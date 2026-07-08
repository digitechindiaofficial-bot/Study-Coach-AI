import {
  pgTable,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// mock_tests — top-level test definition
// mockType: FULL_MOCK | SUBJECT_TEST | TOPIC_TEST | PYQ_TEST
// difficulty: easy | medium | hard | mixed
// ─────────────────────────────────────────────────────────────────────────────
export const mockTestsTable = pgTable(
  "mock_tests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examCode: text("exam_code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    mockType: text("mock_type").notNull().default("FULL_MOCK"),
    timeLimitMinutes: integer("time_limit_minutes").notNull().default(60),
    difficulty: text("difficulty").notNull().default("mixed"),
    instructions: text("instructions"),
    version: integer("version").notNull().default(1),
    totalMarks: integer("total_marks").notNull().default(0),
    mockNumber: integer("mock_number").notNull().default(1),
    status: text("status").notNull().default("draft"),
    examPatternId: uuid("exam_pattern_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_mt_exam_code").on(t.examCode),
    index("idx_mt_active").on(t.isActive),
    index("idx_mt_type").on(t.mockType),
    index("idx_mt_status").on(t.status),
    index("idx_mt_exam_number").on(t.examCode, t.mockNumber),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// mock_test_sections — ordered sections within a mock
// Each section has its own subject, question count, and marking scheme.
// ─────────────────────────────────────────────────────────────────────────────
export const mockTestSectionsTable = pgTable(
  "mock_test_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mockTestId: uuid("mock_test_id").notNull(),
    name: text("name").notNull(),
    subjectCode: text("subject_code"),
    orderNum: integer("order_num").notNull().default(1),
    questionCount: integer("question_count").notNull().default(0),
    marksPerQuestion: numeric("marks_per_question", { precision: 5, scale: 2 }).notNull().default("1"),
    negativeMarks: numeric("negative_marks", { precision: 5, scale: 2 }).notNull().default("0"),
    timeLimitSeconds: integer("time_limit_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_mts_mock_test_id").on(t.mockTestId)],
);

// ─────────────────────────────────────────────────────────────────────────────
// mock_test_section_rules — how to pick questions for a section
// selectionType: 'fixed' (explicit IDs) | 'dynamic' (filter-based)
// ─────────────────────────────────────────────────────────────────────────────
export const mockTestSectionRulesTable = pgTable(
  "mock_test_section_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sectionId: uuid("section_id").notNull().unique(),
    selectionType: text("selection_type").notNull().default("dynamic"),
    examCode: text("exam_code"),
    subjectCode: text("subject_code"),
    topicCode: text("topic_code"),
    difficulty: text("difficulty"),
    easyCount: integer("easy_count").notNull().default(0),
    mediumCount: integer("medium_count").notNull().default(0),
    hardCount: integer("hard_count").notNull().default(0),
    randomize: boolean("randomize").notNull().default(true),
    language: text("language"),
    tags: text("tags").array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_mtsr_section_id").on(t.sectionId)],
);

// ─────────────────────────────────────────────────────────────────────────────
// mock_test_fixed_questions — explicit question list for 'fixed' rules
// ─────────────────────────────────────────────────────────────────────────────
export const mockTestFixedQuestionsTable = pgTable(
  "mock_test_fixed_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ruleId: uuid("rule_id").notNull(),
    questionBankId: uuid("question_bank_id").notNull(),
    orderNum: integer("order_num").notNull().default(1),
  },
  (t) => [
    index("idx_mtfq_rule_id").on(t.ruleId),
    index("idx_mtfq_qb_id").on(t.questionBankId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// mock_test_attempts — one row per user attempt
// Questions materialized at start → mock_test_attempt_questions
// ─────────────────────────────────────────────────────────────────────────────
export const mockTestAttemptsTable = pgTable(
  "mock_test_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mockTestId: uuid("mock_test_id").notNull(),
    mockTestVersion: integer("mock_test_version").notNull().default(1),
    clerkUserId: text("clerk_user_id").notNull(),
    examCode: text("exam_code").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    submittedAt: timestamp("submitted_at"),
    status: text("status").notNull().default("in_progress"),
    score: numeric("score", { precision: 8, scale: 2 }),
    totalMarks: integer("total_marks"),
    timeTakenSeconds: integer("time_taken_seconds"),
    correctCount: integer("correct_count").notNull().default(0),
    incorrectCount: integer("incorrect_count").notNull().default(0),
    unattemptedCount: integer("unattempted_count").notNull().default(0),
    accuracy: numeric("accuracy", { precision: 5, scale: 2 }),
  },
  (t) => [
    index("idx_mta_user_mock").on(t.clerkUserId, t.mockTestId),
    index("idx_mta_user_status").on(t.clerkUserId, t.status),
    index("idx_mta_mock_test_id").on(t.mockTestId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// mock_test_attempt_questions — stable materialized question list per attempt
// Created once at attempt start; never changes.
// ─────────────────────────────────────────────────────────────────────────────
export const mockTestAttemptQuestionsTable = pgTable(
  "mock_test_attempt_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id").notNull(),
    sectionId: uuid("section_id").notNull(),
    questionBankId: uuid("question_bank_id").notNull(),
    orderNum: integer("order_num").notNull(),
    marks: numeric("marks", { precision: 5, scale: 2 }).notNull().default("1"),
    negativeMarks: numeric("negative_marks", { precision: 5, scale: 2 }).notNull().default("0"),
    subjectCode: text("subject_code").notNull(),
    topicCode: text("topic_code").notNull(),
    difficulty: text("difficulty").notNull(),
  },
  (t) => [
    index("idx_mtaq_attempt_id").on(t.attemptId),
    index("idx_mtaq_attempt_section").on(t.attemptId, t.sectionId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// mock_test_responses — one row per attempt × question
// Populated blank at start; updated via auto-save; finalized on submit.
// ─────────────────────────────────────────────────────────────────────────────
export const mockTestResponsesTable = pgTable(
  "mock_test_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id").notNull(),
    attemptQuestionId: uuid("attempt_question_id").notNull().unique(),
    questionBankId: uuid("question_bank_id").notNull(),
    sectionId: uuid("section_id").notNull(),
    subjectCode: text("subject_code").notNull(),
    topicCode: text("topic_code").notNull(),
    difficulty: text("difficulty").notNull(),
    selectedOption: text("selected_option"),
    isMarkedForReview: boolean("is_marked_for_review").notNull().default(false),
    isCorrect: boolean("is_correct"),
    marksAwarded: numeric("marks_awarded", { precision: 5, scale: 2 }).notNull().default("0"),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  },
  (t) => [
    index("idx_mtr_attempt_id").on(t.attemptId),
    index("idx_mtr_attempt_subject").on(t.attemptId, t.subjectCode),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas and types
// ─────────────────────────────────────────────────────────────────────────────
export const insertMockTestSchema = createInsertSchema(mockTestsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertMockTest = z.infer<typeof insertMockTestSchema>;
export type MockTest = typeof mockTestsTable.$inferSelect;

export const insertMockTestSectionSchema = createInsertSchema(mockTestSectionsTable).omit({
  id: true, createdAt: true,
});
export type InsertMockTestSection = z.infer<typeof insertMockTestSectionSchema>;
export type MockTestSection = typeof mockTestSectionsTable.$inferSelect;

export const insertMockTestAttemptSchema = createInsertSchema(mockTestAttemptsTable).omit({
  id: true, startedAt: true,
});
export type InsertMockTestAttempt = z.infer<typeof insertMockTestAttemptSchema>;
export type MockTestAttempt = typeof mockTestAttemptsTable.$inferSelect;
