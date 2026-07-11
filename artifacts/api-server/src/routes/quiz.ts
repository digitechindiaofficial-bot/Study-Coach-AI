import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  profilesTable,
  quizAttemptsTable,
  questionBankTable,
  questionAttemptsTable,
} from "@workspace/db";
import { eq, sql, SQL } from "drizzle-orm";
import { SubmitQuizAttemptBody, GenerateMcqFromNewsBody } from "@workspace/api-zod";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const FREE_DAILY_LIMIT = 10;

async function getProfileByClerkId(clerkUserId: string) {
  const rows = await db.select().from(profilesTable).where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform a question_bank row → backward-compat shape the frontend expects.
// The frontend was built against quiz_questions: questionText, options jsonb,
// correctOption, subject, topic. We shim those fields here so no UI changes
// are needed.
// ─────────────────────────────────────────────────────────────────────────────
function transformQuestion(row: Record<string, unknown>) {
  return {
    id: row.id,
    examCode: row.exam_code,
    subjectCode: row.subject_code,
    topicCode: row.topic_code,
    difficulty: row.difficulty,
    questionText: row.question,
    options: {
      a: row.option_a,
      b: row.option_b,
      c: row.option_c,
      d: row.option_d,
    },
    correctOption: row.correct_answer,
    explanation: row.explanation,
    source: row.source,
    examYear: row.exam_year,
    language: row.language,
    tags: row.tags,
    subject: null,
    topic: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/questions
// Primary table: question_bank
// Fallback: quiz_questions (legacy, for any questions not yet migrated)
//
// Filters: examCode, subjectCode, topicCode, difficulty, limit, weakOnly, exclude
// Ordering: unseen-first (union of question_attempts + quiz_attempts), then RANDOM()
// Never repeats in session via `exclude` param.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/quiz/questions", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const {
    examCode, subjectCode, topicCode,
    subject, topic, difficulty,
    limit: limitStr, weakOnly, exclude,
  } = req.query as Record<string, string>;

  const limit = Math.min(parseInt(limitStr) || 20, 200);
  const excludeIds = exclude ? exclude.split(",").filter(Boolean) : [];

  const profile = await getProfileByClerkId(userId);
  const profileId = profile?.id ?? null;
  const activeExamCode = examCode || profile?.examType || null;

  // ── Build WHERE fragments ────────────────────────────────────────────────
  const whereParts: SQL[] = [sql`q.is_active = true`];

  if (activeExamCode) {
    whereParts.push(sql`q.exam_code = ${activeExamCode}`);
  }
  if (subjectCode) {
    whereParts.push(sql`q.subject_code = ${subjectCode}`);
  }
  if (topicCode) {
    whereParts.push(sql`q.topic_code = ${topicCode}`);
  }
  if (difficulty) {
    whereParts.push(sql`q.difficulty = ${difficulty}`);
  }
  if (excludeIds.length > 0) {
    whereParts.push(sql`q.id != ALL(${excludeIds}::uuid[])`);
  }

  // ── Weak area prioritisation ─────────────────────────────────────────────
  if (weakOnly === "true" && profileId) {
    const weakResult = await db.execute(sql`
      SELECT qa.topic_code
      FROM question_attempts qa
      WHERE qa.user_id = ${profileId}
        ${activeExamCode ? sql`AND qa.exam_code = ${activeExamCode}` : sql``}
      GROUP BY qa.topic_code
      HAVING COUNT(*) > 0
         AND COUNT(CASE WHEN qa.is_correct THEN 1 END)::float / COUNT(*) < 0.6
    `);
    const weakCodes = (weakResult.rows as Array<{ topic_code: string | null }>)
      .map((r) => r.topic_code)
      .filter(Boolean) as string[];

    if (weakCodes.length === 0) return res.json([]);
    whereParts.push(sql`q.topic_code = ANY(${weakCodes}::text[])`);
  }

  const whereClause = sql`WHERE ${sql.join(whereParts, sql` AND `)}`;

  // ── Unseen-first JOIN ────────────────────────────────────────────────────
  // Union question_attempts (new) + quiz_attempts (legacy) so historical
  // attempt data is respected.
  const unseenJoin = profileId
    ? sql`LEFT JOIN (
        SELECT DISTINCT question_id FROM question_attempts WHERE user_id = ${profileId}
        UNION
        SELECT DISTINCT question_id FROM quiz_attempts WHERE user_id = ${profileId}
      ) _seen ON _seen.question_id = q.id`
    : sql``;

  const orderClause = profileId
    ? sql`CASE WHEN _seen.question_id IS NULL THEN 0 ELSE 1 END, RANDOM()`
    : sql`RANDOM()`;

  const result = await db.execute(sql`
    SELECT q.*
    FROM question_bank q
    ${unseenJoin}
    ${whereClause}
    ORDER BY ${orderClause}
    LIMIT ${limit}
  `);

  const questions = (result.rows as Record<string, unknown>[]).map(transformQuestion);

  if (questions.length < limit) {
    req.log.warn(
      {
        event: "quiz_question_shortage",
        table: "question_bank",
        examCode: activeExamCode,
        subjectCode: subjectCode ?? null,
        topicCode: topicCode ?? null,
        difficulty: difficulty ?? null,
        found: questions.length,
        requested: limit,
      },
      `Quiz pool low: ${questions.length}/${limit} for exam=${activeExamCode} sub=${subjectCode ?? "*"} topic=${topicCode ?? "*"}`,
    );
  }

  res.setHeader("Cache-Control", "no-store");
  res.json(questions);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/attempts
// Verifies the question against question_bank; records in question_attempts.
// Also writes to quiz_attempts for backward compat (stats, streak, etc.).
// ─────────────────────────────────────────────────────────────────────────────
router.post("/quiz/attempts", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const parsed = SubmitQuizAttemptBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error });

  // Daily limit for free plan
  const today = new Date().toISOString().split("T")[0];
  const isCountFresh = profile.quizCountDate === today;
  const currentCount = isCountFresh ? (profile.quizCountToday ?? 0) : 0;

  if (profile.planType === "free" && currentCount >= FREE_DAILY_LIMIT) {
    return res.status(429).json({
      error: "daily_limit_reached",
      questionsLeft: 0,
      message: "You have reached your 10 free questions for today. Upgrade to Pro for unlimited access.",
    });
  }

  // Look up in question_bank first, then fall back to quiz_questions
  let isCorrect = false;
  let examCode: string | null = null;
  let subjectCode: string | null = null;
  let topicCode: string | null = null;

  const bankRows = await db
    .select()
    .from(questionBankTable)
    .where(eq(questionBankTable.id, parsed.data.questionId))
    .limit(1);

  if (!bankRows[0]) return res.status(404).json({ error: "Question not found" });

  const q = bankRows[0];
  isCorrect = q.correctAnswer === parsed.data.selectedOption;
  examCode = q.examCode;
  subjectCode = q.subjectCode;
  topicCode = q.topicCode;

  // Write to question_attempts (new, canonical)
  const [attempt] = await db.insert(questionAttemptsTable).values({
    userId: profile.id,
    questionId: parsed.data.questionId,
    examCode,
    subjectCode,
    topicCode,
    selectedAnswer: parsed.data.selectedOption,
    isCorrect,
    timeTakenSeconds: parsed.data.timeTakenSeconds,
  }).returning();

  // Also write to quiz_attempts (legacy) — keeps streak/plan-limit logic intact
  await db.insert(quizAttemptsTable).values({
    userId: profile.id,
    questionId: parsed.data.questionId,
    selectedOption: parsed.data.selectedOption,
    isCorrect,
    timeTakenSeconds: parsed.data.timeTakenSeconds,
  });

  // Increment daily count
  await db.update(profilesTable)
    .set({ quizCountToday: currentCount + 1, quizCountDate: today })
    .where(eq(profilesTable.clerkUserId, userId));

  res.status(201).json({
    ...attempt,
    questionsLeft: profile.planType === "free" ? FREE_DAILY_LIMIT - currentCount - 1 : null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/stats
// Per-subject stats for the user scoped to their exam.
// Uses question_bank for available counts + question_attempts for accuracy.
// Falls back to quiz_attempts (legacy) for historical attempt data.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/quiz/stats", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { examCode } = req.query as Record<string, string>;
  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.json([]);

  const activeExamCode = examCode || profile.examType || null;

  // Count available questions per subject from question_bank
  const countsResult = await db.execute(sql`
    SELECT subject_code, COUNT(*)::int AS questions_available
    FROM question_bank
    WHERE is_active = true
      ${activeExamCode ? sql`AND exam_code = ${activeExamCode}` : sql``}
    GROUP BY subject_code
  `);

  // Attempt stats from question_attempts (new table)
  const newAttemptsResult = await db.execute(sql`
    SELECT
      subject_code,
      COUNT(id)::int                                              AS total,
      COUNT(CASE WHEN is_correct THEN 1 END)::int                AS correct,
      MAX(attempted_at)::text                                     AS last_practiced
    FROM question_attempts
    WHERE user_id = ${profile.id}
      ${activeExamCode ? sql`AND exam_code = ${activeExamCode}` : sql``}
    GROUP BY subject_code
  `);

  // Legacy attempt stats from quiz_attempts (for historical data pre-migration)
  const legacyAttemptsResult = await db.execute(sql`
    SELECT
      q.subject_code,
      COUNT(qa.id)::int                                           AS total,
      COUNT(CASE WHEN qa.is_correct THEN 1 END)::int             AS correct,
      MAX(qa.attempted_at)::text                                  AS last_practiced
    FROM quiz_attempts qa
    JOIN quiz_questions q ON q.id = qa.question_id
    WHERE qa.user_id = ${profile.id}
      ${activeExamCode ? sql`AND q.exam_code = ${activeExamCode}` : sql``}
    GROUP BY q.subject_code
  `);

  type StatEntry = {
    subjectCode: string;
    totalQuestions: number;
    correct: number;
    accuracy: number;
    lastPracticed: string | null;
    questionsAvailable: number;
  };

  const statMap = new Map<string, StatEntry>();

  // Seed from counts
  for (const row of countsResult.rows as any[]) {
    const key = row.subject_code ?? "Unknown";
    statMap.set(key, {
      subjectCode: key,
      totalQuestions: 0,
      correct: 0,
      accuracy: 0,
      lastPracticed: null,
      questionsAvailable: row.questions_available ?? 0,
    });
  }

  // Apply new attempt stats
  for (const row of newAttemptsResult.rows as any[]) {
    const key = row.subject_code ?? "Unknown";
    const existing = statMap.get(key) ?? { subjectCode: key, totalQuestions: 0, correct: 0, accuracy: 0, lastPracticed: null, questionsAvailable: 0 };
    statMap.set(key, {
      ...existing,
      totalQuestions: existing.totalQuestions + (row.total ?? 0),
      correct: existing.correct + (row.correct ?? 0),
      lastPracticed: row.last_practiced ?? existing.lastPracticed,
    });
  }

  // Merge legacy attempt stats (add to totals without double-counting subjects already counted above)
  for (const row of legacyAttemptsResult.rows as any[]) {
    const key = row.subject_code ?? "Unknown";
    const existing = statMap.get(key) ?? { subjectCode: key, totalQuestions: 0, correct: 0, accuracy: 0, lastPracticed: null, questionsAvailable: 0 };
    statMap.set(key, {
      ...existing,
      totalQuestions: existing.totalQuestions + (row.total ?? 0),
      correct: existing.correct + (row.correct ?? 0),
      lastPracticed: row.last_practiced ?? existing.lastPracticed,
    });
  }

  // Compute accuracy
  const stats = [...statMap.values()].map((s) => ({
    ...s,
    accuracy: s.totalQuestions > 0 ? Math.round((s.correct / s.totalQuestions) * 100) : 0,
  }));

  res.json(stats);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/generate-mcq  (Pro-only, AI-powered)
// Generates on-the-fly MCQs from news; does NOT store to question_bank.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/quiz/generate-mcq", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (profile?.planType === "free") {
    return res.status(403).json({ error: "pro_required", message: "MCQ generation from news is a Pro feature." });
  }

  const parsed = GenerateMcqFromNewsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error });

  const { newsTitle, newsSummary } = parsed.data;

  const prompt = `Based on this current affairs item:
Title: ${newsTitle}
Summary: ${newsSummary}

Generate 2 MCQ questions as would appear in SSC/Banking exams.
Return ONLY valid JSON array, no markdown:
[
  {
    "question": "<question text>",
    "options": {"a": "...", "b": "...", "c": "...", "d": "..."},
    "correct": "a|b|c|d",
    "explanation": "<why this answer is correct>"
  }
]`;

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const text = response.text ?? "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    res.json(JSON.parse(cleaned));
  } catch {
    res.status(500).json({ error: "Failed to generate MCQs" });
  }
});

export default router;
