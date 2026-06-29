import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpsertProfileBody } from "@workspace/api-zod";

const router = Router();

async function getOrCreateProfile(clerkUserId: string) {
  const existing = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return existing[0] ?? null;
}

router.get("/profiles/me", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getOrCreateProfile(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  res.json(profile);
});

router.put("/profiles/me", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = UpsertProfileBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error });

  const existing = await getOrCreateProfile(userId);

  if (existing) {
    const [updated] = await db
      .update(profilesTable)
      .set(parsed.data)
      .where(eq(profilesTable.clerkUserId, userId))
      .returning();
    return res.json(updated);
  } else {
    const [created] = await db
      .insert(profilesTable)
      .values({ clerkUserId: userId, ...parsed.data })
      .returning();
    return res.json(created);
  }
});

router.patch("/profiles/plan", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { planType } = req.body ?? {};
  if (planType !== "free" && planType !== "pro") {
    return res.status(400).json({ error: "planType must be 'free' or 'pro'" });
  }

  const profile = await getOrCreateProfile(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const [updated] = await db
    .update(profilesTable)
    .set({ planType })
    .where(eq(profilesTable.clerkUserId, userId))
    .returning();

  res.json(updated);
});

router.post("/profiles/me/streak", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getOrCreateProfile(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const today = new Date().toISOString().split("T")[0];
  const lastActive = profile.lastActiveDate;

  let newStreak = profile.streakCount;
  if (lastActive === today) {
    // Already updated today
  } else if (lastActive) {
    const last = new Date(lastActive);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    newStreak = diffDays === 1 ? profile.streakCount + 1 : 1;
  } else {
    newStreak = 1;
  }

  const [updated] = await db
    .update(profilesTable)
    .set({ streakCount: newStreak, lastActiveDate: today })
    .where(eq(profilesTable.clerkUserId, userId))
    .returning();

  res.json(updated);
});

export default router;
