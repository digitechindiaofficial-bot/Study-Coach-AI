import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { currentAffairsTable } from "@workspace/db";
import { gte } from "drizzle-orm";

const router = Router();

router.get("/current-affairs", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const days = parseInt(req.query.days as string) || 7;
  const category = req.query.category as string | undefined;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  let items = await db
    .select()
    .from(currentAffairsTable)
    .where(gte(currentAffairsTable.publishedDate, cutoffStr))
    .orderBy(currentAffairsTable.publishedDate);

  if (category) {
    items = items.filter(i => i.category === category);
  }

  // Return most recent first
  items.reverse();
  res.json(items);
});

export default router;
