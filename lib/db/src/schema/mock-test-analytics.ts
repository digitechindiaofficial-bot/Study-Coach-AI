import {
  pgTable,
  text,
  integer,
  numeric,
  timestamp,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// mock_test_result_analytics — permanently stored computed analytics per attempt
//
// Created when an attempt is submitted. Never recomputed from responses.
//
// subject_wise / section_wise JSON shape:
// [{ code, name, total, correct, incorrect, unattempted, accuracy, marksEarned, negativeMarks }]
//
// question_time_map JSON shape:
// { [attemptQuestionId]: timeSpentSeconds }
// ─────────────────────────────────────────────────────────────────────────────
export const mockTestResultAnalyticsTable = pgTable(
  "mock_test_result_analytics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id").notNull().unique(),
    mockTestId: uuid("mock_test_id").notNull(),
    clerkUserId: text("clerk_user_id").notNull(),
    // Stored JSON analytics
    subjectWise: jsonb("subject_wise").notNull().default([]),
    sectionWise: jsonb("section_wise").notNull().default([]),
    questionTimeMap: jsonb("question_time_map").notNull().default({}),
    topicWise: jsonb("topic_wise").notNull().default([]),
    // Aggregate stats
    totalTimeSeconds: integer("total_time_seconds").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    incorrectCount: integer("incorrect_count").notNull().default(0),
    unattemptedCount: integer("unattempted_count").notNull().default(0),
    markedForReviewCount: integer("marked_for_review_count").notNull().default(0),
    totalNegativeMarks: numeric("total_negative_marks", { precision: 8, scale: 2 }).notNull().default("0"),
    score: numeric("score", { precision: 8, scale: 2 }).notNull().default("0"),
    totalMarks: integer("total_marks").notNull().default(0),
    accuracy: numeric("accuracy", { precision: 5, scale: 2 }).notNull().default("0"),
    // Rank (to be filled later)
    rank: integer("rank"),
    totalAttempts: integer("total_attempts"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_mtra_attempt_id").on(t.attemptId),
    index("idx_mtra_user_mock").on(t.clerkUserId, t.mockTestId),
    index("idx_mtra_clerk_user_id").on(t.clerkUserId),
    index("idx_mtra_mock_test_id").on(t.mockTestId),
  ],
);

export const insertMockTestResultAnalyticsSchema = createInsertSchema(mockTestResultAnalyticsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMockTestResultAnalytics = z.infer<typeof insertMockTestResultAnalyticsSchema>;
export type MockTestResultAnalytics = typeof mockTestResultAnalyticsTable.$inferSelect;
