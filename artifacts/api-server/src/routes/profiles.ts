import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpsertProfileBody } from "@workspace/api-zod";
import { recordActivityForStreak, resetStreakIfBroken } from "../lib/streak";
import { logDatabaseError } from "../lib/database-error";

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
  const healed = await resetStreakIfBroken(profile);
  res.json(healed);
});

router.put("/profiles/me", async (req, res) => {
  try {
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
  } catch (err) {
    logDatabaseError("PUT /api/profiles/me", err);
    return res.status(500).json({ error: "Failed to update profile" });
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

  const updated = await recordActivityForStreak(profile);
  res.json(updated);
});

export default router;
