/**
 * Mock Test Admin Routes
 *
 * All routes protected by requireAdmin.
 *
 * Mock CRUD:
 *   GET    /admin/mock-tests                                       — list all
 *   POST   /admin/mock-tests                                       — create
 *   GET    /admin/mock-tests/:id                                   — full detail
 *   PUT    /admin/mock-tests/:id                                   — update metadata
 *   DELETE /admin/mock-tests/:id                                   — soft delete
 *
 * Section management:
 *   POST   /admin/mock-tests/:id/sections                         — add section
 *   PUT    /admin/mock-tests/:id/sections/:sid                     — update section
 *   DELETE /admin/mock-tests/:id/sections/:sid                     — delete section
 *
 * Rule management (upsert per section):
 *   PUT    /admin/mock-tests/:id/sections/:sid/rule               — upsert rule
 *
 * Fixed questions (for fixed-type rules):
 *   POST   /admin/mock-tests/:id/sections/:sid/rule/questions      — add question
 *   DELETE /admin/mock-tests/:id/sections/:sid/rule/questions/:qid — remove question
 *
 * Question bank search:
 *   GET    /admin/mock-tests/question-bank/search                  — search question_bank
 *
 * Import:
 *   POST   /admin/mock-tests/import/json                           — import full mock
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
} from "@workspace/db";
import { eq, and, inArray, like, ilike, asc, desc, count } from "drizzle-orm";
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
    ? await db
        .select()
        .from(mockTestSectionRulesTable)
        .where(inArray(mockTestSectionRulesTable.sectionId, sections.map((s) => s.id)))
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
  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(eq(mockTestSectionsTable.mockTestId, mockId));
  const total = sections.reduce(
    (sum, s) => sum + s.questionCount * parseFloat(String(s.marksPerQuestion)),
    0,
  );
  await db
    .update(mockTestsTable)
    .set({ totalMarks: Math.round(total), updatedAt: new Date() })
    .where(eq(mockTestsTable.id, mockId));
}

// ── Mock CRUD ────────────────────────────────────────────────────────────────

router.get("/admin/mock-tests", async (req, res) => {
  const mocks = await db
    .select()
    .from(mockTestsTable)
    .orderBy(desc(mockTestsTable.createdAt));

  const mockIds = mocks.map((m) => m.id);
  const sections = mockIds.length
    ? await db
        .select()
        .from(mockTestSectionsTable)
        .where(inArray(mockTestSectionsTable.mockTestId, mockIds))
    : [];

  const attempts = mockIds.length
    ? await db
        .select({
          mockTestId: mockTestAttemptsTable.mockTestId,
          id: mockTestAttemptsTable.id,
          status: mockTestAttemptsTable.status,
        })
        .from(mockTestAttemptsTable)
        .where(inArray(mockTestAttemptsTable.mockTestId, mockIds))
    : [];

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
});

router.post("/admin/mock-tests", async (req, res) => {
  const parsed = mockCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [mock] = await db.insert(mockTestsTable).values(parsed.data).returning();
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

  const rule = await db
    .select()
    .from(mockTestSectionRulesTable)
    .where(eq(mockTestSectionRulesTable.sectionId, req.params.sid))
    .limit(1);

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

  const existing = await db
    .select()
    .from(mockTestSectionRulesTable)
    .where(eq(mockTestSectionRulesTable.sectionId, req.params.sid))
    .limit(1);

  let rule;
  if (existing[0]) {
    [rule] = await db
      .update(mockTestSectionRulesTable)
      .set(parsed.data)
      .where(eq(mockTestSectionRulesTable.id, existing[0].id))
      .returning();
  } else {
    [rule] = await db
      .insert(mockTestSectionRulesTable)
      .values({ ...parsed.data, sectionId: req.params.sid })
      .returning();
  }

  res.json(rule);
});

// ── Fixed questions ──────────────────────────────────────────────────────────

router.post("/admin/mock-tests/:id/sections/:sid/rule/questions", async (req, res) => {
  const rule = await db
    .select()
    .from(mockTestSectionRulesTable)
    .where(eq(mockTestSectionRulesTable.sectionId, req.params.sid))
    .limit(1);
  if (!rule[0]) { res.status(404).json({ error: "Rule not found for this section" }); return; }

  const schema = z.object({ questionBankId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "questionBankId required" }); return; }

  const existing = await db
    .select({ count: count() })
    .from(mockTestFixedQuestionsTable)
    .where(eq(mockTestFixedQuestionsTable.ruleId, rule[0].id));
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
      id: questionBankTable.id,
      examCode: questionBankTable.examCode,
      subjectCode: questionBankTable.subjectCode,
      topicCode: questionBankTable.topicCode,
      difficulty: questionBankTable.difficulty,
      question: questionBankTable.question,
      source: questionBankTable.source,
      examYear: questionBankTable.examYear,
    })
    .from(questionBankTable)
    .where(and(...conditions))
    .limit(limit);

  res.json(rows);
});

// ── Import JSON ──────────────────────────────────────────────────────────────

const importSchema = z.object({
  name: z.string().min(1),
  examCode: z.string().min(1),
  description: z.string().optional().nullable(),
  mockType: z.enum(["FULL_MOCK", "SUBJECT_TEST", "TOPIC_TEST", "PYQ_TEST"]).default("FULL_MOCK"),
  timeLimitMinutes: z.coerce.number().int().positive().default(60),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  instructions: z.string().optional().nullable(),
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

router.post("/admin/mock-tests/import/json", async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const d = parsed.data;

  const [mock] = await db
    .insert(mockTestsTable)
    .values({
      examCode: d.examCode,
      name: d.name,
      description: d.description,
      mockType: d.mockType,
      timeLimitMinutes: d.timeLimitMinutes,
      difficulty: d.difficulty,
      instructions: d.instructions,
    })
    .returning();

  let totalMarks = 0;

  for (const sec of d.sections) {
    const [section] = await db
      .insert(mockTestSectionsTable)
      .values({
        mockTestId: mock.id,
        name: sec.name,
        subjectCode: sec.subjectCode,
        orderNum: sec.orderNum,
        questionCount: sec.questionCount,
        marksPerQuestion: String(sec.marksPerQuestion),
        negativeMarks: String(sec.negativeMarks),
        timeLimitSeconds: sec.timeLimitSeconds,
      })
      .returning();

    totalMarks += sec.questionCount * sec.marksPerQuestion;

    if (sec.rule) {
      const [rule] = await db
        .insert(mockTestSectionRulesTable)
        .values({
          sectionId: section.id,
          selectionType: sec.rule.selectionType,
          examCode: sec.rule.examCode,
          subjectCode: sec.rule.subjectCode,
          topicCode: sec.rule.topicCode,
          difficulty: sec.rule.difficulty,
          easyCount: sec.rule.easyCount,
          mediumCount: sec.rule.mediumCount,
          hardCount: sec.rule.hardCount,
          randomize: sec.rule.randomize,
          language: sec.rule.language,
        })
        .returning();

      if (sec.rule.selectionType === "fixed" && sec.rule.questionIds?.length) {
        await db.insert(mockTestFixedQuestionsTable).values(
          sec.rule.questionIds.map((qId, i) => ({
            ruleId: rule.id,
            questionBankId: qId,
            orderNum: i + 1,
          })),
        );
      }
    }
  }

  await db.update(mockTestsTable).set({ totalMarks: Math.round(totalMarks) }).where(eq(mockTestsTable.id, mock.id));

  res.status(201).json({ id: mock.id, name: mock.name, sectionCount: d.sections.length, totalMarks: Math.round(totalMarks) });
});

export default router;
