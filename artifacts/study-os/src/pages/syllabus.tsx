import { useGetSyllabus, useUpdateTopicProgress, getGetSyllabusQueryKey } from "@workspace/api-client-react";
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

type TopicStatus = "not_started" | "in_progress" | "completed";

interface TopicWithProgress {
  id: string;
  name: string;
  status: string;
  lastRevisedAt?: string | null;
}

interface SubjectWithTopics {
  id: string;
  name: string;
  topics: TopicWithProgress[];
}

interface ExamWithProgress {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  subjects: SubjectWithTopics[];
}

export default function SyllabusPage() {
  const qc = useQueryClient();
  const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: rawData = [], isLoading } = useGetSyllabus({}, {
    query: { queryKey: getGetSyllabusQueryKey() }
  });
  const exams = rawData as ExamWithProgress[];

  const updateProgress = useUpdateTopicProgress();

  const toggle = (set: Set<string>, key: string) => {
    const n = new Set(set);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  };

  const cycleStatus = (topic: TopicWithProgress) => {
    const statuses: TopicStatus[] = ["not_started", "in_progress", "completed"];
    const next = statuses[(statuses.indexOf(topic.status as TopicStatus) + 1) % 3];
    updateProgress.mutate(
      { topicId: topic.id, data: { status: next } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetSyllabusQueryKey() }) }
    );
  };

  const allTopics = exams.flatMap((e) => e.subjects.flatMap((s) => s.topics));
  const total = allTopics.length;
  const done = allTopics.filter((t) => t.status === "completed").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-3">No Syllabus Yet</h1>
          <p className="text-muted-foreground max-w-md">
            The admin hasn't imported any syllabus data yet. Once imported, your exam topics will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Syllabus Tracker</h1>
        <p className="text-muted-foreground mt-1">Track every topic. Tap the status icon to mark progress.</p>
      </div>

      {total > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Overall Completion</span>
              <span className="font-bold text-primary">{done}/{total} topics ({pct}%)</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        {["all", "not_started", "in_progress", "completed"].map((f) => (
          <Button key={f} variant={statusFilter === f ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(f)}>
            {f === "all" ? "All" : f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {exams.map((exam) => {
          const examTopics = exam.subjects.flatMap((s) => s.topics);
          const examDone = examTopics.filter((t) => t.status === "completed").length;
          const isExamExpanded = expandedExams.has(exam.id);

          return (
            <Card key={exam.id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors bg-primary/5 border-b"
                onClick={() => setExpandedExams(toggle(expandedExams, exam.id))}
              >
                {isExamExpanded
                  ? <ChevronDown className="w-5 h-5 text-primary shrink-0" />
                  : <ChevronRight className="w-5 h-5 text-primary shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base">{exam.name}</span>
                    <Badge variant="secondary" className="text-xs font-mono">{exam.code}</Badge>
                  </div>
                  {exam.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{exam.description}</p>
                  )}
                </div>
                <Badge variant={examDone === examTopics.length && examTopics.length > 0 ? "default" : "secondary"} className="shrink-0">
                  {examDone}/{examTopics.length}
                </Badge>
              </div>

              {isExamExpanded && (
                <div className="divide-y">
                  {exam.subjects.map((subject) => {
                    const filteredTopics = statusFilter === "all"
                      ? subject.topics
                      : subject.topics.filter((t) => t.status === statusFilter);

                    if (filteredTopics.length === 0) return null;

                    const subjectDone = subject.topics.filter((t) => t.status === "completed").length;
                    const subjectKey = `${exam.id}::${subject.id}`;
                    const isSubjExpanded = expandedSubjects.has(subjectKey);

                    return (
                      <div key={subject.id}>
                        <div
                          className="flex items-center gap-3 px-4 py-3 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => setExpandedSubjects(toggle(expandedSubjects, subjectKey))}
                        >
                          <div className="w-5 shrink-0" />
                          {isSubjExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          }
                          <span className="text-sm font-semibold flex-1">{subject.name}</span>
                          <span className="text-xs text-muted-foreground">{subjectDone}/{subject.topics.length}</span>
                        </div>

                        {isSubjExpanded && filteredTopics.map((topic) => {
                          const status = (topic.status || "not_started") as keyof typeof STATUS_CONFIG;
                          const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
                          const Icon = cfg.icon;
                          return (
                            <div
                              key={topic.id}
                              className="flex items-center gap-3 px-4 py-2.5 border-t border-muted/50 hover:bg-muted/20 transition-colors"
                            >
                              <div className="w-9 shrink-0" />
                              <button
                                onClick={() => cycleStatus(topic)}
                                className={cn("shrink-0 transition-colors hover:scale-110", cfg.color)}
                                title={`Status: ${cfg.label} — click to change`}
                              >
                                <Icon className="w-5 h-5" />
                              </button>
                              <span className={cn(
                                "text-sm flex-1",
                                topic.status === "completed" && "line-through text-muted-foreground"
                              )}>
                                {topic.name}
                              </span>
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
