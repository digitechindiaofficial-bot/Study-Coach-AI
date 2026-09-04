import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { requireAdmin as sharedRequireAdmin } from "../lib/require-admin.js";
import { db } from "@workspace/db";
import {
  profilesTable,
  currentAffairsTable,
  quizQuestionsTable,
  quizAttemptsTable,
  syllabusExamsTable,
  syllabusSubjectsTable,
  syllabusTopicsTable,
  userTopicProgressTable,
} from "@workspace/db";
import { eq, desc, inArray, count } from "drizzle-orm";
import { z } from "zod";
import { deriveSubjectCode, buildTopicCode } from "../lib/syllabus-codes.js";
import { hasActiveProAccess } from "../lib/plan-access";

const router = Router();

router.use("/admin", sharedRequireAdmin);

router.get("/admin/check", async (_req, res) => {
  res.json({ isAdmin: true });
});

router.get("/admin/stats", async (_req, res) => {
  const profiles = await db.select().from(profilesTable);
  const totalUsers = profiles.length;
  const proUsers = profiles.filter((profile) => hasActiveProAccess(profile)).length;
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
    phoneNumber: p.phoneNumber,
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
    .set({
      planType,
      planExpiry: planType === "pro"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null,
    })
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

// ── Syllabus Import ──

const SyllabusSubjectInput = z.object({
  name: z.string().min(1),
  topics: z.array(z.string().min(1)),
});

const SyllabusImportInput = z.object({
  exam: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  subjects: z.array(SyllabusSubjectInput).min(1),
});

router.get("/admin/syllabus/exams", async (req, res) => {
  try {
    const exams = await db.select().from(syllabusExamsTable).orderBy(desc(syllabusExamsTable.createdAt));
    if (exams.length === 0) return res.json([]);

    const examIds = exams.map((e) => e.id);
    const subjects = await db.select().from(syllabusSubjectsTable)
      .where(inArray(syllabusSubjectsTable.examId, examIds));
    const subjectIds = subjects.map((s) => s.id);
    const topicCounts = subjectIds.length > 0
      ? await db.select({ subjectId: syllabusTopicsTable.subjectId, cnt: count() })
          .from(syllabusTopicsTable)
          .where(inArray(syllabusTopicsTable.subjectId, subjectIds))
          .groupBy(syllabusTopicsTable.subjectId)
      : [];

    const topicCountBySubject = new Map(topicCounts.map((r) => [r.subjectId, Number(r.cnt)]));
    const subjectsByExam = new Map<string, typeof subjects>();
    for (const s of subjects) {
      const arr = subjectsByExam.get(s.examId) ?? [];
      arr.push(s);
      subjectsByExam.set(s.examId, arr);
    }

    const result = exams.map((exam) => {
      const examSubjects = subjectsByExam.get(exam.id) ?? [];
      const topicCount = examSubjects.reduce((sum, s) => sum + (topicCountBySubject.get(s.id) ?? 0), 0);
      return {
        id: exam.id,
        name: exam.name,
        code: exam.code,
        description: exam.description,
        subjectCount: examSubjects.length,
        topicCount,
        createdAt: exam.createdAt,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to list syllabus exams");
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/admin/syllabus/import", async (req, res) => {
  try {
    const body = req.body;

    if (body === undefined || body === null) {
      res.status(400).json({ error: "Request body is empty or not valid JSON" });
      return;
    }

    const inputs = Array.isArray(body) ? body : [body];
    const results: { exam: string; topics: number }[] = [];

    for (const raw of inputs) {
      const parsed = SyllabusImportInput.safeParse(raw);
      if (!parsed.success) {
        res.status(400).json({ error: `Invalid input for exam: ${parsed.error.message}` });
        return;
      }
      const { exam, code, description, subjects } = parsed.data;

      const existing = await db.select({ id: syllabusExamsTable.id })
        .from(syllabusExamsTable)
        .where(eq(syllabusExamsTable.code, code))
        .limit(1);

      let examId: string;

      // Maps that preserve topic_code / subject_code across re-imports.
      // key: "SubjectName::TopicName" → existing topicCode
      const preservedTopicCodes = new Map<string, string>();
      // key: "SubjectName" → existing subjectCode
      const preservedSubjectCodes = new Map<string, string>();

      if (existing.length > 0) {
        examId = existing[0].id;

        // ── Capture existing codes before deletion ──
        const existingSubjects = await db
          .select({ id: syllabusSubjectsTable.id, name: syllabusSubjectsTable.name, subjectCode: syllabusSubjectsTable.subjectCode })
          .from(syllabusSubjectsTable)
          .where(eq(syllabusSubjectsTable.examId, examId));

        for (const subj of existingSubjects) {
          if (subj.subjectCode) preservedSubjectCodes.set(subj.name, subj.subjectCode);

          const existingTopics = await db
            .select({ name: syllabusTopicsTable.name, topicCode: syllabusTopicsTable.topicCode })
            .from(syllabusTopicsTable)
            .where(eq(syllabusTopicsTable.subjectId, subj.id));

          for (const topic of existingTopics) {
            if (topic.topicCode) {
              preservedTopicCodes.set(`${subj.name}::${topic.name}`, topic.topicCode);
            }
          }
        }

        // ── Delete old data ──
        if (existingSubjects.length > 0) {
          await db.delete(syllabusTopicsTable)
            .where(inArray(syllabusTopicsTable.subjectId, existingSubjects.map((s) => s.id)));
        }
        await db.delete(syllabusSubjectsTable).where(eq(syllabusSubjectsTable.examId, examId));
        await db.update(syllabusExamsTable)
          .set({ name: exam, description: description ?? null })
          .where(eq(syllabusExamsTable.id, examId));
      } else {
        const [created] = await db.insert(syllabusExamsTable)
          .values({ name: exam, code, description: description ?? null })
          .returning();
        examId = created.id;
      }

      // ── Re-insert with codes ──
      let totalTopics = 0;
      for (let si = 0; si < subjects.length; si++) {
        const subj = subjects[si];
        const subjectCode =
          preservedSubjectCodes.get(subj.name) ?? deriveSubjectCode(subj.name);

        const [createdSubject] = await db.insert(syllabusSubjectsTable)
          .values({ examId, name: subj.name, subjectCode, displayOrder: si })
          .returning();

        const topicRows = subj.topics.map((topicName, ti) => ({
          subjectId: createdSubject.id,
          name: topicName,
          topicCode:
            preservedTopicCodes.get(`${subj.name}::${topicName}`) ??
            buildTopicCode(code, subjectCode, ti),
          displayOrder: ti,
        }));

        if (topicRows.length > 0) {
          await db.insert(syllabusTopicsTable).values(topicRows);
          totalTopics += topicRows.length;
        }
      }

      results.push({ exam, topics: totalTopics });
    }

    const summary = results.map((r) => `${r.exam}: ${r.topics} topics`).join(", ");
    res.json({ message: `Imported successfully — ${summary}`, results });
  } catch (err) {
    req.log.error(err, "Syllabus import failed");
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/admin/syllabus/exams/:id", async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [deleted] = await db.delete(syllabusExamsTable).where(eq(syllabusExamsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

router.get("/admin/question-stats", sharedRequireAdmin, async (req, res) => {
  try {
    const { pool: pgPool } = await import("@workspace/db");

    const [totalRes, byExamSubjectRes, byDiffRes, allSubjectsRes] = await Promise.all([
      pgPool.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM question_bank"),
      pgPool.query<{ exam_code: string; subject_code: string; cnt: string }>(
        "SELECT exam_code, subject_code, COUNT(*)::text AS cnt FROM question_bank GROUP BY exam_code, subject_code"
      ),
      pgPool.query<{ exam_code: string; subject_code: string; difficulty: string; cnt: string }>(
        "SELECT exam_code, subject_code, COALESCE(LOWER(difficulty), 'medium') AS difficulty, COUNT(*)::text AS cnt FROM question_bank GROUP BY exam_code, subject_code, LOWER(difficulty)"
      ),
      pgPool.query<{ exam_code: string; subject_code: string; subject_name: string }>(
        `SELECT se.code AS exam_code, ss.subject_code, ss.name AS subject_name
         FROM syllabus_subjects ss
         JOIN syllabus_exams se ON se.id = ss.exam_id
         WHERE ss.is_active = true
         ORDER BY se.code, ss.subject_code`
      ),
    ]);

    const total = parseInt(totalRes.rows[0]?.total ?? "0", 10);

    // Build difficulty lookup: "EXAM|SUBJ|diff" -> count
    const diffMap: Record<string, number> = {};
    for (const r of byDiffRes.rows) {
      const key = `${r.exam_code}|${r.subject_code}|${r.difficulty}`;
      diffMap[key] = (diffMap[key] ?? 0) + parseInt(r.cnt, 10);
    }

    // Build subject count lookup: "EXAM|SUBJ" -> count
    const subMap: Record<string, number> = {};
    for (const r of byExamSubjectRes.rows) {
      subMap[`${r.exam_code}|${r.subject_code}`] = parseInt(r.cnt, 10);
    }

    // Group all syllabus subjects by exam
    const examSubjectsMap: Record<string, Array<{ exam_code: string; subject_code: string; subject_name: string }>> = {};
    for (const s of allSubjectsRes.rows) {
      if (!examSubjectsMap[s.exam_code]) examSubjectsMap[s.exam_code] = [];
      examSubjectsMap[s.exam_code].push(s);
    }

    // Build per-exam stats
    const examCodes = [...new Set(allSubjectsRes.rows.map(r => r.exam_code))];
    const exams = examCodes.map(code => {
      const subjects = (examSubjectsMap[code] ?? []).map(s => {
        const sk = `${code}|${s.subject_code}`;
        const count = subMap[sk] ?? 0;
        return {
          subject_code: s.subject_code,
          count,
          difficulty: {
            easy:   diffMap[`${sk}|easy`]   ?? 0,
            medium: diffMap[`${sk}|medium`] ?? 0,
            hard:   diffMap[`${sk}|hard`]   ?? 0,
          },
        };
      });
      const examTotal = subjects.reduce((sum, s) => sum + s.count, 0);
      return { exam_code: code, total: examTotal, subjects };
    });

    const subjectCount = allSubjectsRes.rows.length;
    const subjectsWithZero = allSubjectsRes.rows.filter(s => (subMap[`${s.exam_code}|${s.subject_code}`] ?? 0) === 0);

    res.json({
      total,
      exam_count: examCodes.length,
      subject_count: subjectCount,
      avg_per_subject: subjectCount > 0 ? Math.round(total / subjectCount) : 0,
      exams,
      subjects_with_zero: subjectsWithZero,
    });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "question-stats failed");
    res.status(500).json({ error: err?.message ?? "Failed" });
  }
});

export default router;
