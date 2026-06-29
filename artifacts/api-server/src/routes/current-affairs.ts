import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { currentAffairsTable } from "@workspace/db";
import { gte, eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const TODAY_TEMPLATE = [
  {
    title: "RBI Keeps Repo Rate Unchanged at 6.5% in Monetary Policy Meeting",
    summary: "The Reserve Bank of India's Monetary Policy Committee unanimously decided to keep the repo rate unchanged at 6.5%. The MPC cited stable inflation and steady GDP growth as key reasons. This decision is significant for banking sector exams as it impacts credit growth and liquidity.",
    category: "Economy",
    examRelevance: ["Banking", "SSC"],
    isFeatured: true,
  },
  {
    title: "India's GDP Growth Rate Reaches 7.2% for Current Fiscal Year",
    summary: "India's economy grew at 7.2% in the current fiscal year, making it the fastest-growing major economy globally. The growth was driven by strong manufacturing output, services sector expansion, and increased government capex. Key sectors like IT, pharma, and automobile contributed significantly.",
    category: "Economy",
    examRelevance: ["SSC", "Banking", "Railway"],
    isFeatured: false,
  },
  {
    title: "Parliament Passes Digital Personal Data Protection Amendment Bill",
    summary: "The Parliament has passed the Digital Personal Data Protection Amendment Bill, strengthening data privacy regulations for Indian citizens. The bill mandates strict penalties for data breaches and establishes a Data Protection Board. This is relevant for polity and governance sections of competitive exams.",
    category: "Polity",
    examRelevance: ["SSC", "Banking"],
    isFeatured: true,
  },
  {
    title: "ISRO Successfully Launches GSAT-20 Communication Satellite",
    summary: "ISRO successfully launched the GSAT-20 high-throughput communication satellite using the LVM3 launch vehicle from Sriharikota. The satellite will provide broadband internet connectivity across India, especially in remote areas. GSAT-20 has a lifespan of 14 years and will boost digital India initiatives.",
    category: "Science",
    examRelevance: ["SSC", "Railway"],
    isFeatured: false,
  },
  {
    title: "India Signs Free Trade Agreement with UAE, Expanding Bilateral Trade",
    summary: "India and the UAE have strengthened their Comprehensive Economic Partnership Agreement (CEPA) with new provisions covering digital trade and renewable energy. Bilateral trade is expected to reach $100 billion by 2030. The FTA covers over 100 product categories and services sectors.",
    category: "International",
    examRelevance: ["SSC", "Banking"],
    isFeatured: false,
  },
  {
    title: "Neeraj Chopra Wins Gold at Diamond League Athletics Event",
    summary: "Star javelin thrower Neeraj Chopra won the gold medal at the prestigious Diamond League meet with a throw of 89.45 metres. This victory strengthens his position as world's best javelin thrower. Neeraj is India's first Olympic gold medalist in track and field (Tokyo 2020).",
    category: "Sports",
    examRelevance: ["SSC", "Railway", "Banking"],
    isFeatured: false,
  },
  {
    title: "PM Launches PM-KISAAN 17th Installment, Transfers Rs 20,000 Crore",
    summary: "Prime Minister launched the 17th installment of PM-KISAN scheme, directly transferring Rs 20,000 crore to over 9 crore farmer families. PM-KISAN provides Rs 6,000 annually in three equal installments of Rs 2,000 each. The scheme is a central topic in government schemes GK for competitive exams.",
    category: "Polity",
    examRelevance: ["SSC", "Banking", "Railway"],
    isFeatured: true,
  },
  {
    title: "India Achieves 500 GW Renewable Energy Target Milestone",
    summary: "India has achieved a significant milestone by installing 500 GW of renewable energy capacity, crossing the target set under the Paris Agreement commitments. Solar power contributes 70% of the renewable mix. India aims to achieve net-zero carbon emissions by 2070.",
    category: "Science",
    examRelevance: ["SSC", "Banking"],
    isFeatured: false,
  },
  {
    title: "Padma Awards 2025 Announced: 132 Personalities Honoured",
    summary: "The Government of India announced Padma Awards 2025 honouring 132 personalities in fields of arts, science, sports, and public service. Four Padma Vibhushan, 17 Padma Bhushan, and 111 Padma Shri awards were given. Padma Awards are announced on Republic Day and presented by the President.",
    category: "Awards",
    examRelevance: ["SSC", "Banking", "Railway"],
    isFeatured: false,
  },
  {
    title: "SEBI Tightens Rules for Stock Market Derivatives Trading",
    summary: "SEBI (Securities and Exchange Board of India) has announced stricter margin requirements and position limits for derivatives trading to curb speculation. The new rules will require higher margins for F&O positions. SEBI is the regulator of Indian capital markets — a key Banking exam topic.",
    category: "Economy",
    examRelevance: ["Banking"],
    isFeatured: false,
  },
  {
    title: "India Ranks 39th in Global Innovation Index 2025",
    summary: "India has improved its ranking to 39th position in the Global Innovation Index 2025, up from 40th last year. India leads South Asia and is among the top 40 innovative economies globally. Key innovations in digital payments, space technology, and pharma drive the ranking.",
    category: "International",
    examRelevance: ["SSC", "Banking"],
    isFeatured: false,
  },
  {
    title: "National Education Policy 2020 Implementation: 5000 New Skill Centers Opened",
    summary: "Under the National Education Policy 2020 implementation, the government has inaugurated 5,000 new skill development centers across India under PM SHRI scheme. These centers focus on vocational training aligned with industry needs. NEP 2020 replaced the 34-year-old Education Policy of 1986.",
    category: "Polity",
    examRelevance: ["SSC", "Railway"],
    isFeatured: false,
  },
];

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
    return dateB.localeCompare(dateA);
  });

  res.json(items);
});

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

  const prompt = `You are an expert current affairs curator for Indian government competitive exam aspirants (SSC, Banking, Railway, State PSC).

Generate exactly 12 current affairs news items that are HIGHLY RELEVANT for Indian government exam aspirants preparing for SSC CGL, IBPS PO, RRB NTPC, UPPSC etc.

Focus on: Indian government schemes, RBI/SEBI announcements, science & technology achievements (especially ISRO/DRDO), sports achievements by Indian athletes, international relations involving India, awards and recognitions, parliament/judiciary news.

Return ONLY valid JSON array, no markdown, no explanation:
[
  {
    "title": "<concise headline, max 100 chars>",
    "summary": "<2-3 sentences covering who, what, why it matters for exams. Include key facts like dates, numbers, ranks>",
    "category": "<one of: Economy | Polity | Science | Sports | International | Awards>",
    "examRelevance": ["SSC", "Banking", "Railway"],
    "isFeatured": false
  }
]

Rules:
- All news must be about India or directly involving India
- Include specific numbers, ranks, facts — not vague statements
- examRelevance is a subset of ["SSC", "Banking", "Railway"] — match to the topic
- Mark 2-3 items as isFeatured: true (most important for exams)
- Categories: Economy (budget, RBI, inflation), Polity (parliament, schemes, judiciary), Science (ISRO, DRDO, tech), Sports (Indian athletes), International (India's foreign relations), Awards (national/international)`;

  let items: typeof TODAY_TEMPLATE;
  let source = "ai";

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { maxOutputTokens: 4096, responseMimeType: "application/json" },
    });
    const text = response.text ?? "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    items = JSON.parse(cleaned);
  } catch (err: any) {
    const errStr = String(err?.message ?? err);
    const isQuota = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
    if (isQuota) {
      req.log.warn("Gemini quota exhausted — using template current affairs");
      items = TODAY_TEMPLATE;
      source = "template";
    } else {
      req.log.error({ err: errStr }, "current affairs generation failed");
      return res.status(500).json({ error: "Failed to generate current affairs.", detail: errStr });
    }
  }

  const rows = items.map(item => ({
    title: item.title,
    summary: item.summary,
    category: item.category,
    examRelevance: item.examRelevance,
    publishedDate: today,
    source: source === "ai" ? "AI Generated" : "Study OS",
    isFeatured: item.isFeatured ?? false,
  }));

  const saved = await db.insert(currentAffairsTable).values(rows).returning();
  res.json({ items: saved, cached: false, source });
});

export default router;
