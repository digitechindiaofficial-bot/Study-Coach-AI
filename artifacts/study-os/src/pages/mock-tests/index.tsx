import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, Clock, Target, Trophy, ChevronRight, Loader2,
  CheckCircle2, PlayCircle, Circle, RotateCcw, BarChart2,
  TrendingDown, TrendingUp, Minus, History, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MockSection {
  id: string;
  name: string;
  subjectCode: string | null;
  questionCount: number;
  marksPerQuestion: string;
  orderNum: number;
}

interface MockTest {
  id: string;
  examCode: string;
  name: string;
  mockNumber: number;
  description: string | null;
  mockType: string;
  timeLimitMinutes: number;
  difficulty: string;
  totalMarks: number;
  version: number;
  sections: MockSection[];
  userStatus: "not_started" | "in_progress" | "completed";
  inProgressAttemptId: string | null;
  bestScore: number | null;
  bestAccuracy: number | null;
  attemptCount: number;
  lastAttemptAt: string | null;
}

interface Stats {
  mocksAttempted: number;
  avgScore: number;
  avgAccuracy: number;
  bestScore: number;
  bestTotalMarks: number;
  latestMock: { id: string; name: string; score: number; totalMarks: number; accuracy: number; attemptId: string; date: string } | null;
  weakSubject: string | null;
  strongSubject: string | null;
}

