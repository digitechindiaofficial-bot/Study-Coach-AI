/**
 * Seed official syllabi for all supported exams into the database.
 * Run: pnpm --filter @workspace/scripts run seed-syllabi
 *
 * Requires DATABASE_URL to be set.
 * Re-running is safe — existing exams are replaced by code.
 */

import { db } from "@workspace/db";
import {
  syllabusExamsTable,
  syllabusSubjectsTable,
  syllabusTopicsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { deriveSubjectCode, buildTopicCode } from "./syllabus-codes.js";

interface SubjectDef { name: string; topics: string[] }
interface ExamDef    { exam: string; code: string; description: string; subjects: SubjectDef[] }

const SYLLABI: ExamDef[] = [
  {
    exam: "SSC CGL",
    code: "SSC_CGL",
    description: "Staff Selection Commission — Combined Graduate Level",
    subjects: [
      {
        name: "Quantitative Aptitude",
        topics: [
          "Number System", "Simplification", "Percentage", "Ratio & Proportion",
          "Average", "Profit & Loss", "Time & Work", "Time, Speed & Distance",
          "Simple & Compound Interest", "Algebra", "Geometry", "Mensuration",
          "Trigonometry", "Statistics", "Data Interpretation", "Probability",
        ],
      },
      {
        name: "English Language",
        topics: [
          "Grammar", "Vocabulary", "Reading Comprehension", "Cloze Test",
          "Error Detection", "Sentence Improvement", "Active & Passive Voice",
          "Direct & Indirect Speech", "Synonyms", "Antonyms",
          "Idioms & Phrases", "One Word Substitution", "Para Jumbles",
        ],
      },
      {
        name: "General Intelligence & Reasoning",
        topics: [
          "Analogy", "Classification", "Series", "Coding-Decoding",
          "Blood Relation", "Direction Sense", "Ranking", "Alphabet Test",
          "Venn Diagram", "Syllogism", "Puzzle", "Seating Arrangement",
          "Clock", "Calendar", "Mirror Image", "Paper Folding",
          "Dice", "Cube", "Non-Verbal Reasoning",
        ],
      },
      {
        name: "General Awareness",
        topics: [
          "History", "Geography", "Indian Polity", "Indian Economy",
          "Physics", "Chemistry", "Biology", "Computer Awareness",
          "Environment", "Current Affairs", "Static GK", "Art & Culture",
          "Sports", "Books & Authors", "Awards & Honours", "Government Schemes",
        ],
      },
    ],
  },

  {
    exam: "SSC CHSL",
    code: "SSC_CHSL",
    description: "Staff Selection Commission — Combined Higher Secondary Level",
    subjects: [
      {
        name: "Quantitative Aptitude",
        topics: [
          "Number System", "Simplification", "Percentage", "Ratio & Proportion",
          "Average", "Profit & Loss", "Time & Work", "Time, Speed & Distance",
          "Simple & Compound Interest", "Algebra", "Geometry", "Mensuration",
          "Trigonometry", "Data Interpretation",
        ],
      },
      {
        name: "English Language",
        topics: [
          "Grammar", "Vocabulary", "Reading Comprehension", "Cloze Test",
          "Error Detection", "Sentence Improvement", "Active & Passive Voice",
          "Direct & Indirect Speech", "Synonyms", "Antonyms",
          "Idioms & Phrases", "One Word Substitution", "Spelling",
        ],
      },
      {
        name: "General Intelligence & Reasoning",
        topics: [
          "Analogy", "Classification", "Series", "Coding-Decoding",
          "Blood Relation", "Direction Sense", "Ranking", "Syllogism",
          "Venn Diagram", "Puzzle", "Mirror Image", "Paper Folding",
          "Dice", "Non-Verbal Reasoning",
        ],
      },
      {
        name: "General Awareness",
        topics: [
          "History", "Geography", "Indian Polity", "Indian Economy",
          "Physics", "Chemistry", "Biology", "Computer Awareness",
          "Current Affairs", "Static GK", "Environment", "Art & Culture", "Sports",
        ],
      },
    ],
  },

  {
    exam: "IBPS PO",
    code: "IBPS_PO",
    description: "Institute of Banking Personnel Selection — Probationary Officer",
    subjects: [
      {
        name: "Quantitative Aptitude",
        topics: [
          "Number System", "Simplification", "Percentage", "Ratio & Proportion",
          "Average", "Profit & Loss", "Time & Work", "Time, Speed & Distance",
          "Simple & Compound Interest", "Permutation & Combination", "Probability",
          "Data Interpretation", "Data Sufficiency", "Quadratic Equations", "Number Series",
        ],
      },
      {
        name: "English Language",
        topics: [
          "Reading Comprehension", "Cloze Test", "Error Detection",
          "Sentence Improvement", "Fill in the Blanks", "Para Jumbles",
          "Vocabulary", "Paragraph Completion", "Word Association", "Sentence Connectors",
        ],
      },
      {
        name: "Reasoning Ability",
        topics: [
          "Analogy", "Classification", "Series", "Coding-Decoding",
          "Blood Relation", "Direction Sense", "Ranking", "Syllogism",
          "Puzzle", "Seating Arrangement", "Input-Output", "Inequality",
          "Data Sufficiency", "Critical Reasoning", "Order & Ranking",
        ],
      },
      {
        name: "General/Economy/Banking Awareness",
        topics: [
          "Banking Awareness", "Financial Awareness", "Current Affairs", "Static GK",
          "Government Schemes", "Indian Economy", "RBI & Monetary Policy",
          "International Organisations", "Awards & Honours", "Budget & Five-Year Plans",
        ],
      },
      {
        name: "Computer Knowledge",
        topics: [
          "Computer Fundamentals", "MS Office", "Internet & Networking",
          "Database Concepts", "Cyber Security", "Input/Output Devices",
          "Operating System", "Programming Basics", "Number System in Computers",
        ],
      },
    ],
  },

  {
    exam: "IBPS Clerk",
    code: "IBPS_CLERK",
    description: "Institute of Banking Personnel Selection — Clerical Cadre",
    subjects: [
      {
        name: "Quantitative Aptitude",
        topics: [
          "Number System", "Simplification", "Percentage", "Ratio & Proportion",
          "Average", "Profit & Loss", "Time & Work", "Time, Speed & Distance",
          "Simple & Compound Interest", "Data Interpretation", "Number Series",
          "Approximation", "Quadratic Equations",
        ],
      },
      {
        name: "English Language",
        topics: [
          "Reading Comprehension", "Cloze Test", "Error Detection",
          "Sentence Improvement", "Fill in the Blanks", "Para Jumbles",
          "Vocabulary", "Spelling", "Word Usage",
        ],
      },
      {
        name: "Reasoning Ability",
        topics: [
          "Analogy", "Classification", "Coding-Decoding", "Blood Relation",
          "Direction Sense", "Ranking", "Syllogism", "Puzzle",
          "Seating Arrangement", "Inequality", "Alphanumeric Series", "Order & Ranking",
        ],
      },
      {
        name: "General/Financial Awareness",
        topics: [
          "Banking Awareness", "Current Affairs", "Static GK", "Indian Economy",
          "Government Schemes", "Financial Institutions", "RBI Guidelines",
        ],
      },
      {
        name: "Computer Knowledge",
        topics: [
          "Computer Fundamentals", "MS Office", "Internet & Networking",
          "Keyboard Shortcuts", "Operating System", "History of Computers",
        ],
      },
    ],
  },

  {
    exam: "SBI PO",
    code: "SBI_PO",
    description: "State Bank of India — Probationary Officer",
    subjects: [
      {
        name: "Quantitative Aptitude",
        topics: [
          "Number System", "Simplification", "Percentage", "Ratio & Proportion",
          "Average", "Profit & Loss", "Time & Work", "Time, Speed & Distance",
          "Simple & Compound Interest", "Permutation & Combination", "Probability",
          "Data Interpretation", "Data Sufficiency", "Quadratic Equations", "Number Series",
        ],
      },
      {
        name: "English Language",
        topics: [
          "Reading Comprehension", "Cloze Test", "Error Detection",
          "Sentence Improvement", "Fill in the Blanks", "Para Jumbles",
          "Vocabulary", "Paragraph Completion", "Word Association",
        ],
      },
      {
        name: "Reasoning & Computer Aptitude",
        topics: [
          "Analogy", "Coding-Decoding", "Blood Relation", "Direction Sense",
          "Ranking", "Syllogism", "Puzzle", "Seating Arrangement", "Input-Output",
          "Inequality", "Critical Reasoning", "Computer Fundamentals",
          "MS Office", "Internet & Networking", "Keyboard Shortcuts",
        ],
      },
      {
        name: "General/Economy/Banking Awareness",
        topics: [
          "Banking Awareness", "Financial Awareness", "Current Affairs", "Static GK",
          "Indian Economy", "RBI & Monetary Policy", "Government Schemes",
          "International Organisations", "Awards & Honours", "Budget Highlights",
        ],
      },
    ],
  },

  {
    exam: "RRB NTPC",
    code: "RRB_NTPC",
    description: "Railway Recruitment Board — Non-Technical Popular Categories",
    subjects: [
      {
        name: "Mathematics",
        topics: [
          "Number System", "Decimals & Fractions", "LCM & HCF", "Ratio & Proportion",
          "Percentage", "Mensuration", "Time & Work", "Time, Speed & Distance",
          "Simple & Compound Interest", "Profit & Loss", "Elementary Algebra",
          "Geometry & Trigonometry", "Elementary Statistics", "Tables & Graphs", "Age Calculations",
        ],
      },
      {
        name: "General Intelligence & Reasoning",
        topics: [
          "Analogy", "Classification", "Number Series", "Coding-Decoding",
          "Mathematical Operations", "Relationships", "Syllogism", "Jumbling",
          "Venn Diagram", "Data Interpretation", "Directions", "Statement & Conclusion",
          "Similarities & Differences", "Decision Making",
        ],
      },
      {
        name: "General Awareness",
        topics: [
          "Current Affairs", "Indian Geography", "Indian History",
          "Indian Polity & Constitution", "Indian Economy", "General Science",
          "Physics", "Chemistry", "Life Science", "Environmental Sciences",
          "Space & Technology", "Sports", "Books & Authors", "Government Schemes",
          "Computer & IT Basics", "Railways & Transport",
        ],
      },
    ],
  },

  {
    exam: "UPPSC",
    code: "UPPSC",
    description: "Uttar Pradesh Public Service Commission — PCS",
    subjects: [
      {
        name: "History & Culture",
        topics: [
          "Ancient India", "Medieval India", "Modern India", "Indian National Movement",
          "World History", "Indian Culture & Heritage", "Art Forms",
          "Uttar Pradesh History", "Post-Independence India",
        ],
      },
      {
        name: "Geography",
        topics: [
          "Physical Geography of India", "Indian Agriculture", "Natural Resources",
          "Disaster Management", "World Geography", "Climate & Environment",
          "Uttar Pradesh Geography", "UP Resources & Industries",
        ],
      },
      {
        name: "Indian Polity & Governance",
        topics: [
          "Indian Constitution", "Panchayati Raj & Local Bodies", "Government Policies & Schemes",
          "Public Policy", "Rights Issues", "UP Political System", "UP Governance",
          "Federalism", "Current Affairs — Governance",
        ],
      },
      {
        name: "Economy & Science",
        topics: [
          "Indian Economy", "Economic Development & Planning", "Agriculture Economy",
          "UP Economy", "Industry & Trade", "Science & Technology",
          "Environment & Ecology", "Energy Resources", "IT & Digital India",
        ],
      },
      {
        name: "Ethics & Aptitude",
        topics: [
          "Ethics & Human Interface", "Integrity & Aptitude", "Social Influence",
          "Attitude", "Civil Service Values", "Emotional Intelligence",
          "Public Service Ethics", "Case Studies",
        ],
      },
      {
        name: "General Hindi",
        topics: [
          "Hindi Grammar", "Comprehension", "Letter Writing",
          "Essay Writing", "Translation", "Vocabulary",
        ],
      },
      {
        name: "Quantitative Aptitude & Reasoning",
        topics: [
          "Number System", "Simplification", "Percentage", "Average",
          "Profit & Loss", "Time & Work", "Data Interpretation",
          "Analogy", "Series", "Coding-Decoding", "Blood Relation",
          "Syllogism", "Logical Reasoning",
        ],
      },
    ],
  },

  {
    exam: "BPSC",
    code: "BPSC",
    description: "Bihar Public Service Commission — Combined Competitive Exam",
    subjects: [
      {
        name: "History & Culture",
        topics: [
          "Ancient India", "Medieval India", "Modern India", "Indian National Movement",
          "Bihar History", "Bihar Culture & Heritage", "Art & Culture",
          "Post-Independence India",
        ],
      },
      {
        name: "Geography & Environment",
        topics: [
          "Indian Geography", "Bihar Geography", "Environment & Ecology",
          "Climate Change", "Disaster Management", "World Geography",
          "Rivers & Water Bodies of Bihar",
        ],
      },
      {
        name: "Indian Polity & Governance",
        topics: [
          "Indian Constitution", "Panchayati Raj", "Government Schemes",
          "Bihar Political System", "Public Administration",
          "Rights Issues", "Federalism",
        ],
      },
      {
        name: "Economy & Development",
        topics: [
          "Indian Economy", "Bihar Economy", "Economic Development",
          "Agriculture", "Industry", "Science & Technology",
          "IT & Digital India", "Current Affairs — Economy",
        ],
      },
      {
        name: "Mathematics & Reasoning",
        topics: [
          "Number System", "Simplification", "Percentage", "Ratio & Proportion",
          "Average", "Profit & Loss", "Time & Work", "Time, Speed & Distance",
          "Simple & Compound Interest", "Algebra", "Geometry",
          "Data Interpretation", "Logical Reasoning", "Analogy",
          "Classification", "Series", "Coding-Decoding",
          "Blood Relation", "Direction Sense", "Syllogism",
        ],
      },
      {
        name: "General Hindi",
        topics: [
          "Hindi Grammar", "Comprehension", "Essay Writing",
          "Letter Writing", "Vocabulary", "Translation",
        ],
      },
      {
        name: "Bihar Special",
        topics: [
          "Bihar Geography — Key Places", "Bihar Economy — Sectors",
          "Bihar Polity — Legislature & Executive", "Bihar Culture — Festivals & Fairs",
          "Important Personalities of Bihar", "Bihar Industrial Development",
          "Bihar Agriculture & Irrigation", "Bihar Government Schemes",
        ],
      },
    ],
  },
];

async function upsertExam(examDef: ExamDef) {
  const { exam, code, description, subjects } = examDef;

  const existing = await db
    .select({ id: syllabusExamsTable.id })
    .from(syllabusExamsTable)
    .where(eq(syllabusExamsTable.code, code))
    .limit(1);

  let examId: string;

  if (existing.length > 0) {
    examId = existing[0].id;
    const existingSubjects = await db
      .select({ id: syllabusSubjectsTable.id })
      .from(syllabusSubjectsTable)
      .where(eq(syllabusSubjectsTable.examId, examId));

    if (existingSubjects.length > 0) {
      await db
        .delete(syllabusTopicsTable)
        .where(inArray(syllabusTopicsTable.subjectId, existingSubjects.map((s) => s.id)));
    }
    await db.delete(syllabusSubjectsTable).where(eq(syllabusSubjectsTable.examId, examId));
    await db
      .update(syllabusExamsTable)
      .set({ name: exam, description })
      .where(eq(syllabusExamsTable.id, examId));
    console.log(`  ↻  Updated  ${code}`);
  } else {
    const [created] = await db
      .insert(syllabusExamsTable)
      .values({ name: exam, code, description })
      .returning();
    examId = created.id;
    console.log(`  +  Created  ${code}`);
  }

  let topicTotal = 0;
  for (let si = 0; si < subjects.length; si++) {
    const subj = subjects[si];
    const subjectCode = deriveSubjectCode(subj.name);
    const [createdSubject] = await db
      .insert(syllabusSubjectsTable)
      .values({ examId, name: subj.name, subjectCode, displayOrder: si })
      .returning();

    if (subj.topics.length > 0) {
      await db.insert(syllabusTopicsTable).values(
        subj.topics.map((t, ti) => ({
          subjectId: createdSubject.id,
          name: t,
          topicCode: buildTopicCode(code, subjectCode, ti),
          displayOrder: ti,
        })),
      );
      topicTotal += subj.topics.length;
    }
  }

  console.log(`     ${subjects.length} subjects, ${topicTotal} topics`);
}

async function main() {
  console.log("Seeding syllabi for all supported exams…\n");
  for (const examDef of SYLLABI) {
    await upsertExam(examDef);
  }
  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
