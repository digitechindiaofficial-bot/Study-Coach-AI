/**
 * ONE-TIME production seeding endpoint — protected by SEED_TOKEN env var.
 * Uses the raw pg pool (bypasses Drizzle) for reliable bulk inserts.
 * DELETE THIS FILE after seeding is complete.
 */
import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

function checkToken(req: any, res: any): boolean {
  const token = process.env.SEED_TOKEN;
  if (!token) { res.status(503).json({ error: "SEED_TOKEN not configured" }); return false; }
  if (req.headers["authorization"] !== `Bearer ${token}`) {
    res.status(401).json({ error: "Unauthorized" }); return false;
  }
  return true;
}

async function bulkInsert(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const params: unknown[] = [];
  const placeholders = rows.map((row) => {
    const start = params.length + 1;
    columns.forEach((col) => params.push(row[col] ?? null));
    return `(${columns.map((_, i) => `$${start + i}`).join(", ")})`;
  });
  const colList = columns.map((c) => `"${c}"`).join(", ");
  const query = `INSERT INTO ${table} (${colList}) VALUES ${placeholders.join(", ")} ON CONFLICT (id) DO NOTHING`;
  await pool.query(query, params);
  return rows.length;
}

router.post("/seed/exams", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const rows = req.body as Record<string, unknown>[];
    const n = await bulkInsert("syllabus_exams", [
      "id","name","code","description","created_at","exam_full_name",
      "category","conducting_body","eligibility","exam_level","target_state",
      "is_active","is_featured","icon_emoji",
    ], rows);
    res.json({ inserted: n });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/seed/subjects", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const rows = req.body as Record<string, unknown>[];
    const n = await bulkInsert("syllabus_subjects", [
      "id","exam_id","name","display_order","created_at","subject_code",
      "subject_full_name","syllabus_topics","total_questions","total_marks",
      "duration_minutes","difficulty_level","is_active",
    ], rows);
    res.json({ inserted: n });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/seed/topics", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const rows = req.body as Record<string, unknown>[];
    const n = await bulkInsert("syllabus_topics", [
      "id","subject_id","name","display_order","created_at","topic_code",
    ], rows);
    res.json({ inserted: n });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/seed/questions", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const rows = req.body as Record<string, unknown>[];
    const n = await bulkInsert("question_bank", [
      "id","exam_code","subject_code","topic_code","difficulty","question",
      "option_a","option_b","option_c","option_d","correct_answer","explanation",
      "source","exam_year","language","tags","is_active","created_at",
    ], rows);
    res.json({ inserted: n });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/seed/status", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const { rows } = await pool.query(`SELECT
      (SELECT COUNT(*)::text FROM syllabus_exams)    AS exams,
      (SELECT COUNT(*)::text FROM syllabus_subjects) AS subjects,
      (SELECT COUNT(*)::text FROM syllabus_topics)   AS topics,
      (SELECT COUNT(*)::text FROM question_bank)     AS questions`);
    res.json(rows[0] ?? {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/seed/profile", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const { clerk_user_id, plan_type, exam_type } = req.body as Record<string, string>;
    if (!clerk_user_id) { res.status(400).json({ error: "clerk_user_id required" }); return; }
    const params: string[] = [clerk_user_id];
    const setParts: string[] = [];
    if (plan_type) { setParts.push(`plan_type = $${params.push(plan_type)}`); }
    if (exam_type) { setParts.push(`exam_type = $${params.push(exam_type)}`); }
    if (setParts.length === 0) { res.json({ updated: 0 }); return; }
    await pool.query(`UPDATE profiles SET ${setParts.join(", ")} WHERE clerk_user_id = $1`, params);
    const { rows } = await pool.query(
      `SELECT clerk_user_id, plan_type, exam_type FROM profiles WHERE clerk_user_id = $1`, [clerk_user_id]
    );
    res.json({ updated: 1, profile: rows[0] ?? null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/seed/profiles", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, clerk_user_id, full_name, plan_type, exam_type FROM profiles ORDER BY created_at`
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
