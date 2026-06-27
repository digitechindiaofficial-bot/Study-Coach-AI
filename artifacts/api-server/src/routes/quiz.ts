import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable, quizQuestionsTable, quizAttemptsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { SubmitQuizAttemptBody, GenerateMcqFromNewsBody } from "@workspace/api-zod";
import { GoogleGenAI } from "@google/genai";

const router = Router();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function getProfileByClerkId(clerkUserId: string) {
  const rows = await db.select().from(profilesTable).where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

router.get("/quiz/questions", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { subject, topic, difficulty, limit: limitStr, weakOnly } = req.query as Record<string, string>;
  const limit = parseInt(limitStr) || 20;

  let questions = await db.select().from(quizQuestionsTable);

  if (subject) questions = questions.filter(q => q.subject === subject);
  if (topic) questions = questions.filter(q => q.topic === topic);
  if (difficulty) questions = questions.filter(q => q.difficulty === difficulty);

  if (weakOnly === "true") {
    const profile = await getProfileByClerkId(userId);
    if (profile) {
      // Get topics where accuracy < 60%
      const attempts = await db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.userId, profile.id));
      const topicAccuracy: Record<string, { correct: number; total: number }> = {};
      for (const attempt of attempts) {
        const q = questions.find(q => q.id === attempt.questionId);
        if (!q?.topic) continue;
        if (!topicAccuracy[q.topic]) topicAccuracy[q.topic] = { correct: 0, total: 0 };
        topicAccuracy[q.topic].total++;
        if (attempt.isCorrect) topicAccuracy[q.topic].correct++;
      }
      const weakTopics = Object.entries(topicAccuracy)
        .filter(([_, v]) => v.total > 0 && v.correct / v.total < 0.6)
        .map(([t]) => t);
      if (weakTopics.length > 0) {
        questions = questions.filter(q => q.topic && weakTopics.includes(q.topic));
      }
    }
  }

  // Shuffle and limit
  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, limit);
  res.json(shuffled);
});

router.post("/quiz/attempts", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const parsed = SubmitQuizAttemptBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error });

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

  res.status(201).json(attempt);
});

router.get("/quiz/stats", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.json([]);

  const attempts = await db.select().from(quizAttemptsTable)
    .where(eq(quizAttemptsTable.userId, profile.id));

  const questions = await db.select().from(quizQuestionsTable);
  const qMap = new Map(questions.map(q => [q.id, q]));

  const subjectStats: Record<string, { correct: number; total: number; lastPracticed: string | null }> = {};

  for (const attempt of attempts) {
    const q = qMap.get(attempt.questionId);
    const subject = q?.subject ?? "Unknown";
    if (!subjectStats[subject]) subjectStats[subject] = { correct: 0, total: 0, lastPracticed: null };
    subjectStats[subject].total++;
    if (attempt.isCorrect) subjectStats[subject].correct++;
    const attemptDate = attempt.attemptedAt.toISOString();
    if (!subjectStats[subject].lastPracticed || attemptDate > subjectStats[subject].lastPracticed!) {
      subjectStats[subject].lastPracticed = attemptDate;
    }
  }

  const stats = Object.entries(subjectStats).map(([subject, data]) => ({
    subject,
    totalQuestions: data.total,
    correct: data.correct,
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    lastPracticed: data.lastPracticed,
  }));

  res.json(stats);
});

router.post("/quiz/generate-mcq", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

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
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const mcqs = JSON.parse(cleaned);
    res.json(mcqs);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate MCQs" });
  }
});

export default router;
