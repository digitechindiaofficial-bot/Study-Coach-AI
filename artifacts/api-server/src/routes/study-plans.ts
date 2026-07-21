import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, pool } from "@workspace/db";
import { profilesTable, studyPlansTable, dailyTasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface DbSubject {
  name: string;
  subject_code: string | null;
  syllabus_topics: string[] | null;
  total_questions: number | null;
}

async function fetchExamSubjects(examCode: string): Promise<DbSubject[]> {
  const { rows } = await pool.query<DbSubject>(
    `SELECT ss.name, ss.subject_code, ss.syllabus_topics, ss.total_questions
     FROM syllabus_subjects ss
     JOIN syllabus_exams se ON se.id = ss.exam_id
     WHERE se.code = $1 AND ss.is_active = true
     ORDER BY ss.display_order`,
    [examCode]
  );
  return rows;
}

async function getProfileByClerkId(clerkUserId: string) {
  const rows = await db.select().from(profilesTable).where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

function buildTemplatePlan(
  examType: string,
  dbSubjects: DbSubject[],
  weeksRemaining: number,
  dailyHours: number
) {
  const totalWeeks = Math.min(weeksRemaining, 12);
  const scheduleWeeks = Math.min(weeksRemaining, 4);
  const subjectCount = dbSubjects.length || 1;
  const weightage = Math.floor(100 / subjectCount);

  const subjectList = dbSubjects.map((s, idx) => {
    const topics = Array.isArray(s.syllabus_topics) ? s.syllabus_topics : [];
    return {
      name: s.name,
      weightage_percent: idx === dbSubjects.length - 1 ? 100 - weightage * (subjectCount - 1) : weightage,
      recommended_hours: Math.round((totalWeeks * dailyHours * 7 * weightage) / 100),
      topics: topics.map((t: string, i: number) => ({
        name: t,
        estimated_hours: 4,
        priority: i < 3 ? "high" : i < 6 ? "medium" : "low",
        week_number: (i % totalWeeks) + 1,
      })),
    };
  });

  const subjectNames = dbSubjects.map(s => s.name);
  const dayMinutes = dailyHours * 60;

  const makeDay = (subjectIdx: number, topicIdx: number, type: string) => {
    const s = dbSubjects[subjectIdx % dbSubjects.length];
    const topics = Array.isArray(s?.syllabus_topics) && s.syllabus_topics.length > 0
      ? s.syllabus_topics
      : ["General Study"];
    return [{
      subject: subjectNames[subjectIdx % subjectNames.length],
      topic: topics[topicIdx % topics.length],
      duration_minutes: Math.min(dayMinutes, 90),
      type,
    }];
  };

  const weeklySchedule = Array.from({ length: scheduleWeeks }, (_, w) => ({
    week: w + 1,
    theme: `${subjectNames[w % subjectNames.length]} Focus — Week ${w + 1}`,
    daily_tasks: {
      Monday:    makeDay(w,     w,     "study"),
      Tuesday:   makeDay(w + 1, w + 1, "study"),
      Wednesday: makeDay(w,     w + 2, "study"),
      Thursday:  makeDay(w + 1, w + 2, "study"),
      Friday:    makeDay(w + 2, w,     "study"),
      Saturday:  makeDay(w,     w,     "revision"),
      Sunday:    [{ subject: "Revision", topic: `Week ${w + 1} Full Revision`, duration_minutes: 120, type: "revision" }],
    },
  }));

  const examLabel = examType.replace(/_/g, " ");
  return {
    exam: examType,
    total_weeks: totalWeeks,
    strategy: `Focus on high-weightage sections first with ${dailyHours}h daily study. Dedicate weekdays to new topics and weekends to revision and mock tests. Track accuracy weekly and revise weak areas before ${examLabel}.`,
    subjects: subjectList,
    weekly_schedule: weeklySchedule,
  };
}

async function savePlanAndSeedTasks(
  userId: string,
  examType: string,
  weeksRemaining: number,
  planData: object
) {
  await db.delete(studyPlansTable).where(eq(studyPlansTable.userId, userId));
  await db.delete(dailyTasksTable).where(eq(dailyTasksTable.userId, userId));

  const [plan] = await db.insert(studyPlansTable).values({
    userId,
    examType,
    planData,
    weeksRemaining,
  }).returning();

  const today = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const taskRows: {
    userId: string; date: string; subject: string; topic: string;
    durationMinutes: number; taskType: string; isCompleted: boolean;
  }[] = [];

  const weekSchedule = (planData as any).weekly_schedule?.[0];
  if (weekSchedule?.daily_tasks) {
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayName = dayNames[date.getDay()];
      const dateTasks = weekSchedule.daily_tasks[dayName] ?? [];
      for (const t of dateTasks) {
        taskRows.push({
          userId,
          date: date.toISOString().split("T")[0],
          subject: t.subject ?? "General",
          topic: t.topic ?? "Study",
          durationMinutes: t.duration_minutes ?? 60,
          taskType: t.type ?? "study",
          isCompleted: false,
        });
      }
    }
  }

  if (taskRows.length > 0) {
    await db.insert(dailyTasksTable).values(taskRows);
  }

  return plan;
}

router.get("/study-plans/current", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const plans = await db.select().from(studyPlansTable)
    .where(eq(studyPlansTable.userId, profile.id))
    .orderBy(desc(studyPlansTable.createdAt))
    .limit(1);

  if (!plans[0]) return res.json({ plan: null });
  res.json({ plan: plans[0] });
});

