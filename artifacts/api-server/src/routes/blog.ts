import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { blogPostsTable } from "@workspace/db";
import { eq, and, desc, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

// ── Public routes (no auth) ──────────────────────────────────────────────────

router.get("/blog", async (req, res) => {
  const { category, search } = req.query;

  let posts = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.isPublished, true))
    .orderBy(desc(blogPostsTable.publishedAt));

  if (category && category !== "all") {
    posts = posts.filter(p => p.category === category);
  }
  if (search && typeof search === "string") {
    const q = search.toLowerCase();
    posts = posts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.excerpt ?? "").toLowerCase().includes(q)
    );
  }

  res.json(posts);
});

router.get("/blog/:slug", async (req, res) => {
  const { slug } = req.params;

  const rows = await db
    .select()
    .from(blogPostsTable)
    .where(and(eq(blogPostsTable.slug, slug), eq(blogPostsTable.isPublished, true)))
    .limit(1);

  const post = rows[0];
  if (!post) return res.status(404).json({ error: "Post not found" });

  // Increment views (fire-and-forget)
  db.update(blogPostsTable)
    .set({ views: post.views + 1 })
    .where(eq(blogPostsTable.id, post.id))
    .catch(() => {});

  // Related posts in same category
  const related = await db
    .select({
      id: blogPostsTable.id,
      title: blogPostsTable.title,
      slug: blogPostsTable.slug,
      excerpt: blogPostsTable.excerpt,
      coverImage: blogPostsTable.coverImage,
      category: blogPostsTable.category,
      readTime: blogPostsTable.readTime,
    })
    .from(blogPostsTable)
    .where(
      and(
        eq(blogPostsTable.isPublished, true),
        eq(blogPostsTable.category, post.category),
        ne(blogPostsTable.id, post.id),
      )
    )
    .limit(3);

  res.json({ post, related });
});

// ── Admin routes (auth + admin email check) ──────────────────────────────────

async function assertAdmin(req: any, res: any): Promise<boolean> {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return false; }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) { res.status(403).json({ error: "Admin not configured" }); return false; }

  // Re-use the clerk client to verify email
  const checkRes = await fetch(`/api/admin/check`, {
    headers: { cookie: req.headers.cookie ?? "" },
  }).catch(() => null);

  // Simpler: compare userId via admin check endpoint logic inline
  const { clerkClient } = await import("@clerk/express");
  try {
    const user = await clerkClient.users.getUser(userId);
    const emails = user.emailAddresses.map((e: any) => e.emailAddress.toLowerCase());
    if (!emails.includes(adminEmail.toLowerCase())) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
  } catch {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.get("/admin/blog/posts", async (req, res) => {
  if (!await assertAdmin(req, res)) return;

  const { filter } = req.query;
  let posts = await db
    .select()
    .from(blogPostsTable)
    .orderBy(desc(blogPostsTable.createdAt));

  if (filter === "published") posts = posts.filter(p => p.isPublished);
  else if (filter === "draft") posts = posts.filter(p => !p.isPublished);
  else if (filter === "featured") posts = posts.filter(p => p.isFeatured);

  res.json(posts);
});

const BlogPostBody = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  excerpt: z.string().optional().nullable(),
  content: z.string().min(1),
  coverImage: z.string().optional().nullable(),
  category: z.string().default("general"),
  tags: z.array(z.string()).default([]),
  examCode: z.string().optional().nullable(),
  author: z.string().default("GovtGuru Team"),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  readTime: z.number().int().default(5),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  publishedAt: z.string().optional().nullable(),
});

router.post("/admin/blog/posts", async (req, res) => {
  if (!await assertAdmin(req, res)) return;

  const parsed = BlogPostBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error });

  const data = parsed.data;
  const words = data.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(words / 200));

  const [post] = await db.insert(blogPostsTable).values({
    ...data,
    readTime,
    coverImage: data.coverImage ?? null,
    excerpt: data.excerpt ?? null,
    examCode: data.examCode ?? null,
    metaTitle: data.metaTitle ?? null,
    metaDescription: data.metaDescription ?? null,
    publishedAt: data.isPublished ? new Date() : null,
    updatedAt: new Date(),
  }).returning();

  res.json(post);
});

router.put("/admin/blog/posts/:id", async (req, res) => {
  if (!await assertAdmin(req, res)) return;

  const parsed = BlogPostBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error });

  const data = parsed.data;
  const words = data.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(words / 200));

  const existing = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.id, req.params.id))
    .limit(1);

  if (!existing[0]) return res.status(404).json({ error: "Post not found" });

  const [updated] = await db
    .update(blogPostsTable)
    .set({
      ...data,
      readTime,
      coverImage: data.coverImage ?? null,
      excerpt: data.excerpt ?? null,
      examCode: data.examCode ?? null,
      metaTitle: data.metaTitle ?? null,
      metaDescription: data.metaDescription ?? null,
      publishedAt: data.isPublished
        ? (existing[0].publishedAt ?? new Date())
        : null,
      updatedAt: new Date(),
    })
    .where(eq(blogPostsTable.id, req.params.id))
    .returning();

  res.json(updated);
});

router.patch("/admin/blog/posts/:id/publish", async (req, res) => {
  if (!await assertAdmin(req, res)) return;

  const rows = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.id, req.params.id))
    .limit(1);

  if (!rows[0]) return res.status(404).json({ error: "Post not found" });

  const newPublished = !rows[0].isPublished;
  const [updated] = await db
    .update(blogPostsTable)
    .set({
      isPublished: newPublished,
      publishedAt: newPublished ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(blogPostsTable.id, req.params.id))
    .returning();

  res.json(updated);
});

router.delete("/admin/blog/posts/:id", async (req, res) => {
  if (!await assertAdmin(req, res)) return;

  await db.delete(blogPostsTable).where(eq(blogPostsTable.id, req.params.id));
  res.json({ ok: true });
});

export default router;
