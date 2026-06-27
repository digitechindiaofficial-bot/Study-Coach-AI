import {
  useGetProgressSummary, useGetWeakAreas, useGetDailyStudyHours, useGetQuizStats,
  getGetProgressSummaryQueryKey, getGetWeakAreasQueryKey, getGetDailyStudyHoursQueryKey, getGetQuizStatsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Flame, BookOpen, BrainCircuit, Clock, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function ProgressPage() {
  const { data: summary } = useGetProgressSummary({ query: { queryKey: getGetProgressSummaryQueryKey() } });
  const { data: weakAreas = [] } = useGetWeakAreas({ query: { queryKey: getGetWeakAreasQueryKey() } });
  const { data: dailyHours = [] } = useGetDailyStudyHours({ days: 14 }, { query: { queryKey: getGetDailyStudyHoursQueryKey({ days: 14 }) } });
  const { data: quizStats = [] } = useGetQuizStats({ query: { queryKey: getGetQuizStatsQueryKey() } });

  const s = summary as any;
  const stats = [
    { label: "Day Streak", value: `${s?.streakCount ?? 0} 🔥`, icon: Flame, color: "text-amber-500" },
    { label: "Tasks Completed", value: s?.totalTasksCompleted ?? 0, icon: TrendingUp, color: "text-primary" },
    { label: "Syllabus Done", value: `${s?.syllabusCompletionPercent ?? 0}%`, icon: BookOpen, color: "text-green-600" },
    { label: "Quiz Accuracy", value: `${s?.avgQuizAccuracy ?? 0}%`, icon: BrainCircuit, color: "text-purple-600" },
    { label: "Study Hours (wk)", value: `${s?.studyHoursThisWeek ?? 0}h`, icon: Clock, color: "text-blue-600" },
    { label: "Topics This Month", value: s?.topicsCompletedThisMonth ?? 0, icon: TrendingUp, color: "text-primary" },
  ];

  const chartData = (dailyHours as any[]).map((d: any) => ({
    date: d.date ? format(parseISO(d.date), "d MMM") : d.date,
    hours: d.hours,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-primary"/>
          Progress Tracker
        </h1>
        <p className="text-muted-foreground mt-1">Your performance at a glance.</p>
      </div>

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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daily Study Hours (Last 14 Days)</CardTitle></CardHeader>
        <CardContent>
          {chartData.some(d => d.hours > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={1}/>
                <YAxis tick={{ fontSize: 10 }}/>
                <Tooltip formatter={(v: any) => `${v}h`}/>
                <Bar dataKey="hours" fill="#4f46e5" radius={[4, 4, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No study hours recorded yet. Complete tasks to see your chart.
            </div>
          )}
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
    </div>
  );
}