router.post("/study-plans/generate", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const force = req.body?.force === true || req.query?.force === "true";

  if (!force) {
    const existing = await db.select().from(studyPlansTable)
      .where(eq(studyPlansTable.userId, profile.id))
      .orderBy(desc(studyPlansTable.createdAt))
      .limit(1);
    if (existing[0]) {
      return res.json({ plan: existing[0], cached: true });
    }
  }

  const examType = profile.examType ?? "SSC_CGL";
  const examDate = profile.examDate;
  const dailyHours = profile.dailyStudyHours ?? 4;

  let weeksRemaining = 12;
  if (examDate) {
    const exam = new Date(examDate);
    const now = new Date();
    weeksRemaining = Math.max(1, Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)));
  }

  // Fetch real subjects from DB for this exam
  const dbSubjects = await fetchExamSubjects(examType);

  let subjectSection: string;
  if (dbSubjects.length > 0) {
    subjectSection = `SUBJECTS FOR ${examType} (use ONLY these subjects, in this order):\n` +
      dbSubjects.map(s => {
        const topics = Array.isArray(s.syllabus_topics) && s.syllabus_topics.length > 0
          ? `\n  Key Topics: ${(s.syllabus_topics as string[]).slice(0, 6).join(", ")}`
          : "";
        const qCount = s.total_questions ? ` (${s.total_questions} questions)` : "";
        return `- ${s.name}${qCount}${topics}`;
      }).join("\n");
  } else {
    subjectSection = `Generate appropriate subjects for the ${examType} exam based on its official syllabus.`;
  }

  const prompt = `You are an expert study planner for Indian government competitive examinations.

Student Profile:
- Exam: ${examType}
- Exam Date: ${examDate ?? "in 12 weeks"}
- Weeks Remaining: ${weeksRemaining}
- Daily Study Hours: ${dailyHours}

${subjectSection}

Create a detailed, week-by-week study plan. Be specific about topics, not vague.
Allocate weightage proportionally based on number of questions and importance.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "exam": "${examType}",
  "total_weeks": ${Math.min(weeksRemaining, 12)},
  "strategy": "<2-3 sentence overall strategy specific to ${examType}>",
  "subjects": [
    {
      "name": "<subject name from list above>",
      "weightage_percent": <number, all must sum to 100>,
      "recommended_hours": <number>,
      "topics": [
        {
          "name": "<specific topic name>",
          "estimated_hours": <number>,
          "priority": "high|medium|low",
          "week_number": <number>
        }
      ]
    }
  ],
  "weekly_schedule": [
    {
      "week": 1,
      "theme": "<focus area for week>",
      "daily_tasks": {
        "Monday": [{"subject": "", "topic": "", "duration_minutes": 60, "type": "study|revision|quiz"}],
        "Tuesday": [{"subject": "", "topic": "", "duration_minutes": 60, "type": "study"}],
        "Wednesday": [{"subject": "", "topic": "", "duration_minutes": 60, "type": "study"}],
        "Thursday": [{"subject": "", "topic": "", "duration_minutes": 60, "type": "study"}],
        "Friday": [{"subject": "", "topic": "", "duration_minutes": 60, "type": "study"}],
        "Saturday": [{"subject": "", "topic": "", "duration_minutes": 90, "type": "revision"}],
        "Sunday": [{"subject": "Revision", "topic": "Weekly revision", "duration_minutes": 120, "type": "revision"}]
      }
    }
  ]
}

Generate exactly ${Math.min(weeksRemaining, 4)} weeks of schedule.`;

  let planData: object;
  let source = "ai";

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });
    const text = response.text ?? "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    planData = JSON.parse(cleaned);
  } catch (err: any) {
    const errStr = String(err?.message ?? err);
    const isQuota = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
    if (isQuota) {
      req.log.warn("Gemini quota exhausted — using template plan");
      planData = buildTemplatePlan(examType, dbSubjects, weeksRemaining, dailyHours);
      source = "template";
    } else {
      req.log.error({ err: errStr }, "study plan generation failed");
      return res.status(500).json({ error: "Failed to generate study plan. Please try again.", detail: errStr });
    }
  }

  try {
    const plan = await savePlanAndSeedTasks(profile.id, examType, weeksRemaining, planData);
    res.json({ plan, source });
  } catch (err: any) {
    req.log.error({ err: err?.message ?? String(err) }, "failed to save study plan");
    res.status(500).json({ error: "Failed to save study plan.", detail: err?.message });
  }
});

export default router;
