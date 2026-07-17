import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable, dailyTasksTable, syllabusProgressTable, quizAttemptsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getISTDateString } from "../lib/date";
import { resetStreakIfBroken } from "../lib/streak";

const router = Router();

// Known subject codes used in topic_code prefixes (e.g. "IBPS_PO_QA_NUMBER_SERIES_014")
const SUBJECT_CODES = new Set([
  "QA", "ENG", "GIR", "GA", "DESC", "BANK", "COMP", "RCA", "MATH",
  "HIST", "POL", "SCI", "HINDI", "GEO", "BIHAR", "MREAS", "NUM",
  "REAS", "ECON", "ETHICS", "APT", "NA",
]);

// Tags that are too broad to use as topic names
const SKIP_TAGS = new Set([
  "easy", "medium", "hard", "mcq", "banking", "general", "india", "bihar",
  "history", "geography", "science", "polity", "environment", "economy",
  "reasoning", "maths", "mathematics", "english", "hindi", "ancient",
  "medieval", "modern", "physics", "chemistry", "biology", "technology",
  "current-affairs", "sahitya", "vyakaran", "sahitya-itihas",
]);

/** Derive a readable topic name from the tags JSON array string returned by PostgreSQL.
 *  Picks the most specific tag (not in SKIP_TAGS), falling back to the first tag.
 *  e.g. '["ancient india","harappan civilization"]' → "Harappan Civilization"
 *       '["chemistry"]'                             → "Chemistry"
 */
function getTopicNameFromTags(tagsJson: string | null): string | null {
  if (!tagsJson) return null;
  let tags: string[] = [];
  try { tags = JSON.parse(tagsJson); } catch { return null; }
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const best = tags.find(t => !SKIP_TAGS.has(t.toLowerCase())) ?? tags[0];
  if (!best) return null;
  return best.replace(/_/g, " ").split(/[\s-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Parse a human-readable topic name from a topic code.
 *  e.g. "IBPS_PO_QA_NUMBER_SERIES_014" → "Number Series"
 *       "SSC_CGL_ENG_READING_COMP_007"  → "Reading Comp"
 *  Returns null when the code has no topic words embedded (e.g. "BPSC_SCI_008").
 */
function parseTopicName(topicCode: string | null): string | null {
  if (!topicCode) return null;
  const parts = topicCode.split("_");
  let startIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (SUBJECT_CODES.has(parts[i])) { startIdx = i + 1; break; }
  }
  if (startIdx === -1 || startIdx >= parts.length) return null;
  const topicParts = [...parts.slice(startIdx)];
  if (topicParts.length > 0 && /^\d+$/.test(topicParts[topicParts.length - 1])) topicParts.pop();
  if (topicParts.length === 0) return null;
  return topicParts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
}

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

  // Use question_attempts grouped by topic_code, filtered by user's target exam
  const activeExamCode = profile.examType ?? null;
  if (!activeExamCode) return res.json([]);

  // CTE picks one representative set of tags per topic_code (for name resolution)
  const result = await db.execute(sql`
    WITH topic_tags_cte AS (
      SELECT DISTINCT ON (topic_code)
        topic_code,
        array_to_json(tags)::text AS tags_json
      FROM question_bank
      WHERE topic_code IS NOT NULL
        AND tags IS NOT NULL
        AND exam_code = ${activeExamCode}
      ORDER BY topic_code, id
    )
    SELECT
      qa.subject_code,
      qa.exam_code,
      qb.topic_code,
      tt.tags_json                                     AS topic_tags,
      ss.name                                          AS subject_name,
      COUNT(qa.id)::int                               AS total,
      COUNT(CASE WHEN qa.is_correct THEN 1 END)::int  AS correct
    FROM question_attempts qa
    LEFT JOIN question_bank qb ON qb.id = qa.question_id
    LEFT JOIN topic_tags_cte tt ON tt.topic_code = qb.topic_code
    LEFT JOIN syllabus_subjects ss
      ON ss.subject_code = qa.subject_code
      AND ss.exam_id = (SELECT id FROM syllabus_exams WHERE code = ${activeExamCode} LIMIT 1)
    WHERE qa.user_id = ${profile.id}
      AND qa.exam_code = ${activeExamCode}
    GROUP BY qa.subject_code, qa.exam_code, qb.topic_code, tt.tags_json, ss.name
    HAVING COUNT(qa.id) >= 1
  `);

  type WeakRow = {
    subject_code: string;
    exam_code: string;
    topic_code: string | null;
    topic_tags: string | null;
    subject_name: string | null;
    total: number;
    correct: number;
  };

  const weakAreas = (result.rows as WeakRow[])
    .map(r => {
      // Priority: tags-derived name → parsed topic code → subject name
      const subjectDisplay = r.subject_name ?? r.subject_code;
      const topicName =
        getTopicNameFromTags(r.topic_tags) ??
        parseTopicName(r.topic_code) ??
        subjectDisplay;
      return {
        topicCode: r.topic_code ?? null,
        topic: topicName,
        subject: subjectDisplay,
        subjectCode: r.subject_code,
        examCode: r.exam_code,
        accuracy: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
        attempts: r.total,
      };
    })
    .filter(w => w.accuracy < 60)
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
