import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const blogPostsTable = pgTable("blog_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  category: text("category").notNull().default("general"),
  tags: text("tags").array().default([]),
  examCode: text("exam_code"),
  author: text("author").default("GovtGuru Team"),
  isPublished: boolean("is_published").default(false).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  views: integer("views").default(0).notNull(),
  readTime: integer("read_time").default(5).notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BlogPost = typeof blogPostsTable.$inferSelect;
export type InsertBlogPost = typeof blogPostsTable.$inferInsert;
