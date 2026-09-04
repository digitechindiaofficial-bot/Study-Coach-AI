/**
 * Exam Manager Admin Routes
 *
 * GET    /api/admin/exams                               — list all exams with subject count
 * POST   /api/admin/exams                               — create exam
 * PUT    /api/admin/exams/:code                         — update exam
 * DELETE /api/admin/exams/:code                         — delete exam + subjects cascade
 * PUT    /api/admin/exams/:code/toggle-active           — flip is_active
 * PUT    /api/admin/exams/:code/toggle-featured         — flip is_featured
 * GET    /api/admin/exams/:code/subjects                — list subjects
 * POST   /api/admin/exams/:code/subjects                — add subject
 * PUT    /api/admin/exams/:code/subjects/:id            — update subject
 * DELETE /api/admin/exams/:code/subjects/:id            — delete subject
 * POST   /api/admin/exams/:code/subjects/:id/sync-count — sync total_questions from question_bank
 *
 * GET    /api/exams                                     — public list (active exams)
 * GET    /api/exams/:code/subjects                      — public subjects for an exam
 */

import { Router } from "express";
import { requireAdmin } from "../lib/require-admin.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { logDatabaseError } from "../lib/database-error";

const router = Router();

// ── Admin guard ──────────────────────────────────────────────────────────────

// ── Public routes ─────────────────────────────────────────────────────────────

