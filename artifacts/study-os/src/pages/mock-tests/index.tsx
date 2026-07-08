import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, Clock, Target, Trophy, ChevronRight, Loader2,
  CheckCircle2, PlayCircle, Circle, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  description: string | null;
  mockType: string;
  timeLimitMinutes: number;
  difficulty: string;
  totalMarks: number;
  version: number;
  sections: MockSection[];
  status: "not_started" | "in_progress" | "completed";
  inProgressAttemptId: string | null;
  bestScore: number | null;
  bestAccuracy: number | null;
  attemptCount: number;
}

const MOCK_TYPE_LABELS: Record<string, string> = {
  FULL_MOCK: "Full Mock",
  SUBJECT_TEST: "Subject Test",
  TOPIC_TEST: "Topic Test",
  PYQ_TEST: "PYQ Test",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
  mixed: "bg-blue-100 text-blue-700",
};

function StatusBadge({ status }: { status: MockTest["status"] }) {
  if (status === "completed")
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </Badge>
    );
  if (status === "in_progress")
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
        <PlayCircle className="h-3 w-3" /> In Progress
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <Circle className="h-3 w-3" /> Not Started
    </Badge>
  );
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function MockTestListPage() {
  const [mocks, setMocks] = useState<MockTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mock-tests", { credentials: "include", headers: { "Cache-Control": "no-cache" } })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setMocks)
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary" />
          Mock Tests
        </h1>
        <p className="text-muted-foreground mt-1">
          Full-length mock tests with timer, question palette, and detailed analytics.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-destructive text-sm">{error}</CardContent>
        </Card>
      )}

      {!isLoading && mocks.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="py-20 flex flex-col items-center text-center gap-3">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-foreground">No mock tests available yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Your admin will add mock tests for your exam soon.
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
              mock.status === "completed" && "border-green-200",
              mock.status === "in_progress" && "border-blue-200",
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {MOCK_TYPE_LABELS[mock.mockType] ?? mock.mockType}
                    </Badge>
                    <Badge className={cn("text-xs capitalize", DIFFICULTY_COLORS[mock.difficulty] ?? "bg-muted")}>
                      {mock.difficulty}
                    </Badge>
                    <span className="text-xs text-muted-foreground">v{mock.version}</span>
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
                      {mock.sections.length > 0 && ` • ${mock.sections.length} sections`}
                    </span>
                  </div>

                  {mock.sections.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {mock.sections.map((s) => (
                        <span
                          key={s.id}
                          className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                        >
                          {s.name} ({s.questionCount}Q)
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap pt-1">
                    <StatusBadge status={mock.status} />
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
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {mock.status === "in_progress" && mock.inProgressAttemptId ? (
                    <Link href={`/mock-tests/${mock.id}?resume=${mock.inProgressAttemptId}`}>
                      <Button className="w-full gap-1">
                        <PlayCircle className="h-4 w-4" /> Resume
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/mock-tests/${mock.id}`}>
                      <Button className="w-full gap-1" variant={mock.status === "completed" ? "outline" : "default"}>
                        {mock.status === "completed" ? (
                          <><RotateCcw className="h-4 w-4" /> Retake</>
                        ) : (
                          <><PlayCircle className="h-4 w-4" /> Start Test</>
                        )}
                      </Button>
                    </Link>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground mx-auto opacity-0" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
