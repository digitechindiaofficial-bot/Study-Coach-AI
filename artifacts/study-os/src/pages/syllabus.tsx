import { useGetSyllabus, useUpdateTopicProgress, getGetSyllabusQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle2, Circle, Minus, ChevronDown, ChevronRight,
  BookOpen, Brain, HelpCircle, FileText, PenLine, RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { isPreviewEnvironment } from "@/lib/app-auth";
import { getPreviewSyllabus } from "@/lib/preview-data";

const STATUS_CONFIG = {
  not_started: { label: "Not Started", icon: Circle, color: "text-muted-foreground", badge: "secondary" },
  in_progress:  { label: "In Progress", icon: Minus,        color: "text-amber-500",       badge: "warning"   },
  completed:    { label: "Completed",   icon: CheckCircle2, color: "text-green-500",        badge: "success"   },
} as const;

const TOPIC_ACTIONS = [
  { icon: Brain,      label: "AI Notes"   },
  { icon: HelpCircle, label: "Quiz"       },
  { icon: FileText,   label: "PYQs"       },
  { icon: PenLine,    label: "Practice"   },
  { icon: RotateCcw,  label: "Revise"     },
] as const;

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
  const preview = isPreviewEnvironment();
  const [previewExams, setPreviewExams] = useState<ExamWithProgress[]>(
    () => (preview ? getPreviewSyllabus() as ExamWithProgress[] : []),
  );
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopic, setExpandedTopic]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter]         = useState("all");

  const { data: rawData = [], isLoading } = useGetSyllabus({
    query: { queryKey: getGetSyllabusQueryKey(), enabled: !preview },
  });
  const exams = (preview ? previewExams : rawData) as ExamWithProgress[];
  const exam  = exams[0] ?? null;

  const updateProgress = useUpdateTopicProgress();

  const toggleSubject = (id: string) => {
    setExpandedSubjects((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const cycleStatus = (topic: TopicWithProgress) => {
    const order: TopicStatus[] = ["not_started", "in_progress", "completed"];
    const next = order[(order.indexOf(topic.status as TopicStatus) + 1) % 3];
    if (preview) {
      setPreviewExams((previous) => previous.map((item) => ({
        ...item,
        subjects: item.subjects.map((subject) => ({
          ...subject,
          topics: subject.topics.map((currentTopic) =>
            currentTopic.id === topic.id
              ? { ...currentTopic, status: next }
              : currentTopic,
          ),
        })),
      })));
      return;
    }
    updateProgress.mutate(
      { topicId: topic.id, data: { status: next } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetSyllabusQueryKey() }) },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">No Syllabus Yet</h1>
          <p className="text-muted-foreground max-w-sm text-sm">
            Your exam syllabus hasn't been imported yet. It will appear here once the admin adds it.
          </p>
        </div>
      </div>
    );
  }

  const allTopics = exam.subjects.flatMap((s) => s.topics);
  const done = allTopics.filter((t) => t.status === "completed").length;
  const inProg = allTopics.filter((t) => t.status === "in_progress").length;
  const total  = allTopics.length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <h1 className="text-2xl font-bold tracking-tight">{exam.name} Syllabus</h1>
          <Badge variant="secondary" className="font-mono text-xs">{exam.code}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Tap a topic's status icon to cycle through Not Started → In Progress → Completed.
        </p>
      </div>

      {/* Progress card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">Overall Progress</span>
            <span className="text-sm font-bold text-primary">{pct}% complete</span>
          </div>
          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span><span className="font-semibold text-green-500">{done}</span> Completed</span>
            <span><span className="font-semibold text-amber-500">{inProg}</span> In Progress</span>
            <span><span className="font-semibold">{total - done - inProg}</span> Not Started</span>
          </div>
        </CardContent>
      </Card>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "not_started", "in_progress", "completed"] as const).map((f) => (
          <Button
            key={f}
            variant={statusFilter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(f)}
            className="h-8 text-xs"
          >
            {f === "all" ? "All Topics" : f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Button>
        ))}
      </div>

      {/* Subject → Topic tree */}
      <div className="space-y-3">
        {exam.subjects.map((subject) => {
          const filteredTopics = statusFilter === "all"
            ? subject.topics
            : subject.topics.filter((t) => t.status === statusFilter);
          if (filteredTopics.length === 0) return null;

          const subjectDone  = subject.topics.filter((t) => t.status === "completed").length;
          const isExpanded   = expandedSubjects.has(subject.id);
          const allDone      = subjectDone === subject.topics.length && subject.topics.length > 0;

          return (
            <Card key={subject.id} className="overflow-hidden">
              {/* Subject header */}
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors",
                  "hover:bg-muted/30",
                  allDone ? "bg-green-500/5" : "bg-muted/10",
                )}
                onClick={() => toggleSubject(subject.id)}
              >
                {isExpanded
                  ? <ChevronDown  className="w-4 h-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className="font-semibold text-sm flex-1">{subject.name}</span>
                <span className={cn(
                  "text-xs font-medium tabular-nums",
                  allDone ? "text-green-500" : "text-muted-foreground",
                )}>
                  {subjectDone}/{subject.topics.length}
                </span>
              </div>

              {/* Topics */}
              {isExpanded && (
                <div className="divide-y divide-muted/50 border-t">
                  {filteredTopics.map((topic) => {
                    const status  = (topic.status || "not_started") as TopicStatus;
                    const cfg     = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
                    const Icon    = cfg.icon;
                    const isOpen  = expandedTopic === topic.id;

                    return (
                      <div key={topic.id} className="group">
                        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                          {/* Status toggle */}
                          <button
                            onClick={() => cycleStatus(topic)}
                            className={cn("shrink-0 transition-all hover:scale-110", cfg.color)}
                            title={`${cfg.label} — click to change`}
                          >
                            <Icon className="w-5 h-5" />
                          </button>

                          {/* Topic name */}
                          <span
                            className={cn(
                              "text-sm flex-1 cursor-pointer",
                              status === "completed" && "line-through text-muted-foreground",
                            )}
                            onClick={() => setExpandedTopic(isOpen ? null : topic.id)}
                          >
                            {topic.name}
                          </span>

                          {/* Expand actions button */}
                          <button
                            onClick={() => setExpandedTopic(isOpen ? null : topic.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          >
                            <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
                          </button>
                        </div>

                        {/* Topic action buttons */}
                        {isOpen && (
                          <div className="px-4 pb-3 flex gap-2 flex-wrap">
                            {TOPIC_ACTIONS.map(({ icon: ActionIcon, label }) => (
                              <Button
                                key={label}
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5"
                                onClick={() => {}}
                              >
                                <ActionIcon className="w-3.5 h-3.5" />
                                {label}
                              </Button>
                            ))}
                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1.5 ml-auto"
                              variant={status === "completed" ? "secondary" : "default"}
                              onClick={() => {
                                const next: TopicStatus = status === "completed" ? "not_started" : "completed";
                                updateProgress.mutate(
                                  { topicId: topic.id, data: { status: next } },
                                  { onSuccess: () => qc.invalidateQueries({ queryKey: getGetSyllabusQueryKey() }) },
                                );
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {status === "completed" ? "Mark Incomplete" : "Mark Complete"}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {filteredCount(exam, statusFilter) === 0 && statusFilter !== "all" && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No topics with status "{statusFilter.replace(/_/g, " ")}" found.
        </div>
      )}
    </div>
  );
}

function filteredCount(exam: ExamWithProgress, filter: string) {
  return exam.subjects.reduce((acc, s) => {
    return acc + (filter === "all" ? s.topics.length : s.topics.filter((t) => t.status === filter).length);
  }, 0);
}
