import { useEffect, useState } from "react";
import { adminFetch as fetch } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Layers, Plus, Pencil, Trash2, Loader2, Sprout, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionConfig {
  name: string;
  subjectCode: string;
  questionCount: number;
  marksPerQuestion: number;
  negativeMarks: number;
  orderNum: number;
}

interface ExamPattern {
  id: string;
  examCode: string;
  examName: string;
  mockType: string;
  totalQuestions: number;
  totalMarks: number;
  timeLimitMinutes: number;
  markPerQuestion: string;
  negativeMarking: string;
  sectionWiseConfig: SectionConfig[] | null;
  isActive: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  examCode: "", examName: "", mockType: "FULL_MOCK",
  totalQuestions: 100, totalMarks: 200, timeLimitMinutes: 60,
  markPerQuestion: 1, negativeMarking: 0, isActive: true,
};

function formatMin(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${m}m`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminExamPatternsPage() {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<ExamPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isSaving, setIsSaving] = useState(false);
  const [seedResult, setSeedResult] = useState<{ examCode: string; action: string }[] | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const r = await fetch("/api/admin/exam-patterns", { credentials: "include" });
      if (!r.ok) throw new Error();
      setPatterns(await r.json());
    } catch {
      toast({ title: "Failed to load patterns", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (p: ExamPattern) => {
    setEditingId(p.id);
    setForm({
      examCode: p.examCode,
      examName: p.examName,
      mockType: p.mockType,
      totalQuestions: p.totalQuestions,
      totalMarks: p.totalMarks,
      timeLimitMinutes: p.timeLimitMinutes,
      markPerQuestion: parseFloat(p.markPerQuestion),
      negativeMarking: parseFloat(p.negativeMarking),
      isActive: p.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.examCode || !form.examName) {
      toast({ title: "Exam code and name are required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const url = editingId ? `/api/admin/exam-patterns/${editingId}` : "/api/admin/exam-patterns";
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(JSON.stringify(err));
      }
      toast({ title: editingId ? "Pattern updated" : "Pattern created" });
      setDialogOpen(false);
      load();
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(`/api/admin/exam-patterns/${deleteId}`, { method: "DELETE", credentials: "include" });
      toast({ title: "Pattern deactivated" });
      setDeleteId(null);
      load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const r = await fetch("/api/admin/exam-patterns/seed", { method: "POST", credentials: "include" });
      const data = await r.json();
      setSeedResult(data.seeded);
      toast({ title: `Seeded ${data.seeded.filter((s: any) => s.action === "created").length} patterns` });
      load();
    } catch {
      toast({ title: "Seed failed", variant: "destructive" });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Exam Patterns
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Official exam configuration — marks, time limit, negative marking, section structure.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleSeed} disabled={isSeeding} className="gap-2">
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
            Seed Defaults
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Pattern
          </Button>
        </div>
      </div>

      {/* Seed result */}
      {seedResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-800 mb-2">Seed Results:</p>
            <div className="flex flex-wrap gap-2">
              {seedResult.map((r) => (
                <Badge
                  key={r.examCode}
                  className={r.action === "created" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}
                >
                  {r.examCode} — {r.action}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : patterns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No exam patterns yet</p>
            <p className="text-muted-foreground text-sm mt-1">Click "Seed Defaults" to add SSC CGL, IBPS PO, RRB NTPC, UPPSC, and BPSC patterns.</p>
            <Button onClick={handleSeed} className="mt-4 gap-2" disabled={isSeeding}>
              {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
              Seed Default Patterns
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {patterns.map((p) => (
            <Card key={p.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-mono text-xs">{p.examCode}</Badge>
                      <Badge variant="outline" className="text-xs">{p.mockType}</Badge>
                      {!p.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                    </div>
                    <h3 className="font-bold text-lg">{p.examName}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{p.totalQuestions} questions</span>
                      <span>{p.totalMarks} marks</span>
                      <span>{formatMin(p.timeLimitMinutes)}</span>
                      <span>{parseFloat(p.markPerQuestion)}m/Q</span>
                      {parseFloat(p.negativeMarking) > 0 && (
                        <span className="text-red-600">−{parseFloat(p.negativeMarking)} negative</span>
                      )}
                    </div>
                    {p.sectionWiseConfig && p.sectionWiseConfig.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.sectionWiseConfig.map((s, i) => (
                          <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            {s.name} ({s.questionCount}Q × {s.marksPerQuestion}m)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Exam Pattern" : "Add Exam Pattern"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Exam Code *</Label>
                <Input
                  placeholder="e.g. SSC_CGL"
                  value={form.examCode}
                  onChange={(e) => setForm({ ...form, examCode: e.target.value })}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Exam Name *</Label>
                <Input
                  placeholder="e.g. SSC CGL Tier I"
                  value={form.examName}
                  onChange={(e) => setForm({ ...form, examName: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Total Questions</Label>
                <Input
                  type="number" min={1}
                  value={form.totalQuestions}
                  onChange={(e) => setForm({ ...form, totalQuestions: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Total Marks</Label>
                <Input
                  type="number" min={1}
                  value={form.totalMarks}
                  onChange={(e) => setForm({ ...form, totalMarks: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Time (minutes)</Label>
                <Input
                  type="number" min={1}
                  value={form.timeLimitMinutes}
                  onChange={(e) => setForm({ ...form, timeLimitMinutes: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Marks per Question</Label>
                <Input
                  type="number" min={0} step={0.25}
                  value={form.markPerQuestion}
                  onChange={(e) => setForm({ ...form, markPerQuestion: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Negative Marking</Label>
                <Input
                  type="number" min={0} step={0.05}
                  value={form.negativeMarking}
                  onChange={(e) => setForm({ ...form, negativeMarking: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>
            {form.totalQuestions > 0 && form.totalMarks > 0 && (
              <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                Effective: {(form.totalMarks / form.totalQuestions).toFixed(2)} marks/question
                {form.negativeMarking > 0 && `, −${form.negativeMarking} negative marking`}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Pattern?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the pattern from new mock test creation. Existing mocks using this pattern are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
