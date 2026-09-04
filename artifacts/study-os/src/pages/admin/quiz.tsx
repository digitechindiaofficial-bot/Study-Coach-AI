import { useEffect, useState } from "react";
import { adminFetch as fetch } from "@/lib/admin-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, BrainCircuit, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  id: string;
  subject: string | null;
  topic: string | null;
  questionText: string;
  options: Record<string, string>;
  correctOption: string;
  explanation: string | null;
  difficulty: string | null;
  examType: string[] | null;
  createdAt: string;
}

const SUBJECTS = ["Quantitative Aptitude", "Reasoning", "English", "General Awareness", "Current Affairs"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const EXAMS = ["SSC_CGL", "SSC_CHSL", "IBPS_PO", "IBPS_CLERK", "SBI_PO", "RRB_NTPC", "UPPSC", "BPSC"];

const emptyForm = {
  subject: "",
  topic: "",
  questionText: "",
  options: { a: "", b: "", c: "", d: "" },
  correctOption: "a",
  explanation: "",
  difficulty: "Medium",
  examType: [] as string[],
};

export default function AdminQuizPage() {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async (subject?: string) => {
    setIsLoading(true);
    try {
      const qs = subject && subject !== "All" ? `?subject=${encodeURIComponent(subject)}` : "";
      const [qRes, cRes] = await Promise.all([
        fetch(`/api/admin/quiz/questions${qs}`, { credentials: "include", headers: { "Cache-Control": "no-cache" } }),
        fetch("/api/admin/quiz/subject-counts", { credentials: "include", headers: { "Cache-Control": "no-cache" } }),
      ]);
      if (!qRes.ok || !cRes.ok) throw new Error();
      setQuestions(await qRes.json());
      setCounts(await cRes.json());
    } catch {
      toast({ title: "Failed to load quiz questions", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(subjectFilter);
  }, [subjectFilter]);

  const toggleExam = (exam: string) => {
    setForm((f) => ({
      ...f,
      examType: f.examType.includes(exam) ? f.examType.filter((e) => e !== exam) : [...f.examType, exam],
    }));
  };

  const handleCreate = async () => {
    if (!form.questionText.trim()) {
      toast({ title: "Question text is required", variant: "destructive" });
      return;
    }
    if (Object.values(form.options).some((v) => !v.trim())) {
      toast({ title: "All four options are required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/quiz/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Question created" });
      setDialogOpen(false);
      setForm(emptyForm);
      load(subjectFilter);
    } catch {
      toast({ title: "Failed to create question", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/quiz/questions/${deleteId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      toast({ title: "Question deleted" });
      setQuestions((prev) => prev.filter((q) => q.id !== deleteId));
    } catch {
      toast({ title: "Failed to delete question", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-700">Quiz Questions Manager</h1>
          <p className="text-muted-foreground mt-1">Add and manage quiz questions across subjects.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-700 hover:to-orange-600">
              <Plus className="mr-2 h-4 w-4" /> New Question
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Quiz Question</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Percentages" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Question</Label>
                <Textarea value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} rows={3} placeholder="Question text" />
              </div>

              <div className="space-y-2">
                <Label>Options</Label>
                {(["a", "b", "c", "d"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, correctOption: key })}
                      className={cn(
                        "h-8 w-8 shrink-0 rounded-full border-2 flex items-center justify-center text-xs font-bold uppercase transition-colors",
                        form.correctOption === key
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-muted text-muted-foreground"
                      )}
                      title="Mark as correct"
                    >
                      {form.correctOption === key ? <CheckCircle2 className="h-4 w-4" /> : key}
                    </button>
                    <Input
                      value={form.options[key]}
                      onChange={(e) => setForm({ ...form, options: { ...form.options, [key]: e.target.value } })}
                      placeholder={`Option ${key.toUpperCase()}`}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Click the circle next to an option to mark it correct.</p>
              </div>

              <div className="space-y-2">
                <Label>Explanation</Label>
                <Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} placeholder="Why this answer is correct" />
              </div>

              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Exam Relevance</Label>
                <div className="flex flex-wrap gap-2">
                  {EXAMS.map((exam) => (
                    <Badge
                      key={exam}
                      onClick={() => toggleExam(exam)}
                      className={cn(
                        "cursor-pointer select-none",
                        form.examType.includes(exam)
                          ? "bg-red-100 text-red-700 border-red-300"
                          : "bg-muted text-muted-foreground border-transparent"
                      )}
                    >
                      {exam.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={isSaving} className="bg-red-600 hover:bg-red-700 text-white">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Question
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {["All", ...SUBJECTS].map((s) => (
          <Badge
            key={s}
            onClick={() => setSubjectFilter(s)}
            className={cn(
              "cursor-pointer select-none",
              subjectFilter === s
                ? "bg-red-600 text-white border-red-600"
                : "bg-muted text-muted-foreground border-transparent"
            )}
          >
            {s} {s !== "All" && counts[s] !== undefined ? `(${counts[s]})` : s === "All" ? `(${Object.values(counts).reduce((a, b) => a + b, 0)})` : ""}
          </Badge>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        </div>
      )}

      {!isLoading && questions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-2">
            <BrainCircuit className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No quiz questions found.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {questions.map((q) => (
          <Card key={q.id} className="border-orange-100">
            <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {q.subject && <Badge variant="secondary">{q.subject}</Badge>}
                  {q.difficulty && <Badge variant="outline">{q.difficulty}</Badge>}
                </div>
                <h3 className="font-medium mb-1">{q.questionText}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground mb-1">
                  {Object.entries(q.options).map(([key, val]) => (
                    <span key={key} className={cn(key === q.correctOption && "text-green-700 font-medium")}>
                      {key.toUpperCase()}. {val}
                    </span>
                  ))}
                </div>
                {q.topic && <p className="text-xs text-muted-foreground">Topic: {q.topic}</p>}
              </div>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0" onClick={() => setDeleteId(q.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
