import {
  useGetProgressSummary, useGetWeakAreas, useGetDailyStudyHours, useGetQuizStats, useGetStudyHeatmap,
  getGetProgressSummaryQueryKey, getGetWeakAreasQueryKey, getGetDailyStudyHoursQueryKey, getGetQuizStatsQueryKey, getGetStudyHeatmapQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Flame, BookOpen, BrainCircuit, Clock, AlertCircle, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function ProgressPage() {
  const { data: summary, isLoading: summaryLoading } = useGetProgressSummary({ query: { queryKey: getGetProgressSummaryQueryKey() } });
  const { data: weakAreas = [], isLoading: weakAreasLoading } = useGetWeakAreas({ query: { queryKey: getGetWeakAreasQueryKey() } });
  const { data: dailyHours = [], isLoading: dailyHoursLoading } = useGetDailyStudyHours({ days: 14 }, { query: { queryKey: getGetDailyStudyHoursQueryKey({ days: 14 }) } });
  const { data: quizStats = [], isLoading: quizStatsLoading } = useGetQuizStats({ query: { queryKey: getGetQuizStatsQueryKey() } });
  const { data: heatmap = [], isLoading: heatmapLoading } = useGetStudyHeatmap({ query: { queryKey: getGetStudyHeatmapQueryKey() } });

  const isLoading = summaryLoading || weakAreasLoading || dailyHoursLoading || quizStatsLoading || heatmapLoading;

  const s = summary as any;
  const stats = [
    { label: "Day Streak", value: `${s?.streakCount ?? 0} 🔥`, icon: Flame, color: "text-amber-500" },
    { label: "Tasks Completed", value: s?.totalTasksCompleted ?? 0, icon: TrendingUp, color: "text-primary" },
    { label: "Syllabus Done", value: `${s?.syllabusCompletionPercent ?? 0}%`, icon: BookOpen, color: "text-green-600" },
    { label: "Quiz Accuracy", value: `${s?.avgQuizAccuracy ?? 0}%`, icon: BrainCircuit, color: "text-purple-600" },
    { label: "Study Hours (wk)", value: `${s?.studyHoursThisWeek ?? 0}h`, icon: Clock, color: "text-blue-600" },
    { label: "Topics This Month", value: s?.topicsCompletedThisMonth ?? 0, icon: TrendingUp, color: "text-primary" },
  ];

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const chartData = (dailyHours as any[]).map((d: any) => ({
    rawDate: d.date,
    date: d.date ? format(parseISO(d.date), "d MMM") : d.date,
    hours: d.hours,
  }));

  const hasAnyActivity = (s?.totalTasksCompleted ?? 0) > 0 || (quizStats as any[]).length > 0 || chartData.some(d => d.hours > 0);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-[240px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-primary"/>
          Progress Tracker
        </h1>
        <p className="text-muted-foreground mt-1">Your performance at a glance.</p>
      </div>

      {!hasAnyActivity ? (
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-2">No data yet — start studying!</h3>
            <p className="text-muted-foreground max-w-sm">Complete tasks in your study planner and take a few quizzes to see your progress here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats.map((st, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <st.icon className={`w-5 h-5 ${st.color}`}/>
                  </div>
                  <div>
                    <div className="text-xl font-bold">{st.value}</div>
                    <div className="text-xs text-muted-foreground">{st.label}</div>
                    {st.label === "Day Streak" && (
                      <div className="text-[11px] text-muted-foreground">Best: {s?.longestStreak ?? 0} days</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Daily Study Hours (Last 14 Days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={1}/>
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 10]}/>
                  <Tooltip formatter={(v: any) => `${v}h`}/>
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.rawDate === todayStr ? "#d97706" : "#fbbf24"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500"/>Last 30 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-10 gap-1.5">
                {(heatmap as any[]).map((day: any) => (
                  <div
                    key={day.date}
                    title={`${format(parseISO(day.date), "MMM d")}: ${day.tasksCompleted} task${day.tasksCompleted === 1 ? "" : "s"} completed`}
                    className={`aspect-square rounded-sm ${day.studied ? "bg-green-500" : "bg-muted"}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-muted" /> Missed
                <div className="w-3 h-3 rounded-sm bg-green-500 ml-3" /> Studied
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Quiz Performance by Subject</CardTitle></CardHeader>
              <CardContent>
                {(quizStats as any[]).length > 0 ? (
                  <div className="space-y-3">
                    {(quizStats as any[]).map((st: any) => (
                      <div key={st.subject} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium truncate pr-2">{st.subject}</span>
                          <span className={`font-bold ${st.accuracy >= 70 ? "text-green-600" : st.accuracy >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {st.accuracy}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${st.accuracy >= 70 ? "bg-green-500" : st.accuracy >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${st.accuracy}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">Take some quizzes to see your performance.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive"/>Weak Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(weakAreas as any[]).length > 0 ? (
                  <div className="space-y-3">
                    {(weakAreas as any[]).map((wa: any, i: number) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium">{wa.topic}</span>
                            <span className="text-xs text-muted-foreground ml-1">({wa.subject})</span>
                          </div>
                          <span className="font-bold text-destructive">{wa.accuracy}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-destructive rounded-full" style={{ width: `${wa.accuracy}%` }}/>
                        </div>
                        <p className="text-xs text-muted-foreground">{wa.attempts} attempts</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">No weak areas detected yet.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
