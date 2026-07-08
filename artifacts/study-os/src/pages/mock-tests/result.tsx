import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, MinusCircle, Flag, Trophy, Clock, Target,
  TrendingUp, BarChart2, Brain, Loader2, ChevronDown, ChevronUp,
  RotateCcw, Home, AlertTriangle, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubjectStat {
  code: string;
  name: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracy: number;
  marksEarned: number;
  negativeMarks: number;
}

interface SectionStat {
  id: string;
  name: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracy: number;
  marksEarned: number;
  negativeMarks: number;
}

interface TopicStat {
  code: string;
  subjectCode: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracy: number;
}

interface Analytics {
  subjectWise: SubjectStat[];
  sectionWise: SectionStat[];
  topicWise: TopicStat[];
  questionTimeMap: Record<string, number>;
  totalTimeSeconds: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  markedForReviewCount: number;
  totalNegativeMarks: number;
  score: number;
  totalMarks: number;
  accuracy: number;
  rank: number | null;
  totalAttempts: number | null;
}

interface QuestionDetail {
  attemptQuestionId: string;
  orderNum: number;
  sectionName: string;
  subjectCode: string;
  topicCode: string;
  difficulty: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string | null;
  selectedOption: string | null;
  isMarkedForReview: boolean;
  isCorrect: boolean | null;
  marksAwarded: string;
  timeSpentSeconds: number;
}

