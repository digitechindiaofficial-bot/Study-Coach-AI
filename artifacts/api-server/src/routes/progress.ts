import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable, dailyTasksTable, syllabusProgressTable, quizAttemptsTable, quizQuestionsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { getISTDateString } from "../lib/date";
import { resetStreakIfBroken } from "../lib/streak";

const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  const rows = await db.select().from(profilesTable).where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

router.get("/progress/summary", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.json({
    streakCount: 0, longestStreak: 0, totalTasksCompleted: 0, syllabusCompletionPercent: 0,
    avgQuizAccuracy: 0, studyHoursThisWeek: 0, studyHoursThisMonth: 0, totalStudyHours: 0,
    topicsCompletedThisMonth: 0,
  });

  const healedProfile = await resetStreakIfBroken(profile);

  // All tasks
  const tasks = await db.select().from(dailyTasksTable).where(eq(dailyTasksTable.userId, profile.id));
  const completedTasks = tasks.filter(t => t.isCompleted);

  // This week study hours
  const weekAgoStr = getISTDateString(-7);
  const thisWeekTasks = completedTasks.filter(t => t.date >= weekAgoStr);
  const studyHoursThisWeek = thisWeekTasks.reduce((sum, t) => sum + (t.durationMinutes ?? 60), 0) / 60;

  // This month study hours (last 30 days)
  const monthAgoStr = getISTDateString(-30);
  const thisMonthTasks = completedTasks.filter(t => t.date >= monthAgoStr);
  const studyHoursThisMonth = thisMonthTasks.reduce((sum, t) => sum + (t.durationMinutes ?? 60), 0) / 60;

  // All-time total study hours
  const totalStudyHours = completedTasks.reduce((sum, t) => sum + (t.durationMinutes ?? 60), 0) / 60;

  // This month completions
  const thisMonthTopics = thisMonthTasks.length;

  // Syllabus completion
  const syllabusItems = await db.select().from(syllabusProgressTable).where(eq(syllabusProgressTable.userId, profile.id));
  const syllabusCompletionPercent = syllabusItems.length > 0
    ? Math.round((syllabusItems.filter(i => i.status === "completed").length / syllabusItems.length) * 100)
    : 0;

  // Quiz accuracy
  const attempts = await db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.userId, profile.id));
  const avgQuizAccuracy = attempts.length > 0
    ? Math.round((attempts.filter(a => a.isCorrect).length / attempts.length) * 100)
    : 0;

  res.json({
    streakCount: healedProfile.streakCount,
    longestStreak: healedProfile.longestStreak,
    totalTasksCompleted: completedTasks.length,
    syllabusCompletionPercent,
    avgQuizAccuracy,
    studyHoursThisWeek: Math.round(studyHoursThisWeek * 10) / 10,
    studyHoursThisMonth: Math.round(studyHoursThisMonth * 10) / 10,
    totalStudyHours: Math.round(totalStudyHours * 10) / 10,
    topicsCompletedThisMonth: thisMonthTopics,
  });
});

router.get("/progress/weak-areas", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.json([]);

  const attempts = await db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.userId, profile.id));
  const questions = await db.select().from(quizQuestionsTable);
  const qMap = new Map(questions.map(q => [q.id, q]));

  const topicStats: Record<string, { correct: number; total: number; subject: string }> = {};
  for (const attempt of attempts) {
    const q = qMap.get(attempt.questionId);
    if (!q?.topic || !q?.subject) continue;
    const key = `${q.subject}::${q.topic}`;
    if (!topicStats[key]) topicStats[key] = { correct: 0, total: 0, subject: q.subject };
    topicStats[key].total++;
    if (attempt.isCorrect) topicStats[key].correct++;
  }

  const weakAreas = Object.entries(topicStats)
    .filter(([_, v]) => v.total >= 2 && v.correct / v.total < 0.6)
    .map(([key, v]) => {
      const [subject, topic] = key.split("::");
      return {
        topic,
        subject,
        accuracy: Math.round((v.correct / v.total) * 100),
        attempts: v.total,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);

  res.json(weakAreas);
});

router.get("/progress/daily-hours", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.json([]);

  const days = parseInt(req.query.days as string) || 14;
  const cutoffStr = getISTDateString(-days);

  const tasks = await db.select().from(dailyTasksTable)
    .where(and(
      eq(dailyTasksTable.userId, profile.id),
      eq(dailyTasksTable.isCompleted, true),
      gte(dailyTasksTable.date, cutoffStr),
    ));

  const byDate: Record<string, number> = {};
  for (const task of tasks) {
    if (!byDate[task.date]) byDate[task.date] = 0;
    byDate[task.date] += (task.durationMinutes ?? 60);
  }

  // Fill all days
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = getISTDateString(-i);
    result.push({ date: dateStr, hours: Math.round(((byDate[dateStr] ?? 0) / 60) * 10) / 10 });
  }

  res.json(result);
});

router.get("/progress/heatmap", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.json([]);

  const days = 30;
  const cutoffStr = getISTDateString(-(days - 1));

  const tasks = await db.select().from(dailyTasksTable)
    .where(and(
      eq(dailyTasksTable.userId, profile.id),
      eq(dailyTasksTable.isCompleted, true),
      gte(dailyTasksTable.date, cutoffStr),
    ));

  const countByDate: Record<string, number> = {};
  const minutesByDate: Record<string, number> = {};
  for (const task of tasks) {
    countByDate[task.date] = (countByDate[task.date] ?? 0) + 1;
    minutesByDate[task.date] = (minutesByDate[task.date] ?? 0) + (task.durationMinutes ?? 60);
  }

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = getISTDateString(-i);
    const tasksCompleted = countByDate[dateStr] ?? 0;
    const hoursStudied = Math.round(((minutesByDate[dateStr] ?? 0) / 60) * 10) / 10;
    result.push({ date: dateStr, studied: tasksCompleted > 0, tasksCompleted, hoursStudied });
  }

  res.json(result);
});

export default router;
