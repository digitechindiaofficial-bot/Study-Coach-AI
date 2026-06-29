import { useGetCurrentAffairs, useGenerateMcqFromNews, getGetCurrentAffairsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, ChevronDown, ChevronUp, Newspaper, RefreshCw, Sparkles, Lock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { usePlan, FREE_CURRENT_AFFAIRS_DAYS } from "@/hooks/use-plan";
import { Link } from "wouter";

const CATEGORY_COLORS: Record<string, string> = {
  Economy:       "bg-green-100 text-green-700 border-green-200",
  Polity:        "bg-blue-100 text-blue-700 border-blue-200",
  Science:       "bg-purple-100 text-purple-700 border-purple-200",
  Sports:        "bg-orange-100 text-orange-700 border-orange-200",
  International: "bg-red-100 text-red-700 border-red-200",
  Environment:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  Awards:        "bg-amber-100 text-amber-700 border-amber-200",
};

const CATEGORIES = ["All", "Economy", "Polity", "Science", "Sports", "International", "Awards"];

interface MCQ { question: string; options: Record<string, string>; correct: string; explanation: string; }

async function generateToday(force = false): Promise<void> {
  await fetch(`/api/current-affairs/today${force ? "?force=true" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  });
}

function isOlderThanDays(dateStr: string | null | undefined, days: number): boolean {
  if (!dateStr) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const articleDate = new Date(dateStr + "T00:00:00");
  return articleDate < cutoff;
}

export default function CurrentAffairsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const plan = usePlan();

  const [category, setCategory] = useState("All");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mcqs, setMcqs] = useState<Record<string, MCQ[]>>({});
  const [loadingMcq, setLoadingMcq] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Record<number, string>>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const autoFetchedRef = useRef(false);

  const queryKey = getGetCurrentAffairsQueryKey({ days: 7 } as any);

  const { data: allItems = [], isLoading } = useGetCurrentAffairs(
    { days: 7 } as any,
    { query: { queryKey } }
  );

  const todayStr = new Date().toISOString().split("T")[0];
  const todayItems = (allItems as any[]).filter((i: any) => i.publishedDate === todayStr);
  const hasToday = todayItems.length > 0;

  const displayItems = category === "All"
    ? (allItems as any[])
    : (allItems as any[]).filter((i: any) => i.category === category);

  useEffect(() => {
    if (!isLoading && !hasToday && !autoFetchedRef.current) {
      autoFetchedRef.current = true;
      setIsGenerating(true);
      generateToday(false)
        .then(() => qc.invalidateQueries({ queryKey }))
        .catch(() => toast({ title: "Failed to fetch today's news", variant: "destructive" }))
        .finally(() => setIsGenerating(false));
    }
  }, [isLoading, hasToday]);

  const handleRefresh = async () => {
    setIsGenerating(true);
    try {
      await generateToday(true);
      await qc.invalidateQueries({ queryKey });
      toast({ title: "Today's news refreshed!" });
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateMcq = useGenerateMcqFromNews();

  const toggle = (id: string, isLocked: boolean) => {
    if (isLocked) return;
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleGenerateMcq = (item: any) => {
    if (!plan.isPro) return;
    setLoadingMcq(item.id);
    generateMcq.mutate(
      { data: { newsTitle: item.title, newsSummary: item.summary ?? item.title } },
      {
        onSuccess: (data: any) => { setMcqs(prev => ({ ...prev, [item.id]: data })); setLoadingMcq(null); },
        onError: () => { toast({ title: "Failed to generate MCQ", variant: "destructive" }); setLoadingMcq(null); }
      }
    );
  };

  const handleAnswer = (articleId: string, qIdx: number, option: string) => {
    setSelectedAnswers(prev => ({ ...prev, [articleId]: { ...(prev[articleId] ?? {}), [qIdx]: option } }));
  };

  if (isLoading || (isGenerating && !hasToday)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Newspaper className="w-8 h-8 text-primary" />
              Current Affairs
            </h1>
            <p className="text-muted-foreground mt-1">Fetching today's news for you…</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <Loader2 className="w-5 h-5 text-primary animate-spin absolute -bottom-1 -right-1" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg">Generating Today's Current Affairs</p>
            <p className="text-muted-foreground text-sm mt-1">AI is curating news relevant for your exam…</p>
          </div>
          <div className="space-y-3 w-full max-w-xl">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const lockedCount = plan.isLoaded && !plan.isPro
    ? displayItems.filter((i: any) => isOlderThanDays(i.publishedDate, FREE_CURRENT_AFFAIRS_DAYS)).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Newspaper className="w-8 h-8 text-primary" />
            Current Affairs
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay updated · {displayItems.length} article{displayItems.length !== 1 ? "s" : ""}
            {todayItems.length > 0
              ? <> · <span className="text-green-600 font-medium">{todayItems.length} from today</span></>
              : <> · <span className="text-amber-600 font-medium">No today's news yet</span></>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={handleRefresh}
          disabled={isGenerating}
        >
          {isGenerating
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh Today's News
        </Button>
      </div>

      {/* Free plan upgrade banner (when locked articles exist) */}
      {lockedCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <span className="font-semibold">{lockedCount} older article{lockedCount !== 1 ? "s" : ""} locked.</span>
            {" "}Free plan shows the last {FREE_CURRENT_AFFAIRS_DAYS} days only.
          </p>
          <Link href="/upgrade">
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:from-amber-600 hover:to-orange-600 shrink-0">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Upgrade
            </Button>
          </Link>
        </div>
      )}

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(c => {
          const count = c === "All"
            ? (allItems as any[]).length
            : (allItems as any[]).filter((i: any) => i.category === c).length;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                category === c
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              )}
            >
              {c}
              {count > 0 && (
                <span className={cn(
                  "ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  category === c ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {displayItems.length === 0 && !isGenerating && (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center">
            <Newspaper className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No articles in this category</p>
          <p className="text-muted-foreground text-sm">Try selecting a different category or refresh today's news.</p>
          <Button size="sm" onClick={handleRefresh} disabled={isGenerating}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh Today's News
          </Button>
        </div>
      )}

      {isGenerating && hasToday && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating fresh news…
        </div>
      )}

      {/* Articles */}
      <div className="space-y-3">
        {displayItems.map((item: any) => {
          const isLocked = !plan.isPro && isOlderThanDays(item.publishedDate, FREE_CURRENT_AFFAIRS_DAYS);
          const isExp = expanded.has(item.id) && !isLocked;
          const catColor = CATEGORY_COLORS[item.category ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";
          const itemMcqs = mcqs[item.id];
          const answers = selectedAnswers[item.id] ?? {};
          const isToday = item.publishedDate === todayStr;

          return (
            <Card
              key={item.id}
              className={cn(
                "transition-shadow",
                isLocked ? "opacity-75" : "hover:shadow-md",
                item.isFeatured && !isLocked && "border-primary/40 shadow-sm"
              )}
            >
              <CardHeader
                className={cn("pb-3", !isLocked && "cursor-pointer")}
                onClick={() => toggle(item.id, isLocked)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className={`text-[10px] border ${catColor}`}>{item.category}</Badge>
                      {item.isFeatured && !isLocked && (
                        <Badge className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-300">⭐ Important</Badge>
                      )}
                      {isToday && (
                        <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">Today</Badge>
                      )}
                      {isLocked && (
                        <Badge className="text-[10px] bg-muted text-muted-foreground border-border">
                          <Lock className="w-2.5 h-2.5 mr-1" />Locked
                        </Badge>
                      )}
                      {item.publishedDate && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.publishedDate + "T00:00:00"), "d MMM yyyy")}
                        </span>
                      )}
                    </div>

                    {/* Blurred title for locked articles */}
                    <div className={cn(isLocked && "relative")}>
                      <CardTitle className={cn("text-[15px] leading-snug", isLocked && "blur-sm select-none")}>
                        {item.title}
                      </CardTitle>
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-start">
                          <Link href="/upgrade">
                            <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100">
                              <Lock className="w-3 h-3 mr-1.5" />
                              Upgrade to unlock
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                  {!isLocked && (
                    isExp
                      ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  {isLocked && <Lock className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />}
                </div>
              </CardHeader>

              {isExp && (
                <CardContent className="pt-0 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.summary}</p>

                  {item.examRelevance && item.examRelevance.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap items-center">
                      <span className="text-xs text-muted-foreground">Relevant for:</span>
                      {item.examRelevance.map((e: string) => (
                        <Badge key={e} variant="outline" className="text-[10px]">{e.replace(/_/g, " ")}</Badge>
                      ))}
                    </div>
                  )}

                  {plan.isPro ? (
                    !itemMcqs ? (
                      <Button size="sm" variant="secondary" onClick={() => handleGenerateMcq(item)} disabled={loadingMcq === item.id}>
                        {loadingMcq === item.id
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <Zap className="mr-2 h-4 w-4" />}
                        Generate Practice MCQs
                      </Button>
                    ) : (
                      <div className="space-y-4 pt-2">
                        <p className="text-sm font-semibold text-primary">Practice Questions</p>
                        {itemMcqs.map((mcq, qi) => {
                          const selectedOpt = answers[qi];
                          const isCorrect = selectedOpt === mcq.correct;
                          return (
                            <div key={qi} className="p-4 bg-muted/30 rounded-lg space-y-3">
                              <p className="text-sm font-medium">{qi + 1}. {mcq.question}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(mcq.options).map(([key, val]) => {
                                  const isSelected = selectedOpt === key;
                                  const isRight = key === mcq.correct;
                                  let cls = "border text-xs p-2.5 rounded text-left transition-colors w-full ";
                                  if (selectedOpt) {
                                    if (isRight) cls += "bg-green-100 border-green-400 text-green-800 font-medium";
                                    else if (isSelected) cls += "bg-red-100 border-red-400 text-red-800";
                                    else cls += "bg-background border-border text-muted-foreground";
                                  } else {
                                    cls += "bg-background border-border hover:border-primary hover:bg-primary/5 cursor-pointer";
                                  }
                                  return (
                                    <button key={key} className={cls} onClick={() => !selectedOpt && handleAnswer(item.id, qi, key)}>
                                      <span className="font-bold">{key.toUpperCase()}.</span> {val as string}
                                    </button>
                                  );
                                })}
                              </div>
                              {selectedOpt && (
                                <p className="text-xs text-muted-foreground bg-muted p-2.5 rounded">
                                  <span className={isCorrect ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
                                    {isCorrect ? "✓ Correct!" : "✗ Incorrect."}
                                  </span>{" "}
                                  {mcq.explanation}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <Link href="/upgrade">
                      <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        Upgrade Pro to generate MCQs
                      </Button>
                    </Link>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
