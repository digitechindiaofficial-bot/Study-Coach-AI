/**
 * ONE-TIME production seeding endpoint — protected by SEED_TOKEN env var.
 * Accepts batches of JSON rows for syllabus_exams, syllabus_subjects,
 * syllabus_topics, and question_bank.
 *
 * DELETE THIS FILE after seeding is complete.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  syllabusExamsTable,
  syllabusSubjectsTable,
  syllabusTopicsTable,
  questionBankTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function checkToken(req: any, res: any): boolean {
  const token = process.env.SEED_TOKEN;
  if (!token) {
    res.status(503).json({ error: "SEED_TOKEN not configured" });
    return false;
  }
  const auth = req.headers["authorization"] ?? "";
  if (auth !== `Bearer ${token}`) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.post("/seed/exams", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const rows = req.body as any[];
    if (!Array.isArray(rows) || rows.length === 0) {
      res.json({ inserted: 0 });
      return;
    }
    await db
      .insert(syllabusExamsTable)
      .values(rows)
      .onConflictDoNothing();
    res.json({ inserted: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: String(e.message) });
  }
});

router.post("/seed/subjects", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const rows = req.body as any[];
    if (!Array.isArray(rows) || rows.length === 0) {
      res.json({ inserted: 0 });
      return;
    }
    await db
      .insert(syllabusSubjectsTable)
      .values(rows)
      .onConflictDoNothing();
    res.json({ inserted: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: String(e.message) });
  }
});

router.post("/seed/topics", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const rows = req.body as any[];
    if (!Array.isArray(rows) || rows.length === 0) {
      res.json({ inserted: 0 });
      return;
    }
    await db
      .insert(syllabusTopicsTable)
      .values(rows)
      .onConflictDoNothing();
    res.json({ inserted: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: String(e.message) });
  }
});

router.post("/seed/questions", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const rows = req.body as any[];
    if (!Array.isArray(rows) || rows.length === 0) {
      res.json({ inserted: 0 });
      return;
    }
    await db
      .insert(questionBankTable)
      .values(rows)
      .onConflictDoNothing();
    res.json({ inserted: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: String(e.message) });
  }
});

router.get("/seed/status", async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const rows = (await db.execute(sql`SELECT
      (SELECT COUNT(*)::text FROM syllabus_exams)    AS exams,
      (SELECT COUNT(*)::text FROM syllabus_subjects) AS subjects,
      (SELECT COUNT(*)::text FROM syllabus_topics)   AS topics,
      (SELECT COUNT(*)::text FROM question_bank)     AS questions`)) as unknown as any[];
    res.json(rows[0] ?? {});
  } catch (e: any) {
    res.status(500).json({ error: String(e.message) });
  }
});

export default router;
