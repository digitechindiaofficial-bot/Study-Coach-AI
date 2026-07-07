import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// question_bank — canonical question store
// Every question belongs to Exam → Subject → Topic.
// source: 'pyq' | 'original' | 'ai_generated'
// language: 'english' | 'hindi'
// difficulty: 'easy' | 'medium' | 'hard'
// correctAnswer: 'a' | 'b' | 'c' | 'd'
// ─────────────────────────────────────────────────────────────────────────────
export const questionBankTable = pgTable(
  "question_bank",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examCode: text("exam_code").notNull(),
    subjectCode: text("subject_code").notNull(),
    topicCode: text("topic_code").notNull(),
    difficulty: text("difficulty").notNull().default("medium"),
    question: text("question").notNull(),
    optionA: text("option_a").notNull(),
    optionB: text("option_b").notNull(),
    optionC: text("option_c").notNull(),
    optionD: text("option_d").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    explanation: text("explanation"),
    source: text("source").notNull().default("original"),
    examYear: integer("exam_year"),
    language: text("language").notNull().default("english"),
    tags: text("tags").array().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_qb_exam_sub_topic").on(t.examCode, t.subjectCode, t.topicCode),
    index("idx_qb_exam_diff").on(t.examCode, t.difficulty),
    index("idx_qb_source").on(t.source),
    index("idx_qb_language").on(t.language),
    index("idx_qb_active").on(t.isActive),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// question_attempts — attempt history for question_bank questions.
// exam/subject/topic are denormalized to avoid JOINs in hot stats queries.
// ─────────────────────────────────────────────────────────────────────────────
export const questionAttemptsTable = pgTable(
  "question_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    questionId: uuid("question_id").notNull(),
    examCode: text("exam_code"),
    subjectCode: text("subject_code"),
    topicCode: text("topic_code"),
    selectedAnswer: text("selected_answer"),
    isCorrect: boolean("is_correct"),
    timeTakenSeconds: integer("time_taken_seconds"),
    attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_qat_user_question").on(t.userId, t.questionId),
    index("idx_qat_user_exam").on(t.userId, t.examCode),
    index("idx_qat_user_date").on(t.userId, t.attemptedAt),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas and types
// ─────────────────────────────────────────────────────────────────────────────
export const insertQuestionBankSchema = createInsertSchema(questionBankTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuestionBank = z.infer<typeof insertQuestionBankSchema>;
export type QuestionBank = typeof questionBankTable.$inferSelect;

export const insertQuestionAttemptSchema = createInsertSchema(questionAttemptsTable).omit({
  id: true,
  attemptedAt: true,
});
export type InsertQuestionAttempt = z.infer<typeof insertQuestionAttemptSchema>;
export type QuestionAttempt = typeof questionAttemptsTable.$inferSelect;
