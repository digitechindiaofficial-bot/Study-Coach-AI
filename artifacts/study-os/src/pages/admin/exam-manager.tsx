import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Pencil, Trash2, Star, Globe, GlobeLock,
  Loader2, RefreshCw, LayoutGrid, BookOpen, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Exam {
  id: string;
  code: string;
  name: string;
  exam_full_name: string | null;
  category: string;
  conducting_body: string | null;
  description: string | null;
  eligibility: string | null;
  exam_level: string;
  target_state: string | null;
  is_active: boolean;
  is_featured: boolean;
  icon_emoji: string;
  display_order: number;
  subject_count: number;
}

interface Subject {
  id: string;
  subject_code: string;
  name: string;
  subject_full_name: string | null;
  syllabus_topics: string[];
  total_questions: number;
  total_marks: number | null;
  duration_minutes: number | null;
  difficulty_level: string;
  is_active: boolean;
  display_order: number;
}

const CATEGORIES = ["central","state","banking","railway","defence","teaching","other"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  central: "Central", state: "State", banking: "Banking",
  railway: "Railway", defence: "Defence", teaching: "Teaching", other: "Other",
};
const CATEGORY_COLORS: Record<string, string> = {
  central: "bg-blue-100 text-blue-700",
  state: "bg-purple-100 text-purple-700",
  banking: "bg-green-100 text-green-700",
  railway: "bg-orange-100 text-orange-700",
  defence: "bg-red-100 text-red-700",
  teaching: "bg-pink-100 text-pink-700",
  other: "bg-gray-100 text-gray-700",
};
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
  mixed: "bg-blue-100 text-blue-700",
};
const EMOJIS = ["📝","📋","🏦","💼","🚂","🗺️","🎯","🏛️","⚖️","🔬","📚","🏥","✈️","🛡️","🎓","🌐"];
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Delhi",
];

// ── Blank form helpers ────────────────────────────────────────────────────────

