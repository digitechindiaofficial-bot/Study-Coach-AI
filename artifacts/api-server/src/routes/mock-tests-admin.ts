/**
 * Mock Test Admin Routes
 *
 * All routes protected by requireAdmin.
 *
 * Mock CRUD:
 *   GET    /api/admin/mock-tests                  — list all (filterable by status)
 *   POST   /api/admin/mock-tests                  — create (draft by default)
 *   GET    /api/admin/mock-tests/:id              — full detail
 *   PUT    /api/admin/mock-tests/:id              — update metadata
 *   PUT    /api/admin/mock-tests/:id/status       — change status (draft/published/archived)
 *   DELETE /api/admin/mock-tests/:id              — soft delete
 *
 * Section management:
 *   POST   /api/admin/mock-tests/:id/sections
 *   PUT    /api/admin/mock-tests/:id/sections/:sid
 *   DELETE /api/admin/mock-tests/:id/sections/:sid
 *
 * Rule management:
 *   PUT    /api/admin/mock-tests/:id/sections/:sid/rule
 *
 * Fixed questions:
 *   POST   /api/admin/mock-tests/:id/sections/:sid/rule/questions
 *   DELETE /api/admin/mock-tests/:id/sections/:sid/rule/questions/:qid
 *
 * Question bank search:
 *   GET    /api/admin/mock-tests/question-bank/search
 *
 * Import (with full validation):
 *   POST   /api/admin/mock-tests/import/validate  — validate without saving
 *   POST   /api/admin/mock-tests/import/json      — validate + import
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import {
  mockTestsTable,
  mockTestSectionsTable,
  mockTestSectionRulesTable,
  mockTestFixedQuestionsTable,
  mockTestAttemptsTable,
  questionBankTable,
  examPatternsTable,
} from "@workspace/db";
import { eq, and, inArray, ilike, asc, desc, count } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── Admin guard ─────────────────────────────────────────────────────────────

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const adminEmail = process.env.ADMIN_EMAIL;
  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ?? null;
    if (!adminEmail || !email || email.toLowerCase() !== adminEmail.toLowerCase()) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  } catch { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

router.use("/admin/mock-tests", requireAdmin);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getMockWithSections(id: string) {
  const mock = await db.select().from(mockTestsTable).where(eq(mockTestsTable.id, id)).limit(1);
  if (!mock[0]) return null;

  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(eq(mockTestSectionsTable.mockTestId, id))
    .orderBy(asc(mockTestSectionsTable.orderNum));

  const rules = sections.length
    ? await db.select().from(mockTestSectionRulesTable).where(inArray(mockTestSectionRulesTable.sectionId, sections.map((s) => s.id)))
    : [];

  const fixedQs = rules.filter((r) => r.selectionType === "fixed").length
    ? await db
        .select()
        .from(mockTestFixedQuestionsTable)
        .where(inArray(mockTestFixedQuestionsTable.ruleId, rules.map((r) => r.id)))
        .orderBy(asc(mockTestFixedQuestionsTable.orderNum))
    : [];

  const ruleMap = new Map(rules.map((r) => [r.sectionId, r]));
  const fixedMap = new Map<string, typeof mockTestFixedQuestionsTable.$inferSelect[]>();
  for (const fq of fixedQs) {
    const arr = fixedMap.get(fq.ruleId) ?? [];
    arr.push(fq);
    fixedMap.set(fq.ruleId, arr);
  }

  return {
    ...mock[0],
    sections: sections.map((s) => {
      const rule = ruleMap.get(s.id) ?? null;
      return { ...s, rule: rule ? { ...rule, fixedQuestions: fixedMap.get(rule.id) ?? [] } : null };
    }),
  };
}

async function recalcTotalMarks(mockId: string) {
  const sections = await db.select().from(mockTestSectionsTable).where(eq(mockTestSectionsTable.mockTestId, mockId));
  const total = sections.reduce((sum, s) => sum + s.questionCount * parseFloat(String(s.marksPerQuestion)), 0);
  await db.update(mockTestsTable).set({ totalMarks: Math.round(total), updatedAt: new Date() }).where(eq(mockTestsTable.id, mockId));
}

async function autoMockNumber(examCode: string): Promise<number> {
  const existing = await db
    .select({ mockNumber: mockTestsTable.mockNumber })
    .from(mockTestsTable)
    .where(and(eq(mockTestsTable.examCode, examCode), eq(mockTestsTable.isActive, true)))
    .orderBy(desc(mockTestsTable.mockNumber))
    .limit(1);
  return (existing[0]?.mockNumber ?? 0) + 1;
}

// ── Mock CRUD ────────────────────────────────────────────────────────────────

router.get("/admin/mock-tests", async (req, res) => {
  const { status } = req.query as { status?: string };

  const conditions = [eq(mockTestsTable.isActive, true)];
  if (status && ["draft", "published", "archived"].includes(status)) {
    conditions.push(eq(mockTestsTable.status, status));
  }

  const mocks = await db
    .select()
    .from(mockTestsTable)
    .where(and(...conditions))
    .orderBy(asc(mockTestsTable.examCode), asc(mockTestsTable.mockNumber), desc(mockTestsTable.createdAt));

  const mockIds = mocks.map((m) => m.id);

  const [sections, attempts] = await Promise.all([
    mockIds.length ? db.select().from(mockTestSectionsTable).where(inArray(mockTestSectionsTable.mockTestId, mockIds)) : Promise.resolve([]),
    mockIds.length
      ? db
          .select({ mockTestId: mockTestAttemptsTable.mockTestId, status: mockTestAttemptsTable.status })
          .from(mockTestAttemptsTable)
          .where(inArray(mockTestAttemptsTable.mockTestId, mockIds))
      : Promise.resolve([]),
  ]);

  const sectionsByMock = new Map<string, number>();
  for (const s of sections) sectionsByMock.set(s.mockTestId, (sectionsByMock.get(s.mockTestId) ?? 0) + 1);

  const attemptsByMock = new Map<string, number>();
  for (const a of attempts) if (a.status === "submitted") attemptsByMock.set(a.mockTestId, (attemptsByMock.get(a.mockTestId) ?? 0) + 1);

  res.json(
    mocks.map((m) => ({
      ...m,
      sectionCount: sectionsByMock.get(m.id) ?? 0,
      attemptCount: attemptsByMock.get(m.id) ?? 0,
    })),
  );
});

const mockCreateSchema = z.object({
  examCode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  mockType: z.enum(["FULL_MOCK", "SUBJECT_TEST", "TOPIC_TEST", "PYQ_TEST"]).default("FULL_MOCK"),
  timeLimitMinutes: z.coerce.number().int().positive().default(60),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  instructions: z.string().optional().nullable(),
  mockNumber: z.coerce.number().int().positive().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  examPatternId: z.string().uuid().optional().nullable(),
});

router.post("/admin/mock-tests", async (req, res) => {
  const parsed = mockCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const mockNumber = parsed.data.mockNumber ?? await autoMockNumber(parsed.data.examCode);

  const [mock] = await db.insert(mockTestsTable).values({ ...parsed.data, mockNumber }).returning();
  res.status(201).json(mock);
});

router.get("/admin/mock-tests/:id", async (req, res) => {
  const result = await getMockWithSections(req.params.id);
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result);
});

router.put("/admin/mock-tests/:id", async (req, res) => {
  const parsed = mockCreateSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [updated] = await db
    .update(mockTestsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(mockTestsTable.id, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ── Status change ─────────────────────────────────────────────────────────────

router.put("/admin/mock-tests/:id/status", async (req, res) => {
  const schema = z.object({ status: z.enum(["draft", "published", "archived"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "status must be draft, published, or archived" }); return; }

  if (parsed.data.status === "published") {
    const sections = await db
      .select()
      .from(mockTestSectionsTable)
      .where(eq(mockTestSectionsTable.mockTestId, req.params.id));

    if (sections.length === 0) {
      res.status(422).json({ error: "Cannot publish: mock has no sections." });
      return;
    }

    const rules = await db
      .select()
      .from(mockTestSectionRulesTable)
      .where(inArray(mockTestSectionRulesTable.sectionId, sections.map((s) => s.id)));

    const missingSections = sections.filter((s) => !rules.find((r) => r.sectionId === s.id));
    if (missingSections.length > 0) {
      res.status(422).json({ error: `Cannot publish: sections missing rules — ${missingSections.map((s) => s.name).join(", ")}` });
      return;
    }
  }

  const [updated] = await db
    .update(mockTestsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(mockTestsTable.id, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/admin/mock-tests/:id", async (req, res) => {
  const [updated] = await db
    .update(mockTestsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(mockTestsTable.id, req.params.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ deleted: true });
});

// ── Section management ───────────────────────────────────────────────────────

const sectionSchema = z.object({
  name: z.string().min(1),
  subjectCode: z.string().optional().nullable(),
  orderNum: z.coerce.number().int().default(1),
  questionCount: z.coerce.number().int().min(0).default(0),
  marksPerQuestion: z.coerce.number().positive().default(1),
  negativeMarks: z.coerce.number().min(0).default(0),
  timeLimitSeconds: z.coerce.number().int().positive().optional().nullable(),
});

router.post("/admin/mock-tests/:id/sections", async (req, res) => {
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const mock = await db.select().from(mockTestsTable).where(eq(mockTestsTable.id, req.params.id)).limit(1);
  if (!mock[0]) { res.status(404).json({ error: "Mock not found" }); return; }

  const [section] = await db
    .insert(mockTestSectionsTable)
    .values({ ...parsed.data, mockTestId: req.params.id, marksPerQuestion: String(parsed.data.marksPerQuestion), negativeMarks: String(parsed.data.negativeMarks) })
    .returning();

  await recalcTotalMarks(req.params.id);
  res.status(201).json(section);
});

router.put("/admin/mock-tests/:id/sections/:sid", async (req, res) => {
  const parsed = sectionSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.marksPerQuestion !== undefined) update.marksPerQuestion = String(parsed.data.marksPerQuestion);
  if (parsed.data.negativeMarks !== undefined) update.negativeMarks = String(parsed.data.negativeMarks);

  const [updated] = await db
    .update(mockTestSectionsTable)
    .set(update)
    .where(and(eq(mockTestSectionsTable.id, req.params.sid), eq(mockTestSectionsTable.mockTestId, req.params.id)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Section not found" }); return; }
  await recalcTotalMarks(req.params.id);
  res.json(updated);
});

router.delete("/admin/mock-tests/:id/sections/:sid", async (req, res) => {
  const section = await db
    .select()
    .from(mockTestSectionsTable)
    .where(and(eq(mockTestSectionsTable.id, req.params.sid), eq(mockTestSectionsTable.mockTestId, req.params.id)))
    .limit(1);

  if (!section[0]) { res.status(404).json({ error: "Section not found" }); return; }

  const rule = await db.select().from(mockTestSectionRulesTable).where(eq(mockTestSectionRulesTable.sectionId, req.params.sid)).limit(1);
  if (rule[0]) {
    await db.delete(mockTestFixedQuestionsTable).where(eq(mockTestFixedQuestionsTable.ruleId, rule[0].id));
    await db.delete(mockTestSectionRulesTable).where(eq(mockTestSectionRulesTable.id, rule[0].id));
  }

  await db.delete(mockTestSectionsTable).where(eq(mockTestSectionsTable.id, req.params.sid));
  await recalcTotalMarks(req.params.id);
  res.json({ deleted: true });
});

// ── Rule management ──────────────────────────────────────────────────────────

const ruleSchema = z.object({
  selectionType: z.enum(["fixed", "dynamic"]).default("dynamic"),
  examCode: z.string().optional().nullable(),
  subjectCode: z.string().optional().nullable(),
  topicCode: z.string().optional().nullable(),
  difficulty: z.string().optional().nullable(),
  easyCount: z.coerce.number().int().min(0).default(0),
  mediumCount: z.coerce.number().int().min(0).default(0),
  hardCount: z.coerce.number().int().min(0).default(0),
  randomize: z.boolean().default(true),
  language: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

router.put("/admin/mock-tests/:id/sections/:sid/rule", async (req, res) => {
  const section = await db
    .select()
    .from(mockTestSectionsTable)
    .where(and(eq(mockTestSectionsTable.id, req.params.sid), eq(mockTestSectionsTable.mockTestId, req.params.id)))
    .limit(1);
  if (!section[0]) { res.status(404).json({ error: "Section not found" }); return; }

  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await db.select().from(mockTestSectionRulesTable).where(eq(mockTestSectionRulesTable.sectionId, req.params.sid)).limit(1);

  let rule;
  if (existing[0]) {
    [rule] = await db.update(mockTestSectionRulesTable).set(parsed.data).where(eq(mockTestSectionRulesTable.id, existing[0].id)).returning();
  } else {
    [rule] = await db.insert(mockTestSectionRulesTable).values({ ...parsed.data, sectionId: req.params.sid }).returning();
  }

  res.json(rule);
});

// ── Fixed questions ──────────────────────────────────────────────────────────

router.post("/admin/mock-tests/:id/sections/:sid/rule/questions", async (req, res) => {
  const rule = await db.select().from(mockTestSectionRulesTable).where(eq(mockTestSectionRulesTable.sectionId, req.params.sid)).limit(1);
  if (!rule[0]) { res.status(404).json({ error: "Rule not found for this section" }); return; }

  const schema = z.object({ questionBankId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "questionBankId required" }); return; }

  const existing = await db.select({ count: count() }).from(mockTestFixedQuestionsTable).where(eq(mockTestFixedQuestionsTable.ruleId, rule[0].id));
  const nextOrder = (existing[0]?.count ?? 0) + 1;

  const [fq] = await db
    .insert(mockTestFixedQuestionsTable)
    .values({ ruleId: rule[0].id, questionBankId: parsed.data.questionBankId, orderNum: nextOrder })
    .returning();

  res.status(201).json(fq);
});

router.delete("/admin/mock-tests/:id/sections/:sid/rule/questions/:qid", async (req, res) => {
  await db.delete(mockTestFixedQuestionsTable).where(eq(mockTestFixedQuestionsTable.id, req.params.qid));
  res.json({ deleted: true });
});

// ── Question bank search ─────────────────────────────────────────────────────

router.get("/admin/mock-tests/question-bank/search", async (req, res) => {
  const { examCode, subjectCode, topicCode, difficulty, limit: limitParam, q } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(limitParam ?? "20"), 100);

  const conditions = [eq(questionBankTable.isActive, true)];
  if (examCode) conditions.push(eq(questionBankTable.examCode, examCode));
  if (subjectCode) conditions.push(eq(questionBankTable.subjectCode, subjectCode));
  if (topicCode) conditions.push(eq(questionBankTable.topicCode, topicCode));
  if (difficulty) conditions.push(eq(questionBankTable.difficulty, difficulty));
  if (q) conditions.push(ilike(questionBankTable.question, `%${q}%`));

  const rows = await db
    .select({
      id: questionBankTable.id, examCode: questionBankTable.examCode,
      subjectCode: questionBankTable.subjectCode, topicCode: questionBankTable.topicCode,
      difficulty: questionBankTable.difficulty, question: questionBankTable.question,
      source: questionBankTable.source, examYear: questionBankTable.examYear,
    })
    .from(questionBankTable)
    .where(and(...conditions))
    .limit(limit);

  res.json(rows);
});

// ── Import validation ─────────────────────────────────────────────────────────

type ValidationIssue = { section: string; type: string; message: string };

const importSchema = z.object({
  name: z.string().min(1),
  examCode: z.string().min(1),
  description: z.string().optional().nullable(),
  mockType: z.enum(["FULL_MOCK", "SUBJECT_TEST", "TOPIC_TEST", "PYQ_TEST"]).default("FULL_MOCK"),
  timeLimitMinutes: z.coerce.number().int().positive().default(60),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  instructions: z.string().optional().nullable(),
  mockNumber: z.coerce.number().int().positive().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  examPatternId: z.string().uuid().optional().nullable(),
  sections: z.array(
    z.object({
      name: z.string().min(1),
      subjectCode: z.string().optional().nullable(),
      orderNum: z.coerce.number().int().default(1),
      questionCount: z.coerce.number().int().min(0).default(0),
      marksPerQuestion: z.coerce.number().positive().default(1),
      negativeMarks: z.coerce.number().min(0).default(0),
      timeLimitSeconds: z.coerce.number().int().positive().optional().nullable(),
      rule: z.object({
        selectionType: z.enum(["fixed", "dynamic"]).default("dynamic"),
        examCode: z.string().optional().nullable(),
        subjectCode: z.string().optional().nullable(),
        topicCode: z.string().optional().nullable(),
        difficulty: z.string().optional().nullable(),
        easyCount: z.coerce.number().int().min(0).default(0),
        mediumCount: z.coerce.number().int().min(0).default(0),
        hardCount: z.coerce.number().int().min(0).default(0),
        randomize: z.boolean().default(true),
        language: z.string().optional().nullable(),
        questionIds: z.array(z.string().uuid()).optional(),
      }).optional(),
    }),
  ).default([]),
});

type ImportInput = z.infer<typeof importSchema>;

async function validateImport(d: ImportInput): Promise<{ valid: boolean; issues: ValidationIssue[]; warnings: ValidationIssue[] }> {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const allFixedIds: string[] = [];

  for (const [idx, sec] of d.sections.entries()) {
    const secLabel = `Section ${idx + 1} (${sec.name})`;

    if (!sec.rule) {
      issues.push({ section: secLabel, type: "MISSING_RULE", message: "Section has no rule configured" });
      continue;
    }

    if (sec.rule.selectionType === "fixed") {
      const ids = sec.rule.questionIds ?? [];

      if (ids.length === 0) {
        issues.push({ section: secLabel, type: "NO_FIXED_QUESTIONS", message: "Fixed selection rule has no questionIds" });
        continue;
      }
      if (ids.length < sec.questionCount) {
        issues.push({ section: secLabel, type: "INSUFFICIENT_QUESTIONS", message: `Needs ${sec.questionCount} questions but only ${ids.length} provided` });
      }

      const unique = new Set(ids);
      if (unique.size < ids.length) {
        issues.push({ section: secLabel, type: "DUPLICATE_QUESTIONS", message: `${ids.length - unique.size} duplicate question IDs within section` });
      }

      const crossDups = ids.filter((id) => allFixedIds.includes(id));
      if (crossDups.length > 0) {
        issues.push({ section: secLabel, type: "CROSS_SECTION_DUPLICATES", message: `${crossDups.length} question IDs appear in multiple sections` });
      }
      allFixedIds.push(...ids);

      const found = await db
        .select({ id: questionBankTable.id, examCode: questionBankTable.examCode, subjectCode: questionBankTable.subjectCode })
        .from(questionBankTable)
        .where(inArray(questionBankTable.id, [...unique]));

      const foundIds = new Set(found.map((q) => q.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        issues.push({ section: secLabel, type: "MISSING_QUESTIONS", message: `${missing.length} question IDs not found in question bank` });
      }

      for (const q of found) {
        if (d.examCode && q.examCode !== d.examCode) {
          warnings.push({ section: secLabel, type: "EXAM_MISMATCH", message: `Question ${q.id.slice(0, 8)}… has examCode "${q.examCode}", import is "${d.examCode}"` });
        }
        if (sec.subjectCode && q.subjectCode !== sec.subjectCode) {
          warnings.push({ section: secLabel, type: "SUBJECT_MISMATCH", message: `Question ${q.id.slice(0, 8)}… has subjectCode "${q.subjectCode}", section is "${sec.subjectCode}"` });
        }
      }
    } else {
      // Dynamic: check availability
      const ruleExamCode = sec.rule.examCode ?? d.examCode;
      const totalRequired = sec.questionCount;
      const distribTotal = (sec.rule.easyCount ?? 0) + (sec.rule.mediumCount ?? 0) + (sec.rule.hardCount ?? 0);

      if (distribTotal > 0) {
        const checkDiff = async (diff: string, needed: number) => {
          if (needed <= 0) return;
          const conds = [eq(questionBankTable.isActive, true), eq(questionBankTable.examCode, ruleExamCode)];
          if (sec.rule!.subjectCode) conds.push(eq(questionBankTable.subjectCode, sec.rule!.subjectCode));
          conds.push(eq(questionBankTable.difficulty, diff));
          const [{ total }] = await db.select({ total: count() }).from(questionBankTable).where(and(...conds));
          if (total < needed) {
            issues.push({ section: secLabel, type: "INSUFFICIENT_QUESTIONS", message: `Need ${needed} ${diff} questions for ${ruleExamCode}/${sec.rule!.subjectCode ?? "any"}, only ${total} available` });
          }
        };
        await checkDiff("easy", sec.rule.easyCount ?? 0);
        await checkDiff("medium", sec.rule.mediumCount ?? 0);
        await checkDiff("hard", sec.rule.hardCount ?? 0);
      } else {
        const conds = [eq(questionBankTable.isActive, true), eq(questionBankTable.examCode, ruleExamCode)];
        if (sec.rule.subjectCode) conds.push(eq(questionBankTable.subjectCode, sec.rule.subjectCode));
        if (sec.rule.difficulty) conds.push(eq(questionBankTable.difficulty, sec.rule.difficulty));
        const [{ total }] = await db.select({ total: count() }).from(questionBankTable).where(and(...conds));
        if (total < totalRequired) {
          issues.push({ section: secLabel, type: "INSUFFICIENT_QUESTIONS", message: `Need ${totalRequired} questions, only ${total} available matching rule criteria` });
        }
      }
    }
  }

  if (d.examPatternId) {
    const pattern = await db.select().from(examPatternsTable).where(eq(examPatternsTable.id, d.examPatternId)).limit(1);
    if (!pattern[0]) {
      warnings.push({ section: "Meta", type: "PATTERN_NOT_FOUND", message: "examPatternId references a pattern that doesn't exist" });
    } else {
      const totalQ = d.sections.reduce((s, sec) => s + sec.questionCount, 0);
      if (totalQ !== pattern[0].totalQuestions) {
        warnings.push({ section: "Meta", type: "PATTERN_MISMATCH", message: `Total questions ${totalQ} != pattern total ${pattern[0].totalQuestions}` });
      }
    }
  }

  return { valid: issues.length === 0, issues, warnings };
}

router.post("/admin/mock-tests/import/validate", async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const result = await validateImport(parsed.data);
  res.json(result);
});

router.post("/admin/mock-tests/import/json", async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const d = parsed.data;
  const validation = await validateImport(d);
  if (!validation.valid) {
    res.status(422).json({ error: "Import validation failed", issues: validation.issues, warnings: validation.warnings });
    return;
  }

  const mockNumber = d.mockNumber ?? await autoMockNumber(d.examCode);

  const [mock] = await db
    .insert(mockTestsTable)
    .values({
      examCode: d.examCode, name: d.name, description: d.description,
      mockType: d.mockType, timeLimitMinutes: d.timeLimitMinutes,
      difficulty: d.difficulty, instructions: d.instructions,
      mockNumber, status: d.status, examPatternId: d.examPatternId,
    })
    .returning();

  let totalMarks = 0;

  for (const sec of d.sections) {
    const [section] = await db
      .insert(mockTestSectionsTable)
      .values({
        mockTestId: mock.id, name: sec.name, subjectCode: sec.subjectCode,
        orderNum: sec.orderNum, questionCount: sec.questionCount,
        marksPerQuestion: String(sec.marksPerQuestion), negativeMarks: String(sec.negativeMarks),
        timeLimitSeconds: sec.timeLimitSeconds,
      })
      .returning();

    totalMarks += sec.questionCount * sec.marksPerQuestion;

    if (sec.rule) {
      const [rule] = await db
        .insert(mockTestSectionRulesTable)
        .values({
          sectionId: section.id, selectionType: sec.rule.selectionType,
          examCode: sec.rule.examCode, subjectCode: sec.rule.subjectCode,
          topicCode: sec.rule.topicCode, difficulty: sec.rule.difficulty,
          easyCount: sec.rule.easyCount, mediumCount: sec.rule.mediumCount,
          hardCount: sec.rule.hardCount, randomize: sec.rule.randomize, language: sec.rule.language,
        })
        .returning();

      if (sec.rule.selectionType === "fixed" && sec.rule.questionIds?.length) {
        await db.insert(mockTestFixedQuestionsTable).values(
          sec.rule.questionIds.map((qId, i) => ({ ruleId: rule.id, questionBankId: qId, orderNum: i + 1 })),
        );
      }
    }
  }

  await db.update(mockTestsTable).set({ totalMarks: Math.round(totalMarks) }).where(eq(mockTestsTable.id, mock.id));

  res.status(201).json({
    id: mock.id, name: mock.name, mockNumber, status: mock.status,
    sectionCount: d.sections.length, totalMarks: Math.round(totalMarks),
    warnings: validation.warnings,
  });
});

export default router;
