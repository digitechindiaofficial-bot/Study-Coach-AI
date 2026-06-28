import { useGetCurrentStudyPlan, useGetMyProfile, getGetMyProfileQueryKey, getGetCurrentStudyPlanQueryKey, getGetDailyTasksQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Sparkles, BookOpen, Clock, ChevronDown, ChevronUp, CalendarDays, AlertCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface Task { subject: string; topic: string; duration_minutes: number; type: string; }
interface WeekSchedule { week: number; theme: string; daily_tasks: Record<string, Task[]>; }
interface Subject { name: string; weightage_percent: number; recommended_hours: number; }
interface PlanData { exam: string; total_weeks: number; strategy: string; subjects?: Subject[]; weekly_schedule?: WeekSchedule[]; }

const DAY_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TASK_COLORS: Record<string, string> = { study:"bg-blue-500/10 text-blue-700 border-blue-200", revision:"bg-amber-500/10 text-amber-700 border-amber-200", quiz:"bg-purple-500/10 text-purple-700 border-purple-200" };

export default function PlannerPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedWeek, setExpandedWeek] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const { data: planResponse, isLoading } = useGetCurrentStudyPlan({ query: { queryKey: getGetCurrentStudyPlanQueryKey() } });

  const currentPlan = (planResponse as any)?.plan ?? null;
  const planData = currentPlan?.planData as PlanData | undefined;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getGetCurrentStudyPlanQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDailyTasksQueryKey({ date: format(new Date(), "yyyy-MM-dd") }) });
  };

  const callGenerate = async (force: boolean) => {
    setIsGenerating(true);
    try {
      const url = force ? "/api/study-plans/generate?force=true" : "/api/study-plans/generate";
      const resp = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Failed");
      }
      toast({ title: force ? "Study plan regenerated!" : "Study plan generated!" });
      invalidateAll();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="h-32 bg-muted rounded animate-pulse"/>)}</div>;

  if (!currentPlan || !planData) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <CalendarDays className="w-10 h-10 text-primary"/>
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-3">No Study Plan Yet</h1>
        <p className="text-muted-foreground max-w-md text-lg">Let AI create a personalized plan for {profile?.examType?.replace(/_/g,' ')}.</p>
      </div>
      <Button size="lg" onClick={() => callGenerate(false)} disabled={isGenerating} className="px-8">
        {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Sparkles className="mr-2 h-5 w-5"/>}
        {isGenerating ? "Generating (~30s)..." : "Generate AI Study Plan"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Planner</h1>
          <p className="text-muted-foreground mt-1">AI-generated {planData.total_weeks}-week plan for {planData.exam?.replace(/_/g,' ')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => callGenerate(true)} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
          Regenerate
        </Button>
      </div>

      {planData.strategy && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5"/>
            <p className="text-sm leading-relaxed"><span className="font-semibold text-primary">Strategy: </span>{planData.strategy}</p>
          </CardContent>
        </Card>
      )}

      {planData.subjects && planData.subjects.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Subject Breakdown</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {planData.subjects.map((s,i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3"><BookOpen className="w-4 h-4 text-primary"/><span className="font-semibold text-sm truncate">{s.name}</span></div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground"><span>Weightage</span><span className="font-bold text-foreground">{s.weightage_percent}%</span></div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{width:`${s.weightage_percent}%`}}/></div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3"/><span>{s.recommended_hours}h recommended</span></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {planData.weekly_schedule && planData.weekly_schedule.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Weekly Schedule</h2>
          <div className="space-y-4">
            {planData.weekly_schedule.map(week => (
              <Card key={week.week} className={expandedWeek===week.week?"border-primary/40":""}>
                <CardHeader className="cursor-pointer py-4" onClick={()=>setExpandedWeek(expandedWeek===week.week?0:week.week)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">W{week.week}</div>
                      <div><CardTitle className="text-base">Week {week.week}</CardTitle><CardDescription className="text-xs">{week.theme}</CardDescription></div>
                    </div>
                    {expandedWeek===week.week?<ChevronUp className="w-5 h-5 text-muted-foreground"/>:<ChevronDown className="w-5 h-5 text-muted-foreground"/>}
                  </div>
                </CardHeader>
                {expandedWeek===week.week && (
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                      {DAY_ORDER.map(day => {
                        const dayTasks = week.daily_tasks?.[day]??[];
                        return (
                          <div key={day} className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">{day.slice(0,3)}</p>
                            {dayTasks.length===0?<div className="text-xs text-muted-foreground italic">Rest</div>:dayTasks.map((t,i)=>(
                              <div key={i} className={`text-xs p-2 rounded-md border ${TASK_COLORS[t.type]??"bg-muted/50 border-border"}`}>
                                <div className="font-medium line-clamp-1">{t.topic}</div>
                                <div className="text-[10px] opacity-75 mt-0.5">{t.subject}•{t.duration_minutes}m</div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
