import { pgTable, text, integer, boolean, date, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyTasksTable = pgTable("daily_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  date: date("date").defaultNow().notNull(),
  subject: text("subject"),
  topic: text("topic"),
  durationMinutes: integer("duration_minutes"),
  taskType: text("task_type"),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
});

export const insertDailyTaskSchema = createInsertSchema(dailyTasksTable).omit({ id: true });
export type InsertDailyTask = z.infer<typeof insertDailyTaskSchema>;
export type DailyTask = typeof dailyTasksTable.$inferSelect;
