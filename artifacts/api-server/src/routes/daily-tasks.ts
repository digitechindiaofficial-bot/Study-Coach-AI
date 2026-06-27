import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable, dailyTasksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

async function getProfileByClerkId(clerkUserId: string) {
  const rows = await db.select().from(profilesTable).where(eq(profilesTable.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

router.get("/daily-tasks", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const date = (req.query.date as string) ?? new Date().toISOString().split("T")[0];

  const tasks = await db
    .select()
    .from(dailyTasksTable)
    .where(and(eq(dailyTasksTable.userId, profile.id), eq(dailyTasksTable.date, date)));

  res.json(tasks);
});

router.post("/daily-tasks/:id/complete", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfileByClerkId(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const [updated] = await db
    .update(dailyTasksTable)
    .set({ isCompleted: true, completedAt: new Date() })
    .where(and(eq(dailyTasksTable.id, req.params.id), eq(dailyTasksTable.userId, profile.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Task not found" });
  res.json(updated);
});

export default router;
