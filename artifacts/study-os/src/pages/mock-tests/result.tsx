import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, MinusCircle, Flag, Trophy, Clock, Target,
  TrendingUp, BarChart2, Brain, Loader2, ChevronDown, ChevronUp,
  RotateCcw, Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SubjectStat {
  subjectCode: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracy: number;
}

interface QuestionDetail {
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
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
    accuracy: string | null;
  };
  mock: {
    id: string;
    name: string;
    timeLimitMinutes: number;
    mockType: string;
    examCode: string;
  } | null;
  subjectWise: SubjectStat[];
  questionDetails: QuestionDetail[];
}

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

function QuestionReviewItem({ q, index }: { q: QuestionDetail; index: number }) {
  const [open, setOpen] = useState(false);

  const icon =
    q.isCorrect === true ? (
      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
    ) : q.isCorrect === false ? (
      <XCircle className="h-4 w-4 text-red-600 shrink-0" />
    ) : (
      <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />
    );

  const rowBg =
    q.isCorrect === true ? "border-green-200 bg-green-50/30" :
    q.isCorrect === false ? "border-red-200 bg-red-50/30" :
    "border-muted";

  return (
    <div className={cn("border rounded-lg overflow-hidden", rowBg)}>
      <button
        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-black/5 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="text-xs font-semibold text-muted-foreground shrink-0">Q{q.orderNum}</span>
          <span className="text-sm truncate">{q.question}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {q.isMarkedForReview && <Flag className="h-3.5 w-3.5 text-orange-500" />}
          <span className="text-xs font-medium">
            {parseFloat(q.marksAwarded) > 0 ? `+${q.marksAwarded}` : q.marksAwarded}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t bg-card">
          <p className="text-sm font-medium pt-3 leading-relaxed">{q.question}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(["a", "b", "c", "d"] as const).map((opt) => {
              const isCorrect = opt === q.correctAnswer;
              const isSelected = opt === q.selectedOption;
              return (
                <div
                  key={opt}
                  className={cn(
                    "text-sm p-2.5 rounded-lg border",
                    isCorrect ? "bg-green-50 border-green-300 text-green-800 font-medium" :
                    isSelected ? "bg-red-50 border-red-300 text-red-800" :
                    "bg-muted/30 border-muted text-muted-foreground",
                  )}
                >
                  <span className="font-bold mr-1.5">{OPTION_LABELS[opt]}.</span>
                  {getOptionText(q, opt)}
                  {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 inline ml-1.5 text-green-600" />}
                  {isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 inline ml-1.5 text-red-600" />}
                </div>
              );
            })}
          </div>
          {q.explanation && (
            <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
              <span className="font-semibold text-blue-700">Explanation: </span>
              {q.explanation}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="capitalize">{q.difficulty}</span>
            <span>·</span>
            <span>{q.subjectCode}</span>
            <span>·</span>
            <span>{formatDuration(q.timeSpentSeconds)} spent</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MockTestResultPage({ id, attemptId }: { id: string; attemptId: string }) {
  const [data, setData] = useState<ResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/mock-tests/${id}/attempts/${attemptId}/result`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load result");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Failed to load results."))
      .finally(() => setIsLoading(false));
  }, [id, attemptId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Calculating results...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive">{error ?? "Something went wrong"}</p>
        <Link href="/mock-tests"><Button variant="outline" className="mt-4">Back to Tests</Button></Link>
      </div>
    );
  }

  const { attempt, mock, subjectWise, questionDetails } = data;
  const score = parseFloat(attempt.score ?? "0");
  const totalMarks = attempt.totalMarks ?? 0;
  const accuracy = parseFloat(attempt.accuracy ?? "0");
  const pct = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

  const scoreColor = pct >= 70 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
  const scoreBg = pct >= 70 ? "from-green-500 to-emerald-500" : pct >= 50 ? "from-amber-500 to-orange-500" : "from-red-500 to-rose-500";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{mock?.name ?? "Mock Test"}</h1>
          <p className="text-sm text-muted-foreground">Result · {mock?.examCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/mock-tests/${id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
          </Link>
          <Link href="/mock-tests">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Home className="h-4 w-4" /> All Tests
            </Button>
          </Link>
        </div>
      </div>

      {/* Score Banner */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className={cn("bg-gradient-to-r p-6 text-white", scoreBg)}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <Trophy className="h-8 w-8" />
              </div>
              <div>
                <p className="text-4xl font-bold">
                  {score}<span className="text-2xl font-normal opacity-80">/{totalMarks}</span>
                </p>
                <p className="text-white/80 text-sm mt-0.5">
                  {pct >= 70 ? "Excellent performance!" : pct >= 50 ? "Good effort!" : "Keep practicing!"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{accuracy.toFixed(1)}%</p>
                <p className="text-white/70 text-xs">Accuracy</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(attempt.timeTakenSeconds)}</p>
                <p className="text-white/70 text-xs">Time Taken</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-green-700">{attempt.correctCount}</p>
              <p className="text-xs text-green-600">Correct</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-red-700">{attempt.incorrectCount}</p>
              <p className="text-xs text-red-600">Incorrect</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-muted">
          <CardContent className="p-4 flex items-center gap-3">
            <MinusCircle className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{attempt.unattemptedCount}</p>
              <p className="text-xs text-muted-foreground">Unattempted</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Flag className="h-8 w-8 text-orange-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {questionDetails.filter((q) => q.isMarkedForReview).length}
              </p>
              <p className="text-xs text-orange-500">Marked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject-wise performance */}
      {subjectWise.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4" /> Subject-wise Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4 font-medium">Subject</th>
                    <th className="text-center py-2 px-3 font-medium">Total</th>
                    <th className="text-center py-2 px-3 font-medium text-green-600">Correct</th>
                    <th className="text-center py-2 px-3 font-medium text-red-600">Wrong</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Skipped</th>
                    <th className="text-center py-2 pl-3 font-medium">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectWise.map((s) => (
                    <tr key={s.subjectCode} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{s.subjectCode}</td>
                      <td className="text-center py-3 px-3">{s.total}</td>
                      <td className="text-center py-3 px-3 text-green-600 font-medium">{s.correct}</td>
                      <td className="text-center py-3 px-3 text-red-600 font-medium">{s.incorrect}</td>
                      <td className="text-center py-3 px-3 text-muted-foreground">{s.unattempted}</td>
                      <td className="text-center py-3 pl-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", s.accuracy >= 70 ? "bg-green-500" : s.accuracy >= 50 ? "bg-amber-500" : "bg-red-500")}
                              style={{ width: `${s.accuracy}%` }}
                            />
                          </div>
                          <span className={cn("text-xs font-semibold", s.accuracy >= 70 ? "text-green-600" : s.accuracy >= 50 ? "text-amber-600" : "text-red-600")}>
                            {s.accuracy.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed border-2 opacity-70">
          <CardContent className="p-6 flex flex-col items-center text-center gap-2">
            <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-semibold text-muted-foreground">Rank & Leaderboard</p>
            <p className="text-xs text-muted-foreground">Coming soon — compare your score with other aspirants</p>
            <Badge variant="outline" className="text-xs">Coming Soon</Badge>
          </CardContent>
        </Card>
        <Card className="border-dashed border-2 opacity-70">
          <CardContent className="p-6 flex flex-col items-center text-center gap-2">
            <Brain className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-semibold text-muted-foreground">AI Analysis</p>
            <p className="text-xs text-muted-foreground">Coming soon — personalized insights on your weak areas</p>
            <Badge variant="outline" className="text-xs">Coming Soon</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Question Review */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Question Review
            <span className="text-xs font-normal text-muted-foreground ml-1">
              ({questionDetails.length} questions)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {questionDetails.map((q, i) => (
            <QuestionReviewItem key={q.orderNum} q={q} index={i} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
