/**
 * One-time migration: backfill subject_code and topic_code for all existing
 * syllabus records that don't yet have them.
 *
 * Run: pnpm --filter @workspace/scripts run migrate-syllabus-codes
 *
 * Safe to re-run — skips records that already have codes.
 * topic_code is never changed once set.
 */

import { db } from "@workspace/db";
import {
  syllabusExamsTable,
  syllabusSubjectsTable,
  syllabusTopicsTable,
} from "@workspace/db";
import { eq, isNull, inArray } from "drizzle-orm";
import { deriveSubjectCode, buildTopicCode } from "./syllabus-codes.js";

async function main() {
  const exams = await db
    .select()
    .from(syllabusExamsTable)
    .orderBy(syllabusExamsTable.createdAt);

  console.log(`Found ${exams.length} exam(s). Processing…\n`);

  let totalSubjects = 0;
  let totalTopics   = 0;

  for (const exam of exams) {
    console.log(`[${exam.code}] ${exam.name}`);

    const subjects = await db
      .select()
      .from(syllabusSubjectsTable)
      .where(eq(syllabusSubjectsTable.examId, exam.id))
      .orderBy(syllabusSubjectsTable.displayOrder);

    for (const subject of subjects) {
      const subjectCode = subject.subjectCode ?? deriveSubjectCode(subject.name);

      if (!subject.subjectCode) {
        await db
          .update(syllabusSubjectsTable)
          .set({ subjectCode })
          .where(eq(syllabusSubjectsTable.id, subject.id));
        totalSubjects++;
        console.log(`  + subject_code "${subjectCode}" → ${subject.name}`);
      } else {
        console.log(`  ✓ subject_code "${subject.subjectCode}" already set for ${subject.name}`);
      }

      // Fetch topics for this subject that are missing topic_code
      const topics = await db
        .select()
        .from(syllabusTopicsTable)
        .where(eq(syllabusTopicsTable.subjectId, subject.id))
        .orderBy(syllabusTopicsTable.displayOrder);

      for (let ti = 0; ti < topics.length; ti++) {
        const topic = topics[ti];
        if (!topic.topicCode) {
          const topicCode = buildTopicCode(exam.code, subjectCode, ti);
          await db
            .update(syllabusTopicsTable)
            .set({ topicCode })
            .where(eq(syllabusTopicsTable.id, topic.id));
          totalTopics++;
        }
      }
      console.log(`    ${topics.filter((t) => t.topicCode).length} already set, ${topics.filter((t) => !t.topicCode).length} assigned`);
    }

    console.log("");
  }

  console.log(`Migration complete.`);
  console.log(`  subject_code assigned: ${totalSubjects}`);
  console.log(`  topic_code   assigned: ${totalTopics}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
