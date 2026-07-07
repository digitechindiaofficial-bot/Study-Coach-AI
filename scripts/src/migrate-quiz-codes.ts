/**
 * Backfill examCode, subjectCode, topicCode on existing quiz_questions rows.
 *
 * Run once after the schema migration:
 *   pnpm --filter @workspace/scripts run migrate-quiz-codes
 */
import { db } from "@workspace/db";
import { quizQuestionsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

// subject display-name → subject_code mapping (matches syllabus-codes.ts)
const SUBJECT_CODE_MAP: Record<string, string> = {
  "Quantitative Aptitude": "QA",
  "General Intelligence & Reasoning": "GIR",
  "General Intelligence": "GIR",
  "General Awareness": "GA",
  "English Language": "ENG",
  "English Language & Comprehension": "ENG",
  "English": "ENG",
  "Computer": "COMP",
  "Computer Knowledge": "COMP",
  "Computer Aptitude": "COMP",
  "Reasoning Ability": "GIR",
  "Numerical Ability": "QA",
  "Numerical Aptitude": "QA",
  "Banking & Financial Awareness": "BFA",
  "Banking Awareness": "BFA",
  "Data Analysis & Interpretation": "DAI",
  "Data Interpretation": "DAI",
  "General/Financial Awareness": "GA",
  "General Studies": "GS",
  "History": "HIST",
  "Geography": "GEO",
  "Polity": "POL",
  "Economics": "ECO",
  "Science": "SCI",
  "General Science": "SCI",
  "Mathematics": "MATH",
  "Arithmetic": "QA",
  "Statistics": "STAT",
};

async function main() {
  console.log("Starting quiz codes migration...");

  // 1. Backfill examCode from examType[0]
  const examResult = await db.execute(sql`
    UPDATE quiz_questions
    SET exam_code = exam_type[1]
    WHERE exam_code IS NULL
      AND exam_type IS NOT NULL
      AND array_length(exam_type, 1) > 0
  `);
  console.log(`Backfilled exam_code for ${(examResult as any).rowCount ?? "?"} rows`);

  // 2. Backfill subjectCode from subject text via lookup
  let subjectUpdates = 0;
  for (const [name, code] of Object.entries(SUBJECT_CODE_MAP)) {
    const r = await db.execute(sql`
      UPDATE quiz_questions
      SET subject_code = ${code}
      WHERE subject_code IS NULL
        AND subject = ${name}
    `);
    const count = (r as any).rowCount ?? 0;
    if (count > 0) {
      console.log(`  ${name} → ${code}: ${count} rows`);
      subjectUpdates += count;
    }
  }
  console.log(`Backfilled subject_code for ${subjectUpdates} rows`);

  // 3. Backfill topicCode by joining with syllabus_topics on name+examCode
  const topicResult = await db.execute(sql`
    UPDATE quiz_questions q
    SET topic_code = st.topic_code
    FROM syllabus_topics st
    JOIN syllabus_subjects ss ON ss.id = st.subject_id
    JOIN syllabus_exams se ON se.id = ss.exam_id
    WHERE q.topic_code IS NULL
      AND q.exam_code = se.code
      AND LOWER(TRIM(q.topic)) = LOWER(TRIM(st.name))
  `);
  console.log(`Backfilled topic_code for ${(topicResult as any).rowCount ?? "?"} rows`);

  // 4. Summary
  const summary = await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      COUNT(exam_code) AS with_exam_code,
      COUNT(subject_code) AS with_subject_code,
      COUNT(topic_code) AS with_topic_code
    FROM quiz_questions
  `);
  console.log("\nFinal state:", summary.rows[0]);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
