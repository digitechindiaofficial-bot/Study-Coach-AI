/**
 * Finalize all 8 official syllabi with corrections against the latest official content.
 * Run: pnpm --filter @workspace/scripts run finalize-syllabi
 *
 * - Preserves existing topic_codes where topic names match exactly.
 * - Assigns new topic_codes for added/renamed topics.
 * - Safe to re-run (idempotent after first run).
 */

import { db } from "@workspace/db";
import {
  syllabusExamsTable,
  syllabusSubjectsTable,
  syllabusTopicsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { buildTopicCode } from "./syllabus-codes.js";

interface SubjectDef {
  name: string;
  subjectCode: string;
  topics: string[];
}

interface ExamDef {
  exam: string;
  code: string;
  description: string;
  subjects: SubjectDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE SYLLABI — verified against latest official notifications
// ─────────────────────────────────────────────────────────────────────────────

const SYLLABI: ExamDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SSC CGL — Tier I (all four sections) + Tier II topics within same subjects
  // ═══════════════════════════════════════════════════════════════════════════
  {
    exam: "SSC CGL",
    code: "SSC_CGL",
    description: "Staff Selection Commission — Combined Graduate Level",
    subjects: [
      {
        name: "Quantitative Aptitude",
        subjectCode: "QA",
        topics: [
          "Number System",
          "LCM & HCF",
          "Simplification",
          "Approximation",
          "Percentage",
          "Ratio & Proportion",
          "Average",
          "Profit & Loss",
          "Discount",
          "Simple & Compound Interest",
          "Time & Work",
          "Pipe & Cistern",
          "Time, Speed & Distance",
          "Mixture & Alligation",
          "Algebra",
          "Geometry",
          "Mensuration",
          "Trigonometry",
          "Height & Distance",
          "Data Interpretation",
          "Statistics",
          "Probability",
          "Number Series",
        ],
      },
      {
        name: "English Language",
        subjectCode: "ENG",
        topics: [
          "Reading Comprehension",
          "Cloze Test",
          "Fill in the Blanks",
          "Spelling Correction",
          "Error Detection",
          "Sentence Improvement",
          "Para Jumbles",
          "Synonyms & Antonyms",
          "Idioms & Phrases",
          "One Word Substitution",
          "Active & Passive Voice",
          "Direct & Indirect Speech",
          "Vocabulary",
        ],
      },
      {
        name: "General Intelligence & Reasoning",
        subjectCode: "GIR",
        topics: [
          "Analogy",
          "Classification",
          "Series",
          "Coding-Decoding",
          "Blood Relation",
          "Direction Sense",
          "Ranking",
          "Alphabet Test",
          "Venn Diagram",
          "Syllogism",
          "Puzzle",
          "Seating Arrangement",
          "Clock",
          "Calendar",
          "Mirror Image",
          "Paper Folding",
          "Dice",
          "Non-Verbal Reasoning",
          "Missing Number",
          "Statement & Assumptions",
          "Mathematical Operations",
        ],
      },
      {
        name: "General Awareness",
        subjectCode: "GA",
        topics: [
          "History",
          "Geography",
          "Indian Polity",
          "Indian Economy",
          "Physics",
          "Chemistry",
          "Biology",
          "Computer Awareness",
          "Environment",
          "Current Affairs",
          "Static GK",
          "Art & Culture",
          "Sports",
          "Books & Authors",
          "Awards & Honours",
          "Government Schemes",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SSC CHSL — Tier I + Tier II Descriptive
  // ═══════════════════════════════════════════════════════════════════════════
  {
    exam: "SSC CHSL",
    code: "SSC_CHSL",
    description: "Staff Selection Commission — Combined Higher Secondary Level",
    subjects: [
      {
        name: "Quantitative Aptitude",
        subjectCode: "QA",
        topics: [
          "Number System",
          "LCM & HCF",
          "Simplification",
          "Approximation",
          "Percentage",
          "Ratio & Proportion",
          "Average",
          "Profit & Loss",
          "Discount",
          "Simple & Compound Interest",
          "Time & Work",
          "Pipe & Cistern",
          "Time, Speed & Distance",
          "Mixture & Alligation",
          "Algebra",
          "Geometry",
          "Mensuration",
          "Trigonometry",
          "Data Interpretation",
        ],
      },
      {
        name: "English Language",
        subjectCode: "ENG",
        topics: [
          "Reading Comprehension",
          "Cloze Test",
          "Fill in the Blanks",
          "Spelling Correction",
          "Error Detection",
          "Sentence Improvement",
          "Para Jumbles",
          "Synonyms & Antonyms",
          "Idioms & Phrases",
          "One Word Substitution",
          "Active & Passive Voice",
          "Direct & Indirect Speech",
          "Vocabulary",
        ],
      },
      {
        name: "General Intelligence & Reasoning",
        subjectCode: "GIR",
        topics: [
          "Analogy",
          "Classification",
          "Series",
          "Coding-Decoding",
          "Blood Relation",
          "Direction Sense",
          "Ranking",
          "Syllogism",
          "Venn Diagram",
          "Puzzle",
          "Mirror Image",
          "Paper Folding",
          "Dice",
          "Non-Verbal Reasoning",
          "Missing Number",
          "Mathematical Operations",
        ],
      },
      {
        name: "General Awareness",
        subjectCode: "GA",
        topics: [
          "History",
          "Geography",
          "Indian Polity",
          "Indian Economy",
          "Physics",
          "Chemistry",
          "Biology",
          "Computer Awareness",
          "Current Affairs",
          "Static GK",
          "Environment",
          "Art & Culture",
          "Sports",
        ],
      },
      {
        name: "Descriptive Paper",
        subjectCode: "DESC",
        topics: [
          "Essay Writing",
          "Letter Writing",
          "Application Writing",
          "Precis Writing",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IBPS PO — Prelims + Mains
  // ═══════════════════════════════════════════════════════════════════════════
  {
    exam: "IBPS PO",
    code: "IBPS_PO",
    description: "Institute of Banking Personnel Selection — Probationary Officer",
    subjects: [
      {
        name: "Quantitative Aptitude",
        subjectCode: "QA",
        topics: [
          "Number System",
          "Simplification",
          "Approximation",
          "Percentage",
          "Ratio & Proportion",
          "Average",
          "Profit & Loss",
          "Discount",
          "Simple & Compound Interest",
          "Time & Work",
          "Pipe & Cistern",
          "Time, Speed & Distance",
          "Mixture & Alligation",
          "Partnership",
          "Permutation & Combination",
          "Probability",
          "Data Interpretation",
          "Data Sufficiency",
          "Quadratic Equations",
          "Number Series",
          "Inequality",
        ],
      },
      {
        name: "English Language",
        subjectCode: "ENG",
        topics: [
          "Reading Comprehension",
          "Cloze Test",
          "Error Detection",
          "Sentence Improvement",
          "Fill in the Blanks",
          "Para Jumbles",
          "Para Summary",
          "Vocabulary",
          "Word Usage",
          "Sentence Connectors",
        ],
      },
      {
        name: "Reasoning Ability",
        subjectCode: "REAS",
        topics: [
          "Analogy",
          "Classification",
          "Series",
          "Coding-Decoding",
          "Blood Relation",
          "Direction Sense",
          "Ranking",
          "Syllogism",
          "Puzzle",
          "Seating Arrangement",
          "Input-Output",
          "Inequality",
          "Data Sufficiency",
          "Critical Reasoning",
          "Alphanumeric Series",
          "Statement & Assumptions",
          "Cause & Effect",
          "Mathematical Operations",
        ],
      },
      {
        name: "General/Economy/Banking Awareness",
        subjectCode: "BANK",
        topics: [
          "Banking Awareness",
          "Financial Awareness",
          "Current Affairs",
          "Static GK",
          "Government Schemes",
          "Indian Economy",
          "RBI & Monetary Policy",
          "International Organisations",
          "Awards & Honours",
          "Budget & Five-Year Plans",
          "Insurance Awareness",
          "Capital Markets",
        ],
      },
      {
        name: "Computer Aptitude",
        subjectCode: "COMP",
        topics: [
          "Computer Fundamentals",
          "History of Computers",
          "Hardware & Software",
          "Input/Output Devices",
          "MS Office",
          "Internet & Networking",
          "Cyber Security",
          "Database Concepts",
          "Operating System",
          "Number System in Computers",
          "Programming Basics",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IBPS Clerk — Prelims + Mains
  // ═══════════════════════════════════════════════════════════════════════════
  {
    exam: "IBPS Clerk",
    code: "IBPS_CLERK",
    description: "Institute of Banking Personnel Selection — Clerical Cadre",
    subjects: [
      {
        name: "Quantitative Aptitude",
        subjectCode: "QA",
        topics: [
          "Number System",
          "Simplification",
          "Approximation",
          "Percentage",
          "Ratio & Proportion",
          "Average",
          "Profit & Loss",
          "Discount",
          "Simple & Compound Interest",
          "Time & Work",
          "Pipe & Cistern",
          "Time, Speed & Distance",
          "Mixture & Alligation",
          "Data Interpretation",
          "Number Series",
          "Quadratic Equations",
        ],
      },
      {
        name: "English Language",
        subjectCode: "ENG",
        topics: [
          "Reading Comprehension",
          "Cloze Test",
          "Error Detection",
          "Sentence Improvement",
          "Fill in the Blanks",
          "Para Jumbles",
          "Vocabulary",
          "Spelling Correction",
          "Word Usage",
        ],
      },
      {
        name: "Reasoning Ability",
        subjectCode: "REAS",
        topics: [
          "Analogy",
          "Classification",
          "Coding-Decoding",
          "Blood Relation",
          "Direction Sense",
          "Order & Ranking",
          "Syllogism",
          "Puzzle",
          "Seating Arrangement",
          "Inequality",
          "Alphanumeric Series",
          "Input-Output",
          "Data Sufficiency",
        ],
      },
      {
        name: "General/Financial Awareness",
        subjectCode: "GFIN",
        topics: [
          "Banking Awareness",
          "Current Affairs",
          "Static GK",
          "Indian Economy",
          "Government Schemes",
          "Financial Institutions",
          "RBI Guidelines",
          "Insurance Awareness",
        ],
      },
      {
        name: "Computer Knowledge",
        subjectCode: "COMP",
        topics: [
          "Computer Fundamentals",
          "MS Office",
          "Internet & Networking",
          "Keyboard Shortcuts",
          "Operating System",
          "History of Computers",
          "Database Concepts",
          "Input/Output Devices",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SBI PO — Prelims + Mains
  // ═══════════════════════════════════════════════════════════════════════════
  {
    exam: "SBI PO",
    code: "SBI_PO",
    description: "State Bank of India — Probationary Officer",
    subjects: [
      {
        name: "Quantitative Aptitude",
        subjectCode: "QA",
        topics: [
          "Number System",
          "Simplification",
          "Approximation",
          "Percentage",
          "Ratio & Proportion",
          "Average",
          "Profit & Loss",
          "Discount",
          "Simple & Compound Interest",
          "Time & Work",
          "Pipe & Cistern",
          "Time, Speed & Distance",
          "Mixture & Alligation",
          "Partnership",
          "Permutation & Combination",
          "Probability",
          "Data Interpretation",
          "Data Sufficiency",
          "Quadratic Equations",
          "Number Series",
        ],
      },
      {
        name: "English Language",
        subjectCode: "ENG",
        topics: [
          "Reading Comprehension",
          "Cloze Test",
          "Error Detection",
          "Sentence Improvement",
          "Fill in the Blanks",
          "Para Jumbles",
          "Para Summary",
          "Vocabulary",
          "Paragraph Completion",
          "Word Association",
          "Sentence Connectors",
        ],
      },
      {
        name: "Reasoning & Computer Aptitude",
        subjectCode: "RCA",
        topics: [
          "Analogy",
          "Coding-Decoding",
          "Blood Relation",
          "Direction Sense",
          "Ranking",
          "Syllogism",
          "Puzzle",
          "Seating Arrangement",
          "Input-Output",
          "Inequality",
          "Critical Reasoning",
          "Alphanumeric Series",
          "Statement & Assumptions",
          "Mathematical Operations",
          "Computer Fundamentals",
          "MS Office",
          "Internet & Networking",
          "Database Concepts",
          "Cyber Security",
        ],
      },
      {
        name: "General/Economy/Banking Awareness",
        subjectCode: "BANK",
        topics: [
          "Banking Awareness",
          "Financial Awareness",
          "Current Affairs",
          "Static GK",
          "Indian Economy",
          "RBI & Monetary Policy",
          "Government Schemes",
          "International Organisations",
          "Awards & Honours",
          "Budget Highlights",
          "Insurance Awareness",
          "Capital Markets",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RRB NTPC — CBT-1 + CBT-2
  // ═══════════════════════════════════════════════════════════════════════════
  {
    exam: "RRB NTPC",
    code: "RRB_NTPC",
    description: "Railway Recruitment Board — Non-Technical Popular Categories",
    subjects: [
      {
        name: "Mathematics",
        subjectCode: "MATH",
        topics: [
          "Number System",
          "Decimals & Fractions",
          "LCM & HCF",
          "Ratio & Proportion",
          "Percentage",
          "Average",
          "Profit & Loss",
          "Discount",
          "Simple & Compound Interest",
          "Time & Work",
          "Pipe & Cistern",
          "Time, Speed & Distance",
          "Mensuration",
          "Geometry",
          "Trigonometry",
          "Elementary Statistics",
          "Tables & Graphs",
          "Elementary Algebra",
          "Age Calculations",
        ],
      },
      {
        name: "General Intelligence & Reasoning",
        subjectCode: "GIR",
        topics: [
          "Analogy",
          "Classification",
          "Number Series",
          "Coding-Decoding",
          "Mathematical Operations",
          "Blood Relation",
          "Direction Sense",
          "Ranking",
          "Syllogism",
          "Venn Diagram",
          "Data Interpretation",
          "Statement & Conclusion",
          "Decision Making",
          "Missing Number",
          "Non-Verbal Reasoning",
        ],
      },
      {
        name: "General Awareness",
        subjectCode: "GA",
        topics: [
          "Current Affairs",
          "Indian Geography",
          "Indian History",
          "Indian Polity & Constitution",
          "Indian Economy",
          "General Science",
          "Physics",
          "Chemistry",
          "Life Science",
          "Environmental Sciences",
          "Space & Technology",
          "Sports",
          "Books & Authors",
          "Government Schemes",
          "Computer & IT Basics",
          "Railways & Transport",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UPPSC — Prelims (CSAT) + Mains GS Papers
  // ═══════════════════════════════════════════════════════════════════════════
  {
    exam: "UPPSC",
    code: "UPPSC",
    description: "Uttar Pradesh Public Service Commission",
    subjects: [
      {
        name: "History & Culture",
        subjectCode: "HIST",
        topics: [
          "Ancient India",
          "Medieval India",
          "Modern India",
          "Indian National Movement",
          "World History",
          "Indian Culture & Heritage",
          "Art & Architecture",
          "Uttar Pradesh History",
          "Post-Independence India",
        ],
      },
      {
        name: "Geography & Environment",
        subjectCode: "GEO",
        topics: [
          "Physical Geography of India",
          "River Systems",
          "Soil & Vegetation",
          "Indian Agriculture",
          "Natural Resources",
          "World Geography",
          "Climate & Environment",
          "Environment & Ecology",
          "Disaster Management",
          "Uttar Pradesh Geography",
          "UP Resources & Industries",
        ],
      },
      {
        name: "Indian Polity & Governance",
        subjectCode: "POL",
        topics: [
          "Indian Constitution",
          "Parliament & State Legislature",
          "Federalism",
          "Panchayati Raj & Local Bodies",
          "Fundamental Rights & Duties",
          "Directive Principles",
          "Government Policies & Schemes",
          "Public Policy",
          "Rights Issues",
          "UP Governance",
        ],
      },
      {
        name: "Economy & Development",
        subjectCode: "ECON",
        topics: [
          "Indian Economy",
          "Economic Development & Planning",
          "Agriculture Economy",
          "UP Economy",
          "Industry & Trade",
          "Banking & Finance",
          "Poverty & Inequality",
          "Infrastructure Development",
          "IT & Digital India",
          "Budget & Economic Survey",
        ],
      },
      {
        name: "Science & Technology",
        subjectCode: "SCI",
        topics: [
          "Physics",
          "Chemistry",
          "Biology",
          "Space & Defence Technology",
          "Biotechnology",
          "Nanotechnology",
          "Computer Science",
          "Environmental Science",
          "Energy Resources",
        ],
      },
      {
        name: "Ethics & Aptitude",
        subjectCode: "ETHICS",
        topics: [
          "Ethics & Human Interface",
          "Integrity & Aptitude",
          "Social Influence",
          "Attitude",
          "Civil Service Values",
          "Emotional Intelligence",
          "Public Service Ethics",
          "Case Studies",
        ],
      },
      {
        name: "General Hindi",
        subjectCode: "HINDI",
        topics: [
          "Hindi Grammar",
          "Comprehension",
          "Letter Writing",
          "Essay Writing",
          "Translation",
          "Vocabulary",
        ],
      },
      {
        name: "Aptitude & Reasoning (CSAT)",
        subjectCode: "APT",
        topics: [
          "Number System",
          "Simplification",
          "Percentage",
          "Average",
          "Profit & Loss",
          "Time & Work",
          "Data Interpretation",
          "Analogy",
          "Series",
          "Coding-Decoding",
          "Blood Relation",
          "Syllogism",
          "Logical Reasoning",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BPSC — Prelims + Mains
  // ═══════════════════════════════════════════════════════════════════════════
  {
    exam: "BPSC",
    code: "BPSC",
    description: "Bihar Public Service Commission",
    subjects: [
      {
        name: "History & Culture",
        subjectCode: "HIST",
        topics: [
          "Ancient India",
          "Medieval India",
          "Modern India",
          "Indian National Movement",
          "Bihar History",
          "Bihar Culture & Heritage",
          "Art & Culture",
          "Post-Independence India",
        ],
      },
      {
        name: "Geography & Environment",
        subjectCode: "GEO",
        topics: [
          "Indian Geography",
          "Bihar Geography",
          "Physical Geography",
          "Rivers & Water Bodies of Bihar",
          "Soil & Agriculture of Bihar",
          "Environment & Ecology",
          "Climate Change",
          "Disaster Management",
          "World Geography",
        ],
      },
      {
        name: "Indian Polity & Governance",
        subjectCode: "POL",
        topics: [
          "Indian Constitution",
          "Parliament & State Legislature",
          "Federalism",
          "Panchayati Raj",
          "Central & State Government Schemes",
          "Bihar Political System",
          "Public Administration",
          "Fundamental Rights & Duties",
          "Bihar Governance & Administration",
        ],
      },
      {
        name: "Economy & Development",
        subjectCode: "ECON",
        topics: [
          "Indian Economy",
          "Bihar Economy",
          "Economic Development",
          "Agriculture",
          "Industry",
          "Banking & Finance",
          "Infrastructure Development",
          "IT & Digital India",
        ],
      },
      {
        name: "General Science",
        subjectCode: "SCI",
        topics: [
          "Physics",
          "Chemistry",
          "Biology",
          "Science & Technology",
          "Computer Fundamentals",
          "Space & Defence Technology",
          "Biotechnology",
          "Nuclear Science",
        ],
      },
      {
        name: "Mathematics & Reasoning",
        subjectCode: "MREAS",
        topics: [
          "Number System",
          "Simplification",
          "Percentage",
          "Ratio & Proportion",
          "Average",
          "Profit & Loss",
          "Time & Work",
          "Time, Speed & Distance",
          "Simple & Compound Interest",
          "Algebra",
          "Geometry",
          "Data Interpretation",
          "Logical Reasoning",
          "Analogy",
          "Classification",
          "Series",
          "Coding-Decoding",
          "Blood Relation",
          "Direction Sense",
          "Syllogism",
        ],
      },
      {
        name: "General Hindi",
        subjectCode: "HINDI",
        topics: [
          "Hindi Grammar",
          "Comprehension",
          "Essay Writing",
          "Letter Writing",
          "Vocabulary",
          "Translation",
        ],
      },
      {
        name: "Bihar Special",
        subjectCode: "BIHAR",
        topics: [
          "Bihar Geography — Key Places",
          "Bihar Economy — Sectors",
          "Bihar Polity — Legislature & Executive",
          "Bihar Culture — Festivals & Fairs",
          "Important Personalities of Bihar",
          "Bihar Industrial Development",
          "Bihar Agriculture & Irrigation",
          "Bihar Government Schemes",
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function captureExistingCodes(examId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      subjectName: syllabusSubjectsTable.name,
      topicName: syllabusTopicsTable.name,
      topicCode: syllabusTopicsTable.topicCode,
    })
    .from(syllabusSubjectsTable)
    .innerJoin(
      syllabusTopicsTable,
      eq(syllabusTopicsTable.subjectId, syllabusSubjectsTable.id),
    )
    .where(eq(syllabusSubjectsTable.examId, examId));

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.topicCode) {
      map.set(`${row.subjectName}::${row.topicName}`, row.topicCode);
    }
  }
  return map;
}

async function deleteExamData(examId: string): Promise<void> {
  const subjects = await db
    .select({ id: syllabusSubjectsTable.id })
    .from(syllabusSubjectsTable)
    .where(eq(syllabusSubjectsTable.examId, examId));

  if (subjects.length > 0) {
    await db
      .delete(syllabusTopicsTable)
      .where(
        inArray(
          syllabusTopicsTable.subjectId,
          subjects.map((s) => s.id),
        ),
      );
  }
  await db
    .delete(syllabusSubjectsTable)
    .where(eq(syllabusSubjectsTable.examId, examId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-exam next-available code counter (skips codes that already exist globally)
// ─────────────────────────────────────────────────────────────────────────────

async function getUsedCodes(): Promise<Set<string>> {
  const rows = await db
    .select({ topicCode: syllabusTopicsTable.topicCode })
    .from(syllabusTopicsTable);
  return new Set(rows.map((r) => r.topicCode).filter(Boolean) as string[]);
}

function makeCodeAssigner(
  examCode: string,
  subjectCode: string,
  existingCodes: Map<string, string>,
  subjectName: string,
  usedGlobally: Set<string>,
) {
  let counter = 0;

  return (topicName: string): string => {
    const preserved = existingCodes.get(`${subjectName}::${topicName}`);
    if (preserved) return preserved;

    counter++;
    let candidate = buildTopicCode(examCode, subjectCode, counter - 1);
    while (usedGlobally.has(candidate)) {
      counter++;
      candidate = buildTopicCode(examCode, subjectCode, counter - 1);
    }
    usedGlobally.add(candidate);
    return candidate;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

interface Change {
  exam: string;
  subjectsBefore: number;
  subjectsAfter: number;
  topicsBefore: number;
  topicsAfter: number;
  added: string[];
  removed: string[];
}

async function finalizeExam(examDef: ExamDef, usedGlobally: Set<string>): Promise<Change> {
  const { exam, code, description, subjects } = examDef;

  // Find or create the exam record
  const existing = await db
    .select({ id: syllabusExamsTable.id })
    .from(syllabusExamsTable)
    .where(eq(syllabusExamsTable.code, code))
    .limit(1);

  let examId: string;
  if (existing.length > 0) {
    examId = existing[0].id;
    await db
      .update(syllabusExamsTable)
      .set({ name: exam, description })
      .where(eq(syllabusExamsTable.id, examId));
  } else {
    const [created] = await db
      .insert(syllabusExamsTable)
      .values({ name: exam, code, description })
      .returning();
    examId = created.id;
  }

  // Count current state for report
  const beforeSubjects = await db
    .select({ id: syllabusSubjectsTable.id })
    .from(syllabusSubjectsTable)
    .where(eq(syllabusSubjectsTable.examId, examId));

  let topicsBefore = 0;
  const beforeTopicNames = new Set<string>();
  if (beforeSubjects.length > 0) {
    const beforeTopics = await db
      .select({
        name: syllabusTopicsTable.name,
        subjectId: syllabusTopicsTable.subjectId,
      })
      .from(syllabusTopicsTable)
      .where(
        inArray(
          syllabusTopicsTable.subjectId,
          beforeSubjects.map((s) => s.id),
        ),
      );
    topicsBefore = beforeTopics.length;
    beforeTopics.forEach((t) => beforeTopicNames.add(t.name));
  }

  // Capture existing codes
  const existingCodes = await captureExistingCodes(examId);

  // Delete existing data
  await deleteExamData(examId);

  // Insert finalized data
  const afterTopicNames = new Set<string>();
  let topicsAfter = 0;

  for (let si = 0; si < subjects.length; si++) {
    const subj = subjects[si];
    const [createdSubject] = await db
      .insert(syllabusSubjectsTable)
      .values({
        examId,
        name: subj.name,
        subjectCode: subj.subjectCode,
        displayOrder: si,
      })
      .returning();

    const assignCode = makeCodeAssigner(
      code,
      subj.subjectCode,
      existingCodes,
      subj.name,
      usedGlobally,
    );

    if (subj.topics.length > 0) {
      await db.insert(syllabusTopicsTable).values(
        subj.topics.map((topicName, ti) => ({
          subjectId: createdSubject.id,
          name: topicName,
          topicCode: assignCode(topicName),
          displayOrder: ti,
        })),
      );
      topicsAfter += subj.topics.length;
      subj.topics.forEach((t) => afterTopicNames.add(t));
    }
  }

  const added = [...afterTopicNames].filter((t) => !beforeTopicNames.has(t));
  const removed = [...beforeTopicNames].filter((t) => !afterTopicNames.has(t));

  return {
    exam: `${exam} (${code})`,
    subjectsBefore: beforeSubjects.length,
    subjectsAfter: subjects.length,
    topicsBefore,
    topicsAfter,
    added,
    removed,
  };
}

async function main() {
  console.log("Finalizing official syllabi for all 8 exams…\n");

  // Load currently used codes before we start deleting
  const usedGlobally = await getUsedCodes();

  const changes: Change[] = [];
  for (const examDef of SYLLABI) {
    process.stdout.write(`  Processing ${examDef.code}…`);
    const change = await finalizeExam(examDef, usedGlobally);
    changes.push(change);
    console.log(` done (${change.topicsBefore} → ${change.topicsAfter} topics)`);
  }

  console.log("\n" + "═".repeat(70));
  console.log("FINALIZATION REPORT");
  console.log("═".repeat(70));

  for (const c of changes) {
    console.log(`\nExam: ${c.exam}`);
    console.log(`Subjects: ${c.subjectsBefore} → ${c.subjectsAfter}`);
    console.log(`Topics:   ${c.topicsBefore} → ${c.topicsAfter}`);
    if (c.added.length > 0) {
      console.log(`Topics Added (${c.added.length}):`);
      c.added.forEach((t) => console.log(`  + ${t}`));
    }
    if (c.removed.length > 0) {
      console.log(`Topics Removed (${c.removed.length}):`);
      c.removed.forEach((t) => console.log(`  - ${t}`));
    }
    const final =
      c.added.length === 0 && c.removed.length === 0
        ? "No changes (already correct)"
        : `${c.added.length} added, ${c.removed.length} removed`;
    console.log(`Final Status: ${final}`);
  }

  console.log("\n" + "═".repeat(70));
  const totalTopics = changes.reduce((s, c) => s + c.topicsAfter, 0);
  const totalSubjects = changes.reduce((s, c) => s + c.subjectsAfter, 0);
  console.log(
    `Total: 8 exams, ${totalSubjects} subjects, ${totalTopics} topics`,
  );
  console.log("═".repeat(70));

  process.exit(0);
}

main().catch((err) => {
  console.error("Finalize failed:", err);
  process.exit(1);
});
