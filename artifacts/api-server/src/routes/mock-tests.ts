/**
 * Mock Test User Routes
 *
 * GET  /api/mock-tests                           — list for user's exam
 * GET  /api/mock-tests/:id                       — metadata + sections (no correct answers)
 * POST /api/mock-tests/:id/attempts              — start attempt (materialize questions)
 * GET  /api/mock-tests/:id/attempts/:aid         — resume state
 * PUT  /api/mock-tests/:id/attempts/:aid         — auto-save responses
 * POST /api/mock-tests/:id/attempts/:aid/submit  — submit + score
 * GET  /api/mock-tests/:id/attempts/:aid/result  — full result with analytics
 */

import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  mockTestsTable,
  mockTestSectionsTable,
  mockTestSectionRulesTable,
  mockTestFixedQuestionsTable,
  mockTestAttemptsTable,
  mockTestAttemptQuestionsTable,
  mockTestResponsesTable,
  questionBankTable,
  profilesTable,
} from "@workspace/db";
import { eq, and, inArray, sql, asc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── Auth helper ─────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response): string | null {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

// ── Materialize questions for an attempt ─────────────────────────────────────

async function materializeSection(
  section: typeof mockTestSectionsTable.$inferSelect,
  rule: typeof mockTestSectionRulesTable.$inferSelect,
): Promise<typeof questionBankTable.$inferSelect[]> {
  if (rule.selectionType === "fixed") {
    const fixedRows = await db
      .select()
      .from(mockTestFixedQuestionsTable)
      .where(eq(mockTestFixedQuestionsTable.ruleId, rule.id))
      .orderBy(asc(mockTestFixedQuestionsTable.orderNum));

    if (fixedRows.length === 0) return [];

    const qIds = fixedRows.map((r) => r.questionBankId);
    const questions = await db
      .select()
      .from(questionBankTable)
      .where(and(inArray(questionBankTable.id, qIds), eq(questionBankTable.isActive, true)));

    const qMap = new Map(questions.map((q) => [q.id, q]));
    return fixedRows.map((r) => qMap.get(r.questionBankId)).filter(Boolean) as typeof questionBankTable.$inferSelect[];
  }

  // Dynamic selection
  const baseConditions = [eq(questionBankTable.isActive, true)];
  if (rule.examCode) baseConditions.push(eq(questionBankTable.examCode, rule.examCode));
  if (rule.subjectCode) baseConditions.push(eq(questionBankTable.subjectCode, rule.subjectCode));
  if (rule.topicCode) baseConditions.push(eq(questionBankTable.topicCode, rule.topicCode));
  if (rule.language) baseConditions.push(eq(questionBankTable.language, rule.language));

  const totalDist = (rule.easyCount ?? 0) + (rule.mediumCount ?? 0) + (rule.hardCount ?? 0);

  if (totalDist > 0) {
    // Fetch by difficulty buckets
    const results: typeof questionBankTable.$inferSelect[] = [];

    const fetchDifficulty = async (diff: string, limit: number) => {
      if (limit <= 0) return;
      const rows = await db
        .select()
        .from(questionBankTable)
        .where(and(...baseConditions, eq(questionBankTable.difficulty, diff)))
        .orderBy(rule.randomize ? sql`RANDOM()` : asc(questionBankTable.createdAt))
        .limit(limit);
      results.push(...rows);
    };

    await fetchDifficulty("easy", rule.easyCount ?? 0);
    await fetchDifficulty("medium", rule.mediumCount ?? 0);
    await fetchDifficulty("hard", rule.hardCount ?? 0);

    if (rule.randomize) {
      for (let i = results.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [results[i], results[j]] = [results[j], results[i]];
      }
    }
    return results;
  }

  // Single difficulty or any
  if (rule.difficulty) baseConditions.push(eq(questionBankTable.difficulty, rule.difficulty));

  const limit = section.questionCount;
  return db
    .select()
    .from(questionBankTable)
    .where(and(...baseConditions))
    .orderBy(rule.randomize ? sql`RANDOM()` : asc(questionBankTable.createdAt))
    .limit(limit);
}

// ── GET /api/mock-tests ──────────────────────────────────────────────────────

router.get("/mock-tests", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await db
    .select({ examType: profilesTable.examType })
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  const examCode = profile[0]?.examType;
  if (!examCode) {
    res.json([]);
    return;
  }

  const mocks = await db
    .select()
    .from(mockTestsTable)
    .where(and(eq(mockTestsTable.examCode, examCode), eq(mockTestsTable.isActive, true)))
    .orderBy(asc(mockTestsTable.createdAt));

  if (mocks.length === 0) {
    res.json([]);
    return;
  }

  const mockIds = mocks.map((m) => m.id);

  // Get best attempt per mock for this user
  const attempts = await db
    .select()
    .from(mockTestAttemptsTable)
    .where(
      and(
        eq(mockTestAttemptsTable.clerkUserId, userId),
        inArray(mockTestAttemptsTable.mockTestId, mockIds),
      ),
    );

  // Get section counts per mock
  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(inArray(mockTestSectionsTable.mockTestId, mockIds));

  const sectionsByMock = new Map<string, typeof mockTestSectionsTable.$inferSelect[]>();
  for (const s of sections) {
    const arr = sectionsByMock.get(s.mockTestId) ?? [];
    arr.push(s);
    sectionsByMock.set(s.mockTestId, arr);
  }

  const result = mocks.map((m) => {
    const mockAttempts = attempts.filter((a) => a.mockTestId === m.id);
    const submitted = mockAttempts.filter((a) => a.status === "submitted");
    const inProgress = mockAttempts.find((a) => a.status === "in_progress");
    const best = submitted.reduce(
      (best, a) => {
        const sc = parseFloat(a.score ?? "0");
        return sc > (best?.sc ?? -1) ? { a, sc } : best;
      },
      null as { a: typeof mockAttempts[0]; sc: number } | null,
    );

    const mockSections = sectionsByMock.get(m.id) ?? [];

    return {
      ...m,
      sections: mockSections.sort((a, b) => a.orderNum - b.orderNum),
      status: inProgress ? "in_progress" : submitted.length > 0 ? "completed" : "not_started",
      inProgressAttemptId: inProgress?.id ?? null,
      bestScore: best ? parseFloat(best.a.score ?? "0") : null,
      bestAccuracy: best ? parseFloat(best.a.accuracy ?? "0") : null,
      attemptCount: submitted.length,
    };
  });

  res.json(result);
});

