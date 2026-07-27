import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, pool } from "@workspace/db";
import { profilesTable, studyPlansTable, dailyTasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

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
  _meta?: {
    generated_date: string;           // IST date, "YYYY-MM-DD"
    completed_subjects_snapshot: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Current date in IST as YYYY-MM-DD */
function getTodayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

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

/**
 * Count how many distinct subjects the user has meaningfully attempted
 * (at least 1 correct answer). Zero means they haven't covered any topics yet.
 */
async function fetchCompletedSubjectCount(profileId: string): Promise<number> {
  const { rows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT subject_code)::int AS cnt
     FROM question_attempts
     WHERE user_id = $1 AND is_correct = true`,
    [profileId]
  );
  return Number(rows[0]?.cnt ?? 0);
}

async function getProfileByClerkId(clerkUserId: string) {
  const rows = await db.select().from(profilesTable)
    .where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

// ─── Revision queue builder ───────────────────────────────────────────────────

/**
 * Builds a deduplicated topic list for cycling through revision days.
 * Weak subjects (low score in weaksMap) come first so the first revision
 * days always target the user's most at-risk areas.
 */
function buildRevisionQueue(
  dbSubjects: DbSubject[],
  weaksMap: Record<string, number>,
): Array<{ topic: string; subject: string; code: string }> {
  // Sort subjects: weakest accuracy first; unknown subjects go last
  const sorted = [...dbSubjects].sort((a, b) => {
    const scoreA = weaksMap[a.subject_code ?? ""] ?? 101;
    const scoreB = weaksMap[b.subject_code ?? ""] ?? 101;
    return scoreA - scoreB;
  });

  const result: Array<{ topic: string; subject: string; code: string }> = [];
  for (const s of sorted) {
    const topics = s.topics.length > 0 ? s.topics : ["General Topics"];
    for (const t of topics) {
      result.push({ topic: t, subject: s.name, code: s.subject_code ?? "" });
    }
  }
  return result;
}

// ─── Calendar builder ─────────────────────────────────────────────────────────

/**
 * Builds the full calendar plan.
 *
 * allowWeekendRevision — pass false when the user hasn't covered any topics yet.
 * Without this flag, a brand-new user joining on Friday gets Sat/Sun "revision"
 * sessions despite having studied nothing, which makes no sense.
 */
function buildFullPlan(
  examDate: Date,
  today: Date,
  dbSubjects: DbSubject[],
  weaksMap: Record<string, number>,
  dailyHours: number,
  examType: string,
  allowWeekendRevision: boolean,
): FullPlanData {
  const MS_DAY = 86_400_000;
  const daysRemaining = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / MS_DAY));
  const planTypeLabel = getPlanTypeLabel(daysRemaining);

  // Reserve blocks at end of plan
  const finalRevDays = Math.min(3, daysRemaining);
  const mockTestDays = daysRemaining > 10 ? Math.min(7, Math.ceil(daysRemaining * 0.10)) : 0;
  const revZoneDays  = daysRemaining > 20 ? Math.ceil(daysRemaining * 0.12) : 0;
  const reservedDays = finalRevDays + mockTestDays + revZoneDays;

  // Flatten topics for first pass (new topic introduction)
  // Weak subjects get one bonus pass in the main queue
  const topicQueue: Array<{ topic: string; subject: string; code: string }> = [];
  for (const s of dbSubjects) {
    const isWeak = (weaksMap[s.subject_code ?? ""] ?? 100) < 60;
    const topics = s.topics.length > 0 ? s.topics : ["General Topics"];
    for (const t of topics) {
      topicQueue.push({ topic: t, subject: s.name, code: s.subject_code ?? "" });
      if (isWeak) topicQueue.push({ topic: `${t} — Revision`, subject: s.name, code: s.subject_code ?? "" });
    }
  }

  // Revision queue: deduplicated topics sorted weakest-subject-first.
  // Used for all revision days and post-queue-exhaustion cycling.
  const revisionQueue = buildRevisionQueue(dbSubjects, weaksMap);
  // Fallback if empty
  const safeRevQueue = revisionQueue.length > 0
    ? revisionQueue
    : [{ topic: "General Topics", subject: dbSubjects[0]?.name ?? "All Subjects", code: "" }];

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
  // Separate cursor for revision queue so it advances independently
  let revCursor = 0;
  // Track flexible-day counts for the 40% cap
  let flexDayCount  = 0; // days that aren't finalRev / mockZone
  let revDayCount   = 0; // of those, how many are tagged "revision"
  const MAX_REV_RATIO = 0.40;

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

    } else {
      // ── Flexible day — apply 40% revision cap ──────────────────────────────
      flexDayCount++;

      // First-pass completion ratio (0–1). Weekend revision only kicks in
      // once the user is ≥50% through the first topic pass, so early weeks
      // stay fully focused on new material.
      const firstPassRatio = topicQueue.length > 0
        ? Math.min(1, topicCursor / topicQueue.length)
        : 1;

      // Whether this day "wants" to be revision based on position in calendar
      const wantsRevision =
        isRevZone ||
        (isWeekend && allowWeekendRevision && firstPassRatio >= 0.5);

      // Check 40% hard cap: if we've already hit it, force study instead
      const revRatio = revDayCount / Math.max(1, flexDayCount - 1);
      const capHit   = revRatio >= MAX_REV_RATIO;

      const topicsExhausted = topicCursor >= topicQueue.length;

      if (wantsRevision && !capHit) {
        // ── Specific revision day ──────────────────────────────────────────
        revDayCount++;
        const revEntry = safeRevQueue[revCursor % safeRevQueue.length];
        revCursor++;

        dayType = "revision";
        const mcqCount = Math.max(20, Math.round(dailyHours * 12));
        sessions = [{
          time: "Full Day",
          topic: `Revise: ${revEntry.topic}`,
          subject: revEntry.subject,
          subject_code: revEntry.code || undefined,
          duration: dailyHours * 60,
          tasks: [
            `Deep revision of ${revEntry.topic} (${revEntry.subject})`,
            `Solve ${mcqCount} focused MCQs on this topic`,
            "Re-read key formulas and shortcuts",
            "Attempt previous year questions on this topic",
          ],
          tip: `Targeted revision of ${revEntry.topic} builds accuracy faster than broad review.`,
        }];

      } else if (topicsExhausted) {
        // ── Topic queue exhausted — cycle through topics as "Deep Study" ───
        // Alternate 2 deep-study : 1 revision so revision never dominates.
        // revCursor % 3 === 2 → revision; otherwise → deep study
        const assignRevision = !capHit && (revCursor % 3 === 2);

        const revEntry = safeRevQueue[revCursor % safeRevQueue.length];
        revCursor++;

        if (assignRevision) {
          revDayCount++;
          dayType = "revision";
          const mcqCount = Math.max(20, Math.round(dailyHours * 12));
          sessions = [{
            time: "Full Day",
            topic: `Revise: ${revEntry.topic}`,
            subject: revEntry.subject,
            subject_code: revEntry.code || undefined,
            duration: dailyHours * 60,
            tasks: [
              `Targeted revision of ${revEntry.topic}`,
              `Solve ${mcqCount} MCQs on ${revEntry.topic}`,
              "Note error patterns and correct them",
              "Review previous year questions on this topic",
            ],
            tip: `Revisiting ${revEntry.topic} now deepens retention and boosts accuracy.`,
          }];
        } else {
          // Deep study: re-cover a topic with more depth
          dayType = "study";
          const mcqs = Math.max(20, Math.round(dailyHours * 10));
          sessions = [
            {
              time: "Morning",
              topic: `Deep Study: ${revEntry.topic}`,
              subject: revEntry.subject,
              subject_code: revEntry.code || undefined,
              duration: morningMins,
              tasks: [
                `In-depth study of ${revEntry.topic} (advanced level)`,
                "Solve harder practice problems",
                `Solve ${mcqs} MCQs with focus on accuracy`,
                "Build comprehensive notes on this topic",
              ],
              tip: `A second pass on ${revEntry.topic} uncovers gaps the first pass missed.`,
            },
            {
              time: "Evening",
              topic: `${revEntry.topic} — Practice`,
              subject: revEntry.subject,
              subject_code: revEntry.code || undefined,
              duration: eveningMins,
              tasks: [
                "Attempt timed practice set",
                "Review any mistakes immediately",
                "Note tricky question patterns",
              ],
              tip: "Evening practice consolidates morning learning.",
            },
          ];
        }

      } else {
        // ── Normal first-pass study day ──────────────────────────────────────
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
    strategy: `${planTypeLabel} for ${examType}: ${daysRemaining} days, ${totalTopics} topics. ${allowWeekendRevision ? "Weekdays for new topics, weekends for revision." : "All days focused on new topic introduction — revision starts once topics are covered."} Last ${finalRevDays + mockTestDays + revZoneDays} days reserved for mock tests and final revision.`,
    subjects,
    daily_plan,
  };
}

// ─── Claude AI enhancement ────────────────────────────────────────────────────

/**
 * Calls Claude to:
 *   1. Write a personalized 2-sentence strategy
 *   2. Generate one-sentence exam tips per topic
 *
 * Falls back gracefully if the API key is missing or the call fails.
 */
async function enhanceWithClaude(
  planData: FullPlanData,
  examType: string,
  daysRemaining: number,
  daysSinceJoined: number,
  completedSubjectCount: number,
  totalSubjects: number,
  weakAreas: WeakArea[],
  dailyHours: number,
): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    // No key configured — skip silently
    return;
  }

  try {
    const client = getAnthropic();

    // Build topic list from the first 80 unique study sessions
    const topicList: Array<{ key: string; label: string }> = [];
    const seen = new Set<string>();
    for (const day of planData.daily_plan) {
      if (day.day_type !== "study") continue;
      for (const s of day.sessions) {
        const cleanTopic = s.topic.replace(/ — (Practice|Revision)$/, "");
        const key = `${s.subject_code ?? s.subject}|${cleanTopic}`;
        if (!seen.has(key)) {
          seen.add(key);
          topicList.push({ key, label: `${s.subject} — ${cleanTopic}` });
        }
      }
      if (topicList.length >= 80) break;
    }

    const weakNote = weakAreas.length > 0
      ? `Weak areas: ${weakAreas.map(w => `${w.subject_code} (${w.score_pct}%)`).join(", ")}.`
      : "No weak areas identified yet (not enough quiz data).";

    const coverageNote = completedSubjectCount === 0
      ? "The student has NOT started studying yet — zero subjects covered."
      : `The student has covered ${completedSubjectCount} out of ${totalSubjects} subjects so far.`;

    const prompt = `You are an expert coach for the ${examType} Indian government exam.

Student profile:
- Days until exam: ${daysRemaining}
- Plan type: ${planData.plan_type}
- Days since joining: ${daysSinceJoined}
- ${coverageNote}
- ${weakNote}
- Daily study hours: ${dailyHours}

TASKS:
1. Write a 2-sentence, motivating, and SPECIFIC study strategy tailored to this student's current progress. If they are a beginner (0 subjects covered), focus on building foundations, NOT revision.
2. For each topic below, write a single practical exam tip specific to ${examType} (not generic advice).

Topics (format: "SubjectCode|TopicName: Subject — Topic"):
${topicList.map(t => `${t.key}: ${t.label}`).join("\n")}

Return ONLY valid JSON (no markdown, no code fences):
{
  "strategy": "...",
  "tips": {
    "${topicList[0]?.key ?? "example|topic"}": "one-sentence exam tip",
    ...
  }
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = message.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .replace(/```json\n?|\n?```/g, "")
      .trim();

    const aiData = JSON.parse(rawText);

    // Apply strategy
    if (aiData.strategy && typeof aiData.strategy === "string") {
      planData.strategy = aiData.strategy;
    }

    // Apply per-topic tips to daily_plan sessions
    if (aiData.tips && typeof aiData.tips === "object") {
      for (const day of planData.daily_plan) {
        for (const session of day.sessions) {
          const cleanTopic = session.topic.replace(/ — (Practice|Revision)$/, "");
          const key = `${session.subject_code ?? session.subject}|${cleanTopic}`;
          const tip = aiData.tips[key];
          if (tip) session.tip = tip;
        }
      }
      // Apply to subject topic list too
      for (const sub of planData.subjects) {
        for (const t of sub.topics) {
          const key = `${sub.subject_code ?? sub.name}|${t.name}`;
          if (aiData.tips[key]) t.tip = aiData.tips[key];
        }
      }
    }
  } catch (err: any) {
    // Non-fatal — plan is still useful without AI tips
    const msg = String(err?.message ?? err);
    const isAuthErr = msg.includes("401") || msg.includes("authentication") || msg.includes("API key");
    if (isAuthErr) {
      console.warn("Claude: invalid ANTHROPIC_API_KEY — add the key in Replit Secrets");
    } else {
      console.warn("Claude enhancement failed (non-fatal):", msg.slice(0, 200));
    }
  }
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
    // Seed first 14 days
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

  const plan = plans[0];
  const meta = (plan.planData as any)?._meta as { generated_date?: string; completed_subjects_snapshot?: number } | undefined;

  // ── Cache staleness check ──────────────────────────────────────────────────
  // Invalidate if: (a) plan is from a previous IST date, or
  //               (b) user completed a new subject since the plan was generated.
  if (meta?.generated_date) {
    const todayIST = getTodayIST();
    const currentCompleted = await fetchCompletedSubjectCount(profile.id);

    const dateStale = meta.generated_date !== todayIST;
    const progressChanged = meta.completed_subjects_snapshot !== undefined &&
      currentCompleted !== meta.completed_subjects_snapshot;

    if (dateStale || progressChanged) {
      // Delete the stale plan — the frontend's empty-state will auto-trigger /generate
      await db.delete(studyPlansTable).where(eq(studyPlansTable.userId, profile.id));
      return res.json({ plan: null, stale: true });
    }
  }

  res.json({ plan });
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

  // Days since the user joined (for Claude context)
  const daysSinceJoined = Math.max(0, Math.ceil(
    (today.getTime() - new Date(profile.createdAt).getTime()) / 86_400_000
  ));

  const [dbSubjects, weakAreas, completedSubjectCount] = await Promise.all([
    fetchExamData(examType),
    fetchWeakAreas(profile.id, examType),
    fetchCompletedSubjectCount(profile.id),
  ]);

  const weaksMap: Record<string, number> = {};
  for (const w of weakAreas) if (w.subject_code) weaksMap[w.subject_code] = w.score_pct;

  // Only allow weekend revision if the user has actually covered some topics
  const allowWeekendRevision = completedSubjectCount > 0;

  // Build the full calendar plan
  const planData = buildFullPlan(
    examDateObj, today, dbSubjects, weaksMap, dailyHours, examType, allowWeekendRevision
  );

  // Enhance with Claude: personalized strategy + per-topic tips
  await enhanceWithClaude(
    planData,
    examType,
    daysRemaining,
    daysSinceJoined,
    completedSubjectCount,
    dbSubjects.length,
    weakAreas,
    dailyHours,
  );

  // Store cache metadata in the plan so GET /current can validate freshness
  planData._meta = {
    generated_date: getTodayIST(),
    completed_subjects_snapshot: completedSubjectCount,
  };

  try {
    const plan = await savePlanAndSeedTasks(profile.id, examType, weeksRemaining, planData);
    res.json({ plan, source: "ai" });
  } catch (err: any) {
    req.log.error({ err: err?.message ?? String(err) }, "failed to save study plan");
    res.status(500).json({ error: "Failed to save study plan.", detail: err?.message });
  }
});

export default router;
