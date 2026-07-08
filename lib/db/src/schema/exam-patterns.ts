import {
  pgTable,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// exam_patterns — official exam configuration (marks, time, negative marking)
//
// section_wise_config JSON array shape:
// [{ name, subjectCode, questionCount, marksPerQuestion, negativeMarks, orderNum }]
//
// Used by:
//   - Admin to auto-populate sections when creating a mock
//   - Import validator to verify section correctness
//   - Session UI to show official marks/negative marking
// ─────────────────────────────────────────────────────────────────────────────
export const examPatternsTable = pgTable(
  "exam_patterns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examCode: text("exam_code").notNull().unique(),
    examName: text("exam_name").notNull(),
    mockType: text("mock_type").notNull().default("FULL_MOCK"),
    totalQuestions: integer("total_questions").notNull(),
    totalMarks: integer("total_marks").notNull(),
    timeLimitMinutes: integer("time_limit_minutes").notNull(),
    markPerQuestion: numeric("mark_per_question", { precision: 5, scale: 2 }).notNull().default("1"),
    negativeMarking: numeric("negative_marking", { precision: 5, scale: 2 }).notNull().default("0"),
    sectionWiseConfig: jsonb("section_wise_config"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_ep_exam_code").on(t.examCode),
    index("idx_ep_active").on(t.isActive),
  ],
);

export const insertExamPatternSchema = createInsertSchema(examPatternsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExamPattern = z.infer<typeof insertExamPatternSchema>;
export type ExamPattern = typeof examPatternsTable.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Default exam patterns seed data
// Applied via POST /api/admin/exam-patterns/seed
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_EXAM_PATTERNS: Omit<InsertExamPattern, "id" | "createdAt" | "updatedAt">[] = [
  {
    examCode: "SSC_CGL",
    examName: "SSC CGL (Tier I)",
    mockType: "FULL_MOCK",
    totalQuestions: 100,
    totalMarks: 200,
    timeLimitMinutes: 60,
    markPerQuestion: "2",
    negativeMarking: "0.50",
    isActive: true,
    sectionWiseConfig: [
      { name: "General Intelligence & Reasoning", subjectCode: "REASONING", questionCount: 25, marksPerQuestion: 2, negativeMarks: 0.5, orderNum: 1 },
      { name: "General Awareness", subjectCode: "GA", questionCount: 25, marksPerQuestion: 2, negativeMarks: 0.5, orderNum: 2 },
      { name: "Quantitative Aptitude", subjectCode: "QUANT", questionCount: 25, marksPerQuestion: 2, negativeMarks: 0.5, orderNum: 3 },
      { name: "English Language", subjectCode: "ENGLISH", questionCount: 25, marksPerQuestion: 2, negativeMarks: 0.5, orderNum: 4 },
    ],
  },
  {
    examCode: "IBPS_PO",
    examName: "IBPS PO (Prelims)",
    mockType: "FULL_MOCK",
    totalQuestions: 100,
    totalMarks: 100,
    timeLimitMinutes: 60,
    markPerQuestion: "1",
    negativeMarking: "0.25",
    isActive: true,
    sectionWiseConfig: [
      { name: "English Language", subjectCode: "ENGLISH", questionCount: 30, marksPerQuestion: 1, negativeMarks: 0.25, orderNum: 1 },
      { name: "Quantitative Aptitude", subjectCode: "QUANT", questionCount: 35, marksPerQuestion: 1, negativeMarks: 0.25, orderNum: 2 },
      { name: "Reasoning Ability", subjectCode: "REASONING", questionCount: 35, marksPerQuestion: 1, negativeMarks: 0.25, orderNum: 3 },
    ],
  },
  {
    examCode: "RRB_NTPC",
    examName: "RRB NTPC (CBT 1)",
    mockType: "FULL_MOCK",
    totalQuestions: 100,
    totalMarks: 100,
    timeLimitMinutes: 90,
    markPerQuestion: "1",
    negativeMarking: "0.33",
    isActive: true,
    sectionWiseConfig: [
      { name: "Mathematics", subjectCode: "MATHS", questionCount: 30, marksPerQuestion: 1, negativeMarks: 0.33, orderNum: 1 },
      { name: "General Intelligence & Reasoning", subjectCode: "REASONING", questionCount: 30, marksPerQuestion: 1, negativeMarks: 0.33, orderNum: 2 },
      { name: "General Awareness", subjectCode: "GA", questionCount: 40, marksPerQuestion: 1, negativeMarks: 0.33, orderNum: 3 },
    ],
  },
  {
    examCode: "UPPSC",
    examName: "UPPSC PCS (Prelims - GS I)",
    mockType: "FULL_MOCK",
    totalQuestions: 150,
    totalMarks: 200,
    timeLimitMinutes: 120,
    markPerQuestion: "1.33",
    negativeMarking: "0.33",
    isActive: true,
    sectionWiseConfig: [
      { name: "General Studies", subjectCode: "GS", questionCount: 150, marksPerQuestion: 1.33, negativeMarks: 0.33, orderNum: 1 },
    ],
  },
  {
    examCode: "BPSC",
    examName: "BPSC Prelims (GS)",
    mockType: "FULL_MOCK",
    totalQuestions: 150,
    totalMarks: 150,
    timeLimitMinutes: 120,
    markPerQuestion: "1",
    negativeMarking: "0",
    isActive: true,
    sectionWiseConfig: [
      { name: "General Studies", subjectCode: "GS", questionCount: 150, marksPerQuestion: 1, negativeMarks: 0, orderNum: 1 },
    ],
  },
];
