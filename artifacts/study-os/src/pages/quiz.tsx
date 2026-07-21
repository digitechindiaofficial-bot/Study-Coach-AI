import {
  useGetQuizStats,
  useGetSyllabus,
  useGetMyProfile,
  getGetQuizStatsQueryKey,
  getGetSyllabusQueryKey,
  getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Zap, Target, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function QuizHomePage() {
  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), staleTime: 30_000 },
  });

  const examCode = (profile as any)?.examType ?? null;

  const { data: syllabusData = [] } = useGetSyllabus({
    query: { queryKey: getGetSyllabusQueryKey(), staleTime: 5 * 60_000 },
  });

  const { data: stats = [] } = useGetQuizStats(
    { params: { query: { examCode: examCode ?? undefined } } },
    { query: { queryKey: getGetQuizStatsQueryKey(), enabled: !!profile } },
  );

  // Exam subjects from syllabus — shown as practice cards
  const examData = (syllabusData as any[]).find((e: any) => e.code === examCode);
  const syllabusSubjects: Array<{ id: string; name: string; subjectCode: string }> =
    examData?.subjects ?? [];

  // Fallback subjects shown when no syllabus is loaded yet
  const FALLBACK_SUBJECTS = [
    { id: "qa",       name: "Quantitative Aptitude", subjectCode: "QA" },
    { id: "reas",     name: "Reasoning",             subjectCode: "REASONING" },
    { id: "eng",      name: "English",               subjectCode: "ENGLISH" },
    { id: "ga",       name: "General Awareness",     subjectCode: "GA" },
    { id: "comp",     name: "Computer Awareness",    subjectCode: "COMPUTER" },
  ];

  const subjects = syllabusSubjects.length > 0 ? syllabusSubjects : FALLBACK_SUBJECTS;

  // Map stats by subjectCode and by name for quick lookup
  const statsByCode = new Map((stats as any[]).map((s: any) => [s.subjectCode, s]));
  const statsByName = new Map((stats as any[]).map((s: any) => [s.subject, s]));

  const getStat = (sub: { name: string; subjectCode: string }) =>
    statsByCode.get(sub.subjectCode) ?? statsByName.get(sub.name) ?? null;

  const totalAttempts = (stats as any[]).reduce(
    (sum: number, s: any) => sum + (s.totalQuestions ?? 0),
    0,
  );
  const avgAccuracy =
    (stats as any[]).length > 0
      ? Math.round(
          (stats as any[]).reduce((sum: number, s: any) => sum + (s.accuracy ?? 0), 0) /
            (stats as any[]).length,
        )
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-primary" />
          Quiz Practice
        </h1>
        <p className="text-muted-foreground mt-1">
          Practice questions by subject and topic. Track your accuracy. Identify weak areas.
        </p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalAttempts}</div>
              <div className="text-xs text-muted-foreground">Total Attempts</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{avgAccuracy}%</div>
              <div className="text-xs text-muted-foreground">Avg Accuracy</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{(stats as any[]).length}</div>
              <div className="text-xs text-muted-foreground">Subjects Practised</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick start */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg">Quick Practice</h3>
            <p className="text-muted-foreground text-sm">
              Mixed questions from all subjects
            </p>
          </div>
          <Link href="/quiz/all">
            <Button size="lg">
              <Zap className="mr-2 w-4 h-4" />
              Start Now
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* By subject — dynamic from exam syllabus, with fallback */}
      <div>
        <h2 className="text-xl font-bold mb-4">Practice by Subject</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subjects.map(sub => {
            const stat = getStat(sub) as any;
            const accuracy = stat?.accuracy ?? 0;
            return (
              <Card key={sub.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1 truncate">{sub.name}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">Practice</Badge>
                      {stat && (
                        <span className="text-xs text-muted-foreground">
                          Accuracy:{" "}
                          <span
                            className={
                              accuracy >= 70
                                ? "text-green-600"
                                : accuracy >= 50
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }
                          >
                            {accuracy}%
                          </span>
                        </span>
                      )}
                    </div>
                    {stat && (
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full ${accuracy >= 70 ? "bg-green-500" : accuracy >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${accuracy}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <Link href={`/quiz/${encodeURIComponent(sub.subjectCode)}`}>
                    <Button size="sm" className="shrink-0">
                      Start Quiz
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Weak area drill */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weak Area Drill</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            AI picks questions from your lowest-accuracy topics
          </p>
          <Link href="/quiz/weak">
            <Button variant="secondary">
              <Target className="mr-2 w-4 h-4" />
              Start Drill
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
