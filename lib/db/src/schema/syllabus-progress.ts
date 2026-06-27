import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const syllabusProgressTable = pgTable("syllabus_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  examType: text("exam_type"),
  subject: text("subject"),
  topic: text("topic"),
  subtopic: text("subtopic"),
  status: text("status").default("not_started").notNull(),
  confidence: text("confidence"),
  lastRevisedAt: timestamp("last_revised_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSyllabusProgressSchema = createInsertSchema(syllabusProgressTable).omit({ id: true, createdAt: true });
export type InsertSyllabusProgress = z.infer<typeof insertSyllabusProgressSchema>;
export type SyllabusProgress = typeof syllabusProgressTable.$inferSelect;
