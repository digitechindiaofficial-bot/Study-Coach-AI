import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { currentAffairsTable, profilesTable } from "@workspace/db";
import { gte, eq, and, ne } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface GeneratedItem {
  title: string;
  summary?: string;
  category?: string;
  examRelevance?: string[];
  exam_relevance?: string[];
  isFeatured?: boolean;
}

const GEMINI_PROMPT = (today: string) =>
  `You are a current affairs expert for Indian government competitive exams (SSC CGL, IBPS PO, RRB NTPC, UPPSC, SBI PO).

Generate exactly 15 important current affairs items for ${today} relevant for Indian government exam aspirants.

Focus on: Economy (RBI, SEBI, Budget, inflation), Polity (Parliament, government schemes, judiciary), Science (ISRO, DRDO, new tech), Sports (Indian athletes), International (India's foreign relations), Awards (national/international recognitions).

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "title": "<concise headline under 100 characters>",
    "summary": "<2-3 sentences: who, what, and why it matters for exams. Include specific numbers, ranks, dates, or key facts examiners love>",
    "category": "<one of: Economy | Polity | Science | Sports | International | Awards>",
    "examRelevance": ["SSC" or "Banking" or "Railway" — relevant subset],
    "isFeatured": false
  }
]

Rules:
- All news must involve India or directly impact India
- Include concrete statistics (percentages, amounts, ranks, dates)
- Mark exactly 3 items as isFeatured: true — the ones most likely to appear in upcoming exams
- examRelevance must be a subset of ["SSC", "Banking", "Railway"]
- Vary categories: include at least 2 Economy, 2 Polity, 2 Science, 1 Sports, 1 International, 1 Awards`;

async function generateAndSave(today: string, logFn: (msg: string) => void) {
  // Delete today's existing AI-generated entries before inserting fresh ones —
  // but never touch admin-added entries, so refresh/auto-fetch can't wipe them out.
  logFn(`Deleting today's (${today}) non-admin entries from DB`);
  await db
    .delete(currentAffairsTable)
    .where(and(eq(currentAffairsTable.publishedDate, today), ne(currentAffairsTable.source, "Admin")));

  logFn("Calling Gemini to generate fresh content");
  let items: GeneratedItem[];
  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: GEMINI_PROMPT(today),
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });
    const text = response.text ?? "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    items = Array.isArray(parsed) ? parsed : [];
    if (items.length === 0) throw new Error("Empty response from Gemini");
    logFn(`Gemini returned ${items.length} items`);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    logFn(`Gemini generation failed: ${msg}`);
    throw new Error(`Current affairs generation failed: ${msg}`);
  }

  logFn(`Saving ${items.length} items to DB`);
  const rows = items.map(item => ({
    title: String(item.title ?? ""),
    summary: item.summary ? String(item.summary) : null,
    category: item.category ? String(item.category) : null,
    examRelevance: Array.isArray(item.examRelevance)
      ? item.examRelevance.map(String)
      : Array.isArray(item.exam_relevance)
        ? item.exam_relevance.map(String)
        : [],
    publishedDate: today,
    source: "AI Generated",
    isFeatured: item.isFeatured === true,
  }));

  const saved = await db.insert(currentAffairsTable).values(rows).returning();
  return { items: saved, source: "ai" as const };
}

// ── GET /current-affairs — fetch articles ──────────────────────────────────────
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
    .where(gte(currentAffairsTable.publishedDate, cutoffStr));

  if (category && category !== "All") {
    items = items.filter(i => i.category === category);
  }

  items.sort((a, b) => {
    const dateA = a.publishedDate ?? "";
    const dateB = b.publishedDate ?? "";
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
  });

  // Prevent caching so fresh data is always served after a refresh
  res.set("Cache-Control", "no-store");
  res.json(items);
});

// ── POST /current-affairs/today — auto-fetch today's news (idempotent) ────────
router.post("/current-affairs/today", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const force = req.body?.force === true || req.query?.force === "true";
  const today = new Date().toISOString().split("T")[0];

  if (!force) {
    const existing = await db
      .select()
      .from(currentAffairsTable)
      .where(eq(currentAffairsTable.publishedDate, today));
    if (existing.length > 0) {
      return res.json({ items: existing, cached: true });
    }
  }

  try {
    const { items, source } = await generateAndSave(today, (msg) => req.log.info(msg));
    res.json({ items, cached: false, source });
  } catch (err: any) {
    req.log.error({ err: String(err?.message ?? err) }, "current-affairs/today failed");
    res.status(500).json({ error: "Failed to generate current affairs." });
  }
});

// ── POST /current-affairs/refresh — Pro-only manual refresh ──────────────────
router.post("/current-affairs/refresh", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  req.log.info({ userId, time: new Date().toISOString() }, "Refresh called");
  req.log.info({ hasKey: !!process.env.GEMINI_API_KEY }, "Gemini key check");

  // Pro plan check
  const profiles = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);
  const profile = profiles[0] ?? null;

  if (!profile || profile.planType !== "pro") {
    return res.status(403).json({
      error: "pro_required",
      message: "News refresh is a Pro feature. Upgrade to access fresh AI-generated current affairs.",
    });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const { items, source } = await generateAndSave(today, (msg) => req.log.info(msg));
    req.log.info({ count: items.length, source }, "Refresh complete — saved to DB");
    res.set("Cache-Control", "no-store");
    res.json({ items, cached: false, source, refreshedAt: new Date().toISOString() });
  } catch (err: any) {
    req.log.error({ err: String(err?.message ?? err) }, "current-affairs/refresh failed");
    res.status(500).json({ error: "Failed to refresh current affairs." });
  }
});

export default router;
