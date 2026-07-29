import { useGetCurrentAffairs, getGetCurrentAffairsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Zap, ChevronDown, ChevronUp, Newspaper,
  RefreshCw, Sparkles, Lock, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/use-plan";
import { Link } from "wouter";

// ── Constants ─────────────────────────────────────────────────────────────────
const FREE_VISIBLE_COUNT = 5; // free users see this many today's articles fully

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

// ── Helpers ───────────────────────────────────────────────────────────────────
async function autoFetchToday(): Promise<void> {
  await fetch("/api/current-affairs/today", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  });
}

async function generateMcqForArticle(title: string, summary: string): Promise<MCQ> {
  const resp = await fetch("/api/quiz/generate-mcq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ newsTitle: title, newsSummary: summary }),
  });
  if (!resp.ok) throw new Error("MCQ generation failed");
  const data: MCQ[] = await resp.json();
  return data[0];
}

// ── Full-page loading skeleton ─────────────────────────────────────────────────
function GeneratingScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Newspaper className="w-8 h-8 text-primary" />
          Current Affairs
        </h1>
        <p className="text-muted-foreground mt-1">Fetching today's news for you…</p>
      </div>
      <div className="flex flex-col items-center justify-center py-20 gap-5">
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
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MCQ Practice component ─────────────────────────────────────────────────────
function McqPractice({ mcq }: { mcq: MCQ }) {
  const [selected, setSelected] = useState<string | null>(null);
  const isCorrect = selected === mcq.correct;
  return (
    <div className="p-4 bg-muted/30 rounded-lg space-y-3 border border-border">
      <p className="text-sm font-medium">{mcq.question}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(mcq.options).map(([key, val]) => {
          const isSelected = selected === key;
          const isRight = key === mcq.correct;
          let cls = "border text-xs p-2.5 rounded text-left transition-colors w-full ";
          if (selected) {
            if (isRight) cls += "bg-green-100 border-green-400 text-green-800 font-medium";
            else if (isSelected) cls += "bg-red-100 border-red-400 text-red-800";
            else cls += "bg-background border-border text-muted-foreground";
          } else {
            cls += "bg-background border-border hover:border-primary hover:bg-primary/5 cursor-pointer";
          }
          return (
            <button key={key} className={cls} onClick={() => !selected && setSelected(key)}>
              <span className="font-bold">{key.toUpperCase()}.</span> {val}
              {selected && isRight && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline ml-1.5" />}
              {selected && isSelected && !isRight && <XCircle className="w-3.5 h-3.5 text-red-600 inline ml-1.5" />}
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground bg-muted p-2.5 rounded leading-relaxed">
          <span className={isCorrect ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
            {isCorrect ? "✓ Correct!" : "✗ Incorrect."}
          </span>{" "}
          {mcq.explanation}
        </p>
      )}
    </div>
  );
}

// ── Article card ───────────────────────────────────────────────────────────────
function ArticleCard({
  item, index, isPro, isBlurred, isExpanded, onToggle,
}: {
  item: any;
  index: number;
  isPro: boolean;
  isBlurred: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { toast } = useToast();
  const [mcq, setMcq] = useState<MCQ | null>(null);
  const [loadingMcq, setLoadingMcq] = useState(false);
  const catColor = CATEGORY_COLORS[item.category ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = item.publishedDate === todayStr;

  const handleGenerateMcq = async () => {
    setLoadingMcq(true);
    try {
      const result = await generateMcqForArticle(item.title, item.summary ?? item.title);
      setMcq(result);
    } catch {
      toast({ title: "Failed to generate MCQ. Try again.", variant: "destructive" });
    } finally {
      setLoadingMcq(false);
    }
  };

  return (
    <Card
      className={cn(
        "transition-shadow",
        isBlurred ? "opacity-80" : "hover:shadow-md cursor-pointer",
        item.isFeatured && !isBlurred && "border-primary/30 shadow-sm",
      )}
    >
      {/* Header — always clickable (if not blurred) */}
      <CardHeader
        className={cn("pb-3", !isBlurred && "cursor-pointer")}
        onClick={isBlurred ? undefined : onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={`text-[10px] border ${catColor}`}>{item.category}</Badge>
              {item.isFeatured && !isBlurred && (
                <Badge className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-300">⭐ Important</Badge>
              )}
              {isToday && (
                <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">Today</Badge>
              )}
              {item.publishedDate && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(item.publishedDate + "T00:00:00"), "d MMM yyyy")}
                </span>
              )}
            </div>

            {/* Title — blurred for locked items */}
            {isBlurred ? (
              <div className="relative">
                <CardTitle className="text-[15px] leading-snug blur-sm select-none pointer-events-none">
                  {item.title}
                </CardTitle>
                <div className="absolute inset-0 flex items-center">
                  <Link href="/upgrade">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100" onClick={e => e.stopPropagation()}>
                      <Lock className="w-3 h-3 mr-1.5" />
                      Upgrade to unlock
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <CardTitle className="text-[15px] leading-snug">{item.title}</CardTitle>
            )}
          </div>

          {isBlurred
            ? <Lock className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1" />
            : isExpanded
              ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />}
        </div>
      </CardHeader>

      {/* Expanded body */}
      {isExpanded && !isBlurred && (
        <CardContent className="pt-0 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{item.summary}</p>

          {item.examRelevance && item.examRelevance.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-xs text-muted-foreground font-medium">Relevant for:</span>
              {item.examRelevance.map((e: string) => (
                <Badge key={e} variant="outline" className="text-[10px]">{e.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          )}

          {/* MCQ section — Pro only */}
          {isPro && (
            !mcq ? (
              <Button size="sm" variant="secondary" onClick={handleGenerateMcq} disabled={loadingMcq}>
                {loadingMcq
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating MCQ…</>
                  : <><Zap className="mr-2 h-4 w-4" />Practice MCQ</>}
              </Button>
            ) : (
              <McqPractice mcq={mcq} />
            )
          )}

          {!isPro && (
            <Link href="/upgrade">
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Upgrade to Pro for Practice MCQ
              </Button>
            </Link>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CurrentAffairsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const plan = usePlan();

  const [category, setCategory] = useState("All");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const autoFetchedRef = useRef(false);

  const queryKey = getGetCurrentAffairsQueryKey({ days: 7 } as any);

  // staleTime: 0 so refetchQueries always fetches fresh data from server
  const { data: allItems = [], isLoading } = useGetCurrentAffairs(
    { days: 7 } as any,
    { query: { queryKey, staleTime: 0 } }
  );

  const todayStr = new Date().toISOString().split("T")[0];
  const todayItems = (allItems as any[]).filter((i: any) => i.publishedDate === todayStr);
  const hasToday = todayItems.length > 0;

  // Derive "last updated" from createdAt of newest today article
  useEffect(() => {
    if (todayItems.length > 0 && !lastRefreshedAt) {
      const newest = todayItems.reduce((a: any, b: any) => {
        const aTime = new Date(a.createdAt ?? 0).getTime();
        const bTime = new Date(b.createdAt ?? 0).getTime();
        return bTime > aTime ? b : a;
      });
      if (newest.createdAt) setLastRefreshedAt(new Date(newest.createdAt));
    }
  }, [todayItems.length]);

  // Auto-fetch if no today news exists
  useEffect(() => {
    if (!isLoading && !hasToday && !autoFetchedRef.current) {
      autoFetchedRef.current = true;
      setIsGenerating(true);
      autoFetchToday()
        .then(() => qc.invalidateQueries({ queryKey }))
        .catch(() => toast({ title: "Failed to fetch today's news", variant: "destructive" }))
        .finally(() => setIsGenerating(false));
    }
  }, [isLoading, hasToday]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading || (isGenerating && !hasToday)) {
    return <GeneratingScreen />;
  }

  // ── Derive what to show per plan ─────────────────────────────────────────
  // For FREE users: show today's articles only. First 5 are readable, rest blurred.
  // For PRO users:  show all items filtered by category.
  const proDisplayItems = category === "All"
    ? (allItems as any[])
    : (allItems as any[]).filter((i: any) => i.category === category);

  const freeDisplayItems = todayItems; // free users always see today only

  const displayItems = plan.isPro ? proDisplayItems : freeDisplayItems;

  const freeLockedCount = !plan.isPro
    ? Math.max(0, freeDisplayItems.length - FREE_VISIBLE_COUNT)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Newspaper className="w-8 h-8 text-primary" />
            Current Affairs
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-muted-foreground">
              {plan.isPro ? `${displayItems.length} articles` : `${Math.min(freeDisplayItems.length, FREE_VISIBLE_COUNT)} of today's news`}
              {todayItems.length > 0 && plan.isPro
                ? <> · <span className="text-green-600 font-medium">{todayItems.length} from today</span></>
                : null}
            </p>
            {plan.isPro && lastRefreshedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Note: refresh happens by reloading the page, no manual refresh button */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <RefreshCw className="w-3 h-3" />
        For the latest current affairs, refresh the page.
      </p>

      {/* FREE plan: upgrade banner showing locked count */}
      {!plan.isPro && plan.isLoaded && (
        <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-900 font-semibold">Free plan: Today's top 5 articles</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Upgrade to Pro for all 15 daily articles, 30-day archive, category filters, and Practice MCQ buttons.
            </p>
          </div>
          <Link href="/upgrade">
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:from-amber-600 hover:to-orange-600 shrink-0 shadow-sm">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Upgrade
            </Button>
          </Link>
        </div>
      )}

      {/* Category filters — Pro only */}
      {plan.isPro && (
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
      )}

      {/* No articles */}
      {displayItems.length === 0 && !isGenerating && (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center">
            <Newspaper className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-medium">
            {plan.isPro && category !== "All" ? `No articles in "${category}"` : "No news available yet"}
          </p>
          <p className="text-muted-foreground text-sm">
            {plan.isPro && category !== "All" ? "Try a different category." : "Auto-fetch is running…"}
          </p>
        </div>
      )}

      {/* Article list */}
      <div className="space-y-3">
        {displayItems.map((item: any, index: number) => {
          // For free users: items beyond FREE_VISIBLE_COUNT are blurred
          const isBlurred = !plan.isPro && index >= FREE_VISIBLE_COUNT;

          return (
            <ArticleCard
              key={item.id}
              item={item}
              index={index}
              isPro={plan.isPro}
              isBlurred={isBlurred}
              isExpanded={expanded.has(item.id)}
              onToggle={() => toggleExpand(item.id)}
            />
          );
        })}
      </div>

      {/* Free upgrade CTA at bottom of list (when blurred items exist) */}
      {!plan.isPro && freeLockedCount > 0 && (
        <div className="text-center py-6 space-y-3 border-t">
          <p className="text-muted-foreground text-sm">
            <span className="font-semibold text-foreground">{freeLockedCount} more articles</span> available in Pro
          </p>
          <Link href="/upgrade">
            <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-md">
              <Sparkles className="mr-2 h-4 w-4" />
              Unlock All 15 Articles + MCQ Practice
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground">₹129/month · Cancel anytime</p>
        </div>
      )}
    </div>
  );
}