// ── GET /api/mock-tests/:id ──────────────────────────────────────────────────

router.get("/mock-tests/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const mock = await db
    .select()
    .from(mockTestsTable)
    .where(and(eq(mockTestsTable.id, req.params.id), eq(mockTestsTable.isActive, true)))
    .limit(1);

  if (!mock[0]) {
    res.status(404).json({ error: "Mock test not found" });
    return;
  }

  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(eq(mockTestSectionsTable.mockTestId, mock[0].id))
    .orderBy(asc(mockTestSectionsTable.orderNum));

  const rules = sections.length
    ? await db
        .select()
        .from(mockTestSectionRulesTable)
        .where(inArray(mockTestSectionRulesTable.sectionId, sections.map((s) => s.id)))
    : [];

  const ruleMap = new Map(rules.map((r) => [r.sectionId, r]));

  res.json({
    ...mock[0],
    sections: sections.map((s) => ({ ...s, rule: ruleMap.get(s.id) ?? null })),
  });
});

// ── POST /api/mock-tests/:id/attempts ────────────────────────────────────────

router.post("/mock-tests/:id/attempts", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const mock = await db
    .select()
    .from(mockTestsTable)
    .where(and(eq(mockTestsTable.id, req.params.id), eq(mockTestsTable.isActive, true)))
    .limit(1);

  if (!mock[0]) {
    res.status(404).json({ error: "Mock test not found" });
    return;
  }

  // Check for existing in-progress attempt
  const existing = await db
    .select()
    .from(mockTestAttemptsTable)
    .where(
      and(
        eq(mockTestAttemptsTable.mockTestId, mock[0].id),
        eq(mockTestAttemptsTable.clerkUserId, userId),
        eq(mockTestAttemptsTable.status, "in_progress"),
      ),
    )
    .limit(1);

  if (existing[0]) {
    res.json({ attemptId: existing[0].id, resumed: true });
    return;
  }

  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(eq(mockTestSectionsTable.mockTestId, mock[0].id))
    .orderBy(asc(mockTestSectionsTable.orderNum));

  const rules = sections.length
    ? await db
        .select()
        .from(mockTestSectionRulesTable)
        .where(inArray(mockTestSectionRulesTable.sectionId, sections.map((s) => s.id)))
    : [];

  const ruleMap = new Map(rules.map((r) => [r.sectionId, r]));

  // Create attempt
  const [attempt] = await db
    .insert(mockTestAttemptsTable)
    .values({
      mockTestId: mock[0].id,
      mockTestVersion: mock[0].version,
      clerkUserId: userId,
      examCode: mock[0].examCode,
      status: "in_progress",
      totalMarks: mock[0].totalMarks,
    })
    .returning();

  // Materialize questions for each section
  const attemptQuestions: (typeof mockTestAttemptQuestionsTable.$inferInsert)[] = [];
  let globalOrder = 1;

  for (const section of sections) {
    const rule = ruleMap.get(section.id);
    if (!rule) continue;

    const questions = await materializeSection(section, rule);

    for (const q of questions) {
      attemptQuestions.push({
        attemptId: attempt.id,
        sectionId: section.id,
        questionBankId: q.id,
        orderNum: globalOrder++,
        marks: section.marksPerQuestion,
        negativeMarks: section.negativeMarks,
        subjectCode: q.subjectCode,
        topicCode: q.topicCode,
        difficulty: q.difficulty,
      });
    }
  }

  if (attemptQuestions.length === 0) {
    await db.delete(mockTestAttemptsTable).where(eq(mockTestAttemptsTable.id, attempt.id));
    res.status(422).json({ error: "No questions could be materialized. Check section rules and question bank." });
    return;
  }

  const insertedAQs = await db
    .insert(mockTestAttemptQuestionsTable)
    .values(attemptQuestions)
    .returning();

  // Create blank responses
  await db.insert(mockTestResponsesTable).values(
    insertedAQs.map((aq) => ({
      attemptId: attempt.id,
      attemptQuestionId: aq.id,
      questionBankId: aq.questionBankId,
      sectionId: aq.sectionId,
      subjectCode: aq.subjectCode,
      topicCode: aq.topicCode,
      difficulty: aq.difficulty,
    })),
  );

  res.status(201).json({ attemptId: attempt.id, resumed: false, questionCount: insertedAQs.length });
});

