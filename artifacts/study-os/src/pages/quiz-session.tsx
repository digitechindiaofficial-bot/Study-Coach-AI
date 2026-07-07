import { getQuizQuestions } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, ChevronRight, RotateCcw, Trophy, Lock } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  useSubmitQuizAttempt,
  useGetMyProfile,
  useGetSyllabus,
  getGetMyProfileQueryKey,
  getGetSyllabusQueryKey,
} from "@workspace/api-client-react";
import { usePlan, FREE_DAILY_QUIZ_LIMIT } from "@/hooks/use-plan";
import UpgradeModal from "@/components/upgrade-modal";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: string;
  questionText: string;
  options: Record<string, string> | null;
  correctOption: string | null;
  explanation: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  examCode: string | null;
  subjectCode: string | null;
  topicCode: string | null;
}

// How many questions to fetch per batch, and how many questions before the
// end of the current batch we silently prefetch the next one so the user
// never sees a loading state between questions.
const BATCH_SIZE = 20;
const PREFETCH_THRESHOLD = 5;

export default function QuizSessionPage({ subject }: { subject: string }) {
  const isWeak = subject === "weak";
  const isAll = subject === "all";
  const decodedSubject = decodeURIComponent(subject);

  const plan = usePlan();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Resolve exam code and subject display name from user profile + syllabus
  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), staleTime: 30_000 },
  });
  const { data: syllabusData = [] } = useGetSyllabus({
    query: { queryKey: getGetSyllabusQueryKey(), staleTime: 5 * 60_000 },
  });

  const examCode: string = (profile as any)?.examType ?? "";
  const examData = (syllabusData as any[]).find((e: any) => e.code === examCode);

  // Resolve subject display name: if subject looks like a code (e.g. "QA"),
  // look it up from the syllabus; otherwise display as-is (legacy text routes)
  const subjectDisplayName = (() => {
    if (isWeak || isAll) return "";
    const fromSyllabus = examData?.subjects?.find(
      (s: any) => s.subjectCode === decodedSubject,
    )?.name;
    return fromSyllabus ?? decodedSubject;
  })();

  // Determine whether to pass subjectCode or legacy subject text
  const isSubjectCode = !isWeak && !isAll && !!examData?.subjects?.find(
    (s: any) => s.subjectCode === decodedSubject,
  );

  // Session-only tracking (never persisted to the DB). Cleared automatically
  // whenever this component mounts fresh (e.g. re-entering the quiz), which
  // is what gives every new session a fresh, full pool of questions again.
  const seenIds = useRef<Set<string>>(new Set());
  const loadedIds = useRef<Set<string>>(new Set());
  const isFetchingMoreRef = useRef(false);
  const noMoreQuestionsRef = useRef(false);

  const [pool, setPool] = useState<Question[]>([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<
    Array<{ qId: string; selected: string; correct: boolean; timeTaken: number }>
  >([]);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());

  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const submitAttempt = useSubmitQuizAttempt();

  const initialLeft = useRef<number | null>(null);
  useEffect(() => {
    if (plan.isLoaded && initialLeft.current === null) {
      initialLeft.current = plan.quizQuestionsLeft;
      if (!plan.canTakeQuiz) setShowLimitModal(true);
    }
  }, [plan.isLoaded, plan.canTakeQuiz, plan.quizQuestionsLeft]);

  const questionsLeft = plan.isPro
    ? Infinity
    : Math.max(0, (initialLeft.current ?? plan.quizQuestionsLeft) - sessionAnswered);
  const isAtLimit = !plan.isPro && questionsLeft <= 0;

  const buildParams = useCallback(
    (excludeIds: Set<string>) => {
      const base: Record<string, string> = { limit: String(BATCH_SIZE) };

      // Always send the user's exam code so questions are exam-scoped
      if (examCode) base.examCode = examCode;

      if (isWeak) {
        base.weakOnly = "true";
      } else if (!isAll) {
        // Prefer code-based filtering; fall back to text for legacy routes
        if (isSubjectCode) {
          base.subjectCode = decodedSubject;
        } else {
          base.subject = decodedSubject;
        }
      }

      if (excludeIds.size > 0) {
        base.exclude = Array.from(excludeIds).join(",");
      }
      return base;
    },
    [isWeak, isAll, decodedSubject, isSubjectCode, examCode],
  );

  const fetchMore = useCallback(
    async (initial: boolean): Promise<Question[]> => {
      if (isFetchingMoreRef.current || noMoreQuestionsRef.current) return [];
      isFetchingMoreRef.current = true;
      setIsFetching(true);
      try {
        let data = (await getQuizQuestions(
          buildParams(loadedIds.current) as any,
        )) as Question[];

        if (data.length === 0 && loadedIds.current.size > 0) {
          // Exhausted every question for this filter — cycle back to the start.
          loadedIds.current.clear();
          seenIds.current.clear();
          data = (await getQuizQuestions(buildParams(new Set()) as any)) as Question[];
          if (data.length > 0) {
            toast({
              title: "Great job!",
              description:
                "You've been through every question — starting fresh with the full set again.",
            });
          }
        }

        if (data.length === 0) {
          noMoreQuestionsRef.current = true;
        } else {
          data.forEach(q => loadedIds.current.add(q.id));
          setPool(prev => (initial ? data : [...prev, ...data]));
        }

        if (initial) setPoolIndex(0);
        return data;
      } finally {
        setIsLoading(false);
        setIsFetching(false);
        isFetchingMoreRef.current = false;
      }
    },
    [buildParams, toast],
  );

  // Initial load — wait until we know the user's exam code
  const profileLoaded = !!profile;
  useEffect(() => {
    if (profileLoaded) {
      fetchMore(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded]);

  // Silent background prefetch when nearing the end of the current batch
  useEffect(() => {
    if (isLoading || isAtLimit) return;
    const remaining = pool.length - poolIndex;
    if (remaining <= PREFETCH_THRESHOLD && !isFetchingMoreRef.current && !noMoreQuestionsRef.current) {
      fetchMore(false);
    }
  }, [poolIndex, pool.length, isLoading, isAtLimit, fetchMore]);

  useEffect(() => {
    setStartTime(Date.now());
  }, [poolIndex, pool]);

  const current = pool[poolIndex] ?? null;
  const options = (current?.options ?? {}) as Record<string, string>;
  const isAnswered = selected !== null;
  const isCorrect = selected === current?.correctOption;

  const handleSelect = (key: string) => {
    if (!current || isAnswered) return;
    if (isAtLimit) {
      setShowLimitModal(true);
      return;
    }

    setSelected(key);
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const correct = key === current.correctOption;
    setAnswers(prev => [...prev, { qId: current.id, selected: key, correct, timeTaken }]);
    seenIds.current.add(current.id);

    submitAttempt.mutate(
      { data: { questionId: current.id, selectedOption: key, timeTakenSeconds: timeTaken } },
      {
        onSuccess: () => {
          setSessionAnswered(prev => prev + 1);
          qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        },
        onError: (err: any) => {
          const status = err?.response?.status ?? err?.status;
          if (status === 429) setShowLimitModal(true);
        },
      },
    );
  };

  const handleNext = async () => {
    if (isAtLimit) {
      setShowLimitModal(true);
      return;
    }
    const nextIndex = poolIndex + 1;
    if (nextIndex >= pool.length) {
      setSelected(null);
      const fetched = await fetchMore(false);
      if (fetched.length > 0) setPoolIndex(nextIndex);
    } else {
      setPoolIndex(nextIndex);
      setSelected(null);
    }
  };

  const handleFinish = () => setFinished(true);

  const handleRetry = () => {
    seenIds.current.clear();
    loadedIds.current.clear();
    noMoreQuestionsRef.current = false;
    initialLeft.current = null;
    setPool([]);
    setPoolIndex(0);
    setSelected(null);
    setAnswers([]);
    setSessionAnswered(0);
    setFinished(false);
    setIsLoading(true);
    fetchMore(true);
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pool.length) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">No questions found for this subject.</p>
        <Link href="/quiz">
          <Button variant="outline" className="mt-4">
            Back to Quiz
          </Button>
        </Link>
      </div>
    );
  }

  // ── Results screen ──
  if (finished) {
    const correct = answers.filter(a => a.correct).length;
    const total = answers.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const trophyColor =
      pct >= 70 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
    const bgColor =
      pct >= 70 ? "bg-green-100" : pct >= 50 ? "bg-amber-100" : "bg-red-100";
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div
          className={cn("w-24 h-24 rounded-full flex items-center justify-center", bgColor)}
        >
          <Trophy className={cn("w-12 h-12", trophyColor)} />
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-2">{pct}%</h1>
          <p className="text-muted-foreground text-lg">
            {correct} / {total} correct
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {pct >= 80
              ? "Excellent! Keep it up!"
              : pct >= 60
                ? "Good work! A bit more practice will help."
                : "Keep practicing — you'll improve!"}
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/quiz">
            <Button variant="outline">Back to Quiz</Button>
          </Link>
          <Button onClick={handleRetry}>
            <RotateCcw className="mr-2 w-4 h-4" /> Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const totalAnswered = answers.length;
  const sessionTitle = isWeak
    ? "Weak Area Drill"
    : isAll
      ? "Mixed Practice"
      : subjectDisplayName;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <UpgradeModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        variant="quiz_limit"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{sessionTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {totalAnswered} answered · {seenIds.current.size} seen this session
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!plan.isPro && plan.isLoaded && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                questionsLeft <= 3
                  ? "border-red-300 text-red-700 bg-red-50"
                  : "border-border text-muted-foreground",
              )}
            >
              {questionsLeft === 0 ? "Limit hit" : `${questionsLeft} left today`}
            </Badge>
          )}
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFinish}
            disabled={answers.length === 0}
          >
            Finish
          </Button>
          <Link href="/quiz">
            <Button variant="ghost" size="sm">
              Exit
            </Button>
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${((poolIndex + 1) / pool.length) * 100}%` }}
        />
      </div>

      {/* Free plan limit banner */}
      {!plan.isPro && plan.isLoaded && questionsLeft <= 3 && questionsLeft > 0 && (
        <div
          className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer"
          onClick={() => setShowLimitModal(true)}
        >
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {questionsLeft === 1
              ? "Last free question today!"
              : `${questionsLeft} free questions remaining today`}
            {" · "}
            <span className="underline">Upgrade for unlimited</span>
          </p>
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {current.subject && (
              <Badge variant="outline" className="text-xs">
                {current.subject}
              </Badge>
            )}
            {current.topic && (
              <Badge variant="secondary" className="text-xs">
                {current.topic}
              </Badge>
            )}
            {current.difficulty && (
              <Badge
                className={cn(
                  "text-xs capitalize",
                  current.difficulty === "easy"
                    ? "bg-green-100 text-green-700"
                    : current.difficulty === "hard"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700",
                )}
              >
                {current.difficulty}
              </Badge>
            )}
          </div>
          <p className="text-base font-medium leading-relaxed">{current.questionText}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(options).map(([key, val]) => {
          let cls =
            "p-4 rounded-lg border text-sm text-left transition-all w-full ";
          if (isAnswered) {
            if (key === current.correctOption)
              cls += "bg-green-100 border-green-400 text-green-900 font-medium";
            else if (key === selected)
              cls += "bg-red-100 border-red-400 text-red-900";
            else cls += "bg-muted/30 border-border text-muted-foreground";
          } else {
            cls +=
              "bg-card border-border hover:border-primary hover:bg-primary/5 cursor-pointer";
          }
          return (
            <button key={key} className={cls} onClick={() => handleSelect(key)}>
              <span className="font-bold uppercase mr-2">{key}.</span>
              {val}
              {isAnswered && key === current.correctOption && (
                <CheckCircle2 className="w-4 h-4 text-green-600 inline ml-2" />
              )}
              {isAnswered && key === selected && key !== current.correctOption && (
                <XCircle className="w-4 h-4 text-red-600 inline ml-2" />
              )}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <Card className="border-primary/20 bg-primary/5 animate-in fade-in">
          <CardContent className="p-4 space-y-2">
            <p
              className={cn(
                "text-sm font-semibold",
                isCorrect ? "text-green-700" : "text-red-700",
              )}
            >
              {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
            </p>
            {current.explanation && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {current.explanation}
              </p>
            )}
            <Button onClick={handleNext} className="mt-2" disabled={isFetching}>
              {isFetching ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" /> Loading more...
                </>
              ) : (
                <>
                  {poolIndex === pool.length - 1
                    ? "Load More Questions"
                    : "Next Question"}{" "}
                  <ChevronRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
