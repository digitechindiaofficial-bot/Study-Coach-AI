/**
 * Reads all reference data from the dev DB and POSTs it to the production
 * seeding endpoint in batches.
 *
 * Usage:
 *   SEED_TOKEN=<token> PROD_URL=https://govtguru.com \
 *     pnpm --filter @workspace/scripts run call-prod-seed
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Client } = require(
  "/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js"
);

const PROD_URL = (process.env.PROD_URL ?? "https://govtguru.com").replace(/\/$/, "");
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
    throw new Error(`${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json() as Promise<{ inserted: number }>;
}

async function getStatus() {
  const res = await fetch(`${PROD_URL}/api/seed/status`, {
    headers: { Authorization: `Bearer ${SEED_TOKEN}` },
  });
  if (!res.ok) throw new Error(`seed/status → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log(`Connected to dev DB`);
  console.log(`Target: ${PROD_URL}\n`);

  // ── Pre-flight check ──────────────────────────────────────────────────────
  console.log("📊 Production counts BEFORE seeding:");
  const before = await getStatus();
  for (const [k, v] of Object.entries(before)) console.log(`   ${k}: ${v}`);
  console.log();

  // ── syllabus_exams ────────────────────────────────────────────────────────
  const exams = (
    await client.query(
      `SELECT id,name,code,description,created_at,exam_full_name,category,
              conducting_body,eligibility,exam_level,target_state,is_active,
              is_featured,icon_emoji,display_order
       FROM syllabus_exams ORDER BY created_at`
    )
  ).rows;
  const examRes = await post("/seed/exams", exams);
  console.log(`✅ syllabus_exams: ${examRes.inserted}/${exams.length} inserted`);

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
  console.log(`✅ syllabus_subjects: ${subRes.inserted}/${subjects.length} inserted`);

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
    process.stdout.write(`\r   syllabus_topics: ${topicTotal}/${topics.length}...`);
  }
  console.log(`\n✅ syllabus_topics: ${topicTotal}/${topics.length} inserted`);

  // ── question_bank ─────────────────────────────────────────────────────────
  const Q_BATCH = 100;
  let qTotal = 0;
  let offset = 0;
  for (;;) {
    const { rows } = await client.query(
      `SELECT id,exam_code,subject_code,topic_code,difficulty,question,
              option_a,option_b,option_c,option_d,correct_answer,explanation,
              source,exam_year,language,tags,is_active,created_at
       FROM question_bank ORDER BY created_at LIMIT $1 OFFSET $2`,
      [Q_BATCH, offset]
    );
    if (rows.length === 0) break;
    const r = await post("/seed/questions", rows);
    qTotal += r.inserted;
    offset += rows.length;
    process.stdout.write(`\r   question_bank: ${qTotal}/4149+...`);
    if (rows.length < Q_BATCH) break;
  }
  console.log(`\n✅ question_bank: ${qTotal} inserted`);

  // ── current_affairs ───────────────────────────────────────────────────────
  const ca = (
    await client.query(
      `SELECT id,title,summary,category,exam_relevance,published_date,
              source,is_featured,created_at
       FROM current_affairs ORDER BY created_at`
    )
  ).rows;
  if (ca.length > 0) {
    const r = await post("/seed/current-affairs", ca);
    console.log(`✅ current_affairs: ${r.inserted}/${ca.length} inserted`);
  } else {
    console.log(`⚠️  current_affairs: 0 rows (skipped)`);
  }

  // ── blog_posts ────────────────────────────────────────────────────────────
  const blogs = (
    await client.query(
      `SELECT id,title,slug,excerpt,content,cover_image,category,tags,
              exam_code,author,is_published,is_featured,views,read_time,
              meta_title,meta_description,published_at,created_at,updated_at
       FROM blog_posts ORDER BY created_at`
    )
  ).rows;
  if (blogs.length > 0) {
    const r = await post("/seed/blog-posts", blogs);
    console.log(`✅ blog_posts: ${r.inserted}/${blogs.length} inserted`);
  } else {
    console.log(`⚠️  blog_posts: 0 rows (skipped)`);
  }

  // ── exam_patterns ─────────────────────────────────────────────────────────
  const patterns = (
    await client.query(
      `SELECT id,exam_code,exam_name,mock_type,total_questions,total_marks,
              time_limit_minutes,mark_per_question,negative_marking,
              section_wise_config,is_active,created_at,updated_at
       FROM exam_patterns ORDER BY created_at`
    )
  ).rows;
  if (patterns.length > 0) {
    const r = await post("/seed/exam-patterns", patterns);
    console.log(`✅ exam_patterns: ${r.inserted}/${patterns.length} inserted`);
  } else {
    console.log(`⚠️  exam_patterns: 0 rows (skipped)`);
  }

  // ── mock_tests ────────────────────────────────────────────────────────────
  const mocks = (
    await client.query(
      `SELECT * FROM mock_tests ORDER BY created_at`
    )
  ).rows;
  if (mocks.length > 0) {
    const r = await post("/seed/mock-tests", mocks);
    console.log(`✅ mock_tests: ${r.inserted}/${mocks.length} inserted`);
  } else {
    console.log(`⚠️  mock_tests: 0 rows (skipped)`);
  }

  // ── Final check ───────────────────────────────────────────────────────────
  console.log("\n📊 Production counts AFTER seeding:");
  const after = await getStatus();
  for (const [k, v] of Object.entries(after)) console.log(`   ${k}: ${v}`);

  await client.end();
  console.log("\n✅ Migration complete!");
}

main().catch((e) => {
  console.error("\n❌ Migration failed:", e.message);
  process.exit(1);
});