// ── GET /api/mock-tests/:id/attempts/:aid ────────────────────────────────────

router.get("/mock-tests/:id/attempts/:aid", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const attempt = await db
    .select()
    .from(mockTestAttemptsTable)
    .where(
      and(
        eq(mockTestAttemptsTable.id, req.params.aid),
        eq(mockTestAttemptsTable.clerkUserId, userId),
      ),
    )
    .limit(1);

  if (!attempt[0]) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }

  const [mock, attemptQuestions, responses] = await Promise.all([
    db.select().from(mockTestsTable).where(eq(mockTestsTable.id, req.params.id)).limit(1),
    db
      .select()
      .from(mockTestAttemptQuestionsTable)
      .where(eq(mockTestAttemptQuestionsTable.attemptId, req.params.aid))
      .orderBy(asc(mockTestAttemptQuestionsTable.orderNum)),
    db
      .select()
      .from(mockTestResponsesTable)
      .where(eq(mockTestResponsesTable.attemptId, req.params.aid)),
  ]);

  if (!mock[0]) {
    res.status(404).json({ error: "Mock test not found" });
    return;
  }

  // Fetch question content (no correct answers)
  const qIds = attemptQuestions.map((aq) => aq.questionBankId);
  const questions = qIds.length
    ? await db
        .select({
          id: questionBankTable.id,
          question: questionBankTable.question,
          optionA: questionBankTable.optionA,
          optionB: questionBankTable.optionB,
          optionC: questionBankTable.optionC,
          optionD: questionBankTable.optionD,
          difficulty: questionBankTable.difficulty,
          subjectCode: questionBankTable.subjectCode,
          topicCode: questionBankTable.topicCode,
          examYear: questionBankTable.examYear,
        })
        .from(questionBankTable)
        .where(inArray(questionBankTable.id, qIds))
    : [];

  const qMap = new Map(questions.map((q) => [q.id, q]));
  const responseMap = new Map(responses.map((r) => [r.attemptQuestionId, r]));

  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(eq(mockTestSectionsTable.mockTestId, mock[0].id))
    .orderBy(asc(mockTestSectionsTable.orderNum));

  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  const questionsWithContent = attemptQuestions.map((aq) => {
    const q = qMap.get(aq.questionBankId);
    const r = responseMap.get(aq.id);
    return {
      attemptQuestionId: aq.id,
      questionBankId: aq.questionBankId,
      sectionId: aq.sectionId,
      sectionName: sectionMap.get(aq.sectionId)?.name ?? "",
      orderNum: aq.orderNum,
      marks: aq.marks,
      negativeMarks: aq.negativeMarks,
      subjectCode: aq.subjectCode,
      topicCode: aq.topicCode,
      difficulty: aq.difficulty,
      question: q?.question ?? "",
      optionA: q?.optionA ?? "",
      optionB: q?.optionB ?? "",
      optionC: q?.optionC ?? "",
      optionD: q?.optionD ?? "",
      examYear: q?.examYear ?? null,
      selectedOption: r?.selectedOption ?? null,
      isMarkedForReview: r?.isMarkedForReview ?? false,
      timeSpentSeconds: r?.timeSpentSeconds ?? 0,
    };
  });

  res.json({
    attempt: attempt[0],
    mock: { id: mock[0].id, name: mock[0].name, timeLimitMinutes: mock[0].timeLimitMinutes, instructions: mock[0].instructions },
    sections: sections.map((s) => ({ id: s.id, name: s.name, subjectCode: s.subjectCode, orderNum: s.orderNum })),
    questions: questionsWithContent,
  });
});

