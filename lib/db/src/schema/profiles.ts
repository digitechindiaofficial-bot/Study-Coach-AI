import { pgTable, text, integer, date, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  fullName: text("full_name"),
  phoneNumber: text("phone_number"),
  examType: text("exam_type"),
  examDate: date("exam_date"),
  dailyStudyHours: integer("daily_study_hours").default(4).notNull(),
  planType: text("plan_type").default("free").notNull(),
  streakCount: integer("streak_count").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastActiveDate: date("last_active_date"),
  quizCountToday: integer("quiz_count_today").default(0).notNull(),
  quizCountDate: date("quiz_count_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true, createdAt: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
