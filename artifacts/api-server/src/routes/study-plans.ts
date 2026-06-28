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

router.get("/study-plans/current", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const plans = await db.select().from(studyPlansTable)
    .where(eq(studyPlansTable.userId, profile.id))
    .orderBy(desc(studyPlansTable.createdAt))
    .limit(1);

  if (!plans[0]) return res.status(404).json({ error: "No study plan found" });
  res.json(plans[0]);
});

router.post("/study-plans/generate", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

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

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const planData = JSON.parse(cleaned);

    // Delete old plans
    await db.delete(studyPlansTable).where(eq(studyPlansTable.userId, profile.id));

    // Save new plan
    const [plan] = await db.insert(studyPlansTable).values({
      userId: profile.id,
      examType,
      planData,
      weeksRemaining,
    }).returning();

    // Seed daily tasks for next 7 days based on plan
    const today = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const taskRows: {
      userId: string;
      date: string;
      subject: string;
      topic: string;
      durationMinutes: number;
      taskType: string;
      isCompleted: boolean;
    }[] = [];

    const weekSchedule = planData.weekly_schedule?.[0];
    if (weekSchedule?.daily_tasks) {
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dayName = dayNames[date.getDay()];
        const dateTasks = weekSchedule.daily_tasks[dayName] ?? [];
        for (const t of dateTasks) {
          taskRows.push({
            userId: profile.id,
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

    res.json(plan);
  } catch (err: any) {
    req.log.error({ err: err?.message ?? String(err) }, "study plan generation failed");
    res.status(500).json({ error: "Failed to generate study plan. Please try again.", detail: err?.message });
  }
});

export default router;