// ── PUT /api/mock-tests/:id/attempts/:aid ────────────────────────────────────

router.put("/mock-tests/:id/attempts/:aid", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const attempt = await db
    .select()
    .from(mockTestAttemptsTable)
    .where(
      and(
        eq(mockTestAttemptsTable.id, req.params.aid),
        eq(mockTestAttemptsTable.clerkUserId, userId),
        eq(mockTestAttemptsTable.status, "in_progress"),
      ),
    )
    .limit(1);

  if (!attempt[0]) {
    res.status(404).json({ error: "Active attempt not found" });
    return;
  }

  const schema = z.object({
    responses: z.array(
      z.object({
        attemptQuestionId: z.string().uuid(),
        selectedOption: z.enum(["a", "b", "c", "d"]).nullable().optional(),
        isMarkedForReview: z.boolean().optional(),
        timeSpentSeconds: z.number().int().min(0).optional(),
      }),
    ),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  for (const r of parsed.data.responses) {
    const update: Record<string, unknown> = {};
    if (r.selectedOption !== undefined) update.selectedOption = r.selectedOption;
    if (r.isMarkedForReview !== undefined) update.isMarkedForReview = r.isMarkedForReview;
    if (r.timeSpentSeconds !== undefined) update.timeSpentSeconds = r.timeSpentSeconds;
    if (Object.keys(update).length > 0) {
      await db
        .update(mockTestResponsesTable)
        .set(update)
        .where(
          and(
            eq(mockTestResponsesTable.attemptQuestionId, r.attemptQuestionId),
            eq(mockTestResponsesTable.attemptId, req.params.aid),
          ),
        );
    }
  }

  res.json({ saved: parsed.data.responses.length });
});

// ── POST /api/mock-tests/:id/attempts/:aid/submit ────────────────────────────

router.post("/mock-tests/:id/attempts/:aid/submit", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const attempt = await db
    .select()
    .from(mockTestAttemptsTable)
    .where(
      and(
        eq(mockTestAttemptsTable.id, req.params.aid),
        eq(mockTestAttemptsTable.clerkUserId, userId),
        eq(mockTestAttemptsTable.status, "in_progress"),
      ),
    )
    .limit(1);

  if (!attempt[0]) {
    res.status(404).json({ error: "Active attempt not found" });
    return;
  }

  const [responses, attemptQuestions] = await Promise.all([
    db.select().from(mockTestResponsesTable).where(eq(mockTestResponsesTable.attemptId, req.params.aid)),
    db.select().from(mockTestAttemptQuestionsTable).where(eq(mockTestAttemptQuestionsTable.attemptId, req.params.aid)),
  ]);

  const aqMap = new Map(attemptQuestions.map((aq) => [aq.id, aq]));
  const qIds = responses.map((r) => r.questionBankId);
  const questions = qIds.length
    ? await db
        .select({ id: questionBankTable.id, correctAnswer: questionBankTable.correctAnswer })
        .from(questionBankTable)
        .where(inArray(questionBankTable.id, qIds))
    : [];
  const correctMap = new Map(questions.map((q) => [q.id, q.correctAnswer]));

  let score = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  for (const r of responses) {
    const aq = aqMap.get(r.attemptQuestionId);
    const correct = correctMap.get(r.questionBankId);
    const marks = parseFloat(String(aq?.marks ?? "1"));
    const negativeMarks = parseFloat(String(aq?.negativeMarks ?? "0"));

    if (!r.selectedOption) {
      unattemptedCount++;
      await db
        .update(mockTestResponsesTable)
        .set({ isCorrect: null, marksAwarded: "0" })
        .where(eq(mockTestResponsesTable.id, r.id));
    } else if (r.selectedOption === correct) {
      correctCount++;
      score += marks;
      await db
        .update(mockTestResponsesTable)
        .set({ isCorrect: true, marksAwarded: String(marks) })
        .where(eq(mockTestResponsesTable.id, r.id));
    } else {
      incorrectCount++;
      score -= negativeMarks;
      await db
        .update(mockTestResponsesTable)
        .set({ isCorrect: false, marksAwarded: String(-negativeMarks) })
        .where(eq(mockTestResponsesTable.id, r.id));
    }
  }

  const totalMarks = attempt[0].totalMarks ?? 0;
  const accuracy = responses.length > 0 ? (correctCount / responses.length) * 100 : 0;
  const timeTakenSeconds = Math.round((Date.now() - attempt[0].startedAt.getTime()) / 1000);

  await db
    .update(mockTestAttemptsTable)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      score: String(Math.max(0, score)),
      totalMarks,
      timeTakenSeconds,
      correctCount,
      incorrectCount,
      unattemptedCount,
      accuracy: String(accuracy.toFixed(2)),
    })
    .where(eq(mockTestAttemptsTable.id, req.params.aid));

  res.json({ score: Math.max(0, score), totalMarks, correctCount, incorrectCount, unattemptedCount, accuracy: accuracy.toFixed(2) });
});