interface HistoryAttempt {
  attemptId: string;
  mockTestId: string;
  mockName: string;
  mockNumber: number;
  examCode: string;
  score: number;
  totalMarks: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_TYPE_LABELS: Record<string, string> = {
  FULL_MOCK: "Full Mock", SUBJECT_TEST: "Subject Test",
  TOPIC_TEST: "Topic Test", PYQ_TEST: "PYQ Test",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
  mixed: "bg-blue-100 text-blue-700",
};

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string | null) {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: MockTest["userStatus"] }) {
  if (status === "completed")
    return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>;
  if (status === "in_progress")
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1"><PlayCircle className="h-3 w-3" /> In Progress</Badge>;
  return <Badge variant="outline" className="text-muted-foreground gap-1"><Circle className="h-3 w-3" /> Not Started</Badge>;
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: Stats }) {
  if (stats.mocksAttempted === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card className="border-0 bg-primary/5">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.mocksAttempted}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tests Taken</p>
        </CardContent>
      </Card>
      <Card className="border-0 bg-amber-50">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{stats.bestScore}/{stats.bestTotalMarks}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Best Score</p>
        </CardContent>
      </Card>
      <Card className="border-0 bg-green-50">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{stats.avgScore.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg Score</p>
        </CardContent>
      </Card>
      <Card className="border-0 bg-blue-50">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{stats.avgAccuracy.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg Accuracy</p>
        </CardContent>
      </Card>
      <Card className="border-0 bg-red-50">
        <CardContent className="p-4 text-center">
          <p className="text-sm font-bold text-red-700 flex items-center justify-center gap-1">
            <TrendingDown className="h-3.5 w-3.5" />
            {stats.weakSubject ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Weak Subject</p>
        </CardContent>
      </Card>
      <Card className="border-0 bg-emerald-50">
        <CardContent className="p-4 text-center">
          <p className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            {stats.strongSubject ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Strong Subject</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── History Table ─────────────────────────────────────────────────────────────

function HistorySection({ history }: { history: HistoryAttempt[] }) {
  if (history.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <History className="h-5 w-5 text-muted-foreground" /> Attempt History
      </h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left px-4 py-3 font-medium">Mock Test</th>
                <th className="text-center px-3 py-3 font-medium">Score</th>
                <th className="text-center px-3 py-3 font-medium">Accuracy</th>
                <th className="text-center px-3 py-3 font-medium hidden sm:table-cell">Correct</th>
                <th className="text-center px-3 py-3 font-medium hidden sm:table-cell">Wrong</th>
                <th className="text-center px-3 py-3 font-medium hidden md:table-cell">Time</th>
                <th className="text-center px-3 py-3 font-medium hidden md:table-cell">Date</th>
                <th className="text-center px-3 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.attemptId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground line-clamp-1">{h.mockName}</div>
                    <div className="text-xs text-muted-foreground">#{h.mockNumber} • {h.examCode}</div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-semibold">{h.score}</span>
                    <span className="text-muted-foreground">/{h.totalMarks}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      "font-semibold",
                      h.accuracy >= 70 ? "text-green-600" : h.accuracy >= 50 ? "text-amber-600" : "text-red-600",
                    )}>
                      {h.accuracy.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    <span className="text-green-600 font-medium">{h.correctCount}</span>
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    <span className="text-red-600 font-medium">{h.incorrectCount}</span>
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell text-muted-foreground">
                    {formatDuration(h.timeTakenSeconds)}
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell text-muted-foreground">
                    {formatDate(h.submittedAt)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link href={`/mock-tests/${h.mockTestId}/results/${h.attemptId}`}>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MockTestListPage() {
  const [mocks, setMocks] = useState<MockTest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tests" | "history">("tests");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const headers = { "Cache-Control": "no-cache" };
    const opts: RequestInit = { credentials: "include", headers };

    Promise.all([
      fetch("/api/mock-tests", opts).then((r) => r.json()),
      fetch("/api/mock-tests/stats", opts).then((r) => r.json()),
      fetch("/api/mock-tests/history", opts).then((r) => r.json()),
    ])
      .then(([mocksData, statsData, historyData]) => {
        setMocks(mocksData);
        setStats(statsData);
        setHistory(historyData);
      })
      .catch(() => setError("Failed to load mock tests. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            Mock Tests
          </h1>
          <p className="text-muted-foreground mt-1">
            Full-length tests with timer, palette, and detailed analytics.
          </p>
        </div>
        {history.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant={activeTab === "tests" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("tests")}
              className="gap-1.5"
            >
              <ClipboardList className="h-4 w-4" /> Tests
            </Button>
            <Button
              variant={activeTab === "history" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("history")}
              className="gap-1.5"
            >
              <History className="h-4 w-4" /> History ({history.length})
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-destructive text-sm">{error}</CardContent>
        </Card>
      )}

      {/* Stats bar */}
      {stats && <StatsBar stats={stats} />}

      {/* Latest mock banner */}
      {stats?.latestMock && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Latest Attempt</p>
              <p className="font-semibold text-foreground mt-0.5">{stats.latestMock.name}</p>
              <p className="text-sm text-muted-foreground">
                Score: <span className="font-medium text-foreground">{stats.latestMock.score}/{stats.latestMock.totalMarks}</span>
                {" · "}Accuracy: <span className="font-medium text-foreground">{stats.latestMock.accuracy.toFixed(1)}%</span>
              </p>
            </div>
            <Link href={`/mock-tests/${stats.latestMock.id}/results/${stats.latestMock.attemptId}`}>
              <Button variant="outline" size="sm" className="gap-1">
                <Eye className="h-3.5 w-3.5" /> View Result
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tab: History */}
      {activeTab === "history" && <HistorySection history={history} />}

      {/* Tab: Tests */}
      {activeTab === "tests" && (
        <>
          {mocks.length === 0 && !error && (
            <Card className="border-dashed">
              <CardContent className="py-20 flex flex-col items-center text-center gap-3">
                <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
                <div>
                  <p className="font-semibold text-foreground">No mock tests available yet</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    Your admin will publish mock tests for your exam soon.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {mocks.map((mock) => (
              <Card
                key={mock.id}
                className={cn(
                  "border transition-shadow hover:shadow-md",
                  mock.userStatus === "completed" && "border-green-200",
                  mock.userStatus === "in_progress" && "border-blue-200",
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-muted-foreground">#{mock.mockNumber}</span>
                        <Badge variant="secondary" className="text-xs">
                          {MOCK_TYPE_LABELS[mock.mockType] ?? mock.mockType}
                        </Badge>
                        <Badge className={cn("text-xs capitalize", DIFFICULTY_COLORS[mock.difficulty] ?? "bg-muted")}>
                          {mock.difficulty}
                        </Badge>
                      </div>

                      <h2 className="text-lg font-bold text-foreground">{mock.name}</h2>
                      {mock.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{mock.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Target className="h-3.5 w-3.5" />
                          {mock.totalMarks} marks
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(mock.timeLimitMinutes)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClipboardList className="h-3.5 w-3.5" />
                          {mock.sections.reduce((sum, s) => sum + s.questionCount, 0)} questions
                          {mock.sections.length > 0 && ` · ${mock.sections.length} sections`}
                        </span>
                      </div>

                      {mock.sections.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {mock.sections.map((s) => (
                            <span key={s.id} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                              {s.name} ({s.questionCount}Q)
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 flex-wrap pt-1">
                        <StatusBadge status={mock.userStatus} />
                        {mock.bestScore !== null && (
                          <span className="text-xs flex items-center gap-1 text-amber-600">
                            <Trophy className="h-3.5 w-3.5" />
                            Best: {mock.bestScore}/{mock.totalMarks}
                            {mock.bestAccuracy !== null && ` (${parseFloat(String(mock.bestAccuracy)).toFixed(1)}%)`}
                          </span>
                        )}
                        {mock.attemptCount > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" />
                            {mock.attemptCount} attempt{mock.attemptCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {mock.lastAttemptAt && (
                          <span className="text-xs text-muted-foreground">
                            Last: {formatDate(mock.lastAttemptAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 min-w-[100px]">
                      {mock.userStatus === "in_progress" && mock.inProgressAttemptId ? (
                        <Link href={`/mock-tests/${mock.id}?resume=${mock.inProgressAttemptId}`}>
                          <Button className="w-full gap-1">
                            <PlayCircle className="h-4 w-4" /> Resume
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/mock-tests/${mock.id}`}>
                          <Button className="w-full gap-1" variant={mock.userStatus === "completed" ? "outline" : "default"}>
                            {mock.userStatus === "completed" ? (
                              <><RotateCcw className="h-4 w-4" /> Retake</>
                            ) : (
                              <><PlayCircle className="h-4 w-4" /> Start Test</>
                            )}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
