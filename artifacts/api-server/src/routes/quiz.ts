import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable, quizQuestionsTable, quizAttemptsTable } from "@workspace/db";
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

// GET /api/quiz/questions
// Filters: examCode, subjectCode, topicCode (code-based, preferred)
//          subject, topic (legacy text-based, fallback)
//          difficulty, limit, weakOnly, exclude
// Ordering: unseen questions (never attempted by this user) first, then RANDOM()
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

  // Resolve active exam: explicit param → profile's selected exam
  const activeExamCode = examCode || profile?.examType || null;

  // Build SQL WHERE fragments
  const whereParts: SQL[] = [];

  if (activeExamCode) {
    whereParts.push(sql`q.exam_code = ${activeExamCode}`);
  }

  // Prefer code-based filtering; fall back to legacy text for old questions
  if (subjectCode) {
    whereParts.push(sql`q.subject_code = ${subjectCode}`);
  } else if (subject) {
    whereParts.push(sql`q.subject = ${subject}`);
  }

  if (topicCode) {
    whereParts.push(sql`q.topic_code = ${topicCode}`);
  } else if (topic) {
    whereParts.push(sql`q.topic = ${topic}`);
  }

  if (difficulty) {
    whereParts.push(sql`q.difficulty = ${difficulty}`);
  }

  if (excludeIds.length > 0) {
    whereParts.push(sql`q.id != ALL(${excludeIds}::uuid[])`);
  }

  // Weak area: find topics where user accuracy < 60% within this exam
  if (weakOnly === "true" && profileId) {
    const weakResult = await db.execute(sql`
      SELECT q.topic_code, q.topic
      FROM quiz_attempts qa
      JOIN quiz_questions q ON q.id = qa.question_id
      WHERE qa.user_id = ${profileId}
        ${activeExamCode ? sql`AND q.exam_code = ${activeExamCode}` : sql``}
      GROUP BY q.topic_code, q.topic
      HAVING COUNT(*) > 0
         AND COUNT(CASE WHEN qa.is_correct THEN 1 END)::float / COUNT(*) < 0.6
    `);

    const rows = weakResult.rows as Array<{ topic_code: string | null; topic: string | null }>;
    const weakCodes = rows.map(r => r.topic_code).filter(Boolean) as string[];
    const weakNames = rows.map(r => r.topic).filter(Boolean) as string[];

    if (weakCodes.length === 0 && weakNames.length === 0) {
      return res.json([]);
    }

    const codePart = weakCodes.length > 0 ? sql`q.topic_code = ANY(${weakCodes}::text[])` : null;
    const namePart = weakNames.length > 0 ? sql`q.topic = ANY(${weakNames}::text[])` : null;

    if (codePart && namePart) {
      whereParts.push(sql`(${codePart} OR ${namePart})`);
    } else if (codePart) {
      whereParts.push(codePart);
    } else if (namePart) {
      whereParts.push(namePart);
    }
  }

  const whereClause = whereParts.length > 0
    ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
    : sql``;

  // Prioritise questions this user has never attempted (unseen-first ordering)
  const unseenJoin = profileId
    ? sql`LEFT JOIN (
        SELECT DISTINCT question_id FROM quiz_attempts WHERE user_id = ${profileId}
      ) _seen ON _seen.question_id = q.id`
    : sql``;

  const orderClause = profileId
    ? sql`CASE WHEN _seen.question_id IS NULL THEN 0 ELSE 1 END, RANDOM()`
    : sql`RANDOM()`;

  const result = await db.execute(sql`
    SELECT q.*
    FROM quiz_questions q
    ${unseenJoin}
    ${whereClause}
    ORDER BY ${orderClause}
    LIMIT ${limit}
  `);

  const questions = result.rows as Record<string, unknown>[];

  // Warn admin when pool is running low for this filter combination
  if (questions.length < limit) {
    req.log.warn(
      {
        event: "quiz_question_shortage",
        examCode: activeExamCode,
        subjectCode: subjectCode ?? null,
        topicCode: topicCode ?? null,
        difficulty: difficulty ?? null,
        found: questions.length,
        requested: limit,
      },
      `Quiz pool low: ${questions.length}/${limit} for exam=${activeExamCode} sub=${subjectCode ?? subject ?? "*"} topic=${topicCode ?? topic ?? "*"}`,
    );
  }

  res.json(questions);
});

