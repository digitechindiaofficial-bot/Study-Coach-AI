import {
  useGetProgressSummary, useGetWeakAreas, useGetDailyStudyHours, useGetQuizStats, useGetStudyHeatmap,
  getGetProgressSummaryQueryKey, getGetWeakAreasQueryKey, getGetDailyStudyHoursQueryKey, getGetQuizStatsQueryKey, getGetStudyHeatmapQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Flame, BookOpen, BrainCircuit, Clock, AlertCircle, Sparkles, CalendarDays, Settings } from "lucide-react";
import { format, parseISO, startOfDay } from "date-fns";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ProgressPage() {
  const { data: summary, isLoading: summaryLoading } = useGetProgressSummary({ query: { queryKey: getGetProgressSummaryQueryKey() } });
  const { data: weakAreas = [], isLoading: weakAreasLoading } = useGetWeakAreas({ query: { queryKey: getGetWeakAreasQueryKey() } });
  const { data: dailyHours = [], isLoading: dailyHoursLoading } = useGetDailyStudyHours({ days: 14 }, { query: { queryKey: getGetDailyStudyHoursQueryKey({ days: 14 }) } });
  const { data: quizStats = [], isLoading: quizStatsLoading } = useGetQuizStats({ query: { queryKey: getGetQuizStatsQueryKey() } });
  const { data: heatmap = [], isLoading: heatmapLoading } = useGetStudyHeatmap({ query: { queryKey: getGetStudyHeatmapQueryKey() } });

  const isLoading = summaryLoading || weakAreasLoading || dailyHoursLoading || quizStatsLoading || heatmapLoading;

  const s = summary as any;
  const stats = [
    { label: "Day Streak", value: `${s?.streakCount ?? 0} 🔥`, icon: Flame, color: "text-amber-500", sub: `Best: ${s?.longestStreak ?? 0} days` },
    { label: "Tasks Completed", value: s?.totalTasksCompleted ?? 0, icon: TrendingUp, color: "text-primary", sub: "all time" },
    { label: "Syllabus Done", value: `${s?.syllabusCompletionPercent ?? 0}%`, icon: BookOpen, color: "text-green-600", sub: "of syllabus" },
    { label: "Quiz Accuracy", value: `${s?.avgQuizAccuracy ?? 0}%`, icon: BrainCircuit, color: "text-purple-600", sub: "overall" },
    { label: "Total Study Hours", value: `${s?.totalStudyHours ?? 0}h`, icon: Clock, color: "text-blue-600", sub: `${s?.studyHoursThisWeek ?? 0}h this week` },
    { label: "Tasks This Month", value: s?.topicsCompletedThisMonth ?? 0, icon: CalendarDays, color: "text-primary", sub: "last 30 days" },
  ];

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const chartData = (dailyHours as any[]).map((d: any) => ({
    rawDate: d.date,
    date: d.date ? format(parseISO(d.date), "d MMM") : d.date,
    hours: d.hours,
  }));

  const hasAnyActivity = (s?.totalTasksCompleted ?? 0) > 0 || (quizStats as any[]).length > 0 || chartData.some(d => d.hours > 0);

  // Build 7-column Mon-Sun calendar from heatmap data
  const heatmapDays = heatmap as any[];
  const calendarCells: (any | null)[] = [];
  if (heatmapDays.length > 0) {
    const firstDate = parseISO(heatmapDays[0].date);
    // getDay(): 0=Sun, 1=Mon ... convert to Mon=0, Sun=6
    const firstDayOfWeek = (firstDate.getDay() + 6) % 7;
    for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
    for (const day of heatmapDays) calendarCells.push(day);
  }

  const daysStudied = heatmapDays.filter(d => d.studied).length;
  const totalHoursThisMonth = heatmapDays.reduce((sum: number, d: any) => sum + (d.hoursStudied ?? 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[240px]" />
        <Skeleton className="h-[280px]" />
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
            <h3 className="text-lg font-bold mb-2">Start studying to see your progress!</h3>
            <p className="text-muted-foreground max-w-sm">Complete tasks in your study planner and take a few quizzes to see your progress here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats.map((st, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <st.icon className={`w-5 h-5 ${st.color}`}/>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-bold">{st.value}</div>
                    <div className="text-xs text-muted-foreground">{st.label}</div>
                    {st.sub && <div className="text-[11px] text-muted-foreground">{st.sub}</div>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Daily Study Hours Chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Daily Study Hours (Last 14 Days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={1}/>
                  <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]}/>
                  <Tooltip formatter={(v: any) => [`${v}h`, "Hours"]}/>
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.rawDate === todayStr ? "#d97706" : "#fbbf24"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 30-Day Activity Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500"/>
                Last 30 Days Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-[10px] text-muted-foreground font-medium">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((day, i) => {
                  if (day === null) {
                    return <div key={`pad-${i}`} className="aspect-square" />;
                  }
                  const isToday = day.date === todayStr;
                  const dayNum = parseInt(day.date.split("-")[2], 10);
                  return (
                    <div
                      key={day.date}
                      title={`${format(parseISO(day.date), "EEE, MMM d")}: ${day.tasksCompleted} task${day.tasksCompleted === 1 ? "" : "s"} · ${day.hoursStudied}h`}
                      className={[
                        "aspect-square rounded-sm flex items-center justify-center text-[10px] font-semibold cursor-default transition-all",
                        day.studied
                          ? "bg-green-500 text-white"
                          : "bg-muted text-muted-foreground",
                        isToday ? "ring-2 ring-offset-1 ring-primary" : "",
                      ].join(" ")}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-muted" /> Missed
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-green-500" /> Studied
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm ring-2 ring-primary bg-muted" /> Today
                </div>
              </div>

              {/* Month stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{daysStudied}<span className="text-sm font-normal text-muted-foreground">/{heatmapDays.length}</span></div>
                  <div className="text-xs text-muted-foreground">Days Studied</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-500">{s?.streakCount ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Current Streak</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">{s?.longestStreak ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Best Streak</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{Math.round(totalHoursThisMonth * 10) / 10}h</div>
                  <div className="text-xs text-muted-foreground">Hours This Month</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quiz performance & weak areas */}
          {(() => {
            const statList = quizStats as any[];
            const weakList = weakAreas as any[];
            const examCode: string | null = statList[0]?.examCode ?? null;
            const examLabel = examCode ? examCode.replace(/_/g, " ") : null;

            const noExamState = (
              <div className="text-center py-8 space-y-3">
                <Settings className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Set your target exam in Settings to see subject-wise performance.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/settings">Go to Settings</Link>
                </Button>
              </div>
            );

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quiz Performance by Subject */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Quiz Performance by Subject</CardTitle>
                      {examLabel && (
                        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                          {examLabel}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {statList.length === 0 ? noExamState : (
                      <div className="space-y-4">
                        {statList.map((st: any) => {
                          const name = st.subject ?? st.subjectCode ?? "Unknown";
                          const pct = st.accuracy ?? 0;
                          return (
                            <div key={st.subjectCode} className="space-y-1">
                              <div className="flex items-center justify-between text-sm gap-2">
                                <span className="font-medium truncate">{name}</span>
                                <span className={`font-bold shrink-0 tabular-nums ${pct >= 70 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                  {pct}%
                                </span>
                              </div>
                              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : pct > 0 ? "bg-red-500" : "bg-muted-foreground/20"}`}
                                  style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {st.totalQuestions} attempted · {st.questionsAvailable > 0 ? `${st.questionsAvailable} available` : "questions coming soon"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Weak Areas */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-destructive" />Weak Areas
                      </CardTitle>
                      {examLabel && (
                        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                          {examLabel}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {statList.length === 0 ? noExamState : weakList.length > 0 ? (
                      <div className="space-y-4">
                        {weakList.map((wa: any) => (
                          <div key={wa.topicCode} className="space-y-1">
                            <div className="flex items-start justify-between text-sm gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium leading-tight">{wa.topicName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{wa.subjectName}</p>
                              </div>
                              <span className="font-bold text-destructive shrink-0 tabular-nums">{wa.accuracy}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-destructive rounded-full"
                                style={{ width: `${Math.max(wa.accuracy, wa.accuracy > 0 ? 2 : 0)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {wa.attempts} attempted ·{" "}
                              {wa.accuracy === 0
                                ? "No correct answers yet!"
                                : wa.accuracy < 30
                                  ? "Needs urgent attention!"
                                  : "Keep practising to improve"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-2">
                        <BrainCircuit className="w-8 h-8 mx-auto text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground font-medium">Great job! No weak areas.</p>
                        <p className="text-xs text-muted-foreground">Keep practising! 🎉</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
