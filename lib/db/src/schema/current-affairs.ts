import { pgTable, text, boolean, date, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const currentAffairsTable = pgTable("current_affairs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  summary: text("summary"),
  category: text("category"),
  examRelevance: text("exam_relevance").array(),
  publishedDate: date("published_date").defaultNow(),
  source: text("source"),
  isFeatured: boolean("is_featured").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCurrentAffairsSchema = createInsertSchema(currentAffairsTable).omit({ id: true, createdAt: true });
export type InsertCurrentAffairs = z.infer<typeof insertCurrentAffairsSchema>;
export type CurrentAffairs = typeof currentAffairsTable.$inferSelect;
