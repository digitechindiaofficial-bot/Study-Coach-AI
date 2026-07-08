/**
 * Mock Test User Routes
 *
 * GET  /api/mock-tests                           — published mocks for user's exam
 * GET  /api/mock-tests/stats                     — dashboard aggregate stats
 * GET  /api/mock-tests/history                   — all submitted attempts across mocks
 * GET  /api/mock-tests/:id                       — metadata + sections (no correct answers)
 * POST /api/mock-tests/:id/attempts              — start/resume attempt
 * GET  /api/mock-tests/:id/attempts/:aid         — resume state
 * PUT  /api/mock-tests/:id/attempts/:aid         — auto-save responses
 * POST /api/mock-tests/:id/attempts/:aid/submit  — submit + score + store analytics
 * GET  /api/mock-tests/:id/attempts/:aid/result  — full result from stored analytics
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
  mockTestResultAnalyticsTable,
  questionBankTable,
  profilesTable,
} from "@workspace/db";
import { eq, and, inArray, sql, asc, desc, avg, max, count } from "drizzle-orm";
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

  if (rule.difficulty) baseConditions.push(eq(questionBankTable.difficulty, rule.difficulty));
  return db
    .select()
    .from(questionBankTable)
    .where(and(...baseConditions))
    .orderBy(rule.randomize ? sql`RANDOM()` : asc(questionBankTable.createdAt))
    .limit(section.questionCount);
}

// ── GET /api/mock-tests/stats ─────────────────────────────────────────────────

router.get("/mock-tests/stats", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const [analytics, attempts] = await Promise.all([
    db
      .select()
      .from(mockTestResultAnalyticsTable)
      .where(eq(mockTestResultAnalyticsTable.clerkUserId, userId))
      .orderBy(desc(mockTestResultAnalyticsTable.createdAt)),
    db
      .select()
      .from(mockTestAttemptsTable)
      .where(
        and(
          eq(mockTestAttemptsTable.clerkUserId, userId),
          eq(mockTestAttemptsTable.status, "submitted"),
        ),
      )
      .orderBy(desc(mockTestAttemptsTable.submittedAt))
      .limit(1),
  ]);

  if (analytics.length === 0) {
    res.json({ mocksAttempted: 0, avgScore: 0, avgAccuracy: 0, bestScore: 0, latestMock: null, weakSubject: null, strongSubject: null });
    return;
  }

  const scores = analytics.map((a) => parseFloat(String(a.score)));
  const totalMarksArr = analytics.map((a) => a.totalMarks);
  const accuracies = analytics.map((a) => parseFloat(String(a.accuracy)));
  const avgScore = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
  const avgAccuracy = accuracies.length ? accuracies.reduce((s, v) => s + v, 0) / accuracies.length : 0;
  const bestIdx = scores.reduce((bi, v, i) => (v > scores[bi] ? i : bi), 0);
  const bestScore = scores[bestIdx];
  const bestTotalMarks = totalMarksArr[bestIdx];

  // Subject aggregates across all attempts
  const subjectMap = new Map<string, { correct: number; total: number }>();
  for (const a of analytics) {
    const sw = a.subjectWise as Array<{ code: string; correct: number; total: number }> | null;
    if (!sw) continue;
    for (const s of sw) {
      const prev = subjectMap.get(s.code) ?? { correct: 0, total: 0 };
      subjectMap.set(s.code, { correct: prev.correct + s.correct, total: prev.total + s.total });
    }
  }

  let weakSubject: string | null = null;
  let strongSubject: string | null = null;
  let minAcc = Infinity;
  let maxAcc = -Infinity;

  for (const [code, { correct, total }] of subjectMap) {
    if (total === 0) continue;
    const acc = correct / total;
    if (acc < minAcc) { minAcc = acc; weakSubject = code; }
    if (acc > maxAcc) { maxAcc = acc; strongSubject = code; }
  }

  // Latest mock info
  let latestMock = null;
  if (attempts[0]) {
    const mock = await db
      .select({ id: mockTestsTable.id, name: mockTestsTable.name })
      .from(mockTestsTable)
      .where(eq(mockTestsTable.id, attempts[0].mockTestId))
      .limit(1);
    if (mock[0]) {
      latestMock = {
        id: mock[0].id,
        name: mock[0].name,
        score: parseFloat(String(attempts[0].score ?? "0")),
        totalMarks: attempts[0].totalMarks,
        accuracy: parseFloat(String(attempts[0].accuracy ?? "0")),
        attemptId: attempts[0].id,
        date: attempts[0].submittedAt,
      };
    }
  }

  res.json({
    mocksAttempted: analytics.length,
    avgScore: Math.round(avgScore * 100) / 100,
    avgAccuracy: Math.round(avgAccuracy * 100) / 100,
    bestScore,
    bestTotalMarks,
    weakSubject,
    strongSubject,
    latestMock,
  });
});

// ── GET /api/mock-tests/history ───────────────────────────────────────────────

router.get("/mock-tests/history", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const attempts = await db
    .select()
    .from(mockTestAttemptsTable)
    .where(
      and(
        eq(mockTestAttemptsTable.clerkUserId, userId),
        eq(mockTestAttemptsTable.status, "submitted"),
      ),
    )
    .orderBy(desc(mockTestAttemptsTable.submittedAt));

  if (attempts.length === 0) { res.json([]); return; }

  const mockIds = [...new Set(attempts.map((a) => a.mockTestId))];
  const mocks = await db
    .select({ id: mockTestsTable.id, name: mockTestsTable.name, examCode: mockTestsTable.examCode, mockNumber: mockTestsTable.mockNumber, totalMarks: mockTestsTable.totalMarks })
    .from(mockTestsTable)
    .where(inArray(mockTestsTable.id, mockIds));
  const mockMap = new Map(mocks.map((m) => [m.id, m]));

  res.json(
    attempts.map((a) => {
      const mock = mockMap.get(a.mockTestId);
      return {
        attemptId: a.id,
        mockTestId: a.mockTestId,
        mockName: mock?.name ?? "Unknown",
        mockNumber: mock?.mockNumber ?? 1,
        examCode: a.examCode,
        score: parseFloat(String(a.score ?? "0")),
        totalMarks: a.totalMarks,
        accuracy: parseFloat(String(a.accuracy ?? "0")),
        correctCount: a.correctCount,
        incorrectCount: a.incorrectCount,
        unattemptedCount: a.unattemptedCount,
        timeTakenSeconds: a.timeTakenSeconds,
        submittedAt: a.submittedAt,
        rank: null,
      };
    }),
  );
});

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
  if (!examCode) { res.json([]); return; }

  // Only published mocks visible to students
  const mocks = await db
    .select()
    .from(mockTestsTable)
    .where(
      and(
        eq(mockTestsTable.examCode, examCode),
        eq(mockTestsTable.isActive, true),
        eq(mockTestsTable.status, "published"),
      ),
    )
    .orderBy(asc(mockTestsTable.mockNumber), asc(mockTestsTable.createdAt));

  if (mocks.length === 0) { res.json([]); return; }

  const mockIds = mocks.map((m) => m.id);

  const [attempts, sections] = await Promise.all([
    db.select().from(mockTestAttemptsTable).where(
      and(eq(mockTestAttemptsTable.clerkUserId, userId), inArray(mockTestAttemptsTable.mockTestId, mockIds)),
    ),
    db.select().from(mockTestSectionsTable).where(inArray(mockTestSectionsTable.mockTestId, mockIds)),
  ]);

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
      (b, a) => {
        const sc = parseFloat(String(a.score ?? "0"));
        return sc > (b?.sc ?? -1) ? { a, sc } : b;
      },
      null as { a: typeof mockAttempts[0]; sc: number } | null,
    );

    return {
      ...m,
      sections: (sectionsByMock.get(m.id) ?? []).sort((a, b) => a.orderNum - b.orderNum),
      userStatus: inProgress ? "in_progress" : submitted.length > 0 ? "completed" : "not_started",
      inProgressAttemptId: inProgress?.id ?? null,
      bestScore: best ? parseFloat(String(best.a.score ?? "0")) : null,
      bestAccuracy: best ? parseFloat(String(best.a.accuracy ?? "0")) : null,
      attemptCount: submitted.length,
      lastAttemptAt: submitted.sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime())[0]?.submittedAt ?? null,
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

  if (!mock[0]) { res.status(404).json({ error: "Mock test not found" }); return; }

  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(eq(mockTestSectionsTable.mockTestId, mock[0].id))
    .orderBy(asc(mockTestSectionsTable.orderNum));

  const rules = sections.length
    ? await db.select().from(mockTestSectionRulesTable).where(inArray(mockTestSectionRulesTable.sectionId, sections.map((s) => s.id)))
    : [];

  const ruleMap = new Map(rules.map((r) => [r.sectionId, r]));
  res.json({ ...mock[0], sections: sections.map((s) => ({ ...s, rule: ruleMap.get(s.id) ?? null })) });
});

// ── POST /api/mock-tests/:id/attempts ────────────────────────────────────────

router.post("/mock-tests/:id/attempts", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const mock = await db
    .select()
    .from(mockTestsTable)
    .where(and(eq(mockTestsTable.id, req.params.id), eq(mockTestsTable.isActive, true), eq(mockTestsTable.status, "published")))
    .limit(1);

  if (!mock[0]) { res.status(404).json({ error: "Mock test not found or not available" }); return; }

  // Resume existing in-progress
  const existing = await db
    .select()
    .from(mockTestAttemptsTable)
    .where(and(eq(mockTestAttemptsTable.mockTestId, mock[0].id), eq(mockTestAttemptsTable.clerkUserId, userId), eq(mockTestAttemptsTable.status, "in_progress")))
    .limit(1);

  if (existing[0]) { res.json({ attemptId: existing[0].id, resumed: true }); return; }

  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(eq(mockTestSectionsTable.mockTestId, mock[0].id))
    .orderBy(asc(mockTestSectionsTable.orderNum));

  const rules = sections.length
    ? await db.select().from(mockTestSectionRulesTable).where(inArray(mockTestSectionRulesTable.sectionId, sections.map((s) => s.id)))
    : [];
  const ruleMap = new Map(rules.map((r) => [r.sectionId, r]));

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

  const insertedAQs = await db.insert(mockTestAttemptQuestionsTable).values(attemptQuestions).returning();

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
    .where(and(eq(mockTestAttemptsTable.id, req.params.aid), eq(mockTestAttemptsTable.clerkUserId, userId)))
    .limit(1);

  if (!attempt[0]) { res.status(404).json({ error: "Attempt not found" }); return; }

  const [mock, attemptQuestions, responses] = await Promise.all([
    db.select().from(mockTestsTable).where(eq(mockTestsTable.id, req.params.id)).limit(1),
    db.select().from(mockTestAttemptQuestionsTable).where(eq(mockTestAttemptQuestionsTable.attemptId, req.params.aid)).orderBy(asc(mockTestAttemptQuestionsTable.orderNum)),
    db.select().from(mockTestResponsesTable).where(eq(mockTestResponsesTable.attemptId, req.params.aid)),
  ]);

  if (!mock[0]) { res.status(404).json({ error: "Mock test not found" }); return; }

  const qIds = attemptQuestions.map((aq) => aq.questionBankId);
  const questions = qIds.length
    ? await db
        .select({
          id: questionBankTable.id, question: questionBankTable.question,
          optionA: questionBankTable.optionA, optionB: questionBankTable.optionB,
          optionC: questionBankTable.optionC, optionD: questionBankTable.optionD,
          difficulty: questionBankTable.difficulty, subjectCode: questionBankTable.subjectCode,
          topicCode: questionBankTable.topicCode, examYear: questionBankTable.examYear,
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
      attemptQuestionId: aq.id, questionBankId: aq.questionBankId,
      sectionId: aq.sectionId, sectionName: sectionMap.get(aq.sectionId)?.name ?? "",
      orderNum: aq.orderNum, marks: aq.marks, negativeMarks: aq.negativeMarks,
      subjectCode: aq.subjectCode, topicCode: aq.topicCode, difficulty: aq.difficulty,
      question: q?.question ?? "", optionA: q?.optionA ?? "",
      optionB: q?.optionB ?? "", optionC: q?.optionC ?? "", optionD: q?.optionD ?? "",
      examYear: q?.examYear ?? null,
      selectedOption: r?.selectedOption ?? null,
      isMarkedForReview: r?.isMarkedForReview ?? false,
      timeSpentSeconds: r?.timeSpentSeconds ?? 0,
    };
  });

  res.json({
    attempt: attempt[0],
    mock: { id: mock[0].id, name: mock[0].name, mockNumber: mock[0].mockNumber, timeLimitMinutes: mock[0].timeLimitMinutes, instructions: mock[0].instructions },
    sections: sections.map((s) => ({ id: s.id, name: s.name, subjectCode: s.subjectCode, orderNum: s.orderNum, marksPerQuestion: s.marksPerQuestion, negativeMarks: s.negativeMarks, questionCount: s.questionCount })),
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
    .where(and(eq(mockTestAttemptsTable.id, req.params.aid), eq(mockTestAttemptsTable.clerkUserId, userId), eq(mockTestAttemptsTable.status, "in_progress")))
    .limit(1);

  if (!attempt[0]) { res.status(404).json({ error: "Active attempt not found" }); return; }

  const schema = z.object({
    responses: z.array(z.object({
      attemptQuestionId: z.string().uuid(),
      selectedOption: z.enum(["a", "b", "c", "d"]).nullable().optional(),
      isMarkedForReview: z.boolean().optional(),
      timeSpentSeconds: z.number().int().min(0).optional(),
    })),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  for (const r of parsed.data.responses) {
    const update: Record<string, unknown> = {};
    if (r.selectedOption !== undefined) update.selectedOption = r.selectedOption;
    if (r.isMarkedForReview !== undefined) update.isMarkedForReview = r.isMarkedForReview;
    if (r.timeSpentSeconds !== undefined) update.timeSpentSeconds = r.timeSpentSeconds;
    if (Object.keys(update).length > 0) {
      await db
        .update(mockTestResponsesTable)
        .set(update)
        .where(and(eq(mockTestResponsesTable.attemptQuestionId, r.attemptQuestionId), eq(mockTestResponsesTable.attemptId, req.params.aid)));
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
    .where(and(eq(mockTestAttemptsTable.id, req.params.aid), eq(mockTestAttemptsTable.clerkUserId, userId), eq(mockTestAttemptsTable.status, "in_progress")))
    .limit(1);

  if (!attempt[0]) { res.status(404).json({ error: "Active attempt not found" }); return; }

  const [responses, attemptQuestions] = await Promise.all([
    db.select().from(mockTestResponsesTable).where(eq(mockTestResponsesTable.attemptId, req.params.aid)),
    db.select().from(mockTestAttemptQuestionsTable).where(eq(mockTestAttemptQuestionsTable.attemptId, req.params.aid)),
  ]);

  const qIds = responses.map((r) => r.questionBankId);
  const questions = qIds.length
    ? await db.select().from(questionBankTable).where(inArray(questionBankTable.id, qIds))
    : [];

  const correctMap = new Map(questions.map((q) => [q.id, q.correctAnswer]));
  const aqMap = new Map(attemptQuestions.map((aq) => [aq.id, aq]));

  const sections = await db
    .select()
    .from(mockTestSectionsTable)
    .where(eq(mockTestSectionsTable.mockTestId, req.params.id))
    .orderBy(asc(mockTestSectionsTable.orderNum));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  // ── Score each response ───────────────────────────────────────────────────
  type SubjectStat = { name: string; correct: number; incorrect: number; unattempted: number; total: number; marksEarned: number; negativeMarksTotal: number };
  type SectionStat = { name: string; correct: number; incorrect: number; unattempted: number; total: number; marksEarned: number; negativeMarksTotal: number };
  type TopicStat = { subjectCode: string; correct: number; incorrect: number; unattempted: number; total: number };

  const subjectStats = new Map<string, SubjectStat>();
  const sectionStats = new Map<string, SectionStat>();
  const topicStats = new Map<string, TopicStat>();
  const questionTimeMap: Record<string, number> = {};

  let score = 0;
  let totalNegativeMarks = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let markedForReviewCount = 0;
  let totalTimeSeconds = 0;

  const responseUpdates: Array<{ id: string; isCorrect: boolean | null; marksAwarded: string }> = [];

  for (const r of responses) {
    const aq = aqMap.get(r.attemptQuestionId);
    const correct = correctMap.get(r.questionBankId);
    const marks = parseFloat(String(aq?.marks ?? "1"));
    const negativeMarks = parseFloat(String(aq?.negativeMarks ?? "0"));
    const sub = r.subjectCode ?? "UNKNOWN";
    const sec = r.sectionId;
    const top = r.topicCode ?? "UNKNOWN";
    const timeSpent = r.timeSpentSeconds ?? 0;

    totalTimeSeconds += timeSpent;
    questionTimeMap[r.attemptQuestionId] = timeSpent;
    if (r.isMarkedForReview) markedForReviewCount++;

    // Init stats
    if (!subjectStats.has(sub)) subjectStats.set(sub, { name: sub, correct: 0, incorrect: 0, unattempted: 0, total: 0, marksEarned: 0, negativeMarksTotal: 0 });
    if (!sectionStats.has(sec)) sectionStats.set(sec, { name: sectionMap.get(sec)?.name ?? sec, correct: 0, incorrect: 0, unattempted: 0, total: 0, marksEarned: 0, negativeMarksTotal: 0 });
    if (!topicStats.has(top)) topicStats.set(top, { subjectCode: sub, correct: 0, incorrect: 0, unattempted: 0, total: 0 });

    const ss = subjectStats.get(sub)!;
    const sec_ = sectionStats.get(sec)!;
    const ts = topicStats.get(top)!;
    ss.total++; sec_.total++; ts.total++;

    if (!r.selectedOption) {
      unattemptedCount++;
      ss.unattempted++; sec_.unattempted++; ts.unattempted++;
      responseUpdates.push({ id: r.id, isCorrect: null, marksAwarded: "0" });
    } else if (r.selectedOption === correct) {
      correctCount++;
      score += marks;
      ss.correct++; sec_.correct++; ts.correct++;
      ss.marksEarned += marks; sec_.marksEarned += marks;
      responseUpdates.push({ id: r.id, isCorrect: true, marksAwarded: String(marks) });
    } else {
      incorrectCount++;
      totalNegativeMarks += negativeMarks;
      score -= negativeMarks;
      ss.incorrect++; sec_.incorrect++; ts.incorrect++;
      ss.negativeMarksTotal += negativeMarks; sec_.negativeMarksTotal += negativeMarks;
      responseUpdates.push({ id: r.id, isCorrect: false, marksAwarded: String(-negativeMarks) });
    }
  }

  const finalScore = Math.max(0, score);
  const totalMarks = attempt[0].totalMarks ?? 0;
  const accuracy = responses.length > 0 ? (correctCount / responses.filter((r) => !!r.selectedOption).length) * 100 : 0;
  const safeAccuracy = isNaN(accuracy) ? 0 : accuracy;
  const timeTakenSeconds = totalTimeSeconds || Math.round((Date.now() - attempt[0].startedAt.getTime()) / 1000);

  // ── Persist response scores ───────────────────────────────────────────────
  await Promise.all(
    responseUpdates.map((u) =>
      db.update(mockTestResponsesTable).set({ isCorrect: u.isCorrect, marksAwarded: u.marksAwarded }).where(eq(mockTestResponsesTable.id, u.id)),
    ),
  );

  // ── Update attempt ────────────────────────────────────────────────────────
  await db.update(mockTestAttemptsTable).set({
    status: "submitted",
    submittedAt: new Date(),
    score: String(finalScore),
    totalMarks,
    timeTakenSeconds,
    correctCount,
    incorrectCount,
    unattemptedCount,
    accuracy: String(safeAccuracy.toFixed(2)),
  }).where(eq(mockTestAttemptsTable.id, req.params.aid));

  // ── Build structured analytics ────────────────────────────────────────────
  const subjectWise = Array.from(subjectStats.entries()).map(([code, s]) => ({
    code,
    name: s.name,
    total: s.total,
    correct: s.correct,
    incorrect: s.incorrect,
    unattempted: s.unattempted,
    accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 10000) / 100 : 0,
    marksEarned: s.marksEarned,
    negativeMarks: s.negativeMarksTotal,
  }));

  const sectionWise = Array.from(sectionStats.entries()).map(([id, s]) => ({
    id,
    name: s.name,
    total: s.total,
    correct: s.correct,
    incorrect: s.incorrect,
    unattempted: s.unattempted,
    accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 10000) / 100 : 0,
    marksEarned: s.marksEarned,
    negativeMarks: s.negativeMarksTotal,
  }));

  const topicWise = Array.from(topicStats.entries()).map(([code, t]) => ({
    code,
    subjectCode: t.subjectCode,
    total: t.total,
    correct: t.correct,
    incorrect: t.incorrect,
    unattempted: t.unattempted,
    accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 10000) / 100 : 0,
  }));

  // ── Store analytics permanently ───────────────────────────────────────────
  await db
    .insert(mockTestResultAnalyticsTable)
    .values({
      attemptId: req.params.aid,
      mockTestId: req.params.id,
      clerkUserId: userId,
      subjectWise,
      sectionWise,
      topicWise,
      questionTimeMap,
      totalTimeSeconds: timeTakenSeconds,
      correctCount,
      incorrectCount,
      unattemptedCount,
      markedForReviewCount,
      totalNegativeMarks: String(totalNegativeMarks.toFixed(2)),
      score: String(finalScore.toFixed(2)),
      totalMarks,
      accuracy: String(safeAccuracy.toFixed(2)),
    })
    .onConflictDoNothing();

  res.json({ score: finalScore, totalMarks, correctCount, incorrectCount, unattemptedCount, accuracy: safeAccuracy.toFixed(2), timeTakenSeconds });
});

// ── GET /api/mock-tests/:id/attempts/:aid/result ─────────────────────────────

router.get("/mock-tests/:id/attempts/:aid/result", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const [attempt, storedAnalytics] = await Promise.all([
    db.select().from(mockTestAttemptsTable).where(and(eq(mockTestAttemptsTable.id, req.params.aid), eq(mockTestAttemptsTable.clerkUserId, userId))).limit(1),
    db.select().from(mockTestResultAnalyticsTable).where(eq(mockTestResultAnalyticsTable.attemptId, req.params.aid)).limit(1),
  ]);

  if (!attempt[0]) { res.status(404).json({ error: "Attempt not found" }); return; }

  const [mock, attemptQuestions] = await Promise.all([
    db.select().from(mockTestsTable).where(eq(mockTestsTable.id, req.params.id)).limit(1),
    db.select().from(mockTestAttemptQuestionsTable).where(eq(mockTestAttemptQuestionsTable.attemptId, req.params.aid)).orderBy(asc(mockTestAttemptQuestionsTable.orderNum)),
  ]);

  if (!mock[0]) { res.status(404).json({ error: "Mock test not found" }); return; }

  // Fetch question content + correct answers for review
  const qIds = attemptQuestions.map((aq) => aq.questionBankId);
  const [questions, responses, sections] = await Promise.all([
    qIds.length ? db.select().from(questionBankTable).where(inArray(questionBankTable.id, qIds)) : Promise.resolve([]),
    db.select().from(mockTestResponsesTable).where(eq(mockTestResponsesTable.attemptId, req.params.aid)),
    db.select().from(mockTestSectionsTable).where(eq(mockTestSectionsTable.mockTestId, req.params.id)).orderBy(asc(mockTestSectionsTable.orderNum)),
  ]);

  const qMap = new Map(questions.map((q) => [q.id, q]));
  const responseMap = new Map(responses.map((r) => [r.attemptQuestionId, r]));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  const questionDetails = attemptQuestions.map((aq) => {
    const q = qMap.get(aq.questionBankId);
    const r = responseMap.get(aq.id);
    return {
      attemptQuestionId: aq.id, questionBankId: aq.questionBankId,
      sectionId: aq.sectionId, sectionName: sectionMap.get(aq.sectionId)?.name ?? "",
      orderNum: aq.orderNum, marks: aq.marks, negativeMarks: aq.negativeMarks,
      subjectCode: aq.subjectCode, topicCode: aq.topicCode, difficulty: aq.difficulty,
      question: q?.question ?? "", optionA: q?.optionA ?? "",
      optionB: q?.optionB ?? "", optionC: q?.optionC ?? "", optionD: q?.optionD ?? "",
      correctAnswer: q?.correctAnswer ?? null, explanation: q?.explanation ?? null,
      examYear: q?.examYear ?? null,
      selectedOption: r?.selectedOption ?? null,
      isCorrect: r?.isCorrect ?? null,
      marksAwarded: r?.marksAwarded ?? "0",
      isMarkedForReview: r?.isMarkedForReview ?? false,
      timeSpentSeconds: r?.timeSpentSeconds ?? 0,
    };
  });

  // Use stored analytics if available, fall back to attempt columns
  const analytics = storedAnalytics[0];

  res.json({
    attempt: attempt[0],
    mock: { id: mock[0].id, name: mock[0].name, mockNumber: mock[0].mockNumber, examCode: mock[0].examCode, totalMarks: mock[0].totalMarks },
    analytics: analytics
      ? {
          subjectWise: analytics.subjectWise,
          sectionWise: analytics.sectionWise,
          topicWise: analytics.topicWise,
          questionTimeMap: analytics.questionTimeMap,
          totalTimeSeconds: analytics.totalTimeSeconds,
          correctCount: analytics.correctCount,
          incorrectCount: analytics.incorrectCount,
          unattemptedCount: analytics.unattemptedCount,
          markedForReviewCount: analytics.markedForReviewCount,
          totalNegativeMarks: parseFloat(String(analytics.totalNegativeMarks)),
          score: parseFloat(String(analytics.score)),
          totalMarks: analytics.totalMarks,
          accuracy: parseFloat(String(analytics.accuracy)),
          rank: analytics.rank,
          totalAttempts: analytics.totalAttempts,
        }
      : {
          // Legacy fallback
          subjectWise: [], sectionWise: [], topicWise: [], questionTimeMap: {},
          totalTimeSeconds: attempt[0].timeTakenSeconds ?? 0,
          correctCount: attempt[0].correctCount ?? 0,
          incorrectCount: attempt[0].incorrectCount ?? 0,
          unattemptedCount: attempt[0].unattemptedCount ?? 0,
          markedForReviewCount: 0, totalNegativeMarks: 0,
          score: parseFloat(String(attempt[0].score ?? "0")),
          totalMarks: attempt[0].totalMarks ?? 0,
          accuracy: parseFloat(String(attempt[0].accuracy ?? "0")),
          rank: null, totalAttempts: null,
        },
    questionDetails,
    sections: sections.map((s) => ({ id: s.id, name: s.name, subjectCode: s.subjectCode, orderNum: s.orderNum })),
  });
});

export default router;
