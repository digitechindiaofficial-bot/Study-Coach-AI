import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  profilesTable,
  syllabusExamsTable,
  syllabusSubjectsTable,
  syllabusTopicsTable,
  userTopicProgressTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  const rows = await db.select().from(profilesTable).where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

const UpdateTopicProgressBody = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]),
});

router.get("/syllabus", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  if (!profile.examType) return res.json([]);

  const exams = await db.select().from(syllabusExamsTable)
    .where(eq(syllabusExamsTable.code, profile.examType))
    .orderBy(syllabusExamsTable.createdAt);
  if (exams.length === 0) return res.json([]);

  const examIds = exams.map((e) => e.id);
  const subjects = await db.select().from(syllabusSubjectsTable)
    .where(inArray(syllabusSubjectsTable.examId, examIds))
    .orderBy(syllabusSubjectsTable.displayOrder);

  const subjectIds = subjects.map((s) => s.id);
  const topics = subjectIds.length > 0
    ? await db.select().from(syllabusTopicsTable)
        .where(inArray(syllabusTopicsTable.subjectId, subjectIds))
        .orderBy(syllabusTopicsTable.displayOrder)
    : [];

  const topicIds = topics.map((t) => t.id);
  const progress = topicIds.length > 0
    ? await db.select().from(userTopicProgressTable)
        .where(and(eq(userTopicProgressTable.userId, profile.id), inArray(userTopicProgressTable.topicId, topicIds)))
    : [];

  const progressMap = new Map(progress.map((p) => [p.topicId, p]));

  const result = exams.map((exam) => ({
    id: exam.id,
    name: exam.name,
    code: exam.code,
    description: exam.description,
    subjects: subjects
      .filter((s) => s.examId === exam.id)
      .map((subject) => ({
        id: subject.id,
        name: subject.name,
        subjectCode: subject.subjectCode ?? null,
        topics: topics
          .filter((t) => t.subjectId === subject.id)
          .map((topic) => {
            const prog = progressMap.get(topic.id);
            return {
              id: topic.id,
              topicCode: topic.topicCode ?? null,
              name: topic.name,
              status: prog?.status ?? "not_started",
              lastRevisedAt: prog?.lastRevisedAt ?? null,
            };
          }),
      })),
  }));

  res.json(result);
});

router.patch("/syllabus/topics/:topicId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const parsed = UpdateTopicProgressBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: String(parsed.error) });

  const { topicId } = req.params;
  const { status } = parsed.data;

  const existing = await db.select().from(userTopicProgressTable)
    .where(and(eq(userTopicProgressTable.userId, profile.id), eq(userTopicProgressTable.topicId, topicId)))
    .limit(1);

  const updateData = {
    status,
    lastRevisedAt: status === "completed" ? new Date() : null,
  };

  if (existing.length > 0) {
    const [updated] = await db.update(userTopicProgressTable)
      .set(updateData)
      .where(and(eq(userTopicProgressTable.userId, profile.id), eq(userTopicProgressTable.topicId, topicId)))
      .returning();
    return res.json(updated);
  } else {
    const [created] = await db.insert(userTopicProgressTable)
      .values({ userId: profile.id, topicId, ...updateData })
      .returning();
    return res.json(created);
  }
});

export default router;
