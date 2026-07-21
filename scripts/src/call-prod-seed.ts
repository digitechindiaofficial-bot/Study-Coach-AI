/**
 * Reads all reference data from the dev DB and POSTs it to the production
 * seeding endpoint in batches.
 *
 * Usage:
 *   SEED_TOKEN=<token> PROD_URL=https://study-coach-ai.replit.app \
 *     pnpm --filter @workspace/scripts run call-prod-seed
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Client } = require(
  "/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js"
);

const PROD_URL = process.env.PROD_URL ?? "https://study-coach-ai.replit.app";
const SEED_TOKEN = process.env.SEED_TOKEN;
if (!SEED_TOKEN) throw new Error("SEED_TOKEN env var required");

async function post(path: string, body: unknown) {
  const res = await fetch(`${PROD_URL}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SEED_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<{ inserted: number }>;
}

async function checkStatus() {
  const res = await fetch(`${PROD_URL}/api/seed/status`, {
    headers: { Authorization: `Bearer ${SEED_TOKEN}` },
  });
  return res.json();
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected to dev DB\n");

  // ── Pre-flight check ──────────────────────────────────────────────────────
  console.log("Production counts before seeding:");
  console.log(await checkStatus(), "\n");

  // ── syllabus_exams ────────────────────────────────────────────────────────
  const exams = (
    await client.query(
      `SELECT id,name,code,description,created_at,exam_full_name,category,
              conducting_body,eligibility,exam_level,target_state,is_active,
              is_featured,icon_emoji FROM syllabus_exams ORDER BY created_at`
    )
  ).rows;
  const examRes = await post("/seed/exams", exams);
  console.log(`Exams: ${examRes.inserted} inserted`);

  // ── syllabus_subjects ─────────────────────────────────────────────────────
  const subjects = (
    await client.query(
      `SELECT id,exam_id,name,display_order,created_at,subject_code,
              subject_full_name,syllabus_topics,total_questions,total_marks,
              duration_minutes,difficulty_level,is_active
       FROM syllabus_subjects ORDER BY created_at`
    )
  ).rows;
  const subRes = await post("/seed/subjects", subjects);
  console.log(`Subjects: ${subRes.inserted} inserted`);

  // ── syllabus_topics ───────────────────────────────────────────────────────
  const TOPIC_BATCH = 100;
  const topics = (
    await client.query(
      `SELECT id,subject_id,name,display_order,created_at,topic_code
       FROM syllabus_topics ORDER BY created_at`
    )
  ).rows;
  let topicTotal = 0;
  for (let i = 0; i < topics.length; i += TOPIC_BATCH) {
    const r = await post("/seed/topics", topics.slice(i, i + TOPIC_BATCH));
    topicTotal += r.inserted;
  }
  console.log(`Topics: ${topicTotal} inserted`);

  // ── question_bank ─────────────────────────────────────────────────────────
  const Q_BATCH = 100;
  let qTotal = 0;
  let lastId = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const { rows } = await client.query(
      `SELECT id,exam_code,subject_code,topic_code,difficulty,question,
              option_a,option_b,option_c,option_d,correct_answer,explanation,
              source,exam_year,language,tags,is_active,created_at
       FROM question_bank WHERE id > $1 ORDER BY id LIMIT $2`,
      [lastId, Q_BATCH]
    );
    if (rows.length === 0) break;
    const r = await post("/seed/questions", rows);
    qTotal += r.inserted;
    lastId = rows[rows.length - 1].id;
    process.stdout.write(`\r  Questions: ${qTotal} inserted (cursor: ${lastId.slice(0, 8)}...)`);
  }
  console.log(`\nQuestions: ${qTotal} total inserted`);

  // ── Final check ───────────────────────────────────────────────────────────
  console.log("\nProduction counts after seeding:");
  console.log(await checkStatus());

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
