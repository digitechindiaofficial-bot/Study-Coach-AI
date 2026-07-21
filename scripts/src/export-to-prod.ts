/**
 * Exports all reference data (syllabus_exams, syllabus_subjects, syllabus_topics, question_bank)
 * from the dev database as SQL INSERT statements written to /tmp/prod-seed.sql
 * Run: pnpm --filter @workspace/scripts run export-to-prod
 */
import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);
// Use pg from the pnpm store
const { Client } = require("/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js");

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "ARRAY[]::text[]";
    return `ARRAY[${v.map((i) => esc(i)).join(",")}]`;
  }
  if (typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const out = fs.createWriteStream("/tmp/prod-seed.sql");
  const write = (s: string) => out.write(s + "\n");

  write("-- GovtGuru production seed generated " + new Date().toISOString());
  write("BEGIN;");

  // ── syllabus_exams ────────────────────────────────────────────────────────
  write("\n-- syllabus_exams");
  const exams = await client.query(
    `SELECT id,name,code,description,created_at,exam_full_name,category,
            conducting_body,eligibility,exam_level,target_state,is_active,
            is_featured,icon_emoji
     FROM syllabus_exams ORDER BY created_at`
  );
  for (const r of exams.rows) {
    write(
      `INSERT INTO syllabus_exams (id,name,code,description,created_at,exam_full_name,category,conducting_body,eligibility,exam_level,target_state,is_active,is_featured,icon_emoji) VALUES (${[r.id,r.name,r.code,r.description,r.created_at,r.exam_full_name,r.category,r.conducting_body,r.eligibility,r.exam_level,r.target_state,r.is_active,r.is_featured,r.icon_emoji].map(esc).join(",")}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  console.log(`  exams: ${exams.rows.length}`);

  // ── syllabus_subjects ─────────────────────────────────────────────────────
  write("\n-- syllabus_subjects");
  const subjects = await client.query(
    `SELECT id,exam_id,name,display_order,created_at,subject_code,
            subject_full_name,syllabus_topics,total_questions,total_marks,
            duration_minutes,difficulty_level,is_active
     FROM syllabus_subjects ORDER BY created_at`
  );
  for (const r of subjects.rows) {
    write(
      `INSERT INTO syllabus_subjects (id,exam_id,name,display_order,created_at,subject_code,subject_full_name,syllabus_topics,total_questions,total_marks,duration_minutes,difficulty_level,is_active) VALUES (${[r.id,r.exam_id,r.name,r.display_order,r.created_at,r.subject_code,r.subject_full_name,r.syllabus_topics,r.total_questions,r.total_marks,r.duration_minutes,r.difficulty_level,r.is_active].map(esc).join(",")}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  console.log(`  subjects: ${subjects.rows.length}`);

  // ── syllabus_topics ───────────────────────────────────────────────────────
  write("\n-- syllabus_topics");
  const topics = await client.query(
    `SELECT id,subject_id,name,display_order,created_at,topic_code
     FROM syllabus_topics ORDER BY created_at`
  );
  for (const r of topics.rows) {
    write(
      `INSERT INTO syllabus_topics (id,subject_id,name,display_order,created_at,topic_code) VALUES (${[r.id,r.subject_id,r.name,r.display_order,r.created_at,r.topic_code].map(esc).join(",")}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  console.log(`  topics: ${topics.rows.length}`);

  // ── question_bank ─────────────────────────────────────────────────────────
  write("\n-- question_bank");
  const BATCH = 200;
  let offset = 0;
  let total = 0;
  for (;;) {
    const batch = await client.query(
      `SELECT id,exam_code,subject_code,topic_code,difficulty,question,
              option_a,option_b,option_c,option_d,correct_answer,explanation,
              source,exam_year,language,tags,is_active,created_at
       FROM question_bank ORDER BY created_at LIMIT $1 OFFSET $2`,
      [BATCH, offset]
    );
    if (batch.rows.length === 0) break;
    for (const r of batch.rows) {
      write(
        `INSERT INTO question_bank (id,exam_code,subject_code,topic_code,difficulty,question,option_a,option_b,option_c,option_d,correct_answer,explanation,source,exam_year,language,tags,is_active,created_at) VALUES (${[r.id,r.exam_code,r.subject_code,r.topic_code,r.difficulty,r.question,r.option_a,r.option_b,r.option_c,r.option_d,r.correct_answer,r.explanation,r.source,r.exam_year,r.language,r.tags,r.is_active,r.created_at].map(esc).join(",")}) ON CONFLICT (id) DO NOTHING;`
      );
    }
    total += batch.rows.length;
    offset += BATCH;
    process.stdout.write(`\r  questions: ${total}`);
    if (batch.rows.length < BATCH) break;
  }
  console.log(`\n  questions total: ${total}`);

  write("\nCOMMIT;");
  await new Promise<void>((res) => out.end(res));
  await client.end();

  const size = fs.statSync("/tmp/prod-seed.sql").size;
  console.log(`\nWrote /tmp/prod-seed.sql (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
