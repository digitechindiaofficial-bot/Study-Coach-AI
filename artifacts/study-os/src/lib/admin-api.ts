type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider | null = null;

export function setAdminTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider;
}

function isPreviewHost() {
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".replit.dev") ||
    hostname.endsWith(".replit.app")
  );
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const previewQuizQuestions = [
  {
    id: "preview-quant",
    subject: "Quantitative Aptitude",
    topic: "Percentage",
    questionText: "If 20% of a number is 50, what is the number?",
    options: { a: "200", b: "250", c: "300", d: "350" },
    correctOption: "b",
    explanation: "50 ÷ 0.20 = 250.",
    difficulty: "Easy",
    examType: ["SSC_CGL"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "preview-reasoning",
    subject: "Reasoning",
    topic: "Number Series",
    questionText: "Find the next term: 2, 6, 12, 20, 30, ?",
    options: { a: "36", b: "40", c: "42", d: "44" },
    correctOption: "c",
    explanation: "The differences are 4, 6, 8, 10, then 12.",
    difficulty: "Medium",
    examType: ["SSC_CGL"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "preview-english",
    subject: "English",
    topic: "Vocabulary",
    questionText: "Choose the synonym of 'abundant'.",
    options: { a: "Scarce", b: "Plentiful", c: "Empty", d: "Rare" },
    correctOption: "b",
    explanation: "Abundant means plentiful.",
    difficulty: "Easy",
    examType: ["SSC_CGL"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "preview-awareness",
    subject: "General Awareness",
    topic: "Indian Polity",
    questionText: "Who is the constitutional head of India?",
    options: { a: "Prime Minister", b: "Chief Justice", c: "President", d: "Speaker" },
    correctOption: "c",
    explanation: "The President is the constitutional head of India.",
    difficulty: "Easy",
    examType: ["SSC_CGL"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "preview-current-affairs",
    subject: "Current Affairs",
    topic: "National",
    questionText: "Preview question: current-affairs content appears here when published.",
    options: { a: "Option A", b: "Option B", c: "Option C", d: "Option D" },
    correctOption: "a",
    explanation: "Sample content for read-only preview.",
    difficulty: "Medium",
    examType: ["SSC_CGL"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const previewMock = {
  id: "preview-ssc-cgl-mock",
  examCode: "SSC_CGL",
  name: "SSC CGL Full Mock — Preview",
  description: "Read-only preview of a complete mock test configuration.",
  mockType: "FULL_MOCK",
  timeLimitMinutes: 60,
  difficulty: "mixed",
  totalMarks: 200,
  isActive: true,
  version: 1,
  mockNumber: 1,
  status: "published",
  sectionCount: 4,
  attemptCount: 0,
  sections: [
    ["Quantitative Aptitude", "QUANT", 25],
    ["General Intelligence & Reasoning", "REASONING", 25],
    ["English Comprehension", "ENGLISH", 25],
    ["General Awareness", "GENERAL_AWARENESS", 25],
  ].map(([name, subjectCode, questionCount], index) => ({
    id: `preview-section-${index + 1}`,
    mockTestId: "preview-ssc-cgl-mock",
    name,
    subjectCode,
    orderNum: index + 1,
    questionCount,
    marksPerQuestion: "2",
    negativeMarks: "0.5",
    timeLimitSeconds: null,
    rule: {
      id: `preview-rule-${index + 1}`,
      sectionId: `preview-section-${index + 1}`,
      selectionType: "dynamic",
      examCode: "SSC_CGL",
      subjectCode,
      topicCode: null,
      difficulty: null,
      easyCount: 8,
      mediumCount: 12,
      hardCount: 5,
      randomize: true,
      language: "en",
    },
  })),
};

async function previewGet(url: URL): Promise<Response> {
  const { pathname, searchParams } = url;

  if (pathname === "/api/admin/stats") {
    return jsonResponse({
      totalUsers: 0,
      proUsers: 0,
      freeUsers: 0,
      todayQuizAttempts: 0,
      totalQuizAttempts: 0,
      totalQuestions: previewQuizQuestions.length,
      totalCurrentAffairs: 0,
    });
  }

  if (pathname === "/api/admin/users") return jsonResponse([]);

  if (pathname === "/api/admin/quiz/questions") {
    const subject = searchParams.get("subject");
    return jsonResponse(
      subject
        ? previewQuizQuestions.filter((question) => question.subject === subject)
        : previewQuizQuestions,
    );
  }

  if (pathname === "/api/admin/quiz/subject-counts") {
    return jsonResponse(
      Object.fromEntries(
        previewQuizQuestions.map((question) => [
          question.subject,
          previewQuizQuestions.filter((item) => item.subject === question.subject).length,
        ]),
      ),
    );
  }

  if (pathname === "/api/admin/current-affairs") return jsonResponse([]);

  if (pathname === "/api/admin/question-stats") {
    return jsonResponse({
      total: previewQuizQuestions.length,
      exam_count: 1,
      subject_count: 5,
      avg_per_subject: 1,
      exams: [],
      subjects_with_zero: [],
    });
  }

  if (pathname === "/api/admin/mock-tests") {
    return jsonResponse([{ ...previewMock, sections: undefined }]);
  }

  if (pathname === `/api/admin/mock-tests/${previewMock.id}`) {
    return jsonResponse(previewMock);
  }

  if (pathname === "/api/admin/mock-tests/question-bank/search") return jsonResponse([]);

  if (pathname === "/api/admin/exam-patterns") {
    return window.fetch("/api/exam-patterns", { credentials: "include" });
  }

  if (pathname === "/api/admin/exams") {
    return window.fetch("/api/exams", { credentials: "include" });
  }

  const subjectMatch = pathname.match(/^\/api\/admin\/exams\/([^/]+)\/subjects$/);
  if (subjectMatch) {
    return window.fetch(`/api/exams/${subjectMatch[1]}/subjects`, { credentials: "include" });
  }

  if (pathname === "/api/admin/syllabus/exams") {
    const response = await window.fetch("/api/exams", { credentials: "include" });
    if (!response.ok) return response;
    const exams = await response.json();
    return jsonResponse(
      Array.isArray(exams)
        ? exams.map((exam) => ({
            ...exam,
            subjectCount: exam.subjectCount ?? exam.subject_count ?? 0,
            topicCount: exam.topicCount ?? 0,
            createdAt: exam.createdAt ?? exam.created_at ?? "2026-01-01T00:00:00.000Z",
          }))
        : [],
    );
  }

  if (pathname === "/api/admin/blog/posts") {
    return window.fetch("/api/blog", { credentials: "include" });
  }

  return jsonResponse([]);
}

export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    window.location.origin,
  );
  const method = (init.method ?? "GET").toUpperCase();

  if (isPreviewHost()) {
    if (method === "GET") return previewGet(url);
    return jsonResponse(
      {
        error: "Admin changes are disabled in preview mode. Use the live domain with a verified admin account.",
      },
      403,
    );
  }

  const token = tokenProvider ? await tokenProvider() : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return window.fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });
}