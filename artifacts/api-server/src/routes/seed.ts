/**
 * Seed routes — called from Replit scripts/src/call-prod-seed.ts
 * Protected by SEED_TOKEN env var (shared secret, not Clerk auth).
 *
 * GET  /api/seed/status         — row counts in all content tables
 * POST /api/seed/exams          — upsert syllabus_exams rows
 * POST /api/seed/subjects       — upsert syllabus_subjects rows
 * POST /api/seed/topics         — upsert syllabus_topics rows
 * POST /api/seed/questions      — upsert question_bank rows
 * POST /api/seed/current-affairs — upsert current_affairs rows
 * POST /api/seed/blog-posts     — upsert blog_posts rows
 * POST /api/seed/exam-patterns  — upsert exam_patterns rows
 * POST /api/seed/mock-tests     — upsert mock_tests rows
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { pool } from "@workspace/db";

const router = Router();

// ── Auth guard ────────────────────────────────────────────────────────────────

function requireSeedToken(req: Request, res: Response, next: NextFunction): void {
  const token = (process.env.SEED_TOKEN ?? "").trim();
  if (!token) {
    res.status(503).json({ error: "SEED_TOKEN not configured on this server" });
    return;
  }
  // Accept token from Authorization header OR ?token= query param
  const auth = req.headers.authorization ?? "";
  const fromHeader = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const fromQuery = typeof req.query.token === "string" ? req.query.token.trim() : "";
  const provided = fromHeader || fromQuery;
  if (provided !== token) {
    // Log first/last chars for debugging (never log full token)
    console.error(`[seed] token mismatch — expected len=${token.length} first3=${token.slice(0,3)} last3=${token.slice(-3)}, got len=${provided.length} first3=${provided.slice(0,3)} last3=${provided.slice(-3)}`);
    res.status(401).json({ error: "Invalid seed token" });
    return;
  }
  next();
}

router.use("/seed", requireSeedToken);

// ── Status ────────────────────────────────────────────────────────────────────

router.get("/seed/status", async (_req, res) => {
  const tables = [
    "syllabus_exams", "syllabus_subjects", "syllabus_topics",
    "question_bank", "current_affairs", "blog_posts",
    "exam_patterns", "mock_tests",
  ];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int c FROM ${t}`);
      counts[t] = r.rows[0].c;
    } catch {
      counts[t] = -1;
    }
  }
  res.json(counts);
});

// ── Generic upsert helper ─────────────────────────────────────────────────────

/**
 * Builds a parameterized INSERT ... ON CONFLICT (id) DO NOTHING
 * from an array of plain objects. All objects must have the same keys.
 */
async function upsertRows(table: string, rows: Record<string, unknown>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const cols = Object.keys(rows[0]);
  let inserted = 0;
  // batch in groups of 50 to stay within param limits
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const valueSets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const row of batch) {
      const placeholders = cols.map(() => `$${idx++}`).join(", ");
      valueSets.push(`(${placeholders})`);
      for (const col of cols) params.push(row[col] ?? null);
    }
    const sql = `INSERT INTO ${table} (${colList}) VALUES ${valueSets.join(", ")} ON CONFLICT (id) DO NOTHING`;
    const r = await pool.query(sql, params);
    inserted += r.rowCount ?? 0;
  }
  return inserted;
}

// ── Exams ─────────────────────────────────────────────────────────────────────

router.post("/seed/exams", async (req, res) => {
  try {
    // Ensure extra columns exist (idempotent)
    await pool.query(`
      ALTER TABLE syllabus_exams
        ADD COLUMN IF NOT EXISTS exam_full_name    text,
        ADD COLUMN IF NOT EXISTS category          text NOT NULL DEFAULT 'central',
        ADD COLUMN IF NOT EXISTS conducting_body   text,
        ADD COLUMN IF NOT EXISTS eligibility       text,
        ADD COLUMN IF NOT EXISTS exam_level        text NOT NULL DEFAULT 'national',
        ADD COLUMN IF NOT EXISTS target_state      text,
        ADD COLUMN IF NOT EXISTS is_active         boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS is_featured       boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS icon_emoji        text NOT NULL DEFAULT '📝',
        ADD COLUMN IF NOT EXISTS display_order     integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at        timestamptz DEFAULT now()
    `);
    const rows = req.body as Record<string, unknown>[];
    const inserted = await upsertRows("syllabus_exams", rows);
    res.json({ inserted, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Subjects ──────────────────────────────────────────────────────────────────

router.post("/seed/subjects", async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE syllabus_subjects
        ADD COLUMN IF NOT EXISTS subject_code      text,
        ADD COLUMN IF NOT EXISTS subject_full_name text,
        ADD COLUMN IF NOT EXISTS syllabus_topics   text[],
        ADD COLUMN IF NOT EXISTS total_questions   integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_marks       integer,
        ADD COLUMN IF NOT EXISTS duration_minutes  integer,
        ADD COLUMN IF NOT EXISTS difficulty_level  text NOT NULL DEFAULT 'medium',
        ADD COLUMN IF NOT EXISTS is_active         boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS updated_at        timestamptz DEFAULT now()
    `);
    const rows = req.body as Record<string, unknown>[];
    const inserted = await upsertRows("syllabus_subjects", rows);
    res.json({ inserted, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Topics ────────────────────────────────────────────────────────────────────

router.post("/seed/topics", async (req, res) => {
  try {
    const rows = req.body as Record<string, unknown>[];
    const inserted = await upsertRows("syllabus_topics", rows);
    res.json({ inserted, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Questions ─────────────────────────────────────────────────────────────────

router.post("/seed/questions", async (req, res) => {
  try {
    const rows = req.body as Record<string, unknown>[];
    const inserted = await upsertRows("question_bank", rows);
    res.json({ inserted, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Current Affairs ───────────────────────────────────────────────────────────

router.post("/seed/current-affairs", async (req, res) => {
  try {
    const rows = req.body as Record<string, unknown>[];
    const inserted = await upsertRows("current_affairs", rows);
    res.json({ inserted, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Blog Posts ────────────────────────────────────────────────────────────────

router.post("/seed/blog-posts", async (req, res) => {
  try {
    const rows = req.body as Record<string, unknown>[];
    const inserted = await upsertRows("blog_posts", rows);
    res.json({ inserted, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Exam Patterns ─────────────────────────────────────────────────────────────

router.post("/seed/exam-patterns", async (req, res) => {
  try {
    const rows = req.body as Record<string, unknown>[];
    const inserted = await upsertRows("exam_patterns", rows);
    res.json({ inserted, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Mock Tests ────────────────────────────────────────────────────────────────

router.post("/seed/mock-tests", async (req, res) => {
  try {
    const rows = req.body as Record<string, unknown>[];
    const inserted = await upsertRows("mock_tests", rows);
    res.json({ inserted, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
