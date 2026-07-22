import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, pool } from "@workspace/db";
import { profilesTable, studyPlansTable, dailyTasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Session {
  time: "Morning" | "Evening" | "Full Day";
  topic: string;
  subject: string;
  subject_code?: string;
  duration: number;
  tasks: string[];
  tip: string;
}

interface DayEntry {
  date: string;
  day_name: string;
  day_type: "study" | "revision" | "mock_test" | "final_revision";
  days_left: number;
  sessions: Session[];
}

interface SubjectEntry {
  name: string;
  subject_code: string | null;
  weightage_percent: number;
  recommended_hours: number;
  topic_count: number;
  allocated_study_days: number;
  start_date: string | null;
  end_date: string | null;
  topics: Array<{ name: string; priority: string; tip?: string }>;
}

interface FullPlanData {
  exam: string;
  plan_type: string;
  days_remaining: number;
  total_topics: number;
  total_hours: number;
  exam_date: string;
  plan_start: string;
  strategy: string;
  subjects: SubjectEntry[];
  daily_plan: DayEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPlanTypeLabel(days: number): string {
  if (days > 90) return "Comprehensive Plan";
  if (days > 60) return "Strategic Plan";
  if (days > 30) return "Focused Plan";
  if (days > 15) return "Intensive Plan";
  if (days > 7)  return "Crash Course";
  return "Emergency Plan";
}

async function fetchExamData(examCode: string): Promise<DbSubject[]> {
  const { rows } = await pool.query<DbSubject>(
    `SELECT
       ss.id, ss.name, ss.subject_code, ss.total_questions,
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
  const rows = await db.select().from(profilesTable)
    .where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

// ─── Calendar builder ─────────────────────────────────────────────────────────

function buildFullPlan(
  examDate: Date,
  today: Date,
  dbSubjects: DbSubject[],
  weaksMap: Record<string, number>,
  dailyHours: number,
  examType: string
): FullPlanData {
  const MS_DAY = 86_400_000;
  const daysRemaining = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / MS_DAY));
  const planTypeLabel = getPlanTypeLabel(daysRemaining);

  // Reserve blocks at end of plan
  const finalRevDays = Math.min(3, daysRemaining);
  const mockTestDays = daysRemaining > 10 ? Math.min(7, Math.ceil(daysRemaining * 0.10)) : 0;
  const revZoneDays  = daysRemaining > 20 ? Math.ceil(daysRemaining * 0.12) : 0;
  const reservedDays = finalRevDays + mockTestDays + revZoneDays;

  // Flatten topics; weak subjects get an extra revision pass
  const topicQueue: Array<{ topic: string; subject: string; code: string }> = [];
  for (const s of dbSubjects) {
    const isWeak = (weaksMap[s.subject_code ?? ""] ?? 100) < 60;
    const topics = s.topics.length > 0 ? s.topics : ["General Topics"];
    for (const t of topics) {
      topicQueue.push({ topic: t, subject: s.name, code: s.subject_code ?? "" });
      if (isWeak) topicQueue.push({ topic: `${t} — Revision`, subject: s.name, code: s.subject_code ?? "" });
    }
  }

  const totalTopics = dbSubjects.reduce((sum, s) => sum + (s.topics.length || 1), 0);

  // Count actual weekday study slots
  let studySlots = 0;
  {
    const tmp = new Date(today);
    while (tmp < examDate) {
      const dl = Math.ceil((examDate.getTime() - tmp.getTime()) / MS_DAY);
      const dow = tmp.getDay();
      if (dow !== 0 && dow !== 6 && dl > reservedDays) studySlots++;
      tmp.setDate(tmp.getDate() + 1);
    }
  }

  const topicsPerDay = studySlots > 0 ? Math.ceil(topicQueue.length / studySlots) : 1;
  const morningMins  = Math.round(dailyHours * 60 * 0.6);
  const eveningMins  = Math.round(dailyHours * 60 * 0.4);
  const DAY_NAMES    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const subjectRanges: Record<string, { start: string | null; end: string | null; days: number }> = {};
  for (const s of dbSubjects) subjectRanges[s.subject_code ?? s.name] = { start: null, end: null, days: 0 };

  const daily_plan: DayEntry[] = [];
  let topicCursor = 0;
  const cur = new Date(today);
  cur.setHours(0, 0, 0, 0);

  while (cur < examDate) {
    const dateStr = cur.toISOString().split("T")[0];
    const dow = cur.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const daysLeft = Math.ceil((examDate.getTime() - cur.getTime()) / MS_DAY);

    const isFinalRev  = daysLeft <= finalRevDays;
    const isMockZone  = !isFinalRev && daysLeft <= finalRevDays + mockTestDays;
    const isRevZone   = !isFinalRev && !isMockZone && daysLeft <= reservedDays;

    let dayType: DayEntry["day_type"];
    let sessions: Session[];

    if (isFinalRev) {
      dayType = "final_revision";
      sessions = [{
        time: "Full Day",
        topic: "Final Revision",
        subject: "All Subjects",
        duration: dailyHours * 60,
        tasks: [
          "Revise all notes and key formulas",
          "Focus on weak topics only",
          "Attempt one previous year paper",
          "Rest well — you're ready!",
        ],
        tip: "No new topics. Sleep well — a rested brain performs far better.",
      }];

    } else if (isMockZone) {
      dayType = "mock_test";
      sessions = [{
        time: "Full Day",
        topic: "Full Mock Test",
        subject: "All Subjects",
        duration: 120,
        tasks: [
          "Attempt full mock under strict timed conditions",
          "Analyse every wrong answer carefully",
          "Note recurring mistake patterns",
          "Revise the topic areas where you slipped",
        ],
        tip: "Treat every mock as the real exam — same focus, same timing.",
      }];

    } else if (isRevZone || isWeekend) {
      dayType = "revision";
      const mcqCount = Math.round(dailyHours * 12);
      sessions = [{
        time: "Full Day",
        topic: isWeekend ? "Weekly Revision" : "Revision Sprint",
        subject: "All Subjects",
        duration: dailyHours * 60,
        tasks: [
          "Review notes from this week's topics",
          `Solve ${mcqCount} mixed practice MCQs`,
          "Flag weak topics for next session",
          "Quick-read important facts and formulas",
        ],
        tip: "Active recall (practice questions) beats re-reading every time.",
      }];

    } else if (topicCursor >= topicQueue.length) {
      // All topics finished — bonus revision days
      dayType = "revision";
      sessions = [{
        time: "Full Day",
        topic: "Extra Revision",
        subject: "All Subjects",
        duration: dailyHours * 60,
        tasks: [
          "All syllabus topics are covered!",
          "Focus entirely on your weak areas",
          "Attempt section-wise mock tests",
          "Review previous year question patterns",
        ],
        tip: "Great work — now build speed, accuracy, and confidence.",
      }];

    } else {
      dayType = "study";
      const topicsThisDay = Math.min(topicsPerDay, topicQueue.length - topicCursor);
      const sessions_out: Session[] = [];

      for (let t = 0; t < topicsThisDay; t++) {
        const { topic, subject, code } = topicQueue[topicCursor + t];
        const rng = subjectRanges[code] ?? (subjectRanges[code] = { start: null, end: null, days: 0 });
        if (!rng.start) rng.start = dateStr;
        rng.end = dateStr;
        if (t === 0) rng.days++;

        const mcqs = Math.max(15, Math.round((dailyHours * 8) / topicsThisDay));
        const dur  = topicsThisDay > 1
          ? Math.round((dailyHours * 60) / topicsThisDay)
          : morningMins;

        sessions_out.push({
          time: topicsThisDay === 1 ? "Morning" : (t === 0 ? "Morning" : "Evening"),
          topic,
          subject,
          subject_code: code,
          duration: dur,
          tasks: [
            `Study ${topic} in depth`,
            "Make concise revision notes",
            `Solve ${mcqs} practice MCQs`,
            "Note key facts and dates",
          ],
          tip: `Focus: ${topic}`,  // replaced by AI tips below
        });
      }

      // Single topic per day: add evening practice session
      if (topicsThisDay === 1) {
        const { topic, subject, code } = topicQueue[topicCursor];
        const mcqs2 = Math.max(10, Math.round(dailyHours * 5));
        sessions_out.push({
          time: "Evening",
          topic: `${topic} — Practice`,
          subject,
          subject_code: code,
          duration: eveningMins,
          tasks: [
            "Revisit morning notes quickly",
            `Solve ${mcqs2} more MCQs on this topic`,
            "Review previous year questions",
            "Note any remaining weak points",
          ],
          tip: "Evening practice locks in what you studied in the morning.",
        });
      }

      topicCursor += topicsThisDay;
      sessions = sessions_out;
    }

    daily_plan.push({ date: dateStr, day_name: DAY_NAMES[dow], day_type: dayType, days_left: daysLeft, sessions });
    cur.setDate(cur.getDate() + 1);
  }

  // Build subject entries
  const subjects: SubjectEntry[] = dbSubjects.map((s, i) => {
    const key  = s.subject_code ?? s.name;
    const rng  = subjectRanges[key] ?? { start: null, end: null, days: 0 };
    const base = Math.round(((s.topics.length || 1) / Math.max(totalTopics, 1)) * 100);
    const wt   = i === dbSubjects.length - 1
      ? Math.max(1, 100 - dbSubjects.slice(0, -1).reduce((sum, sub) =>
          sum + Math.round(((sub.topics.length || 1) / Math.max(totalTopics, 1)) * 100), 0))
      : base;
    return {
      name: s.name,
      subject_code: s.subject_code,
      weightage_percent: wt,
      recommended_hours: Math.round((wt / 100) * daysRemaining * dailyHours),
      topic_count: s.topics.length,
      allocated_study_days: rng.days,
      start_date: rng.start,
      end_date: rng.end,
      topics: s.topics.map((t, ti) => ({
        name: t,
        priority: ti < Math.ceil(s.topics.length / 3) ? "high" : ti < Math.ceil(s.topics.length * 2 / 3) ? "medium" : "low",
      })),
    };
  });

  return {
    exam: examType,
    plan_type: planTypeLabel,
    days_remaining: daysRemaining,
    total_topics: totalTopics,
    total_hours: Math.round(daysRemaining * dailyHours),
    exam_date: examDate.toISOString().split("T")[0],
    plan_start: today.toISOString().split("T")[0],
    strategy: `${planTypeLabel} for ${examType}: ${daysRemaining} days, ${totalTopics} topics. Weekdays for new topics, weekends for revision, last ${finalRevDays + mockTestDays + revZoneDays} days reserved for mock tests and final revision.`,
    subjects,
    daily_plan,
  };
}

// ─── Persist + seed daily tasks ───────────────────────────────────────────────

async function savePlanAndSeedTasks(
  userId: string,
  examType: string,
  weeksRemaining: number,
  planData: FullPlanData | object
) {
  await db.delete(studyPlansTable).where(eq(studyPlansTable.userId, userId));
  await db.delete(dailyTasksTable).where(eq(dailyTasksTable.userId, userId));

  const [plan] = await db.insert(studyPlansTable)
    .values({ userId, examType, planData, weeksRemaining })
    .returning();

  const taskRows: {
    userId: string; date: string; subject: string; topic: string;
    durationMinutes: number; taskType: string; isCompleted: boolean;
  }[] = [];

  const fp = planData as FullPlanData;

  if (fp.daily_plan) {
    // New format: seed first 14 days
    for (const day of fp.daily_plan.slice(0, 14)) {
      for (const session of day.sessions) {
        taskRows.push({
          userId,
          date: day.date,
          subject: session.subject,
          topic: session.topic,
          durationMinutes: session.duration,
          taskType: day.day_type === "study" ? "study" : day.day_type,
          isCompleted: false,
        });
      }
    }
  } else {
    // Legacy weekly_schedule format
    const legacy = planData as any;
    const ws = legacy.weekly_schedule?.[0];
    if (ws?.days) {
      const today = new Date();
      const dayOff: Record<string, number> = { Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6 };
      for (const dayObj of ws.days) {
        const date = new Date(today);
        date.setDate(date.getDate() + (dayOff[dayObj.day] ?? 0));
        for (const s of (dayObj.sessions ?? [])) {
          taskRows.push({ userId, date: date.toISOString().split("T")[0], subject: s.subject, topic: s.topic, durationMinutes: s.duration, taskType: "study", isCompleted: false });
        }
      }
    }
  }

  if (taskRows.length > 0) await db.insert(dailyTasksTable).values(taskRows);
  return plan;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/study-plans/current", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const plans = await db.select().from(studyPlansTable)
    .where(eq(studyPlansTable.userId, profile.id))
    .orderBy(desc(studyPlansTable.createdAt)).limit(1);

  if (!plans[0]) return res.json({ plan: null });
  res.json({ plan: plans[0] });
});

router.delete("/study-plans/current", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  await db.delete(studyPlansTable).where(eq(studyPlansTable.userId, profile.id));
  res.json({ ok: true });
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
      .orderBy(desc(studyPlansTable.createdAt)).limit(1);
    if (existing[0]) return res.json({ plan: existing[0], cached: true });
  }

  const examType   = profile.examType ?? "SSC_CGL";
  const examDate   = profile.examDate;
  const dailyHours = profile.dailyStudyHours ?? 4;

  // Require exam date for the new dynamic plan
  if (!examDate) {
    return res.status(400).json({
      error: "Please set your exam date in Settings to generate a personalised study plan.",
      code: "NO_EXAM_DATE",
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDateObj = new Date(examDate);
  examDateObj.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((examDateObj.getTime() - today.getTime()) / 86_400_000);

  if (daysRemaining <= 0) {
    return res.status(400).json({
      error: "Your exam date has passed. Please update it in Settings.",
      code: "EXAM_PASSED",
    });
  }

  const weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7));

  const [dbSubjects, weakAreas] = await Promise.all([
    fetchExamData(examType),
    fetchWeakAreas(profile.id, examType),
  ]);

  const weaksMap: Record<string, number> = {};
  for (const w of weakAreas) if (w.subject_code) weaksMap[w.subject_code] = w.score_pct;

  // Build full calendar server-side
  const planData = buildFullPlan(examDateObj, today, dbSubjects, weaksMap, dailyHours, examType);

  // Enhance with AI: strategy + per-topic tips (compact single call)
  try {
    const topicList = dbSubjects.flatMap(s =>
      (s.topics.length > 0 ? s.topics : ["General Topics"]).map(t => ({
        key: `${s.subject_code ?? s.name}|${t}`,
        label: `${s.name} — ${t}`,
      }))
    );

    const weakNote = weakAreas.length > 0
      ? `\nStudent weak areas: ${weakAreas.map(w => `${w.subject_code} (${w.score_pct}%)`).join(", ")}.`
      : "";

    const aiPrompt = `You are an expert coach for the ${examType} Indian government exam.
Student has ${daysRemaining} days remaining. Plan type: ${planData.plan_type}.${weakNote}

Task 1 — Write a 2-sentence motivating and specific study strategy for this student.
Task 2 — For each topic below, write a 1-sentence practical exam tip (specific to ${examType}).

Topics:
${topicList.slice(0, 80).map(t => `${t.key}: ${t.label}`).join("\n")}

Return JSON:
{
  "strategy": "...",
  "tips": {
    "${topicList[0]?.key ?? ""}": "tip text",
    ...
  }
}`;

    const aiResp = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: aiPrompt,
      config: { maxOutputTokens: 6000, responseMimeType: "application/json" },
    });

    const aiData = JSON.parse((aiResp.text ?? "{}").replace(/```json\n?|\n?```/g, "").trim());

    if (aiData.strategy) planData.strategy = aiData.strategy;

    if (aiData.tips && typeof aiData.tips === "object") {
      // Merge tips into daily plan sessions
      for (const day of planData.daily_plan) {
        for (const session of day.sessions) {
          const baseTopicKey = `${session.subject_code ?? ""}|${session.topic.replace(/ — (Practice|Revision)$/, "")}`;
          const tip = aiData.tips[baseTopicKey];
          if (tip) session.tip = tip;
        }
      }
      // Also merge into subjects topics
      for (const sub of planData.subjects) {
        for (const t of sub.topics) {
          const key = `${sub.subject_code ?? sub.name}|${t.name}`;
          if (aiData.tips[key]) t.tip = aiData.tips[key];
        }
      }
    }
  } catch (aiErr: any) {
    const errStr = String(aiErr?.message ?? aiErr);
    const isQuota = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
    if (!isQuota) req.log.warn({ err: errStr }, "AI tips failed — using template plan without tips");
    // Plan is still usable without AI tips
  }

  try {
    const plan = await savePlanAndSeedTasks(profile.id, examType, weeksRemaining, planData);
    res.json({ plan, source: "ai" });
  } catch (err: any) {
    req.log.error({ err: err?.message ?? String(err) }, "failed to save study plan");
    res.status(500).json({ error: "Failed to save study plan.", detail: err?.message });
  }
});

export default router;
