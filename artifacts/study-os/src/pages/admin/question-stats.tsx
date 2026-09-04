import { useEffect, useState } from "react";
import { adminFetch as fetch } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, BookOpen, Database, Layers, AlertTriangle,
  ChevronDown, ChevronRight, Plus, RefreshCw, Loader2,
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExamStat {
  exam_code: string;
  total: number;
  subjects: SubjectStat[];
}

interface SubjectStat {
  subject_code: string;
  count: number;
  difficulty: { easy: number; medium: number; hard: number };
}

interface QuestionStats {
  total: number;
  exam_count: number;
  subject_count: number;
  avg_per_subject: number;
  exams: ExamStat[];
  subjects_with_zero: Array<{ exam_code: string; subject_code: string; subject_name: string }>;
}

// ─── Exam colour palette ──────────────────────────────────────────────────────

const EXAM_COLORS: Record<string, string> = {
  BPSC:       "bg-blue-500",
  UPPSC:      "bg-violet-500",
  SSC_CGL:    "bg-emerald-500",
  SSC_CHSL:   "bg-teal-500",
  IBPS_PO:    "bg-amber-500",
  IBPS_CLERK: "bg-orange-500",
  SBI_PO:     "bg-pink-500",
  SBI_CLERK:  "bg-rose-500",
  RRB_NTPC:   "bg-cyan-500",
};

const examColor = (code: string) => EXAM_COLORS[code] ?? "bg-slate-500";

// ─── Difficulty bar ───────────────────────────────────────────────────────────

function DifficultyBar({ easy, medium, hard }: { easy: number; medium: number; hard: number }) {
  const total = easy + medium + hard;
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <div className="space-y-1">
      {[
        { label: "Easy",   val: easy,   pct: pct(easy),   color: "bg-emerald-500" },
        { label: "Medium", val: medium, pct: pct(medium), color: "bg-amber-500" },
        { label: "Hard",   val: hard,   pct: pct(hard),   color: "bg-red-500" },
      ].map(row => (
        <div key={row.label} className="flex items-center gap-2 text-xs">
          <span className="w-12 text-muted-foreground shrink-0">{row.label}</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${row.color} rounded-full`} style={{ width: `${row.pct}%` }} />
          </div>
          <span className="w-10 text-right text-muted-foreground">{row.pct}% <span className="text-[10px]">({row.val})</span></span>
        </div>
      ))}
    </div>
  );
}

// ─── Exam accordion row ───────────────────────────────────────────────────────

function ExamRow({ exam, maxTotal }: { exam: ExamStat; maxTotal: number }) {
  const [open, setOpen] = useState(false);
  const pct = maxTotal > 0 ? Math.round((exam.total / maxTotal) * 100) : 0;
  const color = examColor(exam.exam_code);
  const isEmpty = exam.total === 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className={`w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors text-left ${isEmpty ? "opacity-60" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        <div className={`w-2 h-8 rounded-full shrink-0 ${color}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{exam.exam_code.replace(/_/g, " ")}</span>
            {isEmpty && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded">
                <AlertTriangle className="w-2.5 h-2.5" /> No questions
              </span>
            )}
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-bold text-base">{exam.total.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">{exam.subjects.length} subjects</div>
        </div>

        {open ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t bg-muted/20 divide-y">
          {exam.subjects.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No subject data</div>
          ) : (
            exam.subjects.map(sub => {
              const subPct = exam.total > 0 ? Math.round((sub.count / exam.total) * 100) : 0;
              const subEmpty = sub.count === 0;
              return (
                <div key={sub.subject_code} className={`p-3 ${subEmpty ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{sub.subject_code}</span>
                      {subEmpty && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-2.5 h-2.5" /> 0 questions
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{sub.count}</span>
                      <span className="text-xs text-muted-foreground">({subPct}%)</span>
                      {subEmpty && (
                        <Link href="/admin/question-bank">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-red-300 text-red-600 hover:bg-red-50">
                            <Plus className="w-2.5 h-2.5 mr-1" /> Upload
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-2">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${subPct}%` }} />
                  </div>
                  <DifficultyBar {...sub.difficulty} />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminQuestionStatsPage() {
  const [stats, setStats]       = useState<QuestionStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/question-stats", { credentials: "include" });
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      setStats(await resp.json());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const maxTotal = stats ? Math.max(...stats.exams.map(e => e.total), 1) : 1;

  // Aggregate difficulty across all exams for the overview chart
  const globalDiff = stats?.exams.reduce(
    (acc, exam) => {
      for (const sub of exam.subjects) {
        acc.easy   += sub.difficulty.easy;
        acc.medium += sub.difficulty.medium;
        acc.hard   += sub.difficulty.hard;
      }
      return acc;
    },
    { easy: 0, medium: 0, hard: 0 }
  ) ?? { easy: 0, medium: 0, hard: 0 };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            Question Bank Statistics
          </h1>
          <p className="text-muted-foreground mt-1">
            Detailed breakdown of questions by exam, subject, and difficulty. Admin only.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Questions", value: stats.total.toLocaleString(), icon: <Database className="w-5 h-5 text-primary" />, bg: "bg-primary/10" },
              { label: "Exams Covered",   value: stats.exam_count,             icon: <Layers className="w-5 h-5 text-violet-600" />, bg: "bg-violet-500/10" },
              { label: "Subjects",         value: stats.subject_count,          icon: <BookOpen className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-500/10" },
              { label: "Avg / Subject",    value: stats.avg_per_subject,        icon: <BarChart3 className="w-5 h-5 text-amber-600" />, bg: "bg-amber-500/10" },
            ].map(card => (
              <Card key={card.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${card.bg}`}>{card.icon}</div>
                  <div>
                    <div className="text-2xl font-bold">{card.value}</div>
                    <div className="text-xs text-muted-foreground">{card.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Overall difficulty */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overall Difficulty Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <DifficultyBar {...globalDiff} />
            </CardContent>
          </Card>

          {/* Missing subjects alert */}
          {stats.subjects_with_zero.length > 0 && (
            <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                {stats.subjects_with_zero.length} subjects with 0 questions
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.subjects_with_zero.map(s => (
                  <div
                    key={`${s.exam_code}-${s.subject_code}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700 text-xs"
                  >
                    <span className="font-semibold text-amber-700 dark:text-amber-400">{s.exam_code.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">›</span>
                    <span>{s.subject_name || s.subject_code}</span>
                    <Link href="/admin/question-bank">
                      <Button size="sm" variant="ghost" className="h-4 w-4 p-0 text-amber-600 hover:text-amber-700">
                        <Plus className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exam breakdown */}
          <div>
            <h2 className="text-xl font-bold mb-4">Exam-wise Breakdown</h2>
            <p className="text-sm text-muted-foreground mb-4">Click any exam to expand subject detail and difficulty distribution.</p>
            <div className="space-y-2">
              {stats.exams
                .slice()
                .sort((a, b) => b.total - a.total)
                .map(exam => (
                  <ExamRow key={exam.exam_code} exam={exam} maxTotal={maxTotal} />
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
