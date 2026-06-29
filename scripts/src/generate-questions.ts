/**
 * One-time bulk question generation script.
 * Run: pnpm --filter @workspace/scripts run generate-questions
 *
 * Generates 1800+ questions via Gemini AI and saves them to the quiz_questions table.
 * Tracks progress in .local/question-gen-progress.json — safe to interrupt and resume.
 */

import { GoogleGenAI } from "@google/genai";
import { db } from "@workspace/db";
import { quizQuestionsTable } from "@workspace/db";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { eq, and } from "drizzle-orm";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const PROGRESS_FILE = ".local/question-gen-progress.json";
const DELAY_MS = 3000;       // 3s between Gemini calls to avoid rate limits
const RETRY_WAIT_MS = 60000; // 1min wait on quota exhaustion
const MAX_RETRIES = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Topic map: subject → topics[]
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECTS: Record<string, { topics: string[]; examTypes: string[]; questionsPerTopic: number }> = {
  "Quantitative Aptitude": {
    examTypes: ["SSC", "Banking", "Railway"],
    questionsPerTopic: 10,
    topics: [
      "Number System",
      "HCF and LCM",
      "Percentage",
      "Profit and Loss",
      "Simple Interest",
      "Compound Interest",
      "Ratio and Proportion",
      "Partnership",
      "Mixtures and Alligations",
      "Time and Work",
      "Pipes and Cisterns",
      "Time Speed and Distance",
      "Trains",
      "Boats and Streams",
      "Averages",
      "Ages Problems",
      "Surds and Indices",
      "Square Roots and Cube Roots",
      "Simplification and Approximation",
      "Algebraic Expressions",
      "Linear Equations",
      "Geometry (Lines and Angles)",
      "Triangles",
      "Circles",
      "Mensuration 2D",
      "Mensuration 3D",
      "Trigonometry",
      "Permutations and Combinations",
      "Probability",
      "Data Interpretation (Tables and Charts)",
    ],
  },
  "Reasoning": {
    examTypes: ["SSC", "Banking", "Railway"],
    questionsPerTopic: 10,
    topics: [
      "Analogy (Verbal)",
      "Analogy (Non-Verbal)",
      "Classification (Odd One Out)",
      "Number Series Completion",
      "Alphabet Series",
      "Coding and Decoding",
      "Blood Relations",
      "Direction and Distance",
      "Seating Arrangement (Linear)",
      "Seating Arrangement (Circular)",
      "Puzzles and Logic",
      "Syllogism",
      "Input and Output",
      "Inequalities",
      "Order and Ranking",
      "Venn Diagrams",
      "Statement and Conclusions",
      "Statement and Assumptions",
      "Cause and Effect",
      "Critical Reasoning",
      "Data Sufficiency",
      "Missing Numbers in Matrix",
      "Mirror Images",
      "Paper Folding and Cutting",
      "Cubes and Dice",
      "Figure Series",
      "Embedded Figures",
      "Word Formation",
      "Dictionary Order",
      "Clocks and Calendars",
    ],
  },
  "English": {
    examTypes: ["SSC", "Banking", "Railway"],
    questionsPerTopic: 10,
    topics: [
      "Reading Comprehension",
      "Fill in the Blanks (Single)",
      "Fill in the Blanks (Double)",
      "Spotting Errors",
      "Sentence Correction",
      "Para Jumbles",
      "Cloze Test",
      "Synonyms",
      "Antonyms",
      "Idioms and Phrases",
      "One Word Substitution",
      "Active and Passive Voice",
      "Direct and Indirect Speech",
      "Prepositions",
      "Articles",
      "Conjunctions",
      "Tenses",
      "Subject Verb Agreement",
      "Sentence Improvement",
      "Phrase Replacement",
      "Para Completion",
      "Sentence Rearrangement",
      "Spelling Check",
      "Word Usage in Context",
      "Modifiers and Dangling Modifiers",
      "Gerunds and Infinitives",
      "Parts of Speech",
      "Narration",
      "Conditional Sentences",
      "Vocabulary in Context",
    ],
  },
  "General Awareness": {
    examTypes: ["SSC", "Banking", "Railway"],
    questionsPerTopic: 10,
    topics: [
      "Ancient Indian History",
      "Medieval Indian History",
      "Modern Indian History and Freedom Struggle",
      "Indian Geography (Physical)",
      "Indian Geography (States and Capitals)",
      "World Geography",
      "Indian Polity and Constitution",
      "Parliament and Legislature",
      "Judiciary and Supreme Court",
      "Indian Economy (Basics)",
      "Five Year Plans and Economic Policy",
      "Indian Budget and Finance",
      "Physics Fundamentals",
      "Chemistry Fundamentals",
      "Biology and Life Sciences",
      "Inventions and Scientific Discoveries",
      "First in India",
      "National Parks and Wildlife Sanctuaries",
      "Indian Art and Culture",
      "Famous Personalities",
      "Books and Authors",
      "Sports and Games",
      "Awards and Honours (National)",
      "Awards and Honours (International)",
      "Important Days and Events",
      "Indian Defence and Military",
      "Space Science and ISRO",
      "Environment and Ecology",
      "World Organizations (UN, WHO, IMF)",
      "Indian Railways and Transport",
    ],
  },
  "Banking Awareness": {
    examTypes: ["Banking"],
    questionsPerTopic: 10,
    topics: [
      "RBI and Monetary Policy",
      "Types of Banks in India",
      "Types of Bank Accounts",
      "Negotiable Instruments Act",
      "SEBI and Capital Markets",
      "Insurance Sector (LIC and IRDAI)",
      "Credit Rating Agencies",
      "Payment Systems (NEFT RTGS IMPS UPI)",
      "Financial Inclusion and Jan Dhan Yojana",
      "Basel Norms and Capital Adequacy",
      "NPA and Bad Loans",
      "Government Banking Schemes",
      "Foreign Exchange and FOREX",
      "Banking Terms and Definitions",
      "NABARD and Rural Banking",
      "Small Finance Banks and Payments Banks",
      "Cooperative Banks",
      "IMF World Bank and ADB",
      "Indian Budget and Fiscal Policy",
      "Stock Exchanges BSE NSE",
    ],
  },
  "Computer": {
    examTypes: ["SSC", "Banking", "Railway"],
    questionsPerTopic: 10,
    topics: [
      "Computer Fundamentals and Generations",
      "Hardware Components (CPU RAM Storage)",
      "Input and Output Devices",
      "Memory Types (Primary and Secondary)",
      "Software Types and Operating Systems",
      "MS Word Features and Shortcuts",
      "MS Excel Formulas and Functions",
      "MS PowerPoint Features",
      "Internet and World Wide Web",
      "Networking Concepts and Protocols",
      "Database Management Systems",
      "Binary and Number Systems",
      "Computer Security and Cyber Threats",
      "Email and Communication Tools",
      "Cloud Computing Basics",
      "E-Commerce and Digital Payments",
      "Programming Concepts and Languages",
      "Artificial Intelligence and Machine Learning Basics",
      "Computer Shortcuts and Commands",
      "Storage Devices and File Systems",
    ],
  },
  "Current Affairs GK": {
    examTypes: ["SSC", "Banking", "Railway"],
    questionsPerTopic: 10,
    topics: [
      "Indian Economy and Budget 2025",
      "RBI and Banking News 2025",
      "Government Schemes and Policies 2025",
      "Science and Technology News 2025",
      "ISRO and Space Missions 2025",
      "Defence and Security News 2025",
      "International Relations and Treaties 2025",
      "Sports Events and Champions 2025",
      "Awards and Nobel Prize 2025",
      "Environment and Climate Change 2025",
      "Health and Medical News 2025",
      "Indian States and Governance News 2025",
      "Agriculture and Farmers News 2025",
      "Infrastructure and Development Projects 2025",
      "Education and National Programmes 2025",
      "Corporate and Business News India 2025",
      "International Organizations and Summits 2025",
      "Elections and Political Developments 2025",
      "Art Culture and Heritage News 2025",
      "UN and Global Issues 2025",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Progress tracking
// ─────────────────────────────────────────────────────────────────────────────

interface Progress {
  completed: string[];    // "Subject::Topic" keys
  totalInserted: number;
  startedAt: string;
  lastUpdated: string;
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { completed: [], totalInserted: 0, startedAt: new Date().toISOString(), lastUpdated: new Date().toISOString() };
}

function saveProgress(p: Progress) {
  mkdirSync(".local", { recursive: true });
  p.lastUpdated = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini call with retry
// ─────────────────────────────────────────────────────────────────────────────

interface RawQuestion {
  questionText: string;
  options: Record<string, string>;
  correctOption: string;
  explanation: string;
  difficulty: string;
}

async function callGemini(subject: string, topic: string, count: number): Promise<RawQuestion[]> {
  const prompt = `You are an expert question setter for Indian government competitive exams (SSC CGL, IBPS PO, RRB NTPC, UPSC Prelims).

Generate exactly ${count} unique multiple-choice questions for the topic: "${topic}" under subject: "${subject}".

These questions must be suitable for Indian competitive exam aspirants. Include factual, application, and conceptual questions. Mix difficulty: ~30% easy, ~50% medium, ~20% hard.

Return ONLY a valid JSON array with no markdown, no explanation, no prefix:
[
  {
    "questionText": "<clear, complete question>",
    "options": {
      "a": "<option text>",
      "b": "<option text>",
      "c": "<option text>",
      "d": "<option text>"
    },
    "correctOption": "a",
    "explanation": "<brief explanation of why the answer is correct, with key facts>",
    "difficulty": "easy|medium|hard"
  }
]

Rules:
- All options must be plausible and different from each other
- Correct answers must be 100% factually accurate
- Explanations must be concise (1-2 sentences) but educational
- For General Awareness / Current Affairs: use facts accurate up to mid-2025
- No repeated questions across the array
- questionText must end with a question mark or "___" for fill-in-the-blank style`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
      });
      const text = response.text ?? "[]";
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned) as RawQuestion[];
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty or invalid response array");
      return parsed;
    } catch (err: any) {
      lastErr = err;
      const isQuota = String(err?.message ?? err).match(/429|RESOURCE_EXHAUSTED|quota/i);
      if (isQuota && attempt < MAX_RETRIES) {
        console.log(`    ⏳ Quota hit — waiting ${RETRY_WAIT_MS / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
        await delay(RETRY_WAIT_MS);
      } else if (!isQuota) {
        throw err; // non-quota errors fail fast
      }
    }
  }
  throw lastErr;
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert to DB
// ─────────────────────────────────────────────────────────────────────────────

async function insertQuestions(
  questions: RawQuestion[],
  subject: string,
  topic: string,
  examTypes: string[],
) {
  if (questions.length === 0) return 0;
  const rows = questions.map(q => ({
    subject,
    topic,
    questionText: q.questionText,
    options: q.options,
    correctOption: q.correctOption,
    explanation: q.explanation,
    difficulty: q.difficulty ?? "medium",
    examType: examTypes,
  }));

  // Insert in chunks of 50 to stay safe
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    await db.insert(quizQuestionsTable).values(chunk);
    inserted += chunk.length;
  }
  return inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const progress = loadProgress();

  // Count total topics
  const allTasks: Array<{ subject: string; topic: string; examTypes: string[]; count: number }> = [];
  for (const [subject, cfg] of Object.entries(SUBJECTS)) {
    for (const topic of cfg.topics) {
      allTasks.push({ subject, topic, examTypes: cfg.examTypes, count: cfg.questionsPerTopic });
    }
  }

  const total = allTasks.length;
  const done = progress.completed.length;
  const remaining = allTasks.filter(t => !progress.completed.includes(`${t.subject}::${t.topic}`));

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AI Study OS — Bulk Question Generator");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Total topics  : ${total}`);
  console.log(`  Already done  : ${done}`);
  console.log(`  Remaining     : ${remaining.length}`);
  console.log(`  Questions DB  : ${progress.totalInserted} already in DB`);
  console.log(`  Est. time     : ~${Math.ceil(remaining.length * DELAY_MS / 60000)} minutes`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (remaining.length === 0) {
    console.log("✅ All topics already generated! Nothing to do.");
    console.log(`   Total questions in DB: ${progress.totalInserted}`);
    return;
  }

  let sessionInserted = 0;
  let sessionFailed = 0;

  for (let i = 0; i < remaining.length; i++) {
    const task = remaining[i];
    const key = `${task.subject}::${task.topic}`;
    const pct = Math.round(((done + i) / total) * 100);

    process.stdout.write(
      `  [${String(done + i + 1).padStart(3)}/${total}] ${pct}% | ${task.subject} — ${task.topic} ... `
    );

    try {
      const questions = await callGemini(task.subject, task.topic, task.count);
      const inserted = await insertQuestions(questions, task.subject, task.topic, task.examTypes);
      progress.completed.push(key);
      progress.totalInserted += inserted;
      saveProgress(progress);
      sessionInserted += inserted;
      console.log(`✓ ${inserted} questions`);
    } catch (err: any) {
      sessionFailed++;
      console.log(`✗ FAILED — ${String(err?.message ?? err).slice(0, 80)}`);
    }

    // Rate limit delay (skip after last item)
    if (i < remaining.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Session complete");
  console.log(`  Inserted this run : ${sessionInserted} questions`);
  console.log(`  Failed topics     : ${sessionFailed}`);
  console.log(`  Total in DB       : ${progress.totalInserted} questions`);
  console.log(`  Topics done       : ${progress.completed.length} / ${total}`);
  if (progress.completed.length < total) {
    console.log(`\n  ⚠  Some topics failed. Re-run the script to retry them.`);
    console.log(`     Progress is saved — completed topics won't be regenerated.`);
  } else {
    console.log("\n  🎉 All 1800 questions generated successfully!");
  }
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(e => {
  console.error("\n💥 Fatal error:", e);
  process.exit(1);
});
