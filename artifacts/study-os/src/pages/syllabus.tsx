import { useGetSyllabus, useUpdateSyllabusItem, useSeedSyllabus, getGetSyllabusQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Circle, Minus, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  not_started: { label: "Not Started", icon: Circle, color: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Minus, color: "text-amber-500" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-500" },
};

interface SyllabusItem {
  id: string;
  subject?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  status: string;
  confidence?: string | null;
}

export default function SyllabusPage() {
  const qc = useQueryClient();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: rawItems = [], isLoading } = useGetSyllabus({}, {
    query: { queryKey: getGetSyllabusQueryKey() }
  });
  const items = rawItems as SyllabusItem[];

  const updateItem = useUpdateSyllabusItem();
  const seed = useSeedSyllabus();

  const handleSeed = () => seed.mutate({}, {
    onSuccess: () => qc.invalidateQueries({ queryKey: getGetSyllabusQueryKey() })
  });

  const toggleSubject = (s: string) => setExpandedSubjects(prev => {
    const n = new Set(prev);
    n.has(s) ? n.delete(s) : n.add(s);
    return n;
  });

  const toggleTopic = (t: string) => setExpandedTopics(prev => {
    const n = new Set(prev);
    n.has(t) ? n.delete(t) : n.add(t);
    return n;
  });

  const cycleStatus = (item: SyllabusItem) => {
    const statuses = ["not_started", "in_progress", "completed"];
    const next = statuses[(statuses.indexOf(item.status) + 1) % 3];
    updateItem.mutate(
      { id: item.id, data: { status: next as any } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetSyllabusQueryKey() }) }
    );
  };

  const filtered = statusFilter === "all" ? items : items.filter(i => i.status === statusFilter);

  const grouped: Record<string, Record<string, SyllabusItem[]>> = {};
  for (const item of filtered) {
    const subj = item.subject ?? "Uncategorized";
    const topic = item.topic ?? "General";
    if (!grouped[subj]) grouped[subj] = {};
    if (!grouped[subj][topic]) grouped[subj][topic] = [];
    grouped[subj][topic].push(item);
  }

  const total = items.length;
  const done = items.filter(i => i.status === "completed").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse"/>)}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-primary"/>
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-3">Load Your Syllabus</h1>
          <p className="text-muted-foreground max-w-md">Populate your exam syllabus to track progress topic by topic.</p>
        </div>
        <Button size="lg" onClick={handleSeed} disabled={seed.isPending}>
          {seed.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BookOpen className="mr-2 h-4 w-4"/>}
          Load Syllabus
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Syllabus Tracker</h1>
        <p className="text-muted-foreground mt-1">Track every topic. Tap status icon to mark progress.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Overall Completion</span>
            <span className="font-bold text-primary">{done}/{total} topics ({pct}%)</span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }}/>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        {["all", "not_started", "in_progress", "completed"].map(f => (
          <Button key={f} variant={statusFilter === f ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(f)}>
            {f === "all" ? "All" : f.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([subject, topics]) => {
          const subjectItems = Object.values(topics).flat();
          const subjectDone = subjectItems.filter(i => i.status === "completed").length;
          const isExpanded = expandedSubjects.has(subject);
          return (
            <Card key={subject}>
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleSubject(subject)}
              >
                {isExpanded
                  ? <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0"/>
                  : <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0"/>
                }
                <span className="font-semibold flex-1">{subject}</span>
                <Badge variant="secondary" className="text-xs">{subjectDone}/{subjectItems.length}</Badge>
              </div>

              {isExpanded && (
                <div className="border-t">
                  {Object.entries(topics).map(([topic, subtopics]) => {
                    const topicKey = `${subject}::${topic}`;
                    const topicDone = subtopics.filter(i => i.status === "completed").length;
                    const isTopicExp = expandedTopics.has(topicKey);
                    return (
                      <div key={topic}>
                        <div
                          className="flex items-center gap-3 px-4 py-3 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => toggleTopic(topicKey)}
                        >
                          <div className="w-5 shrink-0"/>
                          {isTopicExp
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0"/>
                            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0"/>
                          }
                          <span className="text-sm font-medium flex-1">{topic}</span>
                          <span className="text-xs text-muted-foreground">{topicDone}/{subtopics.length}</span>
                        </div>

                        {isTopicExp && subtopics.map(item => {
                          const status = item.status as keyof typeof STATUS_CONFIG;
                          const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
                          const Icon = cfg.icon;
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 px-4 py-2.5 border-t border-muted/50 hover:bg-muted/20 transition-colors"
                            >
                              <div className="w-9 shrink-0"/>
                              <button
                                onClick={() => cycleStatus(item)}
                                className={cn("shrink-0 transition-colors hover:scale-110", cfg.color)}
                                title="Click to change status"
                              >
                                <Icon className="w-5 h-5"/>
                              </button>
                              <span className={cn("text-sm flex-1", item.status === "completed" && "line-through text-muted-foreground")}>
                                {item.subtopic}
                              </span>
                              {item.confidence && (
                                <span className={cn(
                                  "text-xs font-medium capitalize",
                                  item.confidence === "weak" ? "text-red-500" :
                                  item.confidence === "medium" ? "text-amber-500" : "text-green-500"
                                )}>
                                  {item.confidence}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
