import { useGetCurrentStudyPlan, useGetMyProfile, getGetMyProfileQueryKey, getGetCurrentStudyPlanQueryKey, getGetDailyTasksQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Sparkles, BookOpen, Clock, CalendarDays, RefreshCw, Lock,
  Sun, Moon, CheckCircle2, Lightbulb, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Target, Zap, TrendingUp, Settings,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfWeek } from "date-fns";
import { FREE_VISIBLE_PLAN_DAYS, usePlan } from "@/hooks/use-plan";
import UpgradeModal from "@/components/upgrade-modal";
import { useLocation } from "wouter";
import { isPreviewEnvironment } from "@/lib/app-auth";
import {
  createPreviewStudyPlan,
  readPreviewProfile,
  readPreviewStudyPlan,
  savePreviewStudyPlan,
} from "@/lib/preview-data";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  time: "Morning" | "Evening" | "Full Day";
  topic: string;
  subject: string;
  subject_code?: string;
  duration: number;
  tasks: string[];
  tip?: string;
}

interface DayEntry {
  date: string;
  day_name: string;
  day_type: "study" | "revision" | "mock_test" | "final_revision";
  days_left: number;
  sessions: Session[];
  _locked?: boolean;  // server sets this for free users on days 3+
}

interface SubjectEntry {
  name: string;
  subject_code: string | null;
  weightage_percent: number;
  recommended_hours: number;
  topic_count: number;
  allocated_study_days: number;
  start_date: string | null;
  end_date: string | null;
  topics: Array<{ name: string; priority: string; tip?: string }>;
}

interface FullPlanData {
  exam: string;
  plan_type?: string;
  days_remaining?: number;
  total_topics?: number;
  total_hours?: number;
  exam_date?: string;
  plan_start?: string;
  strategy?: string;
  subjects?: SubjectEntry[];
  daily_plan?: DayEntry[];
  // legacy
  total_weeks?: number;
  weekly_schedule?: Array<{ week: number; theme: string; days?: unknown[]; daily_tasks?: Record<string, unknown[]> }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
];

