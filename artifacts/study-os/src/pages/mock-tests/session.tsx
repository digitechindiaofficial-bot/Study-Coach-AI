import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft, ChevronRight, Flag, Send, Loader2, Grid3x3,
  X, Clock, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface AttemptQuestion {
  attemptQuestionId: string;
  questionBankId: string;
  sectionId: string;
  sectionName: string;
  orderNum: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  difficulty: string;
  subjectCode: string;
  topicCode: string;
  marks: string;
  selectedOption: string | null;
  isMarkedForReview: boolean;
  timeSpentSeconds: number;
}

interface ResponseState {
  selectedOption: string | null;
  isMarkedForReview: boolean;
  timeSpentSeconds: number;
}

interface AttemptData {
  attempt: { id: string; status: string; startedAt: string; timeTakenSeconds: number | null };
  mock: { id: string; name: string; timeLimitMinutes: number; instructions: string | null };
  sections: { id: string; name: string; subjectCode: string | null; orderNum: number }[];
  questions: AttemptQuestion[];
}

const OPTIONS = ["a", "b", "c", "d"] as const;
const OPTION_LABELS: Record<string, string> = { a: "A", b: "B", c: "C", d: "D" };

function getOptionText(q: AttemptQuestion, opt: typeof OPTIONS[number]) {
  return opt === "a" ? q.optionA : opt === "b" ? q.optionB : opt === "c" ? q.optionC : q.optionD;
}

