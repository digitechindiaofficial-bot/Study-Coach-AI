import { pgTable, text, boolean, integer, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quizQuestionsTable = pgTable("quiz_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: text("subject"),
  topic: text("topic"),
  questionText: text("question_text").notNull(),
  options: jsonb("options"),
  correctOption: text("correct_option"),
  explanation: text("explanation"),
  difficulty: text("difficulty"),
  examType: text("exam_type").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quizAttemptsTable = pgTable("quiz_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  questionId: uuid("question_id").notNull(),
  selectedOption: text("selected_option"),
  isCorrect: boolean("is_correct"),
  timeTakenSeconds: integer("time_taken_seconds"),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
});

export const insertQuizQuestionSchema = createInsertSchema(quizQuestionsTable).omit({ id: true, createdAt: true });
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type QuizQuestion = typeof quizQuestionsTable.$inferSelect;

export const insertQuizAttemptSchema = createInsertSchema(quizAttemptsTable).omit({ id: true, attemptedAt: true });
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;