const DAY_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  study:          { label: "Study",          color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",     icon: <BookOpen className="w-3 h-3" /> },
  revision:       { label: "Revision",       color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", icon: <RefreshCw className="w-3 h-3" /> },
  mock_test:      { label: "Mock Test",      color: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300", icon: <Target className="w-3 h-3" /> },
  final_revision: { label: "Final Revision", color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",         icon: <Zap className="w-3 h-3" /> },
};

// ─── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({ session, colorClass }: { session: Session; colorClass: string }) {
  const isMorning  = session.time === "Morning";
  const isFullDay  = session.time === "Full Day";

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isFullDay ? <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
            : isMorning ? <Sun className="w-3.5 h-3.5 text-amber-500" />
              : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {session.time}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{session.duration}min</span>
        </div>
      </div>

      <div>
        <p className="font-semibold text-sm leading-tight">{session.topic}</p>
        <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-white ${colorClass}`}>
          {session.subject}
        </span>
      </div>

      {session.tasks.length > 0 && (
        <ul className="space-y-1">
          {session.tasks.map((task, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
              <span>{task}</span>
            </li>
          ))}
        </ul>
      )}

      {session.tip && session.tip !== `Focus: ${session.topic}` && (
        <div className="flex items-start gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{session.tip}</span>
        </div>
      )}
    </div>
  );
}

// ─── Day Card ──────────────────────────────────────────────────────────────────

function DayCard({
  entry,
  isToday,
  subjectColorMap,
}: {
  entry: DayEntry;
  isToday: boolean;
  subjectColorMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(isToday);
  const cfg = DAY_TYPE_CONFIG[entry.day_type] ?? DAY_TYPE_CONFIG.study;
  const dateObj = new Date(entry.date + "T00:00:00");

  return (
    <div className={`rounded-xl border overflow-hidden transition-shadow ${
      isToday ? "border-primary shadow-sm ring-1 ring-primary/30" : open ? "border-border/80 shadow-sm" : ""
    }`}>
      <button
        className={`w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors text-left ${
          isToday ? "bg-primary/5" : ""
        }`}
        onClick={() => setOpen(o => !o)}
      >
        {/* Date */}
        <div className={`shrink-0 w-10 text-center rounded-lg py-1 ${isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <div className="text-[10px] font-medium uppercase">{entry.day_name}</div>
          <div className="text-sm font-bold leading-none mt-0.5">{dateObj.getDate()}</div>
        </div>

        {/* Summary */}
        <div className="flex-1 min-w-0">
          {isToday && <span className="text-[10px] font-semibold text-primary uppercase tracking-wide mr-1.5">Today</span>}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.color}`}>
              {cfg.icon}{cfg.label}
            </span>
            {entry.sessions.slice(0, 2).map((s, i) => (
              <span key={i} className="text-xs text-muted-foreground truncate max-w-[150px]">{s.topic}</span>
            ))}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{entry.days_left}d left</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t bg-muted/20 p-3 space-y-2">
          {entry.sessions.map((session, i) => (
            <SessionCard
              key={i}
              session={session}
              colorClass={subjectColorMap[session.subject] ?? SUBJECT_COLORS[0]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Locked Day Card (free users, days 3+) ────────────────────────────────────

function LockedDayCard({ entry, isToday, onUpgrade }: {
  entry: DayEntry;
  isToday: boolean;
  onUpgrade: () => void;
}) {
  const dateObj = new Date(entry.date + "T00:00:00");
  const cfg = DAY_TYPE_CONFIG[entry.day_type] ?? DAY_TYPE_CONFIG.study;

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isToday ? "border-primary/40 ring-1 ring-primary/20" : "border-border/60"
    }`}>
      {/* Header row — same layout as DayCard but not clickable */}
      <div className="flex items-center gap-3 p-3 bg-muted/30">
        <div className="shrink-0 w-10 text-center rounded-lg py-1 bg-muted opacity-60">
          <div className="text-[10px] font-medium uppercase">{entry.day_name}</div>
          <div className="text-sm font-bold leading-none mt-0.5">{dateObj.getDate()}</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full opacity-50 ${cfg.color}`}>
              {cfg.icon}{cfg.label}
            </span>
            <span className="text-xs text-muted-foreground/60 italic">Content hidden</span>
          </div>
        </div>

        <div className="shrink-0 text-xs text-muted-foreground/60">{entry.days_left}d left</div>
      </div>

      {/* Upgrade prompt */}
      <div
        className="border-t bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
        onClick={onUpgrade}
      >
        <p className="text-xs text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
          <Lock className="w-3 h-3 shrink-0" />
          <span><span className="font-semibold">Pro only.</span> Upgrade to unlock your full personalised plan.</span>
        </p>
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 underline shrink-0 whitespace-nowrap">
          ₹129/mo →
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const { toast }   = useToast();
  const qc          = useQueryClient();
  const [, navigate] = useLocation();
  const [weekOffset, setWeekOffset]         = useState(0);
  const [isGenerating, setIsGenerating]     = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const preview = isPreviewEnvironment();

  const plan       = usePlan();
  const { data: profileData } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), enabled: !preview },
  });
  const previewProfile = useMemo(
    () => (preview ? readPreviewProfile() : undefined),
    [preview],
  );
  const profile = profileData ?? previewProfile;
  const { data: planResponse, isLoading } = useGetCurrentStudyPlan({
    query: { queryKey: getGetCurrentStudyPlanQueryKey(), enabled: !preview },
  });
  const [previewPlanResponse, setPreviewPlanResponse] = useState<any>(() => {
    if (!preview) return null;
    const saved = readPreviewStudyPlan();
    return saved ? { plan: saved.plan ?? saved } : null;
  });

  const currentPlan = preview
    ? previewPlanResponse?.plan ?? null
    : (planResponse as any)?.plan ?? null;
  const planData    = currentPlan?.planData as FullPlanData | undefined;

  // Subject → color map
  const subjectColorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    planData?.subjects?.forEach((s, i) => { map[s.name] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });
    return map;
  }, [planData?.subjects]);

  // Build daily index for fast lookup
  const dailyIndex = useMemo<Record<string, DayEntry>>(() => {
    const idx: Record<string, DayEntry> = {};
    const days = planData?.daily_plan;
    if (!days) return idx;

    const displayDays = plan.isPro
      ? days.map(({ _locked: _ignored, ...day }) => day)
      : days.map((day, index) => {
          if (index < FREE_VISIBLE_PLAN_DAYS) return day;
          return {
            date: day.date,
            day_name: day.day_name,
            day_type: day.day_type,
            days_left: day.days_left,
            sessions: [],
            _locked: true,
          };
        });

    for (const d of displayDays) idx[d.date] = d;
    return idx;
  }, [planData?.daily_plan, plan.isPro]);

  // Week days for calendar view
  const weekDays = useMemo(() => {
    const monday = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [weekOffset]);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getGetCurrentStudyPlanQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDailyTasksQueryKey({ date: todayStr }) });
  };

  // Track whether we already auto-triggered to avoid infinite loop
  const autoRegenTriggered = useRef(false);

  const callGenerate = async (force: boolean) => {
    if (force && !plan.canRegeneratePlan) { setShowUpgradeModal(true); return; }
    setIsGenerating(true);
    if (preview) {
      const generated = { plan: createPreviewStudyPlan(profile ?? readPreviewProfile()) };
      setPreviewPlanResponse(generated);
      savePreviewStudyPlan(generated);
      toast({ title: force ? "Preview plan regenerated!" : "Preview study plan generated!" });
      setIsGenerating(false);
      return;
    }
    try {
      const url  = force ? "/api/study-plans/generate?force=true" : "/api/study-plans/generate";
      const resp = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const code = (err as any).code;
        if (code === "NO_EXAM_DATE" || code === "EXAM_PASSED") {
          toast({ title: "Exam date needed", description: (err as any).error, variant: "destructive" });
          navigate("/settings");
          return;
        }
        throw new Error((err as any).error ?? "Failed");
      }
      toast({ title: force ? "Plan regenerated!" : "Study plan generated!" });
      invalidateAll();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-regen when saved plan is for a different exam than the profile
  useEffect(() => {
    if (preview || isLoading || isGenerating || autoRegenTriggered.current) return;
    if (!currentPlan || !profile) return;

    const planExam    = (currentPlan as any).examType as string | undefined;
    const profileExam = (profile as any).examType    as string | undefined;

    if (planExam && profileExam && planExam !== profileExam) {
      autoRegenTriggered.current = true;
      toast({
        title: "Exam changed — regenerating your plan",
        description: `Switching from ${planExam.replace(/_/g, " ")} to ${profileExam.replace(/_/g, " ")}…`,
      });
      // Force regenerate without the Pro gate — this is system-driven, not user-initiated
      setIsGenerating(true);
      fetch("/api/study-plans/generate?force=true", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      })
        .then(async r => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            const code = (err as any).code;
            if (code === "NO_EXAM_DATE" || code === "EXAM_PASSED") {
              toast({ title: "Exam date needed", description: (err as any).error, variant: "destructive" });
              navigate("/settings");
              return;
            }
            throw new Error((err as any).error ?? "Failed");
          }
          toast({ title: "New plan ready!", description: `Study plan for ${profileExam.replace(/_/g, " ")} generated.` });
          invalidateAll();
        })
        .catch((e: any) => {
          toast({ title: "Could not regenerate plan", description: "Please click the Regenerate button.", variant: "destructive" });
          autoRegenTriggered.current = false;
        })
        .finally(() => setIsGenerating(false));
    }
  }, [preview, isLoading, currentPlan, profile]);

  if (isLoading) return (
    <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded animate-pulse" />)}</div>
  );

  const isNewFormat = !!(planData?.daily_plan && planData.daily_plan.length > 0);

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!currentPlan || !planData) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} variant="study_plan" />
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <CalendarDays className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-2">No Study Plan Yet</h1>
        <p className="text-muted-foreground max-w-sm">
          AI will build a day-by-day plan from today to your exam date for{" "}
          <span className="font-semibold text-foreground">{profile?.examType?.replace(/_/g, " ") ?? "your exam"}</span>.
        </p>
        {!profile?.examDate && (
          <button
            className="mt-3 text-sm text-primary underline flex items-center gap-1 mx-auto"
            onClick={() => navigate("/settings")}
          >
            <Settings className="w-3.5 h-3.5" /> Set your exam date first
          </button>
        )}
      </div>
      <Button size="lg" onClick={() => callGenerate(false)} disabled={isGenerating} className="px-8">
        {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
        {isGenerating ? "Generating (~30s)..." : "Generate AI Study Plan"}
      </Button>
    </div>
  );

  // ── Compute stats ────────────────────────────────────────────────────────────
  const daysRemaining = planData.days_remaining ?? 0;
  const totalHours    = planData.total_hours ?? 0;
  const totalTopics   = planData.total_topics ?? 0;
  const planType      = planData.plan_type ?? "";
  const examName      = planData.exam?.replace(/_/g, " ") ?? "";
  const examDate      = planData.exam_date ?? "";
  const planStart     = planData.plan_start ?? "";

  let progressPercent = 0;
  if (planStart && examDate) {
    const totalDays = Math.max(1, Math.ceil((new Date(examDate).getTime() - new Date(planStart).getTime()) / 86_400_000));
    const daysPassed = Math.max(0, Math.ceil((new Date().getTime() - new Date(planStart).getTime()) / 86_400_000));
    progressPercent  = Math.min(100, Math.round((daysPassed / totalDays) * 100));
  }

  const planTypeColor = (planType.includes("Emergency") || planType.includes("Crash"))
    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
    : planType.includes("Intensive")
      ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";

  return (
    <div className="space-y-8">
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} variant="study_plan" />

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Study Planner</h1>
            {planType && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planTypeColor}`}>{planType}</span>
            )}
          </div>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{examName}</span>
            {examDate && <> · Exam: {format(new Date(examDate + "T00:00:00"), "dd MMM yyyy")}</>}
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => callGenerate(true)}
          disabled={isGenerating}
          className={!plan.canRegeneratePlan ? "opacity-75 shrink-0" : "shrink-0"}
        >
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : !plan.canRegeneratePlan ? <Lock className="mr-2 h-4 w-4" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
          {!plan.canRegeneratePlan ? "Regenerate (Pro)" : "Regenerate"}
        </Button>
      </div>

      {/* Exam change reminder */}
      <div style={{
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderLeft: '4px solid #3B82F6',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}>
        <span style={{ fontSize: '16px', lineHeight: '1.5' }}>ℹ️</span>
        <p style={{ margin: 0, color: '#1E40AF', fontSize: '14px', lineHeight: '1.5' }}>
          <strong>Changed your target exam or exam date?</strong><br />
          Click the <strong>"Regenerate"</strong> button above and refresh the page once to get your updated study plan.
        </p>
      </div>

      {!plan.canRegeneratePlan && (
        <div
          className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => setShowUpgradeModal(true)}
        >
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-400">
            <span className="font-semibold">Free plan:</span> Your first {FREE_VISIBLE_PLAN_DAYS} days are included.
            Upgrade to Pro to unlock the remaining plan and regenerate anytime.
            {" "}<span className="underline font-medium">Upgrade for ₹129/month →</span>
          </p>
        </div>
      )}

      {/* ── Stats + Countdown (new format only) ────────────────────────────── */}
      {isNewFormat && (
        <div className="space-y-4">
          {/* 4-stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Days Left",     value: daysRemaining, icon: <CalendarDays className="w-4 h-4 text-primary" />,    color: "text-primary" },
              { label: "Total Hours",   value: `${totalHours}h`, icon: <Clock className="w-4 h-4 text-emerald-500" />,    color: "text-emerald-600" },
              { label: "Topics",        value: totalTopics,   icon: <BookOpen className="w-4 h-4 text-violet-500" />,      color: "text-violet-600" },
              { label: "Subjects",      value: planData.subjects?.length ?? 0, icon: <TrendingUp className="w-4 h-4 text-amber-500" />, color: "text-amber-600" },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">{stat.icon}</div>
                  <div>
                    <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Countdown progress */}
          {planStart && examDate && (
            <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-transparent p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">
                  🔥 {daysRemaining} days to {examName}!
                </span>
                <span className="text-xs text-muted-foreground">{progressPercent}% elapsed</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>{planStart}</span>
                <span>Exam: {examDate}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Strategy ──────────────────────────────────────────────────────────── */}
      {planData.strategy && (
        <div className="flex gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
          <Target className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">
            <span className="font-semibold text-primary">Strategy: </span>{planData.strategy}
          </p>
        </div>
      )}

      {/* ── Subject Breakdown ─────────────────────────────────────────────────── */}
      {planData.subjects && planData.subjects.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Subject Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {planData.subjects.map((s, i) => (
              <Card key={i} className="overflow-hidden">
                <div className={`h-1.5 ${SUBJECT_COLORS[i % SUBJECT_COLORS.length]}`} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="font-semibold text-sm leading-tight">{s.name}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Weightage</span>
                      <span className="font-bold text-foreground">{s.weightage_percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${SUBJECT_COLORS[i % SUBJECT_COLORS.length]}`} style={{ width: `${Math.min(s.weightage_percent, 100)}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.recommended_hours}h</div>
                    <div className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{s.topic_count} topics</div>
                    {s.allocated_study_days > 0 && (
                      <div className="flex items-center gap-1 col-span-2"><CalendarDays className="w-3 h-3" />{s.allocated_study_days} study days</div>
                    )}
                  </div>

                  {s.start_date && s.end_date && (
                    <div className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
                      📅 {format(new Date(s.start_date + "T00:00:00"), "dd MMM")} → {format(new Date(s.end_date + "T00:00:00"), "dd MMM")}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Calendar View (new format) ─────────────────────────────────────────── */}
      {isNewFormat && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Daily Schedule</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(weekDays[0], "dd MMM")} – {format(weekDays[6], "dd MMM")}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setWeekOffset(0)}>
                  Today
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {weekDays.map(dayDate => {
              const dateStr = format(dayDate, "yyyy-MM-dd");
              const entry   = dailyIndex[dateStr];
              const isToday = dateStr === todayStr;

              if (!entry) {
                return (
                  <div key={dateStr} className={`rounded-xl border p-3 flex items-center gap-3 ${isToday ? "border-primary/40 bg-primary/5" : ""}`}>
                    <div className={`shrink-0 w-10 text-center rounded-lg py-1 ${isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="text-[10px] font-medium uppercase">{format(dayDate, "EEE")}</div>
                      <div className="text-sm font-bold leading-none mt-0.5">{dayDate.getDate()}</div>
                    </div>
                    <span className="text-sm text-muted-foreground italic">
                      {isToday ? "Today — not in plan range" : "Not in plan range"}
                    </span>
                  </div>
                );
              }

              if (entry._locked) {
                return (
                  <LockedDayCard
                    key={dateStr}
                    entry={entry}
                    isToday={isToday}
                    onUpgrade={() => setShowUpgradeModal(true)}
                  />
                );
              }

              return (
                <DayCard key={dateStr} entry={entry} isToday={isToday} subjectColorMap={subjectColorMap} />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legacy weekly_schedule fallback ──────────────────────────────────── */}
      {!isNewFormat && planData.weekly_schedule && planData.weekly_schedule.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Weekly Schedule</h2>
          <p className="text-sm text-muted-foreground mb-3">
            This plan uses the old format. Click <strong>Regenerate</strong> to get a day-by-day calendar.
          </p>
          <div className="space-y-3">
            {planData.weekly_schedule.map(week => (
              <Card key={week.week}>
                <CardContent className="p-4">
                  <div className="font-semibold">Week {week.week}: {week.theme}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