function formatTime(seconds: number) {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function paletteColor(res: ResponseState | undefined, current: boolean) {
  const answered = !!res?.selectedOption;
  const marked = res?.isMarkedForReview ?? false;
  if (current) return "ring-2 ring-primary bg-primary text-primary-foreground";
  if (answered && marked) return "bg-purple-500 text-white";
  if (answered) return "bg-green-500 text-white";
  if (marked) return "bg-orange-400 text-white";
  return "bg-muted text-muted-foreground";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MockTestSessionPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [data, setData] = useState<AttemptData | null>(null);
  const [responses, setResponses] = useState<Map<string, ResponseState>>(new Map());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questionStartRef = useRef<number>(Date.now());
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSavingRef = useRef(false);

  // ── Load attempt ────────────────────────────────────────────────────────

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const resumeId = searchParams.get("resume");

    const init = async () => {
      try {
        let aid = resumeId;
        if (!aid) {
          const r = await fetch(`/api/mock-tests/${id}/attempts`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.error ?? "Failed to start attempt");
          }
          const d = await r.json();
          aid = d.attemptId;
        }

        setAttemptId(aid!);
        const r2 = await fetch(`/api/mock-tests/${id}/attempts/${aid}`, { credentials: "include" });
        if (!r2.ok) throw new Error("Failed to load attempt");
        const attemptData: AttemptData = await r2.json();
        setData(attemptData);

        // Build responses map from server state
        const rMap = new Map<string, ResponseState>();
        for (const q of attemptData.questions) {
          rMap.set(q.attemptQuestionId, {
            selectedOption: q.selectedOption,
            isMarkedForReview: q.isMarkedForReview,
            timeSpentSeconds: q.timeSpentSeconds,
          });
        }
        setResponses(rMap);

        // Timer: total time - elapsed time already spent
        const elapsed = attemptData.attempt.timeTakenSeconds ?? 0;
        const totalSeconds = attemptData.mock.timeLimitMinutes * 60;
        const timeSinceStart = Math.floor(
          (Date.now() - new Date(attemptData.attempt.startedAt).getTime()) / 1000,
        );
        setTimeLeftSeconds(Math.max(0, totalSeconds - timeSinceStart));

        questionStartRef.current = Date.now();
      } catch (e: any) {
        setError(e.message ?? "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    };

    init();
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  // ── Countdown timer ──────────────────────────────────────────────────────

  useEffect(() => {
    if (timeLeftSeconds <= 0 || isLoading) return;
    timerRef.current = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLoading, timeLeftSeconds > 0]);

  // ── Auto-save ────────────────────────────────────────────────────────────

  const performSave = useCallback(
    async (responsesSnapshot: Map<string, ResponseState>, aid: string) => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      try {
        await fetch(`/api/mock-tests/${id}/attempts/${aid}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responses: Array.from(responsesSnapshot.entries()).map(([aqId, r]) => ({
              attemptQuestionId: aqId,
              selectedOption: r.selectedOption,
              isMarkedForReview: r.isMarkedForReview,
              timeSpentSeconds: r.timeSpentSeconds,
            })),
          }),
        });
      } catch {
        // silent — next auto-save will retry
      } finally {
        isSavingRef.current = false;
      }
    },
    [id],
  );

  const scheduleAutoSave = useCallback(
    (responsesSnapshot: Map<string, ResponseState>) => {
      if (!attemptId) return;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        performSave(responsesSnapshot, attemptId);
      }, 3000);
    },
    [attemptId, performSave],
  );

  // ── Navigation ───────────────────────────────────────────────────────────

  const saveCurrentQuestionTime = useCallback(
    (currentIndex: number, responsesMap: Map<string, ResponseState>) => {
      const q = data?.questions[currentIndex];
      if (!q) return responsesMap;
      const elapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
      const updated = new Map(responsesMap);
      const existing = updated.get(q.attemptQuestionId) ?? { selectedOption: null, isMarkedForReview: false, timeSpentSeconds: 0 };
      updated.set(q.attemptQuestionId, { ...existing, timeSpentSeconds: existing.timeSpentSeconds + elapsed });
      questionStartRef.current = Date.now();
      return updated;
    },
    [data],
  );

  const navigateTo = useCallback(
    (newIdx: number) => {
      setResponses((prev) => {
        const updated = saveCurrentQuestionTime(currentIdx, prev);
        scheduleAutoSave(updated);
        return updated;
      });
      setCurrentIdx(newIdx);
      questionStartRef.current = Date.now();
      if (showPalette && window.innerWidth < 768) setShowPalette(false);
    },
    [currentIdx, saveCurrentQuestionTime, scheduleAutoSave, showPalette],
  );

  // ── Select option ────────────────────────────────────────────────────────

  const handleSelect = (opt: string) => {
    if (!data) return;
    const q = data.questions[currentIdx];
    setResponses((prev) => {
      const existing = prev.get(q.attemptQuestionId) ?? { selectedOption: null, isMarkedForReview: false, timeSpentSeconds: 0 };
      const updated = new Map(prev);
      updated.set(q.attemptQuestionId, { ...existing, selectedOption: opt === existing.selectedOption ? null : opt });
      scheduleAutoSave(updated);
      return updated;
    });
  };

  // ── Mark for review ──────────────────────────────────────────────────────

  const handleMarkForReview = () => {
    if (!data) return;
    const q = data.questions[currentIdx];
    setResponses((prev) => {
      const existing = prev.get(q.attemptQuestionId) ?? { selectedOption: null, isMarkedForReview: false, timeSpentSeconds: 0 };
      const updated = new Map(prev);
      updated.set(q.attemptQuestionId, { ...existing, isMarkedForReview: !existing.isMarkedForReview });
      scheduleAutoSave(updated);
      return updated;
    });
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (autoSubmit = false) => {
    if (!attemptId || isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitDialog(false);

    // Final save before submit
    const finalResponses = saveCurrentQuestionTime(currentIdx, responses);
    await performSave(finalResponses, attemptId);

    try {
      const r = await fetch(`/api/mock-tests/${id}/attempts/${attemptId}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Submit failed");
      if (autoSubmit) toast({ title: "Time up! Test submitted automatically." });
      navigate(`/mock-tests/${id}/results/${attemptId}`);
    } catch {
      toast({ title: "Failed to submit. Please try again.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Preparing your test...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold">Could not start test</p>
          <p className="text-muted-foreground text-sm mt-1">{error ?? "Unknown error"}</p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  const questions = data.questions;
  const currentQ = questions[currentIdx];
  const currentResponse = responses.get(currentQ?.attemptQuestionId ?? "") ?? {
    selectedOption: null, isMarkedForReview: false, timeSpentSeconds: 0,
  };

  const answeredCount = Array.from(responses.values()).filter((r) => r.selectedOption).length;
  const markedCount = Array.from(responses.values()).filter((r) => r.isMarkedForReview).length;
  const unattemptedCount = questions.length - answeredCount;

  const isTimeLow = timeLeftSeconds > 0 && timeLeftSeconds <= 300;

  // Group questions by section for palette
  const sectionGroups = data.sections.map((s) => ({
    ...s,
    questions: questions.filter((q) => q.sectionId === s.id).sort((a, b) => a.orderNum - b.orderNum),
  }));

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-4rem)]">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => navigate("/mock-tests")}
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{data.mock.name}</p>
              <p className="text-xs text-muted-foreground">
                Q {currentIdx + 1}/{questions.length} · {answeredCount} answered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-semibold",
                timeLeftSeconds <= 0
                  ? "bg-gray-100 text-gray-500"
                  : isTimeLow
                  ? "bg-red-100 text-red-700 animate-pulse"
                  : "bg-muted text-foreground",
              )}
            >
              <Clock className="h-4 w-4" />
              {formatTime(timeLeftSeconds)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setShowPalette(!showPalette)}
            >
              <Grid3x3 className="h-5 w-5" />
            </Button>
            <Button
              onClick={() => setShowSubmitDialog(true)}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
              size="sm"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1.5" /> Submit</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full">
        {/* ── Main Question Area ── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-w-0">
          {/* Section label */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{currentQ.sectionName}</Badge>
            <Badge
              className={cn(
                "text-xs capitalize",
                currentQ.difficulty === "easy" ? "bg-green-100 text-green-700" :
                currentQ.difficulty === "hard" ? "bg-red-100 text-red-700" :
                "bg-amber-100 text-amber-700",
              )}
            >
              {currentQ.difficulty}
            </Badge>
            <Badge variant="secondary" className="text-xs">{currentQ.marks} mark{parseFloat(currentQ.marks) !== 1 ? "s" : ""}</Badge>
            {currentResponse.isMarkedForReview && (
              <Badge className="bg-orange-100 text-orange-700 text-xs gap-1">
                <Flag className="h-3 w-3" /> Marked for Review
              </Badge>
            )}
          </div>

          {/* Question */}
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              Question {currentIdx + 1}
            </p>
            <p className="text-base font-medium leading-relaxed text-foreground">
              {currentQ.question}
            </p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPTIONS.map((opt) => {
              const text = getOptionText(currentQ, opt);
              const isSelected = currentResponse.selectedOption === opt;
              return (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "text-left p-4 rounded-xl border-2 transition-all text-sm leading-relaxed",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground font-medium"
                      : "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 rounded-full items-center justify-center text-xs font-bold mr-2 shrink-0",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {OPTION_LABELS[opt]}
                  </span>
                  {text}
                </button>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkForReview}
              className={cn(
                "gap-1.5",
                currentResponse.isMarkedForReview && "border-orange-400 text-orange-600 bg-orange-50",
              )}
            >
              <Flag className={cn("h-4 w-4", currentResponse.isMarkedForReview ? "fill-current" : "")} />
              {currentResponse.isMarkedForReview ? "Unmark" : "Mark for Review"}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateTo(currentIdx - 1)}
                disabled={currentIdx === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {currentIdx + 1} / {questions.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateTo(currentIdx + 1)}
                disabled={currentIdx === questions.length - 1}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Question Palette (desktop sidebar) ── */}
        <div className="hidden md:flex w-72 border-l flex-col">
          <PalettePanel
            sectionGroups={sectionGroups}
            responses={responses}
            currentIdx={currentIdx}
            onNavigate={navigateTo}
            questions={questions}
            answeredCount={answeredCount}
            markedCount={markedCount}
            unattemptedCount={unattemptedCount}
          />
        </div>
      </div>

      {/* ── Mobile Palette Overlay ── */}
      {showPalette && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setShowPalette(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-card shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-semibold">Question Palette</span>
              <Button variant="ghost" size="icon" onClick={() => setShowPalette(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <PalettePanel
              sectionGroups={sectionGroups}
              responses={responses}
              currentIdx={currentIdx}
              onNavigate={navigateTo}
              questions={questions}
              answeredCount={answeredCount}
              markedCount={markedCount}
              unattemptedCount={unattemptedCount}
            />
          </div>
        </div>
      )}

      {/* ── Submit Dialog ── */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Mock Test?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You are about to submit. This cannot be undone.</p>
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <p className="text-xl font-bold text-green-700">{answeredCount}</p>
                    <p className="text-xs text-green-600 mt-0.5">Answered</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                    <p className="text-xl font-bold text-orange-700">{markedCount}</p>
                    <p className="text-xs text-orange-600 mt-0.5">Marked</p>
                  </div>
                  <div className="rounded-lg bg-muted border p-3">
                    <p className="text-xl font-bold text-muted-foreground">{unattemptedCount}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Skipped</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Test</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleSubmit(false)}
              className="bg-primary text-primary-foreground"
            >
              Submit Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Palette Panel ─────────────────────────────────────────────────────────────

function PalettePanel({
  sectionGroups, responses, currentIdx, onNavigate, questions,
  answeredCount, markedCount, unattemptedCount,
}: {
  sectionGroups: any[];
  responses: Map<string, ResponseState>;
  currentIdx: number;
  onNavigate: (idx: number) => void;
  questions: AttemptQuestion[];
  answeredCount: number;
  markedCount: number;
  unattemptedCount: number;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Legend */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {[
          { color: "bg-green-500", label: "Answered" },
          { color: "bg-muted", label: "Not Attempted" },
          { color: "bg-orange-400", label: "Marked" },
          { color: "bg-purple-500", label: "Ans + Marked" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("h-3 w-3 rounded-sm shrink-0", color)} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
        <div className="rounded bg-green-50 border border-green-200 p-1.5">
          <p className="font-bold text-green-700 text-sm">{answeredCount}</p>
          <p className="text-green-600">Done</p>
        </div>
        <div className="rounded bg-orange-50 border border-orange-200 p-1.5">
          <p className="font-bold text-orange-700 text-sm">{markedCount}</p>
          <p className="text-orange-600">Marked</p>
        </div>
        <div className="rounded bg-muted border p-1.5">
          <p className="font-bold text-muted-foreground text-sm">{unattemptedCount}</p>
          <p className="text-muted-foreground">Skipped</p>
        </div>
      </div>

      {/* Section-wise palette */}
      {sectionGroups.map((section) => (
        <div key={section.id}>
          <p className="text-xs font-semibold text-muted-foreground mb-2 truncate">{section.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {section.questions.map((q: AttemptQuestion) => {
              const globalIdx = questions.findIndex((gq) => gq.attemptQuestionId === q.attemptQuestionId);
              const res = responses.get(q.attemptQuestionId);
              return (
                <button
                  key={q.attemptQuestionId}
                  onClick={() => onNavigate(globalIdx)}
                  className={cn(
                    "h-8 w-8 rounded text-xs font-semibold transition-all hover:scale-110",
                    paletteColor(res, globalIdx === currentIdx),
                  )}
                >
                  {q.orderNum}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
