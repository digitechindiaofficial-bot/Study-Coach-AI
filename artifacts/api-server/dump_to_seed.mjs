// Run from artifacts/api-server: node dump_to_seed.mjs
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const OUT = path.join(__dirname, 'src/seed-data');
fs.mkdirSync(OUT, { recursive: true });

const TABLES = [
  'syllabus_exams',
  'syllabus_subjects',
  'syllabus_topics',
  'question_bank',
  'current_affairs',
  'blog_posts',
  'exam_patterns',
  'mock_tests',
  'mock_test_sections',
  'mock_test_fixed_questions',
];

for (const table of TABLES) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${table} ORDER BY created_at ASC NULLS LAST`
    );
    fs.writeFileSync(path.join(OUT, `${table}.json`), JSON.stringify(rows, null, 2));
    console.log(`✅ ${table}: ${rows.length} rows`);
  } catch (e) {
    console.log(`⚠️  ${table}: ${e.message}`);
    fs.writeFileSync(path.join(OUT, `${table}.json`), '[]');
  }
}
await pool.end();
console.log('\nAll tables dumped to src/seed-data/');
