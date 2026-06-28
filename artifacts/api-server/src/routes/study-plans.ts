import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable, studyPlansTable, dailyTasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { getSyllabusText } from "../lib/syllabi";

const router = Router();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function getProfileByClerkId(clerkUserId: string) {
  const rows = await db.select().from(profilesTable).where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

const EXAM_SUBJECTS: Record<string, Array<{ name: string; weightage_percent: number; recommended_hours: number; topics: string[] }>> = {
  SSC_CGL: [
    { name: "Quantitative Aptitude", weightage_percent: 25, recommended_hours: 80, topics: ["Number System", "Percentage", "Ratio & Proportion", "Algebra", "Geometry", "Trigonometry", "Data Interpretation", "Time & Work", "Speed & Distance"] },
    { name: "English Language", weightage_percent: 25, recommended_hours: 60, topics: ["Reading Comprehension", "Cloze Test", "Fill in the Blanks", "Error Spotting", "Sentence Improvement", "Synonyms & Antonyms", "Idioms & Phrases"] },
    { name: "General Intelligence", weightage_percent: 25, recommended_hours: 50, topics: ["Analogies", "Series", "Coding-Decoding", "Blood Relations", "Direction Sense", "Matrix", "Venn Diagrams", "Syllogism"] },
    { name: "General Awareness", weightage_percent: 25, recommended_hours: 60, topics: ["History", "Geography", "Polity", "Economics", "Science & Technology", "Current Affairs", "Sports", "Awards & Honours"] },
  ],
  BANKING: [
    { name: "Quantitative Aptitude", weightage_percent: 30, recommended_hours: 90, topics: ["Number Series", "Simplification", "Data Interpretation", "Quadratic Equations", "Percentage", "Profit & Loss", "Time & Work", "Probability"] },
    { name: "Reasoning Ability", weightage_percent: 30, recommended_hours: 70, topics: ["Puzzles & Seating Arrangement", "Syllogism", "Coding-Decoding", "Blood Relations", "Inequality", "Direction Sense", "Input-Output"] },
    { name: "English Language", weightage_percent: 20, recommended_hours: 50, topics: ["Reading Comprehension", "Cloze Test", "Para Jumbles", "Error Detection", "Fill in the Blanks", "Sentence Correction"] },
    { name: "General Awareness", weightage_percent: 20, recommended_hours: 40, topics: ["Banking Awareness", "Financial Awareness", "Current Affairs", "Static GK", "Government Schemes"] },
  ],
  RAILWAY: [
    { name: "Mathematics", weightage_percent: 30, recommended_hours: 80, topics: ["Number System", "LCM & HCF", "Percentage", "Ratio", "Time & Work", "Speed & Distance", "Geometry", "Mensuration"] },
    { name: "General Intelligence", weightage_percent: 25, recommended_hours: 55, topics: ["Analogies", "Alphabetical Series", "Coding-Decoding", "Mathematical Operations", "Conclusions", "Decision Making"] },
    { name: "General Science", weightage_percent: 25, recommended_hours: 65, topics: ["Physics", "Chemistry", "Biology", "Computer Basics", "Environmental Science"] },
    { name: "General Awareness", weightage_percent: 20, recommended_hours: 50, topics: ["History", "Geography", "Polity", "Economy", "Current Affairs", "Railways GK"] },
  ],
};

function buildTemplatePlan(examType: string, weeksRemaining: number, dailyHours: number) {
  const subjects = EXAM_SUBJECTS[examType] ?? EXAM_SUBJECTS["SSC_CGL"];
  const totalWeeks = Math.min(weeksRemaining, 12);
  const scheduleWeeks = Math.min(weeksRemaining, 4);

  const subjectList = subjects.map(s => ({
    name: s.name,
    weightage_percent: s.weightage_percent,
    recommended_hours: s.recommended_hours,
    topics: s.topics.map((t, i) => ({
      name: t,
      estimated_hours: 4,
      priority: i < 3 ? "high" : i < 6 ? "medium" : "low",
      week_number: (i % totalWeeks) + 1,
    })),
  }));

  const dayMinutes = dailyHours * 60;
  const subjectNames = subjects.map(s => s.name);

  const makeDay = (subjectIdx: number, topicIdx: number, type: string) => [{
    subject: subjectNames[subjectIdx % subjectNames.length],
    topic: subjects[subjectIdx % subjects.length].topics[topicIdx % subjects[subjectIdx % subjects.length].topics.length],
    duration_minutes: Math.min(dayMinutes, 90),
    type,
  }];

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

  const syllabusText = getSyllabusText(examType);

  const prompt = `You are an expert study planner for Indian government competitive examinations.

Student Profile:
- Exam: ${examType}
- Exam Date: ${examDate ?? "in 12 weeks"}
- Weeks Remaining: ${weeksRemaining}
- Daily Study Hours: ${dailyHours}

Create a detailed, week-by-week study plan. Be specific about topics, not vague.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "exam": "${examType}",
  "total_weeks": ${Math.min(weeksRemaining, 12)},
  "strategy": "<2-3 sentence overall strategy>",
  "subjects": [
    {
      "name": "<subject>",
      "weightage_percent": <number>,
      "recommended_hours": <number>,
      "topics": [
        {
          "name": "<topic name>",
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

SYLLABUS REFERENCE for ${examType}:
${syllabusText}

Generate exactly ${Math.min(weeksRemaining, 4)} weeks of schedule (or up to 4 for brevity).`;

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
      planData = buildTemplatePlan(examType, weeksRemaining, dailyHours);
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
