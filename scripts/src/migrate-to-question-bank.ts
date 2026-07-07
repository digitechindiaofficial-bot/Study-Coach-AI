/**
 * migrate-to-question-bank.ts
 *
 * One-time migration: copy all quiz_questions rows → question_bank.
 * Preserves the original UUID so existing quiz_attempts rows remain valid.
 * Safe to re-run — uses ON CONFLICT DO NOTHING.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("── Question Bank Migration ──────────────────────────────");

  const countResult = await db.execute(sql`SELECT COUNT(*)::int AS n FROM quiz_questions`);
  const sourceCount = Number((countResult.rows[0] as { n: number }).n);
  console.log(`  Source rows in quiz_questions: ${sourceCount}`);

  const existingResult = await db.execute(sql`SELECT COUNT(*)::int AS n FROM question_bank`);
  const existingCount = Number((existingResult.rows[0] as { n: number }).n);
  console.log(`  Already in question_bank:      ${existingCount}`);

  if (sourceCount === 0) {
    console.log("  Nothing to migrate.");
    process.exit(0);
  }

  // Transform jsonb options {a,b,c,d} → separate columns
  const migrated = await db.execute(sql`
    INSERT INTO question_bank (
      id, exam_code, subject_code, topic_code, difficulty, question,
      option_a, option_b, option_c, option_d, correct_answer, explanation,
      source, language, tags, is_active, created_at, updated_at
    )
    SELECT
      id,
      COALESCE(exam_code, (exam_type::text[])[1], 'UNKNOWN')   AS exam_code,
      COALESCE(subject_code, 'UNKNOWN')                        AS subject_code,
      COALESCE(topic_code, 'UNKNOWN')                          AS topic_code,
      COALESCE(difficulty, 'medium')                           AS difficulty,
      question_text                                            AS question,
      COALESCE(options->>'a', '')                              AS option_a,
      COALESCE(options->>'b', '')                              AS option_b,
      COALESCE(options->>'c', '')                              AS option_c,
      COALESCE(options->>'d', '')                              AS option_d,
      COALESCE(correct_option, 'a')                            AS correct_answer,
      explanation,
      'ai_generated'                                           AS source,
      'english'                                                AS language,
      ARRAY[]::text[]                                          AS tags,
      true                                                     AS is_active,
      created_at,
      NOW()                                                    AS updated_at
    FROM quiz_questions
    WHERE question_text IS NOT NULL
      AND options IS NOT NULL
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `);

  console.log(`  Newly migrated:                ${migrated.rows.length}`);

  const finalResult = await db.execute(sql`SELECT COUNT(*)::int AS n FROM question_bank`);
  const finalCount = Number((finalResult.rows[0] as { n: number }).n);
  console.log(`  Total in question_bank now:    ${finalCount}`);
  console.log("────────────────────────────────────────────────────────");
  console.log("  Migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
