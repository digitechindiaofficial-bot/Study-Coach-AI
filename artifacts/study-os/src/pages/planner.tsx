import { useGetCurrentStudyPlan, useGetMyProfile, getGetMyProfileQueryKey, getGetCurrentStudyPlanQueryKey, getGetDailyTasksQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, BookOpen, Clock, ChevronDown, ChevronUp, CalendarDays, AlertCircle, RefreshCw, Lock, Sun, Moon, CheckCircle2, Lightbulb, Target } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { usePlan } from "@/hooks/use-plan";
import UpgradeModal from "@/components/upgrade-modal";

interface SessionTask { time: "Morning" | "Evening"; topic: string; subject: string; duration: number; tasks: string[]; tip?: string; }
interface DaySchedule { day: string; sessions: SessionTask[]; }
interface WeekSchedule { week: number; theme: string; days?: DaySchedule[]; daily_tasks?: Record<string, Array<{ subject: string; topic: string; duration_minutes: number; type: string }>>; }
interface SubjectPlan { name: string; weightage_percent: number; recommended_hours: number; topic_count?: number; topics?: Array<{ name: string; priority: string; week_number: number }>; }
interface PlanData { exam: string; total_weeks: number; strategy: string; subjects?: SubjectPlan[]; weekly_schedule?: WeekSchedule[]; }

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT: Record<string, string> = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };

const SUBJECT_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
];

