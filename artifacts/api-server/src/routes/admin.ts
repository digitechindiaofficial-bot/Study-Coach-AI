import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import {
  profilesTable,
  currentAffairsTable,
  quizQuestionsTable,
  quizAttemptsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

async function isAdminEmail(userId: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.emailAddresses.find((e: { id: string }) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    return !!email && email.toLowerCase() === adminEmail.toLowerCase();
  } catch {
    return false;
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const ok = await isAdminEmail(userId);
  if (!ok) {
    req.log.warn({ userId }, "Non-admin user attempted to access admin panel");
    res.status(403).json({ error: "forbidden", message: "Admin access only." });
    return;
  }
  next();
}

router.use("/admin", requireAdmin);

router.get("/admin/check", async (_req, res) => {
  res.json({ isAdmin: true });
});

router.get("/admin/stats", async (_req, res) => {
  const profiles = await db.select().from(profilesTable);
  const totalUsers = profiles.length;
  const proUsers = profiles.filter((p) => p.planType === "pro").length;
  const freeUsers = totalUsers - proUsers;

  const today = new Date().toISOString().split("T")[0];
  const attempts = await db.select().from(quizAttemptsTable);
  const todayQuizAttempts = attempts.filter(
    (a) => a.attemptedAt.toISOString().split("T")[0] === today,
  ).length;

  const questions = await db.select().from(quizQuestionsTable);
  const currentAffairs = await db.select().from(currentAffairsTable);

  res.json({
    totalUsers,
    proUsers,
    freeUsers,
    todayQuizAttempts,
    totalQuizAttempts: attempts.length,
    totalQuestions: questions.length,
    totalCurrentAffairs: currentAffairs.length,
  });
});

// ── Current Affairs ──
router.get("/admin/current-affairs", async (req, res) => {
  const date = req.query.date as string | undefined;
  let items = await db.select().from(currentAffairsTable);
  if (date) items = items.filter((i) => i.publishedDate === date);
  items.sort((a, b) => {
    const d = (b.publishedDate ?? "").localeCompare(a.publishedDate ?? "");
    if (d !== 0) return d;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  res.json(items);
});

router.post("/admin/current-affairs", async (req, res) => {
  const { title, summary, category, examRelevance, publishedDate, isFeatured } = req.body ?? {};
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  const [created] = await db
    .insert(currentAffairsTable)
    .values({
      title,
      summary: summary ?? null,
      category: category ?? null,
      examRelevance: Array.isArray(examRelevance) ? examRelevance : [],
      publishedDate: publishedDate || new Date().toISOString().split("T")[0],
      source: "Admin",
      isFeatured: isFeatured === true,
    })
    .returning();
  res.status(201).json(created);
});

router.put("/admin/current-affairs/:id", async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, summary, category, examRelevance, publishedDate, isFeatured } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (summary !== undefined) updates.summary = summary;
  if (category !== undefined) updates.category = category;
  if (examRelevance !== undefined) updates.examRelevance = Array.isArray(examRelevance) ? examRelevance : [];
  if (publishedDate !== undefined) updates.publishedDate = publishedDate;
  if (isFeatured !== undefined) updates.isFeatured = isFeatured === true;

  const [updated] = await db
    .update(currentAffairsTable)
    .set(updates)
    .where(eq(currentAffairsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/admin/current-affairs/:id", async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [deleted] = await db.delete(currentAffairsTable).where(eq(currentAffairsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

// ── Users ──
router.get("/admin/users", async (req, res) => {
  const search = (req.query.search as string | undefined)?.toLowerCase().trim();
  const profiles = await db.select().from(profilesTable).orderBy(desc(profilesTable.createdAt));

  const clerkIds = profiles.map((p) => p.clerkUserId);
  const emailMap = new Map<string, string>();
  const nameMap = new Map<string, string>();

  if (clerkIds.length > 0) {
    try {
      const userList = await clerkClient.users.getUserList({
        userId: clerkIds,
        limit: Math.min(clerkIds.length, 500),
      });
      const users = Array.isArray(userList) ? userList : userList.data;
      for (const u of users) {
        const email =
          u.emailAddresses.find((e: { id: string }) => e.id === u.primaryEmailAddressId)?.emailAddress ??
          u.emailAddresses[0]?.emailAddress ??
          "";
        emailMap.set(u.id, email);
        nameMap.set(u.id, [u.firstName, u.lastName].filter(Boolean).join(" "));
      }
    } catch (err) {
      req.log.warn({ err: String(err) }, "Failed to fetch Clerk users for admin panel");
    }
  }

  let result = profiles.map((p) => ({
    id: p.id,
    clerkUserId: p.clerkUserId,
    fullName: p.fullName || nameMap.get(p.clerkUserId) || "—",
    email: emailMap.get(p.clerkUserId) ?? "—",
    examType: p.examType,
    planType: p.planType,
    streakCount: p.streakCount,
    createdAt: p.createdAt,
    lastActiveDate: p.lastActiveDate,
  }));

  if (search) {
    result = result.filter(
      (u) => u.fullName.toLowerCase().includes(search) || u.email.toLowerCase().includes(search),
    );
  }

  res.json(result);
});

router.patch("/admin/users/:id/plan", async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { planType } = req.body ?? {};
  if (planType !== "free" && planType !== "pro") {
    res.status(400).json({ error: "planType must be 'free' or 'pro'" });
    return;
  }
  const [updated] = await db
    .update(profilesTable)
    .set({ planType })
    .where(eq(profilesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
});

// ── Quiz Questions ──
router.get("/admin/quiz/questions", async (req, res) => {
  const subject = req.query.subject as string | undefined;
  let questions = await db.select().from(quizQuestionsTable).orderBy(desc(quizQuestionsTable.createdAt));
  if (subject && subject !== "All") questions = questions.filter((q) => q.subject === subject);
  res.json(questions);
});

router.get("/admin/quiz/subject-counts", async (_req, res) => {
  const questions = await db.select().from(quizQuestionsTable);
  const counts: Record<string, number> = {};
  for (const q of questions) {
    const subj = q.subject ?? "Uncategorized";
    counts[subj] = (counts[subj] ?? 0) + 1;
  }
  res.json(counts);
});

router.post("/admin/quiz/questions", async (req, res) => {
  const { subject, topic, questionText, options, correctOption, explanation, difficulty, examType } =
    req.body ?? {};
  if (!questionText || typeof questionText !== "string") {
    res.status(400).json({ error: "Question text is required" });
    return;
  }
  if (!options || typeof options !== "object") {
    res.status(400).json({ error: "Options are required" });
    return;
  }
  if (!correctOption || typeof correctOption !== "string") {
    res.status(400).json({ error: "Correct option is required" });
    return;
  }
  const [created] = await db
    .insert(quizQuestionsTable)
    .values({
      subject: subject ?? null,
      topic: topic ?? null,
      questionText,
      options,
      correctOption,
      explanation: explanation ?? null,
      difficulty: difficulty ?? null,
      examType: Array.isArray(examType) ? examType : [],
    })
    .returning();
  res.status(201).json(created);
});

router.delete("/admin/quiz/questions/:id", async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [deleted] = await db.delete(quizQuestionsTable).where(eq(quizQuestionsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

export default router;