interface ResultData {
  attempt: {
    id: string;
    status: string;
    score: string | null;
    totalMarks: number | null;
    timeTakenSeconds: number | null;
    submittedAt: string | null;
  };
  mock: {
    id: string;
    name: string;
    mockNumber: number;
    examCode: string;
    totalMarks: number;
  } | null;
  analytics: Analytics;
  questionDetails: QuestionDetail[];
  sections: { id: string; name: string; subjectCode: string | null; orderNum: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null) {
  if (!seconds) return "--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const OPTION_LABELS: Record<string, string> = { a: "A", b: "B", c: "C", d: "D" };

function getOptionText(q: QuestionDetail, opt: string) {
  return opt === "a" ? q.optionA : opt === "b" ? q.optionB : opt === "c" ? q.optionC : q.optionD;
}

function AccuracyBar({ accuracy }: { accuracy: number }) {
  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
      <div
        className={cn(
          "h-1.5 rounded-full",
          accuracy >= 70 ? "bg-green-500" : accuracy >= 50 ? "bg-amber-500" : "bg-red-500",
        )}
        style={{ width: `${Math.min(100, accuracy)}%` }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MockTestResultPage() {
  const [data, setData] = useState<ResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "subjects" | "sections" | "review">("overview");

  const pathParts = window.location.pathname.split("/");
  const mockId = pathParts[2];
  const attemptId = pathParts[4];

  useEffect(() => {
    fetch(`/api/mock-tests/${mockId}/attempts/${attemptId}/result`, {
      credentials: "include",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load result");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Failed to load results. Please try again."))
      .finally(() => setIsLoading(false));
  }, [mockId, attemptId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-destructive font-medium">{error ?? "Result not found"}</p>
        <Link href="/mock-tests"><Button variant="outline"><Home className="h-4 w-4 mr-2" /> Back to Tests</Button></Link>
      </div>
    );
  }

  const a = data.analytics;
  const percentage = a.totalMarks > 0 ? (a.score / a.totalMarks) * 100 : 0;

  const scoreColor =
    percentage >= 80 ? "text-green-600" :
    percentage >= 60 ? "text-blue-600" :
    percentage >= 40 ? "text-amber-600" : "text-red-600";

  const scoreBg =
    percentage >= 80 ? "bg-green-50 border-green-200" :
    percentage >= 60 ? "bg-blue-50 border-blue-200" :
    percentage >= 40 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/mock-tests">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2">
                <Home className="h-3.5 w-3.5" /> Mock Tests
              </Button>
            </Link>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-xs text-muted-foreground">{data.mock?.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Result — {data.mock?.name ?? "Mock Test"}</h1>
          <p className="text-muted-foreground text-sm">
            {data.mock?.examCode} • Mock #{data.mock?.mockNumber}
            {data.attempt.submittedAt && (
              <> • {new Date(data.attempt.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/mock-tests/${mockId}`}>
            <Button variant="outline" size="sm" className="gap-1"><RotateCcw className="h-4 w-4" /> Retake</Button>
          </Link>
        </div>
      </div>

      {/* Score Banner */}
      <Card className={cn("border-2", scoreBg)}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Big Score */}
            <div className="text-center">
              <div className={cn("text-6xl font-bold", scoreColor)}>{a.score.toFixed(1)}</div>
              <div className="text-muted-foreground text-sm">out of {a.totalMarks}</div>
              <div className={cn("text-2xl font-semibold mt-1", scoreColor)}>{percentage.toFixed(1)}%</div>
            </div>

            {/* Stats Grid */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{a.correctCount}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{a.incorrectCount}</div>
                <div className="text-xs text-muted-foreground">Incorrect</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">{a.unattemptedCount}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{a.accuracy.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Accuracy</div>
              </div>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Time: <span className="text-foreground font-medium ml-1">{formatDuration(a.totalTimeSeconds)}</span>
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <Minus className="h-3.5 w-3.5" />
              Negative: <span className="font-medium ml-1">−{a.totalNegativeMarks.toFixed(2)}</span>
            </span>
            {a.markedForReviewCount > 0 && (
              <span className="flex items-center gap-1">
                <Flag className="h-3.5 w-3.5" />
                Marked: <span className="text-foreground font-medium ml-1">{a.markedForReviewCount}</span>
              </span>
            )}
            {a.rank && a.totalAttempts && (
              <span className="flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                Rank: <span className="text-foreground font-medium ml-1">#{a.rank} / {a.totalAttempts}</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["overview", "subjects", "sections", "review"] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="capitalize"
          >
            {tab === "overview" && <BarChart2 className="h-3.5 w-3.5 mr-1" />}
            {tab === "subjects" && <Brain className="h-3.5 w-3.5 mr-1" />}
            {tab === "sections" && <Target className="h-3.5 w-3.5 mr-1" />}
            {tab === "review" && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
            {tab === "overview" ? "Overview" : tab === "subjects" ? "Subject-wise" : tab === "sections" ? "Section-wise" : "Question Review"}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {a.subjectWise.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Subject Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {a.subjectWise.map((s) => (
                    <div key={s.code}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{s.code}</span>
                        <span className={cn("text-sm font-bold", s.accuracy >= 70 ? "text-green-600" : s.accuracy >= 50 ? "text-amber-600" : "text-red-600")}>
                          {s.accuracy.toFixed(1)}%
                        </span>
                      </div>
                      <AccuracyBar accuracy={s.accuracy} />
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span className="text-green-600">✓ {s.correct}</span>
                        <span className="text-red-600">✗ {s.incorrect}</span>
                        <span>— {s.unattempted}</span>
                        <span className="ml-auto">+{s.marksEarned.toFixed(1)} / −{s.negativeMarks.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {a.topicWise.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Topic Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left pb-2 font-medium">Topic</th>
                        <th className="text-left pb-2 font-medium">Subject</th>
                        <th className="text-center pb-2 font-medium">Total</th>
                        <th className="text-center pb-2 font-medium">✓</th>
                        <th className="text-center pb-2 font-medium">✗</th>
                        <th className="text-center pb-2 font-medium">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.topicWise.sort((a, b) => b.accuracy - a.accuracy).map((t) => (
                        <tr key={t.code} className="border-b last:border-0">
                          <td className="py-2 font-medium">{t.code}</td>
                          <td className="py-2 text-muted-foreground text-xs">{t.subjectCode}</td>
                          <td className="py-2 text-center">{t.total}</td>
                          <td className="py-2 text-center text-green-600">{t.correct}</td>
                          <td className="py-2 text-center text-red-600">{t.incorrect}</td>
                          <td className="py-2 text-center">
                            <span className={cn("font-semibold", t.accuracy >= 70 ? "text-green-600" : t.accuracy >= 50 ? "text-amber-600" : "text-red-600")}>
                              {t.accuracy.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Subject-wise Tab */}
      {activeTab === "subjects" && (
        <Card>
          <CardContent className="p-0">
            {a.subjectWise.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No subject-wise data available</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Subject</th>
                    <th className="text-center px-3 py-3 font-medium">Total</th>
                    <th className="text-center px-3 py-3 font-medium">Correct</th>
                    <th className="text-center px-3 py-3 font-medium">Wrong</th>
                    <th className="text-center px-3 py-3 font-medium">Skipped</th>
                    <th className="text-center px-3 py-3 font-medium">Marks</th>
                    <th className="text-center px-3 py-3 font-medium">Negative</th>
                    <th className="text-center px-3 py-3 font-medium">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {a.subjectWise.map((s) => (
                    <tr key={s.code} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{s.code}</td>
                      <td className="px-3 py-3 text-center">{s.total}</td>
                      <td className="px-3 py-3 text-center text-green-600 font-medium">{s.correct}</td>
                      <td className="px-3 py-3 text-center text-red-600 font-medium">{s.incorrect}</td>
                      <td className="px-3 py-3 text-center text-muted-foreground">{s.unattempted}</td>
                      <td className="px-3 py-3 text-center text-green-700">+{s.marksEarned.toFixed(1)}</td>
                      <td className="px-3 py-3 text-center text-red-600">−{s.negativeMarks.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn("font-bold", s.accuracy >= 70 ? "text-green-600" : s.accuracy >= 50 ? "text-amber-600" : "text-red-600")}>
                          {s.accuracy.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section-wise Tab */}
      {activeTab === "sections" && (
        <Card>
          <CardContent className="p-0">
            {a.sectionWise.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No section-wise data available</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Section</th>
                    <th className="text-center px-3 py-3 font-medium">Total</th>
                    <th className="text-center px-3 py-3 font-medium">Correct</th>
                    <th className="text-center px-3 py-3 font-medium">Wrong</th>
                    <th className="text-center px-3 py-3 font-medium">Skipped</th>
                    <th className="text-center px-3 py-3 font-medium">Marks</th>
                    <th className="text-center px-3 py-3 font-medium">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {a.sectionWise.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-3 py-3 text-center">{s.total}</td>
                      <td className="px-3 py-3 text-center text-green-600 font-medium">{s.correct}</td>
                      <td className="px-3 py-3 text-center text-red-600 font-medium">{s.incorrect}</td>
                      <td className="px-3 py-3 text-center text-muted-foreground">{s.unattempted}</td>
                      <td className="px-3 py-3 text-center text-green-700">+{s.marksEarned.toFixed(1)} / −{s.negativeMarks.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn("font-bold", s.accuracy >= 70 ? "text-green-600" : s.accuracy >= 50 ? "text-amber-600" : "text-red-600")}>
                          {s.accuracy.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Question Review Tab */}
      {activeTab === "review" && (
        <div className="space-y-3">
          {/* Filter row */}
          <div className="flex gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">{data.questionDetails.length} questions total</span>
            <span className="text-green-600">✓ {a.correctCount} correct</span>
            <span className="text-red-600">✗ {a.incorrectCount} wrong</span>
            <span className="text-muted-foreground">— {a.unattemptedCount} skipped</span>
          </div>

          {data.questionDetails.map((q) => {
            const isExpanded = expandedQuestion === q.attemptQuestionId;
            const statusIcon =
              q.isCorrect === true ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> :
              q.isCorrect === false ? <XCircle className="h-4 w-4 text-red-500 shrink-0" /> :
              <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />;

            return (
              <Card
                key={q.attemptQuestionId}
                className={cn(
                  "border",
                  q.isCorrect === true && "border-green-200 bg-green-50/30",
                  q.isCorrect === false && "border-red-200 bg-red-50/30",
                )}
              >
                <CardContent className="p-4">
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpandedQuestion(isExpanded ? null : q.attemptQuestionId)}
                  >
                    {statusIcon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-muted-foreground">Q{q.orderNum}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{q.sectionName}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{q.subjectCode}</span>
                        <span className="text-xs text-muted-foreground capitalize">{q.difficulty}</span>
                        {q.isMarkedForReview && (
                          <span className="text-xs flex items-center gap-0.5 text-amber-600">
                            <Flag className="h-3 w-3" /> Marked
                          </span>
                        )}
                        <span className="ml-auto text-xs font-medium text-muted-foreground">
                          {parseFloat(q.marksAwarded) > 0 ? `+${q.marksAwarded}` : q.marksAwarded} marks
                        </span>
                        {q.timeSpentSeconds > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-3 w-3" /> {q.timeSpentSeconds}s
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground line-clamp-2">{q.question}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-2 pl-7">
                      {/* Question full text */}
                      <p className="text-sm font-medium text-foreground mb-3">{q.question}</p>

                      {/* Options */}
                      {(["a", "b", "c", "d"] as const).map((opt) => {
                        const isSelected = q.selectedOption === opt;
                        const isCorrectOpt = q.correctAnswer === opt;
                        return (
                          <div
                            key={opt}
                            className={cn(
                              "flex items-start gap-2 rounded-md px-3 py-2 text-sm border",
                              isCorrectOpt ? "bg-green-50 border-green-300 text-green-900" :
                              isSelected && !isCorrectOpt ? "bg-red-50 border-red-300 text-red-900" :
                              "bg-muted/30 border-transparent",
                            )}
                          >
                            <span className="font-bold w-5 shrink-0">{OPTION_LABELS[opt]}.</span>
                            <span>{getOptionText(q, opt)}</span>
                            {isCorrectOpt && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto shrink-0" />}
                            {isSelected && !isCorrectOpt && <XCircle className="h-4 w-4 text-red-600 ml-auto shrink-0" />}
                          </div>
                        );
                      })}

                      {/* Your answer */}
                      {q.selectedOption ? (
                        <p className="text-xs text-muted-foreground pt-1">
                          Your answer: <span className="font-medium text-foreground">{OPTION_LABELS[q.selectedOption]}</span>
                          {" · "}Correct: <span className="font-medium text-green-700">{OPTION_LABELS[q.correctAnswer]}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground pt-1">
                          Not attempted · Correct: <span className="font-medium text-green-700">{OPTION_LABELS[q.correctAnswer]}</span>
                        </p>
                      )}

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Explanation</p>
                          <p className="text-sm text-foreground">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
