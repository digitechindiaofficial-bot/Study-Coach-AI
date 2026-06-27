import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable, syllabusProgressTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { UpdateSyllabusItemBody } from "@workspace/api-zod";
import { getSyllabusForExam } from "../lib/syllabi";

const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  const rows = await db.select().from(profilesTable).where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

router.get("/syllabus", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  let query = db.select().from(syllabusProgressTable).where(eq(syllabusProgressTable.userId, profile.id)).$dynamic();

  const items = await query;

  let filtered = items;
  if (req.query.subject) {
    filtered = filtered.filter(i => i.subject === req.query.subject);
  }
  if (req.query.status) {
    if (req.query.status === "weak") {
      filtered = filtered.filter(i => i.confidence === "weak");
    } else {
      filtered = filtered.filter(i => i.status === req.query.status);
    }
  }

  res.json(filtered);
});

router.patch("/syllabus/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const parsed = UpdateSyllabusItemBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error });

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "completed") {
    updateData.lastRevisedAt = new Date();
  }

  const [updated] = await db
    .update(syllabusProgressTable)
    .set(updateData)
    .where(and(eq(syllabusProgressTable.id, req.params.id), eq(syllabusProgressTable.userId, profile.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Item not found" });
  res.json(updated);
});

router.post("/syllabus/seed", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const examType = profile.examType ?? "SSC_CGL";

  // Check if already seeded
  const existing = await db.select({ id: syllabusProgressTable.id }).from(syllabusProgressTable)
    .where(eq(syllabusProgressTable.userId, profile.id)).limit(1);

  if (existing.length > 0) {
    return res.json({ seeded: 0, message: "Syllabus already seeded" });
  }

  const topics = getSyllabusForExam(examType);
  const rows = topics.map(t => ({
    userId: profile.id,
    examType,
    subject: t.subject,
    topic: t.topic,
    subtopic: t.subtopic,
    status: "not_started" as const,
  }));

  await db.insert(syllabusProgressTable).values(rows);
  res.json({ seeded: rows.length, message: `Seeded ${rows.length} topics for ${examType}` });
});

export default router;
