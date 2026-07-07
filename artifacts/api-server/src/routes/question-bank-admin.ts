/**
 * Question Bank Admin Routes
 *
 * All routes are protected by requireAdmin (Clerk email check).
 *
 * CRUD:
 *   GET    /admin/question-bank            — list (paginated, filterable)
 *   POST   /admin/question-bank            — create single question
 *   PUT    /admin/question-bank/:id        — update question
 *   DELETE /admin/question-bank/:id        — soft-delete (is_active = false)
 *
 * Bulk Import:
 *   POST   /admin/question-bank/import/json — JSON array
 *   POST   /admin/question-bank/import/csv  — CSV text body
 *   POST   /admin/question-bank/import/bulk — JSON array + options
 *
 * CSV format (header row required):
 *   examCode,subjectCode,topicCode,difficulty,question,optionA,optionB,
 *   optionC,optionD,correctAnswer,explanation,source,examYear,language,tags
 *
 *   - tags: pipe-separated list inside the field  e.g. "math|algebra"
 *   - examYear: integer or blank (null)
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { questionBankTable } from "@workspace/db";
import { eq, and, desc, sql, SQL } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── Admin guard ────────────────────────────────────────────────────────────

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const adminEmail = process.env.ADMIN_EMAIL;
  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.emailAddresses.find((e: { id: string }) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ?? null;
    if (!adminEmail || !email || email.toLowerCase() !== adminEmail.toLowerCase()) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
  } catch {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
}

router.use("/admin/question-bank", requireAdmin);

// ── Shared Zod schema for a question row ──────────────────────────────────

const questionSchema = z.object({
  examCode: z.string().min(1),
  subjectCode: z.string().min(1),
  topicCode: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  question: z.string().min(5),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  optionC: z.string().min(1),
  optionD: z.string().min(1),
  correctAnswer: z.enum(["a", "b", "c", "d"]),
  explanation: z.string().optional().nullable(),
  source: z.enum(["pyq", "original", "ai_generated"]).default("original"),
  examYear: z.coerce.number().int().positive().nullable().optional(),
  language: z.enum(["english", "hindi"]).default("english"),
  tags: z.array(z.string()).default([]),
});

type QuestionInput = z.infer<typeof questionSchema>;

// ── CSV parser ────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\r$/, "").trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = values[i] ?? ""; });
    return row;
  });
}

function csvRowToInput(row: Record<string, string>): QuestionInput {
  return {
    examCode: row.examCode ?? "",
    subjectCode: row.subjectCode ?? "",
    topicCode: row.topicCode ?? "",
    difficulty: (row.difficulty ?? "medium") as QuestionInput["difficulty"],
    question: row.question ?? "",
    optionA: row.optionA ?? "",
    optionB: row.optionB ?? "",
    optionC: row.optionC ?? "",
    optionD: row.optionD ?? "",
    correctAnswer: (row.correctAnswer ?? "a") as QuestionInput["correctAnswer"],
    explanation: row.explanation || null,
    source: (row.source || "original") as QuestionInput["source"],
    examYear: row.examYear ? parseInt(row.examYear) : null,
    language: (row.language || "english") as QuestionInput["language"],
    tags: row.tags ? row.tags.split("|").map((t) => t.trim()).filter(Boolean) : [],
  };
}

// ── Bulk insert helper ────────────────────────────────────────────────────

interface ImportOptions {
  skipErrors?: boolean;
  dryRun?: boolean;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: Array<{ index: number; error: string }>;
  dryRun: boolean;
}

async function importQuestions(
  rows: unknown[],
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const { skipErrors = true, dryRun = false } = opts;
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [], dryRun };

  const valid: QuestionInput[] = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = questionSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      result.errors.push({ index: i, error: msg });
      if (!skipErrors) throw new Error(`Row ${i}: ${msg}`);
      result.skipped++;
    } else {
      valid.push(parsed.data);
    }
  }

  if (!dryRun && valid.length > 0) {
    const BATCH = 200;
    for (let i = 0; i < valid.length; i += BATCH) {
      const chunk = valid.slice(i, i + BATCH);
      await db.insert(questionBankTable).values(
        chunk.map((q) => ({
          examCode: q.examCode,
          subjectCode: q.subjectCode,
          topicCode: q.topicCode,
          difficulty: q.difficulty,
          question: q.question,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation ?? null,
          source: q.source,
          examYear: q.examYear ?? null,
          language: q.language,
          tags: q.tags,
        })),
      );
      result.inserted += chunk.length;
    }
  } else if (dryRun) {
    result.inserted = valid.length;
  }

  return result;
}

// ── GET /admin/question-bank ──────────────────────────────────────────────
// Query params: examCode, subjectCode, topicCode, source, language,
//               difficulty, active, page (1-based), limit (max 200)

router.get("/admin/question-bank", async (req, res) => {
  const {
    examCode, subjectCode, topicCode, source, language, difficulty, active,
    page: pageStr, limit: limitStr,
  } = req.query as Record<string, string>;

  const limit = Math.min(parseInt(limitStr) || 50, 200);
  const page = Math.max(parseInt(pageStr) || 1, 1);
  const offset = (page - 1) * limit;

  const whereParts: SQL[] = [];
  if (examCode) whereParts.push(sql`exam_code = ${examCode}`);
  if (subjectCode) whereParts.push(sql`subject_code = ${subjectCode}`);
  if (topicCode) whereParts.push(sql`topic_code = ${topicCode}`);
  if (source) whereParts.push(sql`source = ${source}`);
  if (language) whereParts.push(sql`language = ${language}`);
  if (difficulty) whereParts.push(sql`difficulty = ${difficulty}`);
  if (active !== undefined) whereParts.push(sql`is_active = ${active === "true"}`);

  const whereClause = whereParts.length > 0
    ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
    : sql``;

  const [countRes, rowsRes] = await Promise.all([
    db.execute(sql`SELECT COUNT(*)::int AS n FROM question_bank ${whereClause}`),
    db.execute(sql`
      SELECT * FROM question_bank ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
  ]);

  const total = (countRes.rows[0] as { n: number }).n;
  res.json({
    data: rowsRes.rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ── POST /admin/question-bank ─────────────────────────────────────────────

router.post("/admin/question-bank", async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const q = parsed.data;
  const [created] = await db.insert(questionBankTable).values({
    examCode: q.examCode,
    subjectCode: q.subjectCode,
    topicCode: q.topicCode,
    difficulty: q.difficulty,
    question: q.question,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? null,
    source: q.source,
    examYear: q.examYear ?? null,
    language: q.language,
    tags: q.tags,
  }).returning();
  res.status(201).json(created);
});

// ── PUT /admin/question-bank/:id ──────────────────────────────────────────

router.put("/admin/question-bank/:id", async (req, res) => {
  const id = req.params.id as string;
  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const q = parsed.data;
  const [updated] = await db
    .update(questionBankTable)
    .set({ ...q, updatedAt: new Date() })
    .where(eq(questionBankTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ── DELETE /admin/question-bank/:id (soft delete) ────────────────────────

router.delete("/admin/question-bank/:id", async (req, res) => {
  const id = req.params.id as string;
  const [updated] = await db
    .update(questionBankTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(questionBankTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ── POST /admin/question-bank/stats ──────────────────────────────────────

router.get("/admin/question-bank/stats", async (_req, res) => {
  const result = await db.execute(sql`
    SELECT
      exam_code     AS "examCode",
      subject_code  AS "subjectCode",
      topic_code    AS "topicCode",
      source,
      language,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_active)::int AS active
    FROM question_bank
    GROUP BY exam_code, subject_code, topic_code, source, language
    ORDER BY exam_code, subject_code, topic_code
  `);
  res.json(result.rows);
});

// ── POST /admin/question-bank/import/json ────────────────────────────────
// Body: { questions: QuestionInput[] }

router.post("/admin/question-bank/import/json", async (req, res) => {
  const { questions } = req.body ?? {};
  if (!Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "Body must be { questions: [...] } with at least one item" });
    return;
  }
  try {
    const result = await importQuestions(questions);
    req.log.info({ event: "qb_json_import", ...result }, "Question bank JSON import");
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── POST /admin/question-bank/import/csv ─────────────────────────────────
// Content-Type: text/plain or text/csv
// Body: raw CSV text

router.post("/admin/question-bank/import/csv", async (req, res) => {
  let csvText: string;
  if (typeof req.body === "string") {
    csvText = req.body;
  } else if (req.body && typeof req.body === "object" && "csv" in req.body) {
    csvText = String(req.body.csv);
  } else {
    res.status(400).json({
      error: "Send raw CSV as text/plain body, or JSON { csv: '...' }",
    });
    return;
  }

  let rows: Record<string, string>[];
  try {
    rows = parseCSV(csvText);
  } catch (err) {
    res.status(400).json({ error: `CSV parse error: ${String(err)}` });
    return;
  }

  const inputs = rows.map(csvRowToInput);
  try {
    const result = await importQuestions(inputs);
    req.log.info({ event: "qb_csv_import", rows: rows.length, ...result }, "Question bank CSV import");
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── POST /admin/question-bank/import/bulk ────────────────────────────────
// Body: { questions: QuestionInput[], options?: { skipErrors, dryRun } }

router.post("/admin/question-bank/import/bulk", async (req, res) => {
  const { questions, options } = req.body ?? {};
  if (!Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "Body must be { questions: [...], options?: {} }" });
    return;
  }
  const opts: ImportOptions = {
    skipErrors: options?.skipErrors !== false,
    dryRun: options?.dryRun === true,
  };
  try {
    const result = await importQuestions(questions, opts);
    req.log.info({ event: "qb_bulk_import", count: questions.length, ...result }, "Question bank bulk import");
    res.status(opts.dryRun ? 200 : 201).json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