router.get("/exams", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT e.*,
        COUNT(s.id)::int AS subject_count
      FROM syllabus_exams e
      LEFT JOIN syllabus_subjects s ON s.exam_id = e.id AND s.is_active = true
      WHERE e.is_active = true
      GROUP BY e.id
      ORDER BY e.display_order, e.name
    `);
    return res.json(result.rows);
  } catch (err) {
    logDatabaseError("GET /api/exams", err);
    return res.status(500).json({ error: "Failed to load exams" });
  }
});

router.get("/exams/:code/subjects", async (req, res) => {
  const result = await db.execute(sql`
    SELECT s.*
    FROM syllabus_subjects s
    JOIN syllabus_exams e ON e.id = s.exam_id
    WHERE e.code = ${req.params.code} AND s.is_active = true
    ORDER BY s.display_order, s.name
  `);
  res.json(result.rows);
});

// ── Admin middleware ──────────────────────────────────────────────────────────

router.use("/admin/exams", requireAdmin);

// ── Validation schemas ────────────────────────────────────────────────────────

const examSchema = z.object({
  code:           z.string().min(1).max(32).transform(s => s.toUpperCase()),
  name:           z.string().min(1),
  exam_full_name: z.string().optional().nullable(),
  category:       z.enum(["central","state","banking","railway","defence","teaching","other"]).default("central"),
  conducting_body:z.string().optional().nullable(),
  description:    z.string().optional().nullable(),
  eligibility:    z.string().optional().nullable(),
  exam_level:     z.enum(["national","state"]).default("national"),
  target_state:   z.string().optional().nullable(),
  is_active:      z.boolean().default(true),
  is_featured:    z.boolean().default(false),
  icon_emoji:     z.string().default("📝"),
  display_order:  z.coerce.number().int().default(0),
});

const subjectSchema = z.object({
  subject_code:     z.string().min(1).max(32).transform(s => s.toUpperCase()),
  name:             z.string().min(1),
  subject_full_name:z.string().optional().nullable(),
  syllabus_topics:  z.array(z.string()).default([]),
  total_marks:      z.coerce.number().int().optional().nullable(),
  duration_minutes: z.coerce.number().int().optional().nullable(),
  difficulty_level: z.enum(["easy","medium","hard","mixed"]).default("medium"),
  is_active:        z.boolean().default(true),
  display_order:    z.coerce.number().int().default(0),
});

// ── GET /api/admin/exams ──────────────────────────────────────────────────────

router.get("/admin/exams", async (_req, res) => {
  const result = await db.execute(sql`
    SELECT e.*,
      COUNT(s.id)::int AS subject_count
    FROM syllabus_exams e
    LEFT JOIN syllabus_subjects s ON s.exam_id = e.id
    GROUP BY e.id
    ORDER BY e.display_order, e.name
  `);
  res.json(result.rows);
});

// ── POST /api/admin/exams ─────────────────────────────────────────────────────

router.post("/admin/exams", async (req, res) => {
  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const existing = await db.execute(sql`SELECT id FROM syllabus_exams WHERE code = ${d.code}`);
  if ((existing.rows as any[]).length > 0) return res.status(409).json({ error: "Exam code already exists" });

  const result = await db.execute(sql`
    INSERT INTO syllabus_exams
      (code, name, exam_full_name, category, conducting_body, description, eligibility,
       exam_level, target_state, is_active, is_featured, icon_emoji, display_order, updated_at)
    VALUES
      (${d.code}, ${d.name}, ${d.exam_full_name ?? null}, ${d.category}, ${d.conducting_body ?? null},
       ${d.description ?? null}, ${d.eligibility ?? null}, ${d.exam_level}, ${d.target_state ?? null},
       ${d.is_active}, ${d.is_featured}, ${d.icon_emoji}, ${d.display_order}, NOW())
    RETURNING *
  `);
  res.status(201).json((result.rows as any[])[0]);
});

// ── PUT /api/admin/exams/:code ────────────────────────────────────────────────

router.put("/admin/exams/:code", async (req, res) => {
  const parsed = examSchema.omit({ code: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const code = req.params.code.toUpperCase();

  const result = await db.execute(sql`
    UPDATE syllabus_exams SET
      name             = ${d.name},
      exam_full_name   = ${d.exam_full_name ?? null},
      category         = ${d.category},
      conducting_body  = ${d.conducting_body ?? null},
      description      = ${d.description ?? null},
      eligibility      = ${d.eligibility ?? null},
      exam_level       = ${d.exam_level},
      target_state     = ${d.target_state ?? null},
      is_active        = ${d.is_active},
      is_featured      = ${d.is_featured},
      icon_emoji       = ${d.icon_emoji},
      display_order    = ${d.display_order},
      updated_at       = NOW()
    WHERE code = ${code}
    RETURNING *
  `);
  if ((result.rows as any[]).length === 0) return res.status(404).json({ error: "Not found" });
  res.json((result.rows as any[])[0]);
});

// ── DELETE /api/admin/exams/:code ─────────────────────────────────────────────

router.delete("/admin/exams/:code", async (req, res) => {
  const code = req.params.code.toUpperCase();
  await db.execute(sql`
    DELETE FROM syllabus_subjects WHERE exam_id = (SELECT id FROM syllabus_exams WHERE code = ${code})
  `);
  const result = await db.execute(sql`DELETE FROM syllabus_exams WHERE code = ${code} RETURNING id`);
  if ((result.rows as any[]).length === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// ── PUT /api/admin/exams/:code/toggle-active ──────────────────────────────────

router.put("/admin/exams/:code/toggle-active", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const result = await db.execute(sql`
    UPDATE syllabus_exams SET is_active = NOT is_active, updated_at = NOW()
    WHERE code = ${code} RETURNING *
  `);
  if ((result.rows as any[]).length === 0) return res.status(404).json({ error: "Not found" });
  res.json((result.rows as any[])[0]);
});

// ── PUT /api/admin/exams/:code/toggle-featured ────────────────────────────────

router.put("/admin/exams/:code/toggle-featured", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const result = await db.execute(sql`
    UPDATE syllabus_exams SET is_featured = NOT is_featured, updated_at = NOW()
    WHERE code = ${code} RETURNING *
  `);
  if ((result.rows as any[]).length === 0) return res.status(404).json({ error: "Not found" });
  res.json((result.rows as any[])[0]);
});

// ── GET /api/admin/exams/:code/subjects ──────────────────────────────────────

router.get("/admin/exams/:code/subjects", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const result = await db.execute(sql`
    SELECT s.*
    FROM syllabus_subjects s
    JOIN syllabus_exams e ON e.id = s.exam_id
    WHERE e.code = ${code}
    ORDER BY s.display_order, s.name
  `);
  res.json(result.rows);
});

// ── POST /api/admin/exams/:code/subjects ──────────────────────────────────────

router.post("/admin/exams/:code/subjects", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const parsed = subjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const examRow = await db.execute(sql`SELECT id FROM syllabus_exams WHERE code = ${code}`);
  if ((examRow.rows as any[]).length === 0) return res.status(404).json({ error: "Exam not found" });
  const examId = (examRow.rows as any[])[0].id;

  const dup = await db.execute(sql`SELECT id FROM syllabus_subjects WHERE exam_id = ${examId} AND subject_code = ${d.subject_code}`);
  if ((dup.rows as any[]).length > 0) return res.status(409).json({ error: "Subject code already exists for this exam" });

  const result = await db.execute(sql`
    INSERT INTO syllabus_subjects
      (exam_id, subject_code, name, subject_full_name, syllabus_topics, total_marks,
       duration_minutes, difficulty_level, is_active, display_order, updated_at)
    VALUES
      (${examId}, ${d.subject_code}, ${d.name}, ${d.subject_full_name ?? null},
       ${JSON.stringify(d.syllabus_topics)}::jsonb, ${d.total_marks ?? null},
       ${d.duration_minutes ?? null}, ${d.difficulty_level}, ${d.is_active}, ${d.display_order}, NOW())
    RETURNING *
  `);
  res.status(201).json((result.rows as any[])[0]);
});

// ── PUT /api/admin/exams/:code/subjects/:id ───────────────────────────────────

router.put("/admin/exams/:code/subjects/:id", async (req, res) => {
  const parsed = subjectSchema.omit({ subject_code: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const result = await db.execute(sql`
    UPDATE syllabus_subjects SET
      name              = ${d.name},
      subject_full_name = ${d.subject_full_name ?? null},
      syllabus_topics   = ${JSON.stringify(d.syllabus_topics)}::jsonb,
      total_marks       = ${d.total_marks ?? null},
      duration_minutes  = ${d.duration_minutes ?? null},
      difficulty_level  = ${d.difficulty_level},
      is_active         = ${d.is_active},
      display_order     = ${d.display_order},
      updated_at        = NOW()
    WHERE id = ${req.params.id}
    RETURNING *
  `);
  if ((result.rows as any[]).length === 0) return res.status(404).json({ error: "Not found" });
  res.json((result.rows as any[])[0]);
});

// ── DELETE /api/admin/exams/:code/subjects/:id ────────────────────────────────

router.delete("/admin/exams/:code/subjects/:id", async (req, res) => {
  const result = await db.execute(sql`DELETE FROM syllabus_subjects WHERE id = ${req.params.id} RETURNING id`);
  if ((result.rows as any[]).length === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// ── POST /api/admin/exams/:code/subjects/:id/sync-count ──────────────────────

router.post("/admin/exams/:code/subjects/:id/sync-count", async (req, res) => {
  const subRow = await db.execute(sql`SELECT subject_code, exam_id FROM syllabus_subjects WHERE id = ${req.params.id}`);
  if ((subRow.rows as any[]).length === 0) return res.status(404).json({ error: "Not found" });
  const { subject_code } = (subRow.rows as any[])[0];
  const code = req.params.code.toUpperCase();

  const countRes = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM question_bank
    WHERE exam_code = ${code} AND subject_code = ${subject_code} AND is_active = true
  `);
  const cnt = (countRes.rows as any[])[0]?.cnt ?? 0;

  const updated = await db.execute(sql`
    UPDATE syllabus_subjects SET total_questions = ${cnt}, updated_at = NOW()
    WHERE id = ${req.params.id} RETURNING *
  `);
  res.json({ total_questions: cnt, subject: (updated.rows as any[])[0] });
});

export default router;
