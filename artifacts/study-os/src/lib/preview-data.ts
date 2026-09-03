export interface PreviewProfile {
  fullName: string;
  examType: string;
  examDate: string;
  dailyStudyHours: number;
  planType: "free" | "pro";
  streakCount: number;
  longestStreak: number;
  quizCountToday: number;
}

export interface PreviewTopic {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "completed";
  lastRevisedAt: string | null;
}

export interface PreviewSubject {
  id: string;
  name: string;
  subjectCode: string;
  topics: PreviewTopic[];
}

export interface PreviewExam {
  id: string;
  name: string;
  code: string;
  description: string;
  subjects: PreviewSubject[];
}

export interface PreviewQuestion {
  id: string;
  questionText: string;
  options: Record<string, string>;
  correctOption: string;
  explanation: string;
  subject: string;
  topic: string;
  difficulty: string;
  examCode: string;
  subjectCode: string;
  topicCode: string;
}

const PREVIEW_PROFILE_KEY = "govtguru-preview-profile";
const PREVIEW_PLAN_KEY = "govtguru-preview-plan";

function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function readPreviewProfile(): PreviewProfile {
  try {
    const saved = window.localStorage.getItem(PREVIEW_PROFILE_KEY);
    if (saved) return { ...defaultPreviewProfile(), ...JSON.parse(saved) };
  } catch {
    // Use safe defaults when storage contains invalid data or is unavailable.
  }
  return defaultPreviewProfile();
}

function defaultPreviewProfile(): PreviewProfile {
  return {
    fullName: "Preview User",
    examType: "SSC_CGL",
    examDate: futureDate(30),
    dailyStudyHours: 4,
    planType: "free",
    streakCount: 0,
    longestStreak: 0,
    quizCountToday: 0,
  };
}

export function getPreviewSyllabus(): PreviewExam[] {
  const topics = (subject: string, names: string[]): PreviewTopic[] =>
    names.map((name, index) => ({
      id: `preview-${subject.toLowerCase()}-${index + 1}`,
      name,
      status: "not_started",
      lastRevisedAt: null,
    }));

  return [{
    id: "preview-ssc-cgl",
    name: "SSC CGL",
    code: "SSC_CGL",
    description: "Staff Selection Commission Combined Graduate Level",
    subjects: [
      {
        id: "preview-qa",
        name: "Quantitative Aptitude",
        subjectCode: "QA",
        topics: topics("qa", ["Percentages", "Profit and Loss", "Time and Work"]),
      },
      {
        id: "preview-reasoning",
        name: "Reasoning",
        subjectCode: "REASONING",
        topics: topics("reasoning", ["Analogy", "Series", "Coding-Decoding"]),
      },
      {
        id: "preview-english",
        name: "English",
        subjectCode: "ENGLISH",
        topics: topics("english", ["Grammar", "Vocabulary", "Reading Comprehension"]),
      },
      {
        id: "preview-ga",
        name: "General Awareness",
        subjectCode: "GA",
        topics: topics("ga", ["Indian History", "Geography", "Current Affairs"]),
      },
    ],
  }];
}

