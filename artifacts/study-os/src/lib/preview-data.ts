import canonicalSyllabus from "../../../../scripts/output/SSC_CGL.json";

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

export function savePreviewProfile(updates: Partial<PreviewProfile>): PreviewProfile {
  const profile = { ...readPreviewProfile(), ...updates };
  try {
    window.localStorage.setItem(PREVIEW_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Keep the current in-memory flow usable if preview storage is unavailable.
  }
  return profile;
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
  return [{
    id: "preview-ssc-cgl",
    name: canonicalSyllabus.exam,
    code: canonicalSyllabus.code,
    description: canonicalSyllabus.description,
    subjects: canonicalSyllabus.subjects.map((subject) => ({
      id: `preview-${subject.subjectCode.toLowerCase()}`,
      name: subject.name,
      subjectCode: subject.subjectCode,
      topics: subject.topics.map((topic) => ({
        id: `preview-${topic.topicCode}`,
        name: topic.name,
        status: "not_started",
        lastRevisedAt: null,
      })),
    })),
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
  start.setHours(0, 0, 0, 0);
  const examDateValue = new Date(`${examDate}T00:00:00`);
  const daysRemaining = Math.max(
    0,
    Math.ceil((examDateValue.getTime() - start.getTime()) / 86_400_000),
  );
  const totalPlanDays = Math.max(1, daysRemaining + 1);
  const syllabus = getPreviewSyllabus()[0];
  const syllabusTopics = syllabus.subjects.flatMap((subject) =>
    subject.topics.map((topic) => ({
      ...topic,
      subject: subject.name,
      subjectCode: subject.subjectCode,
    })),
  );

  const planDays = Array.from({ length: totalPlanDays }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateString = date.toISOString().slice(0, 10);
    const selectedTopic = syllabusTopics[index % syllabusTopics.length];
    const isExamDay = index === totalPlanDays - 1 && daysRemaining > 0;
    const topic = selectedTopic?.name ?? "Full Syllabus Revision";
    return {
      date: dateString,
      day_name: date.toLocaleDateString("en-US", { weekday: "short" }),
      day_type: isExamDay ? "final_revision" : index % 7 === 6 ? "revision" : "study",
      days_left: Math.max(0, Math.ceil(
        (new Date(examDate).getTime() - date.getTime()) / 86_400_000,
      )),
      sessions: [{
        time: isExamDay ? "Full Day" : "Morning",
        topic,
        subject: selectedTopic?.subject ?? "All Subjects",
        subject_code: selectedTopic?.subjectCode,
        duration: Math.max(30, dailyStudyHours * (isExamDay ? 60 : 30)),
        tasks: isExamDay
          ? ["Review formulas and key facts", "Stay calm and follow your exam strategy"]
          : [`Study ${topic} in depth`, "Solve practice questions", "Note repeated mistakes"],
        tip: isExamDay
          ? "Final review only — conserve energy for the exam."
          : `Focus on ${topic} and note any repeated mistakes.`,
      }],
    };
  });

  return {
    examType,
    planData: {
      exam: examType,
      plan_type: "Focused Preview Plan",
      days_remaining: daysRemaining,
      total_topics: syllabusTopics.length,
      total_hours: dailyStudyHours * totalPlanDays,
      exam_date: examDate,
      plan_start: start.toISOString().slice(0, 10),
      strategy: `Cover all ${syllabusTopics.length} syllabus topics with daily practice, then use the final days for revision before the exam.`,
      subjects: syllabus.subjects.map((subject, index) => {
        const subjectDays = planDays.filter((day) =>
          day.sessions.some((session) => session.subject_code === subject.subjectCode),
        );
        const weightage = Math.round((subject.topics.length / syllabusTopics.length) * 100);
        return {
          name: subject.name,
          subject_code: subject.subjectCode,
          weightage_percent: index === syllabus.subjects.length - 1
            ? Math.max(
                1,
                100 - syllabus.subjects
                  .slice(0, -1)
                  .reduce((total, item) => total + Math.round((item.topics.length / syllabusTopics.length) * 100), 0),
              )
            : weightage,
          recommended_hours: Math.max(1, Math.round((subject.topics.length / syllabusTopics.length) * totalPlanDays * dailyStudyHours)),
          topic_count: subject.topics.length,
          allocated_study_days: subjectDays.length,
          start_date: subjectDays[0]?.date ?? null,
          end_date: subjectDays.at(-1)?.date ?? null,
          topics: subject.topics.map((topic, topicIndex) => ({
            name: topic.name,
            priority: topicIndex < Math.ceil(subject.topics.length / 3)
              ? "high"
              : topicIndex < Math.ceil((subject.topics.length * 2) / 3)
                ? "medium"
                : "low",
            tip: `Practice ${topic.name} and review your mistakes.`,
          })),
        };
      }),
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