// POST /api/quiz/attempts
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

  const question = await db.select().from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.id, parsed.data.questionId)).limit(1);
  if (!question[0]) return res.status(404).json({ error: "Question not found" });

  const isCorrect = question[0].correctOption === parsed.data.selectedOption;

  const [attempt] = await db.insert(quizAttemptsTable).values({
    userId: profile.id,
    questionId: parsed.data.questionId,
    selectedOption: parsed.data.selectedOption,
    isCorrect,
    timeTakenSeconds: parsed.data.timeTakenSeconds,
  }).returning();

  await db.update(profilesTable)
    .set({ quizCountToday: currentCount + 1, quizCountDate: today })
    .where(eq(profilesTable.clerkUserId, userId));

  res.status(201).json({
    ...attempt,
    questionsLeft: profile.planType === "free" ? FREE_DAILY_LIMIT - currentCount - 1 : null,
  });
});

// GET /api/quiz/stats
// Returns per-subject stats for the user, scoped to their exam.
// Includes questionsAvailable for ALL subjects with questions (not just attempted ones).
router.get("/quiz/stats", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { examCode } = req.query as Record<string, string>;

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.json([]);

  const activeExamCode = examCode || profile.examType || null;

  // All subjects with available question counts for this exam
  const countsResult = await db.execute(sql`
    SELECT subject, subject_code, COUNT(*)::int AS questions_available
    FROM quiz_questions
    ${activeExamCode ? sql`WHERE exam_code = ${activeExamCode}` : sql``}
    GROUP BY subject, subject_code
  `);

  // Attempt stats per subject for this user + exam
  const attemptsResult = await db.execute(sql`
    SELECT
      q.subject,
      q.subject_code,
      COUNT(qa.id)::int                                                   AS total,
      COUNT(CASE WHEN qa.is_correct THEN 1 END)::int                      AS correct,
      MAX(qa.attempted_at)::text                                          AS last_practiced
    FROM quiz_attempts qa
    JOIN quiz_questions q ON q.id = qa.question_id
    WHERE qa.user_id = ${profile.id}
      ${activeExamCode ? sql`AND q.exam_code = ${activeExamCode}` : sql``}
    GROUP BY q.subject, q.subject_code
  `);

  type StatEntry = {
    subject: string;
    subjectCode: string | null;
    totalQuestions: number;
    correct: number;
    accuracy: number;
    lastPracticed: string | null;
    questionsAvailable: number;
  };

  const statMap = new Map<string, StatEntry>();

  for (const row of countsResult.rows as any[]) {
    const key = row.subject_code ?? row.subject ?? "Unknown";
    statMap.set(key, {
      subject: row.subject ?? "Unknown",
      subjectCode: row.subject_code ?? null,
      totalQuestions: 0,
      correct: 0,
      accuracy: 0,
      lastPracticed: null,
      questionsAvailable: row.questions_available ?? 0,
    });
  }

  for (const row of attemptsResult.rows as any[]) {
    const key = row.subject_code ?? row.subject ?? "Unknown";
    const existing = statMap.get(key);
    const total = row.total ?? 0;
    const correct = row.correct ?? 0;
    statMap.set(key, {
      ...(existing ?? { questionsAvailable: 0 }),
      subject: row.subject ?? "Unknown",
      subjectCode: row.subject_code ?? null,
      totalQuestions: total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      lastPracticed: row.last_practiced ?? null,
    });
  }

  res.json([...statMap.values()]);
});

// POST /api/quiz/generate-mcq  (Pro-only, AI-powered)
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
