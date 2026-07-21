import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, pool } from "@workspace/db";
import { profilesTable, studyPlansTable, dailyTasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface DbSubject {
  id: string;
  name: string;
  subject_code: string | null;
  total_questions: number | null;
  topics: string[];
}

interface WeakArea {
  subject_code: string;
  score_pct: number;
  total_attempts: number;
}

async function fetchExamData(examCode: string): Promise<DbSubject[]> {
  const { rows } = await pool.query<DbSubject>(
    `SELECT
       ss.id,
       ss.name,
       ss.subject_code,
       ss.total_questions,
       COALESCE(
         json_agg(st.name ORDER BY st.display_order)
           FILTER (WHERE st.id IS NOT NULL),
         '[]'::json
       ) AS topics
     FROM syllabus_subjects ss
     JOIN syllabus_exams se ON se.id = ss.exam_id
     LEFT JOIN syllabus_topics st ON st.subject_id = ss.id
     WHERE se.code = $1 AND ss.is_active = true
     GROUP BY ss.id, ss.name, ss.subject_code, ss.total_questions, ss.display_order
     ORDER BY ss.display_order`,
    [examCode]
  );
  return rows;
}

async function fetchWeakAreas(profileId: string, examCode: string): Promise<WeakArea[]> {
  const { rows } = await pool.query<WeakArea>(
    `SELECT
       subject_code,
       ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*))::int AS score_pct,
       COUNT(*)::int AS total_attempts
     FROM question_attempts
     WHERE user_id = $1 AND exam_code = $2
     GROUP BY subject_code
     HAVING COUNT(*) >= 5
     ORDER BY score_pct ASC
     LIMIT 4`,
    [profileId, examCode]
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
  weaksMap: Record<string, number>,
  weeksRemaining: number,
  dailyHours: number
) {
  const totalWeeks = Math.min(weeksRemaining, 12);
  const scheduleWeeks = Math.min(weeksRemaining, 4);
  const subjectCount = dbSubjects.length || 1;
  const baseWeight = Math.floor(100 / subjectCount);

  const subjects = dbSubjects.map((s, idx) => {
    const score = weaksMap[s.subject_code ?? ""] ?? 80;
    const isWeak = score < 60;
    const weightage = idx === dbSubjects.length - 1
      ? 100 - baseWeight * (subjectCount - 1)
      : baseWeight;
    const hours = Math.round((totalWeeks * dailyHours * 7 * (isWeak ? weightage * 1.5 : weightage)) / 100);
    return {
      name: s.name,
      weightage_percent: weightage,
      recommended_hours: Math.min(hours, 80),
      topic_count: s.topics.length,
      is_weak: isWeak,
      topics: s.topics.map((t, i) => ({
        name: t,
        estimated_hours: 4,
        priority: i < 3 ? "high" : i < 6 ? "medium" : "low",
        week_number: (i % totalWeeks) + 1,
      })),
    };
  });

  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const makeSession = (subIdx: number, topicIdx: number, time: "Morning" | "Evening", type: "study" | "revision") => {
    const s = dbSubjects[subIdx % dbSubjects.length];
    const topic = s.topics.length > 0 ? s.topics[topicIdx % s.topics.length] : "General Topics";
    return {
      time,
      topic,
      subject: s.name,
      duration: time === "Morning" ? 90 : 60,
      tasks: [
        `Study ${topic} in detail`,
        `Make concise notes`,
        `Solve 20 practice MCQs`,
      ],
      tip: `Focus on understanding core concepts of ${topic}`,
    };
  };

  const weeklySchedule = Array.from({ length: scheduleWeeks }, (_, w) => ({
    week: w + 1,
    theme: `${dbSubjects[w % dbSubjects.length]?.name ?? "General"} Focus — Week ${w + 1}`,
    days: dayOrder.map((day, d) => {
      if (day === "Sunday") {
        return {
          day,
          sessions: [{
            time: "Morning",
            topic: `Week ${w + 1} Full Revision`,
            subject: "Revision",
            duration: 120,
            tasks: ["Review all topics from this week", "Attempt a mini mock test", "Identify weak areas"],
            tip: "Revision is as important as learning new topics",
          }],
        };
      }
      if (day === "Saturday") {
        return {
          day,
          sessions: [makeSession(w + d, d, "Morning", "revision")],
        };
      }
      return {
        day,
        sessions: [
          makeSession(w + d, d, "Morning", "study"),
          makeSession(w + d + 1, d + 1, "Evening", "study"),
        ],
      };
    }),
  }));

  return {
    exam: examType,
    total_weeks: totalWeeks,
    strategy: `Systematic coverage of all ${examType} topics with extra time on weak areas. Weekdays for new topics, Saturdays for revision, Sundays for full revision + mock tests.`,
    subjects,
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
  const dayNameToOffset: Record<string, number> = {
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
    Friday: 4, Saturday: 5, Sunday: 6,
  };

  const taskRows: {
    userId: string; date: string; subject: string; topic: string;
    durationMinutes: number; taskType: string; isCompleted: boolean;
  }[] = [];

  const weekSchedule = (planData as any).weekly_schedule?.[0];

  if (weekSchedule?.days) {
    for (const dayObj of weekSchedule.days) {
      const offset = dayNameToOffset[dayObj.day] ?? 0;
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      const dateStr = date.toISOString().split("T")[0];
      for (const session of (dayObj.sessions ?? [])) {
        taskRows.push({
          userId,
          date: dateStr,
          subject: session.subject ?? "General",
          topic: session.topic ?? "Study",
          durationMinutes: session.duration ?? 60,
          taskType: session.time === "Morning" ? "study" : "revision",
          isCompleted: false,
        });
      }
    }
  } else if (weekSchedule?.daily_tasks) {
    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayName = dayNames[date.getDay()];
      for (const t of (weekSchedule.daily_tasks[dayName] ?? [])) {
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
    if (existing[0]) return res.json({ plan: existing[0], cached: true });
  }

  const examType = profile.examType ?? "SSC_CGL";
  const examDate = profile.examDate;
  const dailyHours = profile.dailyStudyHours ?? 4;

  let weeksRemaining = 12;
  let daysRemaining = 84;
  if (examDate) {
    const exam = new Date(examDate);
    const now = new Date();
    daysRemaining = Math.max(7, Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7));
  }

  const [dbSubjects, weakAreas] = await Promise.all([
    fetchExamData(examType),
    fetchWeakAreas(profile.id, examType),
  ]);

  const weaksMap: Record<string, number> = {};
  for (const w of weakAreas) {
    if (w.subject_code) weaksMap[w.subject_code] = w.score_pct;
  }

  const subjectBlock = dbSubjects.length > 0
    ? dbSubjects.map(s => {
        const topicList = s.topics.length > 0
          ? `\n  Topics (${s.topics.length}): ${s.topics.join(", ")}`
          : "";
        const qNote = s.total_questions ? ` — ${s.total_questions} questions in bank` : "";
        const weakNote = weaksMap[s.subject_code ?? ""] !== undefined
          ? ` ⚠️ WEAK AREA (${weaksMap[s.subject_code ?? ""]}% score — give 50% more time)`
          : "";
        return `• ${s.name}${qNote}${weakNote}${topicList}`;
      }).join("\n")
    : `Generate appropriate subjects for ${examType}.`;

  const weakBlock = weakAreas.length > 0
    ? "STUDENT WEAK AREAS (prioritise these):\n" +
      weakAreas.map(w => `• ${w.subject_code}: ${w.score_pct}% score (${w.total_attempts} attempts)`).join("\n")
    : "No weak area data yet — distribute time evenly.";

  const scheduleWeeks = Math.min(weeksRemaining, 4);

  const prompt = `You are an expert coach for the ${examType} Indian government exam.

STUDENT PROFILE:
- Target Exam: ${examType}
- Exam Date: ${examDate ?? `in ${weeksRemaining} weeks`}
- Days Remaining: ${daysRemaining}
- Daily Study Hours: ${dailyHours}h

EXAM SYLLABUS — use ONLY these subjects and topics:
${subjectBlock}

${weakBlock}

PLANNING RULES:
1. Cover every topic listed above at least once
2. Give 50% extra time to weak areas
3. Each day: Morning session (new topic) + Evening session (practice/revision)
4. Saturday: Revision of the week's topics
5. Sunday: Full revision + mock test
6. Topics with more questions get proportionally more time
7. Last 20% of days: only revision + mock tests

Return ONLY valid JSON — no markdown, no explanation:
{
  "exam": "${examType}",
  "total_weeks": ${Math.min(weeksRemaining, 12)},
  "strategy": "<2-3 sentences specific to ${examType} and this student's weak areas>",
  "subjects": [
    {
      "name": "<subject>",
      "weightage_percent": <0-100, all must sum to 100>,
      "recommended_hours": <number>,
      "topic_count": <number of topics>,
      "topics": [
        { "name": "<topic>", "estimated_hours": <number>, "priority": "high|medium|low", "week_number": <1-${scheduleWeeks}> }
      ]
    }
  ],
  "weekly_schedule": [
    {
      "week": 1,
      "theme": "<focus area>",
      "days": [
        {
          "day": "Monday",
          "sessions": [
            {
              "time": "Morning",
              "topic": "<specific topic name from syllabus>",
              "subject": "<subject name>",
              "duration": 90,
              "tasks": ["<specific task 1>", "<specific task 2>", "Solve <N> practice MCQs"],
              "tip": "<1 specific exam tip for this topic>"
            },
            {
              "time": "Evening",
              "topic": "<specific topic name>",
              "subject": "<subject name>",
              "duration": 60,
              "tasks": ["<task 1>", "<task 2>", "Solve <N> MCQs"],
              "tip": "<specific tip>"
            }
          ]
        }
      ]
    }
  ]
}

Generate exactly ${scheduleWeeks} week(s) covering days Monday through Sunday.
Use specific topic names from the syllabus above — never use "General Study" or vague names.`;

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
      planData = buildTemplatePlan(examType, dbSubjects, weaksMap, weeksRemaining, dailyHours);
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