const blankExam = () => ({
  code: "", name: "", exam_full_name: "", category: "central" as const,
  conducting_body: "", description: "", eligibility: "",
  exam_level: "national" as "national" | "state", target_state: "",
  is_active: true, is_featured: false, icon_emoji: "📝", display_order: 0,
});
const blankSubject = () => ({
  subject_code: "", name: "", subject_full_name: "",
  syllabus_topics: [] as string[],
  total_marks: "" as any, duration_minutes: "" as any,
  difficulty_level: "medium" as const, is_active: true, display_order: 0,
});

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExamManagerPage() {
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Exam modal state
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examForm, setExamForm] = useState(blankExam());
  const [examSaving, setExamSaving] = useState(false);
  const [deleteExamId, setDeleteExamId] = useState<string | null>(null);

  // Subject modal state
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState(blankSubject());
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [deleteSubjectId, setDeleteSubjectId] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const api = (path: string, opts?: RequestInit) =>
    fetch(path, { credentials: "include", ...opts });

  // ── Load exams ──────────────────────────────────────────────────────────────

  const loadExams = async () => {
    setLoading(true);
    try {
      const r = await api("/api/admin/exams");
      setExams(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { loadExams(); }, []);

  // ── Load subjects when exam selected ────────────────────────────────────────

  const loadSubjects = async (examCode: string) => {
    setSubjectsLoading(true);
    try {
      const r = await api(`/api/admin/exams/${examCode}/subjects`);
      setSubjects(await r.json());
    } finally { setSubjectsLoading(false); }
  };

  const selectExam = (exam: Exam) => {
    setSelectedExam(exam);
    loadSubjects(exam.code);
  };

  // ── Exam CRUD ───────────────────────────────────────────────────────────────

  const openCreateExam = () => {
    setEditingExam(null);
    setExamForm(blankExam());
    setExamModalOpen(true);
  };

  const openEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setExamForm({
      code: exam.code, name: exam.name,
      exam_full_name: exam.exam_full_name ?? "",
      category: exam.category as any,
      conducting_body: exam.conducting_body ?? "",
      description: exam.description ?? "",
      eligibility: exam.eligibility ?? "",
      exam_level: exam.exam_level as any,
      target_state: exam.target_state ?? "",
      is_active: exam.is_active, is_featured: exam.is_featured,
      icon_emoji: exam.icon_emoji, display_order: exam.display_order,
    });
    setExamModalOpen(true);
  };

  const saveExam = async () => {
    if (!examForm.code.trim() || !examForm.name.trim()) {
      toast({ title: "Code and Name are required", variant: "destructive" }); return;
    }
    setExamSaving(true);
    try {
      const url = editingExam ? `/api/admin/exams/${editingExam.code}` : "/api/admin/exams";
      const method = editingExam ? "PUT" : "POST";
      const payload = editingExam
        ? { ...examForm, code: undefined }
        : { ...examForm };
      const r = await api(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to save");
      toast({ title: editingExam ? "Exam updated" : "Exam created" });
      setExamModalOpen(false);
      await loadExams();
      if (selectedExam?.code === editingExam?.code) {
        setSelectedExam(data);
      }
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setExamSaving(false); }
  };

  const deleteExam = async () => {
    if (!deleteExamId) return;
    const exam = exams.find(e => e.id === deleteExamId);
    if (!exam) return;
    const r = await api(`/api/admin/exams/${exam.code}`, { method: "DELETE" });
    if (!r.ok) { toast({ title: "Failed to delete", variant: "destructive" }); return; }
    toast({ title: "Exam deleted" });
    setDeleteExamId(null);
    if (selectedExam?.id === deleteExamId) { setSelectedExam(null); setSubjects([]); }
    await loadExams();
  };

  const toggleActive = async (exam: Exam) => {
    await api(`/api/admin/exams/${exam.code}/toggle-active`, { method: "PUT" });
    await loadExams();
    if (selectedExam?.id === exam.id) setSelectedExam(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
  };

  const toggleFeatured = async (exam: Exam) => {
    await api(`/api/admin/exams/${exam.code}/toggle-featured`, { method: "PUT" });
    await loadExams();
    if (selectedExam?.id === exam.id) setSelectedExam(prev => prev ? { ...prev, is_featured: !prev.is_featured } : null);
  };

  // ── Subject CRUD ────────────────────────────────────────────────────────────

  const openCreateSubject = () => {
    setEditingSubject(null);
    setSubjectForm(blankSubject());
    setTopicInput("");
    setSubjectModalOpen(true);
  };

  const openEditSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setSubjectForm({
      subject_code: sub.subject_code, name: sub.name,
      subject_full_name: sub.subject_full_name ?? "",
      syllabus_topics: sub.syllabus_topics ?? [],
      total_marks: sub.total_marks ?? "",
      duration_minutes: sub.duration_minutes ?? "",
      difficulty_level: sub.difficulty_level as any,
      is_active: sub.is_active, display_order: sub.display_order,
    });
    setTopicInput("");
    setSubjectModalOpen(true);
  };

  const saveSubject = async () => {
    if (!subjectForm.subject_code.trim() || !subjectForm.name.trim()) {
      toast({ title: "Code and Name are required", variant: "destructive" }); return;
    }
    if (!selectedExam) return;
    setSubjectSaving(true);
    try {
      const url = editingSubject
        ? `/api/admin/exams/${selectedExam.code}/subjects/${editingSubject.id}`
        : `/api/admin/exams/${selectedExam.code}/subjects`;
      const method = editingSubject ? "PUT" : "POST";
      const payload = {
        ...subjectForm,
        total_marks: subjectForm.total_marks === "" ? null : Number(subjectForm.total_marks),
        duration_minutes: subjectForm.duration_minutes === "" ? null : Number(subjectForm.duration_minutes),
        ...(editingSubject ? { subject_code: undefined } : {}),
      };
      const r = await api(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to save");
      toast({ title: editingSubject ? "Subject updated" : "Subject added" });
      setSubjectModalOpen(false);
      await loadSubjects(selectedExam.code);
      await loadExams();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSubjectSaving(false); }
  };

  const deleteSubject = async () => {
    if (!deleteSubjectId || !selectedExam) return;
    const r = await api(`/api/admin/exams/${selectedExam.code}/subjects/${deleteSubjectId}`, { method: "DELETE" });
    if (!r.ok) { toast({ title: "Failed to delete", variant: "destructive" }); return; }
    toast({ title: "Subject deleted" });
    setDeleteSubjectId(null);
    await loadSubjects(selectedExam.code);
    await loadExams();
  };

  const syncCount = async (sub: Subject) => {
    if (!selectedExam) return;
    setSyncingId(sub.id);
    try {
      const r = await api(`/api/admin/exams/${selectedExam.code}/subjects/${sub.id}/sync-count`, { method: "POST" });
      const data = await r.json();
      toast({ title: `Synced: ${data.total_questions} questions` });
      await loadSubjects(selectedExam.code);
    } finally { setSyncingId(null); }
  };

  const addTopic = () => {
    const t = topicInput.trim();
    if (!t || subjectForm.syllabus_topics.includes(t)) return;
    setSubjectForm(f => ({ ...f, syllabus_topics: [...f.syllabus_topics, t] }));
    setTopicInput("");
  };

  // ── Filtered exam list ───────────────────────────────────────────────────────

  const filtered = exams.filter(e => {
    const matchCat = catFilter === "all" || e.category === catFilter;
    const q = search.toLowerCase();
    const matchQ = !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-700 flex items-center gap-3">
            <Settings2 className="h-8 w-8" />
            Exam Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Add and manage exams and subjects. Changes reflect immediately in the app.
          </p>
        </div>
        <Button
          onClick={openCreateExam}
          className="bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-700 hover:to-orange-600 gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add Exam
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── LEFT: Exam list ── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search + filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search exams…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exam cards */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-red-500" /></div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                {search || catFilter !== "all" ? "No exams match your filters." : "No exams yet."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(exam => (
                <Card
                  key={exam.id}
                  className={cn(
                    "cursor-pointer border transition-all hover:border-red-300",
                    selectedExam?.id === exam.id && "border-red-400 bg-red-50/40",
                    !exam.is_active && "opacity-55",
                  )}
                  onClick={() => selectExam(exam)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className="text-2xl shrink-0">{exam.icon_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm truncate">{exam.name}</span>
                        {exam.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{exam.code}</span>
                        <Badge className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[exam.category])}>
                          {CATEGORY_LABELS[exam.category]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{exam.subject_count} subj</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        className={cn("h-6 w-6 rounded-full border flex items-center justify-center transition-colors",
                          exam.is_active ? "bg-green-100 border-green-300 text-green-600 hover:bg-red-100 hover:border-red-300 hover:text-red-600"
                            : "bg-red-100 border-red-300 text-red-600 hover:bg-green-100 hover:border-green-300 hover:text-green-600")}
                        title={exam.is_active ? "Deactivate" : "Activate"}
                        onClick={() => toggleActive(exam)}
                      >
                        {exam.is_active ? <Globe className="h-3 w-3" /> : <GlobeLock className="h-3 w-3" />}
                      </button>
                      <button
                        className={cn("h-6 w-6 rounded-full border flex items-center justify-center transition-colors",
                          exam.is_featured ? "bg-amber-100 border-amber-300 text-amber-600" : "bg-muted border-border text-muted-foreground hover:bg-amber-50 hover:text-amber-600")}
                        title={exam.is_featured ? "Unfeature" : "Feature"}
                        onClick={() => toggleFeatured(exam)}
                      >
                        <Star className={cn("h-3 w-3", exam.is_featured && "fill-amber-400")} />
                      </button>
                      <button
                        className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        onClick={() => openEditExam(exam)}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-red-50 hover:border-red-300 transition-colors"
                        onClick={() => setDeleteExamId(exam.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Subjects ── */}
        <div className="lg:col-span-3">
          {!selectedExam ? (
            <Card className="border-dashed h-full flex items-center justify-center">
              <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <LayoutGrid className="h-10 w-10" />
                <p>Select an exam to manage its subjects</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Exam header */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{selectedExam.icon_emoji}</span>
                      <div>
                        <h2 className="text-lg font-bold">{selectedExam.name}</h2>
                        {selectedExam.exam_full_name && (
                          <p className="text-xs text-muted-foreground">{selectedExam.exam_full_name}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge className={cn("text-xs", CATEGORY_COLORS[selectedExam.category])}>
                            {CATEGORY_LABELS[selectedExam.category]}
                          </Badge>
                          {selectedExam.conducting_body && (
                            <Badge variant="outline" className="text-xs">{selectedExam.conducting_body}</Badge>
                          )}
                          {selectedExam.target_state && (
                            <Badge variant="outline" className="text-xs">{selectedExam.target_state}</Badge>
                          )}
                          {selectedExam.exam_level === "national" ? (
                            <Badge variant="outline" className="text-xs">National</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">State-level</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={openCreateSubject} className="gap-1">
                      <Plus className="h-3.5 w-3.5" /> Add Subject
                    </Button>
                  </div>
                  {selectedExam.eligibility && (
                    <p className="text-xs text-muted-foreground mt-3 border-t pt-3">
                      <span className="font-medium">Eligibility:</span> {selectedExam.eligibility}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Subject list */}
              {subjectsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-red-500" /></div>
              ) : subjects.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2" />
                    <p>No subjects yet. Add one to get started.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {subjects.map(sub => {
                    const topics: string[] = sub.syllabus_topics ?? [];
                    const SHOW_MAX = 5;
                    return (
                      <Card key={sub.id} className={cn("border", !sub.is_active && "opacity-55")}>
                        <CardContent className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm truncate">{sub.name}</span>
                                {!sub.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="text-xs font-mono text-muted-foreground">{sub.subject_code}</span>
                                {sub.subject_full_name && (
                                  <span className="text-xs text-muted-foreground truncate">· {sub.subject_full_name}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => openEditSubject(sub)}
                              ><Pencil className="h-3 w-3" /></button>
                              <button
                                className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-red-300 hover:bg-red-50"
                                onClick={() => setDeleteSubjectId(sub.id)}
                              ><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                              {sub.total_questions} Q
                            </span>
                            {sub.total_marks && (
                              <span className="bg-muted px-2 py-0.5 rounded-full">{sub.total_marks} marks</span>
                            )}
                            {sub.duration_minutes && (
                              <span className="bg-muted px-2 py-0.5 rounded-full">{sub.duration_minutes}m</span>
                            )}
                            <Badge className={cn("text-[10px] px-1.5 py-0 capitalize", DIFFICULTY_COLORS[sub.difficulty_level])}>
                              {sub.difficulty_level}
                            </Badge>
                          </div>

                          {/* Syllabus topics */}
                          {topics.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {topics.slice(0, SHOW_MAX).map((t, i) => (
                                <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border truncate max-w-[120px]">
                                  {t}
                                </span>
                              ))}
                              {topics.length > SHOW_MAX && (
                                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5">
                                  +{topics.length - SHOW_MAX} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Sync count */}
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs gap-1 w-full"
                            disabled={syncingId === sub.id}
                            onClick={() => syncCount(sub)}
                          >
                            {syncingId === sub.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <RefreshCw className="h-3 w-3" />}
                            Sync Q Count
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Exam Modal ── */}
      <Dialog open={examModalOpen} onOpenChange={o => !o && setExamModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExam ? "Edit Exam" : "Add New Exam"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Emoji picker */}
            <div className="space-y-1.5">
              <Label className="text-xs">Icon</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setExamForm(f => ({ ...f, icon_emoji: e }))}
                    className={cn(
                      "w-9 h-9 rounded text-xl flex items-center justify-center border transition-colors",
                      examForm.icon_emoji === e ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                    )}
                  >{e}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Exam Code *</Label>
                <Input
                  value={examForm.code}
                  disabled={!!editingExam}
                  onChange={e => setExamForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="SSC_CGL"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Short Name *</Label>
                <Input value={examForm.name} onChange={e => setExamForm(f => ({ ...f, name: e.target.value }))} placeholder="SSC CGL" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name</Label>
                <Input value={examForm.exam_full_name} onChange={e => setExamForm(f => ({ ...f, exam_full_name: e.target.value }))} placeholder="Staff Selection Commission Combined Graduate Level" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={examForm.category} onValueChange={v => setExamForm(f => ({ ...f, category: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Exam Level</Label>
                <Select value={examForm.exam_level} onValueChange={v => setExamForm(f => ({ ...f, exam_level: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Conducting Body</Label>
                <Input value={examForm.conducting_body} onChange={e => setExamForm(f => ({ ...f, conducting_body: e.target.value }))} placeholder="SSC" />
              </div>
              <div className="space-y-1.5">
                <Label>Target State</Label>
                <Select value={examForm.target_state || "__none__"} onValueChange={v => setExamForm(f => ({ ...f, target_state: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="N/A" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">N/A</SelectItem>
                    {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Display Order</Label>
                <Input type="number" value={examForm.display_order} onChange={e => setExamForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Eligibility</Label>
                <Input value={examForm.eligibility} onChange={e => setExamForm(f => ({ ...f, eligibility: e.target.value }))} placeholder="Graduation" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea value={examForm.description} onChange={e => setExamForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={examForm.is_active} onCheckedChange={v => setExamForm(f => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={examForm.is_featured} onCheckedChange={v => setExamForm(f => ({ ...f, is_featured: v }))} />
                <Label>Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamModalOpen(false)}>Cancel</Button>
            <Button onClick={saveExam} disabled={examSaving} className="bg-red-600 hover:bg-red-700 text-white">
              {examSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingExam ? "Save Changes" : "Create Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Subject Modal ── */}
      <Dialog open={subjectModalOpen} onOpenChange={o => !o && setSubjectModalOpen(false)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubject ? "Edit Subject" : "Add Subject"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Subject Code *</Label>
                <Input
                  value={subjectForm.subject_code}
                  disabled={!!editingSubject}
                  onChange={e => setSubjectForm(f => ({ ...f, subject_code: e.target.value.toUpperCase() }))}
                  placeholder="QA"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subject Name *</Label>
                <Input value={subjectForm.name} onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))} placeholder="Quantitative Aptitude" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name</Label>
                <Input value={subjectForm.subject_full_name} onChange={e => setSubjectForm(f => ({ ...f, subject_full_name: e.target.value }))} placeholder="Quantitative Aptitude & Data Interpretation" />
              </div>
              <div className="space-y-1.5">
                <Label>Total Marks</Label>
                <Input type="number" value={subjectForm.total_marks} onChange={e => setSubjectForm(f => ({ ...f, total_marks: e.target.value }))} placeholder="50" />
              </div>
              <div className="space-y-1.5">
                <Label>Duration (min)</Label>
                <Input type="number" value={subjectForm.duration_minutes} onChange={e => setSubjectForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="60" />
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={subjectForm.difficulty_level} onValueChange={v => setSubjectForm(f => ({ ...f, difficulty_level: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Display Order</Label>
                <Input type="number" value={subjectForm.display_order} onChange={e => setSubjectForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-3 col-span-2">
                <Switch checked={subjectForm.is_active} onCheckedChange={v => setSubjectForm(f => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </div>

            {/* Syllabus topics editor */}
            <div className="space-y-2 border rounded-lg p-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Syllabus Topics ({subjectForm.syllabus_topics.length})
              </Label>
              <div className="flex gap-2">
                <Input
                  value={topicInput}
                  onChange={e => setTopicInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }}
                  placeholder="e.g. Number System"
                  className="text-sm"
                />
                <Button size="sm" variant="outline" onClick={addTopic} disabled={!topicInput.trim()}>Add</Button>
              </div>
              {subjectForm.syllabus_topics.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 mt-1">
                  {subjectForm.syllabus_topics.map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 bg-muted rounded text-sm">
                      <span className="text-xs text-muted-foreground mr-1">{i + 1}.</span>
                      <span className="flex-1 truncate">{t}</span>
                      <button
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setSubjectForm(f => ({ ...f, syllabus_topics: f.syllabus_topics.filter((_, j) => j !== i) }))}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectModalOpen(false)}>Cancel</Button>
            <Button onClick={saveSubject} disabled={subjectSaving} className="bg-red-600 hover:bg-red-700 text-white">
              {subjectSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSubject ? "Save Changes" : "Add Subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Exam Dialog ── */}
      <AlertDialog open={!!deleteExamId} onOpenChange={o => !o && setDeleteExamId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this exam?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the exam and <strong>all its subjects</strong>.
              Question bank data is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteExam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Exam + Subjects
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Subject Dialog ── */}
      <AlertDialog open={!!deleteSubjectId} onOpenChange={o => !o && setDeleteSubjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this subject?</AlertDialogTitle>
            <AlertDialogDescription>This subject will be permanently removed from the exam.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSubject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
