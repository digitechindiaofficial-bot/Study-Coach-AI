import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { currentAffairsTable, profilesTable } from "@workspace/db";
import { gte, eq, and, ne } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── Fallback template (15 items, used when Gemini quota is exhausted) ──────────
const TEMPLATE_15 = [
  { title: "RBI Keeps Repo Rate Unchanged at 6.5%", summary: "The Reserve Bank of India's Monetary Policy Committee kept the repo rate at 6.5% for the sixth consecutive meeting. The decision was unanimous and cites stable CPI inflation near the 4% target. Repo rate is the rate at which RBI lends to commercial banks — a core Banking exam topic.", category: "Economy", examRelevance: ["Banking", "SSC"], isFeatured: true },
  { title: "India's GDP Growth at 7.2% — Fastest Growing Major Economy", summary: "India's GDP grew 7.2% in the latest fiscal year, maintaining its position as the world's fastest-growing major economy. Manufacturing (8.1%) and services (7.8%) led the growth. IMF projects India to surpass Japan and Germany in nominal GDP by 2027.", category: "Economy", examRelevance: ["SSC", "Banking", "Railway"], isFeatured: false },
  { title: "SEBI Revises F&O Margin Requirements to Curb Speculation", summary: "SEBI has increased minimum margin requirements for futures and options trading to 25% from 15%. The new rules target retail investors over-exposed to derivatives. SEBI (Securities and Exchange Board of India) was established in 1988 and given statutory powers in 1992.", category: "Economy", examRelevance: ["Banking"], isFeatured: false },
  { title: "Parliament Passes Digital Personal Data Protection Bill", summary: "The Lok Sabha passed the Digital Personal Data Protection Bill with 342 votes in favour. The bill creates a Data Protection Board and mandates data fiduciaries to obtain consent. Violators face penalties up to ₹250 crore — highly relevant for polity and governance.", category: "Polity", examRelevance: ["SSC", "Banking"], isFeatured: true },
  { title: "PM-KISAN 17th Installment: ₹20,000 Crore Transferred to 9 Crore Farmers", summary: "Prime Minister released the 17th installment of PM-KISAN scheme, crediting ₹2,000 each to over 9 crore farmer beneficiaries via DBT. PM-KISAN provides ₹6,000 annually in three installments. Launched in 2019, it is a key government scheme for all competitive exams.", category: "Polity", examRelevance: ["SSC", "Banking", "Railway"], isFeatured: false },
  { title: "Supreme Court Upholds PMLA Provisions on Money Laundering", summary: "The Supreme Court upheld key provisions of the Prevention of Money Laundering Act (PMLA), including ED's power of arrest and attachment. The bench held that PMLA is a special law and its procedures are constitutionally valid. ED operates under the Finance Ministry.", category: "Polity", examRelevance: ["SSC", "Banking"], isFeatured: false },
  { title: "ISRO Successfully Launches GSAT-20 High-Throughput Satellite", summary: "ISRO's LVM3 rocket successfully placed the GSAT-20 communication satellite in geostationary orbit from Sriharikota. GSAT-20 will provide 48 Gbps broadband capacity, serving remote areas. LVM3 (formerly GSLV Mk III) is India's heaviest operational rocket with 10-tonne payload capacity.", category: "Science", examRelevance: ["SSC", "Railway"], isFeatured: true },
  { title: "DRDO Tests Hypersonic Missile Demonstrator Successfully", summary: "DRDO conducted a successful flight test of a Hypersonic Technology Demonstrator Vehicle (HSTDV) capable of speeds above Mach 6. India joins the US, Russia, and China in hypersonic missile capability. DRDO was established in 1958 under the Ministry of Defence.", category: "Science", examRelevance: ["SSC", "Railway"], isFeatured: false },
  { title: "India Achieves 500 GW Renewable Energy Capacity Target", summary: "India has installed 500 GW of renewable energy capacity, surpassing the Paris Agreement commitment target. Solar power contributes 350 GW (70%) of the renewable mix. India aims for net-zero emissions by 2070 and 50% energy from renewables by 2030.", category: "Science", examRelevance: ["SSC", "Banking"], isFeatured: false },
  { title: "Neeraj Chopra Wins Gold at Diamond League with 89.45m Throw", summary: "Neeraj Chopra won the Diamond League gold with a throw of 89.45 metres, reinforcing his status as world's top javelin thrower. Chopra is India's first Olympic gold medalist in track and field (Tokyo 2020). He also holds the national record of 89.94m.", category: "Sports", examRelevance: ["SSC", "Railway", "Banking"], isFeatured: false },
  { title: "India Beats Australia 3-1 to Win ICC Test Series", summary: "India defeated Australia 3-1 in the four-match Test series played in Australia. Virat Kohli top-scored with 512 runs across the series. India now holds the No. 1 position in the ICC World Test Championship standings.", category: "Sports", examRelevance: ["SSC", "Banking", "Railway"], isFeatured: false },
  { title: "India Ranks 39th in Global Innovation Index 2025", summary: "India improved to 39th in the Global Innovation Index 2025, up from 40th the previous year. India leads South Asia and Central & Southern Asia regions. The GII is published by WIPO (World Intellectual Property Organization) annually.", category: "International", examRelevance: ["SSC", "Banking"], isFeatured: false },
  { title: "India-UAE CEPA Enhanced: Bilateral Trade Target Set at $100 Billion", summary: "India and UAE enhanced their Comprehensive Economic Partnership Agreement (CEPA) signed in 2022, adding digital trade and green energy provisions. Bilateral trade reached $83 billion in 2024. UAE is India's 3rd largest trading partner and 2nd largest export destination.", category: "International", examRelevance: ["SSC", "Banking"], isFeatured: false },
  { title: "Padma Awards 2025: 132 Personalities Honoured by President", summary: "President Droupadi Murmu presented Padma Awards 2025 to 132 personalities: 4 Padma Vibhushan, 17 Padma Bhushan, and 111 Padma Shri. Padma Awards are announced on Republic Day (26 January) and conferred in March-April by the President at Rashtrapati Bhavan.", category: "Awards", examRelevance: ["SSC", "Banking", "Railway"], isFeatured: false },
  { title: "Sahitya Akademi Award 2024 Announced Across 24 Languages", summary: "Sahitya Akademi announced its 2024 awards for outstanding literary works across 24 Indian languages. The award carries ₹1 lakh cash prize and an engraved copper plaque. Sahitya Akademi was established in 1954 and is India's national academy of letters.", category: "Awards", examRelevance: ["SSC", "Banking"], isFeatured: false },
];

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
  let items: typeof TEMPLATE_15;
  let source: "ai" | "template" = "ai";

  // Delete today's existing AI/template entries before inserting fresh ones —
  // but never touch admin-added entries, so refresh/auto-fetch can't wipe them out.
  logFn(`Deleting today's (${today}) non-admin entries from DB`);
  await db
    .delete(currentAffairsTable)
    .where(and(eq(currentAffairsTable.publishedDate, today), ne(currentAffairsTable.source, "Admin")));

  logFn("Calling Gemini to generate fresh content");
  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: GEMINI_PROMPT(today),
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });
    const text = response.text ?? "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    items = Array.isArray(parsed) ? parsed : TEMPLATE_15;
    if (items.length === 0) throw new Error("Empty response from Gemini");
    logFn(`Gemini returned ${items.length} items`);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    const isQuota = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
    if (isQuota) {
      logFn("Gemini quota exhausted — using template current affairs");
      items = TEMPLATE_15;
      source = "template";
    } else {
      throw err;
    }
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
    source: source === "ai" ? "AI Generated" : "Study OS",
    isFeatured: item.isFeatured === true,
  }));

  const saved = await db.insert(currentAffairsTable).values(rows).returning();
  return { items: saved, source };
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
