import { useGetCurrentAffairs, useGenerateMcqFromNews, getGetCurrentAffairsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_COLORS: Record<string, string> = {
  Economy: "bg-green-100 text-green-700 border-green-200",
  Polity: "bg-blue-100 text-blue-700 border-blue-200",
  Science: "bg-purple-100 text-purple-700 border-purple-200",
  Sports: "bg-orange-100 text-orange-700 border-orange-200",
  International: "bg-red-100 text-red-700 border-red-200",
  Environment: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Awards: "bg-amber-100 text-amber-700 border-amber-200",
};

const DAYS_OPTIONS = [3, 7, 14, 30];
const CATEGORIES = ["All","Economy","Polity","Science","Sports","International","Environment","Awards"];

interface MCQ { question: string; options: Record<string,string>; correct: string; explanation: string; }

export default function CurrentAffairsPage() {
  const { toast } = useToast();
  const [days, setDays] = useState(7);
  const [category, setCategory] = useState("All");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mcqs, setMcqs] = useState<Record<string, MCQ[]>>({});
  const [loadingMcq, setLoadingMcq] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Record<number, string>>>({});

  const queryParams = category !== "All" ? { days, category } : { days };
  const { data: items = [], isLoading } = useGetCurrentAffairs(queryParams as any, {
    query: { queryKey: getGetCurrentAffairsQueryKey({ days }) }
  });

  const generateMcq = useGenerateMcqFromNews();

  const toggle = (id: string) => setExpanded(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleGenerateMcq = (item: any) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Newspaper className="w-8 h-8 text-primary"/>
          Current Affairs
        </h1>
        <p className="text-muted-foreground mt-1">Stay updated. Generate MCQs instantly from any article.</p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {DAYS_OPTIONS.map(d => (
            <Button key={d} variant={days === d ? "default" : "outline"} size="sm" onClick={() => setDays(d)}>
              Last {d} days
            </Button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <Button key={c} variant={category === c ? "default" : "outline"} size="sm" onClick={() => setCategory(c)}>
              {c}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded animate-pulse"/>)}
        </div>
      )}

      {!isLoading && (items as any[]).length === 0 && (
        <div className="text-center py-20 text-muted-foreground">No articles found for the selected filters.</div>
      )}

      <div className="space-y-4">
        {(items as any[]).map((item: any) => {
          const isExp = expanded.has(item.id);
          const catColor = CATEGORY_COLORS[item.category ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";
          const itemMcqs = mcqs[item.id];
          const answers = selectedAnswers[item.id] ?? {};

          return (
            <Card key={item.id} className={item.isFeatured ? "border-primary/30" : ""}>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => toggle(item.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className={`text-[10px] border ${catColor}`}>{item.category}</Badge>
                      {item.isFeatured && (
                        <Badge className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-300">Featured</Badge>
                      )}
                      {item.publishedDate && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.publishedDate), "d MMM yyyy")}
                        </span>
                      )}
                      {item.source && <span className="text-xs text-muted-foreground">• {item.source}</span>}
                    </div>
                    <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
                  </div>
                  {isExp
                    ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0"/>
                    : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0"/>
                  }
                </div>
              </CardHeader>

              {isExp && (
                <CardContent className="pt-0 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.summary}</p>

                  {item.examRelevance && item.examRelevance.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      <span className="text-xs text-muted-foreground mr-1">Relevant for:</span>
                      {item.examRelevance.map((e: string) => (
                        <Badge key={e} variant="outline" className="text-[10px]">{e.replace(/_/g, " ")}</Badge>
                      ))}
                    </div>
                  )}

                  {!itemMcqs && (
                    <Button size="sm" variant="secondary" onClick={() => handleGenerateMcq(item)} disabled={loadingMcq === item.id}>
                      {loadingMcq === item.id
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                        : <Zap className="mr-2 h-4 w-4"/>
                      }
                      Generate MCQ Practice
                    </Button>
                  )}

                  {itemMcqs && (
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
                                let cls = "border text-xs p-2 rounded text-left transition-colors w-full ";
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
                              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
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
