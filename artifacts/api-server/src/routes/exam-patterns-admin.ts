/**
 * Exam Patterns Admin Routes
 *
 * GET    /api/admin/exam-patterns          — list all
 * POST   /api/admin/exam-patterns          — create
 * PUT    /api/admin/exam-patterns/:id      — update
 * DELETE /api/admin/exam-patterns/:id      — delete
 * POST   /api/admin/exam-patterns/seed     — seed default patterns (idempotent)
 * GET    /api/exam-patterns                — public list (for user-facing selects)
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { examPatternsTable, DEFAULT_EXAM_PATTERNS } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── Admin guard ─────────────────────────────────────────────────────────────

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const adminEmail = process.env.ADMIN_EMAIL;
  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ?? null;
    if (!adminEmail || !email || email.toLowerCase() !== adminEmail.toLowerCase()) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  } catch { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

// ── Public route — exam patterns for user-facing dropdowns ──────────────────

router.get("/exam-patterns", async (req, res) => {
  const patterns = await db
    .select()
    .from(examPatternsTable)
    .where(eq(examPatternsTable.isActive, true))
    .orderBy(asc(examPatternsTable.examName));
  res.json(patterns);
});

// ── Admin routes ─────────────────────────────────────────────────────────────

router.use("/admin/exam-patterns", requireAdmin);

const patternSchema = z.object({
  examCode: z.string().min(1),
  examName: z.string().min(1),
  mockType: z.enum(["FULL_MOCK", "SUBJECT_TEST", "TOPIC_TEST", "PYQ_TEST"]).default("FULL_MOCK"),
  totalQuestions: z.coerce.number().int().positive(),
  totalMarks: z.coerce.number().int().positive(),
  timeLimitMinutes: z.coerce.number().int().positive(),
  markPerQuestion: z.coerce.number().positive().default(1),
  negativeMarking: z.coerce.number().min(0).default(0),
  sectionWiseConfig: z.array(z.object({
    name: z.string(),
    subjectCode: z.string(),
    questionCount: z.number().int().positive(),
    marksPerQuestion: z.number().positive(),
    negativeMarks: z.number().min(0).default(0),
    orderNum: z.number().int().default(1),
  })).optional().nullable(),
  isActive: z.boolean().default(true),
});

router.get("/admin/exam-patterns", async (req, res) => {
  const patterns = await db
    .select()
    .from(examPatternsTable)
    .orderBy(asc(examPatternsTable.examName));
  res.json(patterns);
});

router.post("/admin/exam-patterns", async (req, res) => {
  const parsed = patternSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [pattern] = await db
    .insert(examPatternsTable)
    .values({
      ...parsed.data,
      markPerQuestion: String(parsed.data.markPerQuestion),
      negativeMarking: String(parsed.data.negativeMarking),
    })
    .returning();
  res.status(201).json(pattern);
});

router.put("/admin/exam-patterns/:id", async (req, res) => {
  const parsed = patternSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const update: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.markPerQuestion !== undefined) update.markPerQuestion = String(parsed.data.markPerQuestion);
  if (parsed.data.negativeMarking !== undefined) update.negativeMarking = String(parsed.data.negativeMarking);

  const [updated] = await db
    .update(examPatternsTable)
    .set(update)
    .where(eq(examPatternsTable.id, req.params.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/admin/exam-patterns/:id", async (req, res) => {
  const [updated] = await db
    .update(examPatternsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(examPatternsTable.id, req.params.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ deleted: true });
});

// ── Seed default patterns (idempotent) ───────────────────────────────────────

router.post("/admin/exam-patterns/seed", async (req, res) => {
  const results: { examCode: string; action: "created" | "exists" }[] = [];

  for (const pattern of DEFAULT_EXAM_PATTERNS) {
    const existing = await db
      .select({ id: examPatternsTable.id })
      .from(examPatternsTable)
      .where(eq(examPatternsTable.examCode, pattern.examCode))
      .limit(1);

    if (existing[0]) {
      results.push({ examCode: pattern.examCode, action: "exists" });
    } else {
      await db.insert(examPatternsTable).values({
        ...pattern,
        markPerQuestion: String(pattern.markPerQuestion),
        negativeMarking: String(pattern.negativeMarking),
      });
      results.push({ examCode: pattern.examCode, action: "created" });
    }
  }

  res.json({ seeded: results });
});

export default router;