// ── GET /api/mock-tests/:id/attempts/:aid/result ─────────────────────────────

router.get("/mock-tests/:id/attempts/:aid/result", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const attempt = await db
    .select()
    .from(mockTestAttemptsTable)
    .where(
      and(
        eq(mockTestAttemptsTable.id, req.params.aid),
        eq(mockTestAttemptsTable.clerkUserId, userId),
      ),
    )
    .limit(1);

  if (!attempt[0]) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }

  const [responses, attemptQuestions, mock] = await Promise.all([
    db.select().from(mockTestResponsesTable).where(eq(mockTestResponsesTable.attemptId, req.params.aid)),
    db
      .select()
      .from(mockTestAttemptQuestionsTable)
      .where(eq(mockTestAttemptQuestionsTable.attemptId, req.params.aid))
      .orderBy(asc(mockTestAttemptQuestionsTable.orderNum)),
    db.select().from(mockTestsTable).where(eq(mockTestsTable.id, req.params.id)).limit(1),
  ]);

  const qIds = responses.map((r) => r.questionBankId);
  const questions = qIds.length
    ? await db
        .select()
        .from(questionBankTable)
        .where(inArray(questionBankTable.id, qIds))
    : [];
  const qMap = new Map(questions.map((q) => [q.id, q]));

  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(eq(mockTestSectionsTable.mockTestId, req.params.id))
    .orderBy(asc(mockTestSectionsTable.orderNum));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  const responseMap = new Map(responses.map((r) => [r.attemptQuestionId, r]));
  const aqMap = new Map(attemptQuestions.map((aq) => [aq.id, aq]));

  // Subject-wise analytics
  const subjectStats = new Map<string, { correct: number; incorrect: number; unattempted: number; total: number }>();
  const topicStats = new Map<string, { subjectCode: string; correct: number; incorrect: number; unattempted: number; total: number }>();

  for (const r of responses) {
    const sub = r.subjectCode;
    const top = r.topicCode;

    if (!subjectStats.has(sub)) subjectStats.set(sub, { correct: 0, incorrect: 0, unattempted: 0, total: 0 });
    if (!topicStats.has(top)) topicStats.set(top, { subjectCode: sub, correct: 0, incorrect: 0, unattempted: 0, total: 0 });

    const ss = subjectStats.get(sub)!;
    const ts = topicStats.get(top)!;
    ss.total++;
    ts.total++;

    if (r.isCorrect === true) { ss.correct++; ts.correct++; }
    else if (r.isCorrect === false) { ss.incorrect++; ts.incorrect++; }
    else { ss.unattempted++; ts.unattempted++; }
  }

  const questionDetails = attemptQuestions.map((aq) => {
    const r = responseMap.get(aq.id);
    const q = qMap.get(aq.questionBankId);
    return {
      orderNum: aq.orderNum,
      sectionName: sectionMap.get(aq.sectionId)?.name ?? "",
      subjectCode: aq.subjectCode,
      topicCode: aq.topicCode,
      difficulty: aq.difficulty,
      question: q?.question ?? "",
      optionA: q?.optionA ?? "",
      optionB: q?.optionB ?? "",
      optionC: q?.optionC ?? "",
      optionD: q?.optionD ?? "",
      correctAnswer: q?.correctAnswer ?? "",
      explanation: q?.explanation ?? null,
      selectedOption: r?.selectedOption ?? null,
      isMarkedForReview: r?.isMarkedForReview ?? false,
      isCorrect: r?.isCorrect ?? null,
      marksAwarded: r?.marksAwarded ?? "0",
      timeSpentSeconds: r?.timeSpentSeconds ?? 0,
    };
  });

  res.json({
    attempt: attempt[0],
    mock: mock[0] ?? null,
    subjectWise: Array.from(subjectStats.entries()).map(([subjectCode, s]) => ({
      subjectCode,
      ...s,
      accuracy: s.total > 0 ? parseFloat(((s.correct / s.total) * 100).toFixed(1)) : 0,
    })),
    topicWise: Array.from(topicStats.entries()).map(([topicCode, t]) => ({
      topicCode,
      ...t,
      accuracy: t.total > 0 ? parseFloat(((t.correct / t.total) * 100).toFixed(1)) : 0,
    })),
    questionDetails,
  });
});

export default router;