function SessionCard({ session, colorClass }: { session: SessionTask; colorClass: string }) {
  const isMorning = session.time === "Morning";
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isMorning
            ? <Sun className="w-3.5 h-3.5 text-amber-500" />
            : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{session.time}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{session.duration}min</span>
        </div>
      </div>

      <div>
        <p className="font-semibold text-sm leading-tight">{session.topic}</p>
        <div className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-xs font-medium text-white ${colorClass}`}>
          {session.subject}
        </div>
      </div>

      {session.tasks && session.tasks.length > 0 && (
        <ul className="space-y-1">
          {session.tasks.map((task, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
              <span>{task}</span>
            </li>
          ))}
        </ul>
      )}

      {session.tip && (
        <div className="flex items-start gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{session.tip}</span>
        </div>
      )}
    </div>
  );
}

function DayCard({ dayObj, subjectColorMap }: { dayObj: DaySchedule; subjectColorMap: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const hasSessions = dayObj.sessions && dayObj.sessions.length > 0;
  const isRestDay = !hasSessions;

  return (
    <div className={`rounded-lg border ${open ? "border-primary/40 shadow-sm" : ""} overflow-hidden`}>
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
        disabled={isRestDay}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold w-8 text-muted-foreground">{DAY_SHORT[dayObj.day] ?? dayObj.day}</span>
          {isRestDay ? (
            <span className="text-xs text-muted-foreground italic">Rest day</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {dayObj.sessions.map((s, i) => (
                <span key={i} className="text-xs truncate max-w-[120px]">{s.topic}</span>
              )).reduce((acc: React.ReactNode[], el, i, arr) => {
                acc.push(el);
                if (i < arr.length - 1) acc.push(<span key={`sep-${i}`} className="text-muted-foreground">·</span>);
                return acc;
              }, [])}
            </div>
          )}
        </div>
        {!isRestDay && (
          open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && hasSessions && (
        <div className="px-3 pb-3 space-y-2 border-t bg-muted/20">
          <div className="pt-3 space-y-2">
            {dayObj.sessions.map((session, i) => (
              <SessionCard
                key={i}
                session={session}
                colorClass={subjectColorMap[session.subject] ?? SUBJECT_COLORS[0]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LegacyDayCard({ dayName, tasks, subjectColorMap }: { dayName: string; tasks: Array<{ subject: string; topic: string; duration_minutes: number; type: string }>; subjectColorMap: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border p-3 flex items-center gap-2">
        <span className="text-xs font-bold w-8 text-muted-foreground">{DAY_SHORT[dayName] ?? dayName}</span>
        <span className="text-xs text-muted-foreground italic">Rest day</span>
      </div>
    );
  }
  return (
    <div className={`rounded-lg border ${open ? "border-primary/40" : ""} overflow-hidden`}>
      <button className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold w-8 text-muted-foreground">{DAY_SHORT[dayName] ?? dayName}</span>
          <span className="text-xs">{tasks[0].topic}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t bg-muted/20 pt-3">
          {tasks.map((t, i) => (
            <div key={i} className="rounded-lg border bg-card p-3 space-y-1">
              <p className="font-semibold text-sm">{t.topic}</p>
              <div className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium text-white ${subjectColorMap[t.subject] ?? SUBJECT_COLORS[0]}`}>{t.subject}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1"><Clock className="w-3 h-3" />{t.duration_minutes}min</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlannerPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedWeek, setExpandedWeek] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const plan = usePlan();
  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const { data: planResponse, isLoading } = useGetCurrentStudyPlan({ query: { queryKey: getGetCurrentStudyPlanQueryKey() } });

  const currentPlan = (planResponse as any)?.plan ?? null;
  const planData = currentPlan?.planData as PlanData | undefined;

  const subjectColorMap: Record<string, string> = {};
  planData?.subjects?.forEach((s, i) => {
    subjectColorMap[s.name] = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getGetCurrentStudyPlanQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDailyTasksQueryKey({ date: format(new Date(), "yyyy-MM-dd") }) });
  };

  const callGenerate = async (force: boolean) => {
    if (force && !plan.canRegeneratePlan) { setShowUpgradeModal(true); return; }
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

  if (isLoading) return (
    <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded animate-pulse" />)}</div>
  );

  if (!currentPlan || !planData) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} variant="study_plan" />
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <CalendarDays className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-3">No Study Plan Yet</h1>
        <p className="text-muted-foreground max-w-md text-lg">
          Let AI create a topic-by-topic plan for {profile?.examType?.replace(/_/g, " ")}.
        </p>
      </div>
      <Button size="lg" onClick={() => callGenerate(false)} disabled={isGenerating} className="px-8">
        {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
        {isGenerating ? "Generating (~30s)..." : "Generate AI Study Plan"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-8">
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} variant="study_plan" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Planner</h1>
          <p className="text-muted-foreground mt-1">
            AI-generated {planData.total_weeks}-week plan for{" "}
            <span className="font-semibold text-foreground">{planData.exam?.replace(/_/g, " ")}</span>
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => callGenerate(true)}
          disabled={isGenerating}
          className={!plan.canRegeneratePlan ? "opacity-75" : ""}
        >
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : !plan.canRegeneratePlan ? <Lock className="mr-2 h-4 w-4" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
          {!plan.canRegeneratePlan ? "Regenerate (Pro)" : "Regenerate"}
        </Button>
      </div>

      {!plan.canRegeneratePlan && (
        <div
          className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
          onClick={() => setShowUpgradeModal(true)}
        >
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-400">
            <span className="font-semibold">Free plan:</span> Your plan is fixed. Upgrade to Pro to regenerate anytime.
            {" "}<span className="underline font-medium">Upgrade for ₹199/month →</span>
          </p>
        </div>
      )}

      {/* Strategy */}
      {planData.strategy && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex gap-3">
            <Target className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              <span className="font-semibold text-primary">Strategy: </span>{planData.strategy}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Subject Breakdown */}
      {planData.subjects && planData.subjects.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Subject Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {planData.subjects.map((s, i) => (
              <Card key={i} className="overflow-hidden">
                <div className={`h-1 ${SUBJECT_COLORS[i % SUBJECT_COLORS.length]}`} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="font-semibold text-sm leading-tight">{s.name}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Weightage</span>
                      <span className="font-bold text-foreground">{s.weightage_percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${SUBJECT_COLORS[i % SUBJECT_COLORS.length]}`} style={{ width: `${Math.min(s.weightage_percent, 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span>{s.recommended_hours}h</span></div>
                    {s.topic_count != null && s.topic_count > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{s.topic_count} topics</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Schedule */}
      {planData.weekly_schedule && planData.weekly_schedule.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Weekly Schedule</h2>
          <div className="space-y-4">
            {planData.weekly_schedule.map(week => {
              const isExpanded = expandedWeek === week.week;
              return (
                <Card key={week.week} className={isExpanded ? "border-primary/40 shadow-sm" : ""}>
                  <CardHeader
                    className="cursor-pointer py-4"
                    onClick={() => setExpandedWeek(isExpanded ? 0 : week.week)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          W{week.week}
                        </div>
                        <div>
                          <CardTitle className="text-base">Week {week.week}</CardTitle>
                          <CardDescription className="text-xs">{week.theme}</CardDescription>
                        </div>
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      {/* New session-based format */}
                      {week.days && week.days.length > 0 ? (
                        <div className="space-y-2">
                          {DAY_ORDER.map(dayName => {
                            const dayObj = week.days!.find(d => d.day === dayName);
                            if (!dayObj) return (
                              <div key={dayName} className="rounded-lg border p-3 flex items-center gap-2">
                                <span className="text-xs font-bold w-8 text-muted-foreground">{DAY_SHORT[dayName]}</span>
                                <span className="text-xs text-muted-foreground italic">Rest day</span>
                              </div>
                            );
                            return (
                              <DayCard key={dayName} dayObj={dayObj} subjectColorMap={subjectColorMap} />
                            );
                          })}
                        </div>
                      ) : week.daily_tasks ? (
                        /* Legacy flat format */
                        <div className="space-y-2">
                          {DAY_ORDER.map(dayName => (
                            <LegacyDayCard
                              key={dayName}
                              dayName={dayName}
                              tasks={week.daily_tasks![dayName] ?? []}
                              subjectColorMap={subjectColorMap}
                            />
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