export function getPreviewQuestions({
  subjectCode,
  examCode = "SSC_CGL",
  excludeIds,
}: {
  subjectCode?: string;
  examCode?: string;
  isWeak?: boolean;
  isAll?: boolean;
  excludeIds?: Set<string>;
}): PreviewQuestion[] {
  const subject = subjectCode && subjectCode !== "all" ? subjectCode : "QA";
  const subjectName = getPreviewSyllabus()[0].subjects.find(
    (item) => item.subjectCode === subject,
  )?.name ?? "Quantitative Aptitude";

  const questions: PreviewQuestion[] = [
    {
      id: "preview-question-1",
      questionText: "What is 15% of 200?",
      options: { a: "25", b: "30", c: "35", d: "40" },
      correctOption: "b",
      explanation: "15% of 200 is (15 ÷ 100) × 200 = 30.",
      subject: subjectName,
      topic: "Percentages",
      difficulty: "easy",
      examCode,
      subjectCode: subject,
      topicCode: "preview-percentages",
    },
    {
      id: "preview-question-2",
      questionText: "If a number is increased by 20% and becomes 240, what was the original number?",
      options: { a: "180", b: "190", c: "200", d: "220" },
      correctOption: "c",
      explanation: "120% of the original number is 240, so the original number is 200.",
      subject: subjectName,
      topic: "Percentages",
      difficulty: "medium",
      examCode,
      subjectCode: subject,
      topicCode: "preview-percentages",
    },
    {
      id: "preview-question-3",
      questionText: "The average of 10, 20 and 30 is:",
      options: { a: "15", b: "20", c: "25", d: "30" },
      correctOption: "b",
      explanation: "Average = (10 + 20 + 30) ÷ 3 = 20.",
      subject: subjectName,
      topic: "Arithmetic",
      difficulty: "easy",
      examCode,
      subjectCode: subject,
      topicCode: "preview-arithmetic",
    },
  ];

  const unseen = excludeIds
    ? questions.filter((question) => !excludeIds.has(question.id))
    : questions;
  return unseen.length > 0 ? unseen : questions;
}

export function createPreviewStudyPlan(profile: {
  examType?: string | null;
  examDate?: string | null;
  dailyStudyHours?: number | null;
} = readPreviewProfile()) {
  const examType = profile.examType || "SSC_CGL";
  const examDate = profile.examDate || futureDate(30);
  const dailyStudyHours = profile.dailyStudyHours || 4;
  const start = new Date();
  const planDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateString = date.toISOString().slice(0, 10);
    const topics = ["Percentages", "Reasoning Series", "English Grammar", "Indian History"];
    const topic = topics[index % topics.length];
    return {
      date: dateString,
      day_name: date.toLocaleDateString("en-US", { weekday: "short" }),
      day_type: index === 6 ? "revision" : "study",
      days_left: Math.max(0, Math.ceil(
        (new Date(examDate).getTime() - date.getTime()) / 86_400_000,
      )),
      sessions: [{
        time: "Morning",
        topic,
        subject: index % 2 === 0 ? "Quantitative Aptitude" : "Reasoning",
        subject_code: index % 2 === 0 ? "QA" : "REASONING",
        duration: Math.max(30, dailyStudyHours * 15),
        tasks: [`Review ${topic}`, "Solve 10 practice questions"],
        tip: `Focus on ${topic} and note any repeated mistakes.`,
      }],
    };
  });

  return {
    examType,
    planData: {
      exam: examType,
      plan_type: "Focused Preview Plan",
      days_remaining: Math.max(0, Math.ceil(
        (new Date(examDate).getTime() - start.getTime()) / 86_400_000,
      )),
      total_topics: 12,
      total_hours: dailyStudyHours * 7,
      exam_date: examDate,
      plan_start: start.toISOString().slice(0, 10),
      strategy: "Build consistency with focused daily sessions, then revise the week's topics.",
      subjects: [
        {
          name: "Quantitative Aptitude",
          subject_code: "QA",
          weightage_percent: 30,
          recommended_hours: dailyStudyHours * 2,
          topic_count: 3,
          allocated_study_days: 3,
          start_date: planDays[0].date,
          end_date: planDays[4].date,
          topics: [{ name: "Percentages", priority: "high", tip: "Practice short calculations." }],
        },
        {
          name: "Reasoning",
          subject_code: "REASONING",
          weightage_percent: 25,
          recommended_hours: dailyStudyHours * 2,
          topic_count: 3,
          allocated_study_days: 2,
          start_date: planDays[1].date,
          end_date: planDays[5].date,
          topics: [{ name: "Series", priority: "high", tip: "Look for repeating patterns." }],
        },
      ],
      daily_plan: planDays,
    },
  };
}

export function readPreviewStudyPlan() {
  try {
    const saved = window.localStorage.getItem(PREVIEW_PLAN_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function savePreviewStudyPlan(plan: unknown) {
  try {
    window.localStorage.setItem(PREVIEW_PLAN_KEY, JSON.stringify(plan));
  } catch {
    // The current session still has the plan in React state if storage is unavailable.
  }
}