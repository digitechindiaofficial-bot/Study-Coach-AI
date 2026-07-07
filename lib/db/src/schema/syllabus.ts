import { pgTable, text, timestamp, uuid, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const syllabusExamsTable = pgTable("syllabus_exams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const syllabusSubjectsTable = pgTable("syllabus_subjects", {
  id: uuid("id").defaultRandom().primaryKey(),
  examId: uuid("exam_id").notNull().references(() => syllabusExamsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subjectCode: text("subject_code"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const syllabusTopicsTable = pgTable("syllabus_topics", {
  id: uuid("id").defaultRandom().primaryKey(),
  subjectId: uuid("subject_id").notNull().references(() => syllabusSubjectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  topicCode: text("topic_code").unique(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userTopicProgressTable = pgTable(
  "user_topic_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").notNull().references(() => syllabusTopicsTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("not_started"),
    lastRevisedAt: timestamp("last_revised_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("user_topic_unique").on(t.userId, t.topicId)],
);

export const insertSyllabusExamSchema = createInsertSchema(syllabusExamsTable).omit({ id: true, createdAt: true });
export type InsertSyllabusExam = z.infer<typeof insertSyllabusExamSchema>;
export type SyllabusExam = typeof syllabusExamsTable.$inferSelect;

export const insertSyllabusSubjectSchema = createInsertSchema(syllabusSubjectsTable).omit({ id: true, createdAt: true });
export type InsertSyllabusSubject = z.infer<typeof insertSyllabusSubjectSchema>;
export type SyllabusSubject = typeof syllabusSubjectsTable.$inferSelect;

export const insertSyllabusTopicSchema = createInsertSchema(syllabusTopicsTable).omit({ id: true, createdAt: true });
export type InsertSyllabusTopic = z.infer<typeof insertSyllabusTopicSchema>;
export type SyllabusTopic = typeof syllabusTopicsTable.$inferSelect;

export const insertUserTopicProgressSchema = createInsertSchema(userTopicProgressTable).omit({ id: true, createdAt: true });
export type InsertUserTopicProgress = z.infer<typeof insertUserTopicProgressSchema>;
export type UserTopicProgress = typeof userTopicProgressTable.$inferSelect;
