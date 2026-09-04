import { useEffect, useState, useRef } from "react";
import { adminFetch as fetch } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ClipboardList, Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp,
  Settings, Database, Upload, Send, CheckCircle2, XCircle, Search,
  SkipForward, Globe, Archive, FileEdit, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface MockTest {
  id: string;
  examCode: string;
  name: string;
  description: string | null;
  mockType: string;
  timeLimitMinutes: number;
  difficulty: string;
  totalMarks: number;
  isActive: boolean;
  version: number;
  mockNumber: number;
  status: "draft" | "published" | "archived";
  sectionCount: number;
  attemptCount: number;
  sections?: SectionWithRule[];
}

interface ValidationResult {
  valid: boolean;
  issues: { section: string; type: string; message: string }[];
  warnings: { section: string; type: string; message: string }[];
}

interface ImportResult {
  id: string;
  name: string;
  mockNumber: number;
  status: string;
  sectionCount: number;
  totalMarks: number;
  warnings?: { section: string; type: string; message: string }[];
}

interface SectionWithRule {
  id: string;
  mockTestId: string;
  name: string;
  subjectCode: string | null;
  orderNum: number;
  questionCount: number;
  marksPerQuestion: string;
  negativeMarks: string;
  timeLimitSeconds: number | null;
  rule: RuleData | null;
}

interface RuleData {
  id: string;
  sectionId: string;
  selectionType: "fixed" | "dynamic";
  examCode: string | null;
  subjectCode: string | null;
  topicCode: string | null;
  difficulty: string | null;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  randomize: boolean;
  language: string | null;
  fixedQuestions?: { id: string; questionBankId: string; orderNum: number }[];
}


// ── Constants ────────────────────────────────────────────────────────────────

const MOCK_TYPES = ["FULL_MOCK", "SUBJECT_TEST", "TOPIC_TEST", "PYQ_TEST"];
const DIFFICULTIES = ["easy", "medium", "hard", "mixed"];

const EXAMPLE_JSON = JSON.stringify(
  {
    name: "SSC CGL Full Mock #1",
    examCode: "SSC_CGL",
    mockType: "FULL_MOCK",
    timeLimitMinutes: 60,
    difficulty: "mixed",
    instructions: "Read each question carefully.",
    sections: [
      {
        name: "Section 1: Quantitative Aptitude",
        subjectCode: "QA",
        orderNum: 1,
        questionCount: 25,
        marksPerQuestion: 2,
        negativeMarks: 0.5,
        rule: {
          selectionType: "dynamic",
          examCode: "SSC_CGL",
          subjectCode: "QA",
          easyCount: 10,
          mediumCount: 10,
          hardCount: 5,
          randomize: true,
        },
      },
    ],
  },
  null,
  2,
);

// ── Mock Form ─────────────────────────────────────────────────────────────────

function MockForm({
  initial, onSave, onClose,
}: {
  initial?: Partial<MockTest>;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    examCode: initial?.examCode ?? "",
    description: initial?.description ?? "",
    mockType: initial?.mockType ?? "FULL_MOCK",
    timeLimitMinutes: initial?.timeLimitMinutes ?? 60,
    difficulty: initial?.difficulty ?? "mixed",
    instructions: "",
    status: (initial as any)?.status ?? "draft",
    mockNumber: (initial as any)?.mockNumber ?? undefined,
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handle = async () => {
    if (!form.name.trim() || !form.examCode.trim()) {
      toast({ title: "Name and Exam Code are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e: any) { toast({ title: e.message ?? "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Mock Test Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="SSC CGL Full Mock #1" />
        </div>
        <div className="space-y-1.5">
          <Label>Exam Code *</Label>
          <Input value={form.examCode} onChange={(e) => setForm({ ...form, examCode: e.target.value })} placeholder="SSC_CGL" />
        </div>
        <div className="space-y-1.5">
          <Label>Mock Type</Label>
          <Select value={form.mockType} onValueChange={(v) => setForm({ ...form, mockType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MOCK_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Time Limit (minutes)</Label>
          <Input type="number" value={form.timeLimitMinutes} onChange={(e) => setForm({ ...form, timeLimitMinutes: parseInt(e.target.value) || 60 })} min={1} />
        </div>
        <div className="space-y-1.5">
          <Label>Overall Difficulty</Label>
          <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DIFFICULTIES.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mock Number (auto if blank)</Label>
          <Input type="number" min={1} value={form.mockNumber ?? ""} onChange={(e) => setForm({ ...form, mockNumber: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="Auto" />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Description</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Instructions (shown to students)</Label>
          <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} placeholder="Read all questions carefully..." />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handle} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initial?.id ? "Save Changes" : "Create Mock"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ── Section Manager ───────────────────────────────────────────────────────────

function SectionManager({ mock, onRefresh }: { mock: MockTest; onRefresh: () => void }) {
  const { toast } = useToast();
  const [sections, setSections] = useState<SectionWithRule[]>(mock.sections ?? []);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSection, setNewSection] = useState({ name: "", subjectCode: "", questionCount: 10, marksPerQuestion: 1, negativeMarks: 0 });
  const [savingSection, setSavingSection] = useState(false);

  const addSection = async () => {
    setSavingSection(true);
    try {
      const r = await fetch(`/api/admin/mock-tests/${mock.id}/sections`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newSection, orderNum: sections.length + 1 }),
      });
      if (!r.ok) throw new Error("Failed to add section");
      const sec: SectionWithRule = await r.json();
      setSections((prev) => [...prev, { ...sec, rule: null }]);
      setAddingSection(false);
      setNewSection({ name: "", subjectCode: "", questionCount: 10, marksPerQuestion: 1, negativeMarks: 0 });
      onRefresh();
      toast({ title: "Section added" });
    } catch { toast({ title: "Failed to add section", variant: "destructive" }); }
    finally { setSavingSection(false); }
  };

  const deleteSection = async (sid: string) => {
    try {
      await fetch(`/api/admin/mock-tests/${mock.id}/sections/${sid}`, { method: "DELETE", credentials: "include" });
      setSections((prev) => prev.filter((s) => s.id !== sid));
      onRefresh();
      toast({ title: "Section deleted" });
    } catch { toast({ title: "Failed to delete section", variant: "destructive" }); }
  };

  const saveRule = async (sid: string, rule: Partial<RuleData>) => {
    const r = await fetch(`/api/admin/mock-tests/${mock.id}/sections/${sid}/rule`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
    if (!r.ok) throw new Error("Failed to save rule");
    const saved = await r.json();
    setSections((prev) => prev.map((s) => s.id === sid ? { ...s, rule: { ...saved, fixedQuestions: s.rule?.fixedQuestions ?? [] } } : s));
    toast({ title: "Rule saved" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Sections ({sections.length})</h3>
        <Button size="sm" variant="outline" onClick={() => setAddingSection(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Section
        </Button>
      </div>

      {addingSection && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label className="text-xs">Section Name</Label><Input value={newSection.name} onChange={(e) => setNewSection({ ...newSection, name: e.target.value })} placeholder="Section 1: Quantitative Aptitude" /></div>
              <div className="space-y-1"><Label className="text-xs">Subject Code</Label><Input value={newSection.subjectCode} onChange={(e) => setNewSection({ ...newSection, subjectCode: e.target.value })} placeholder="QA" /></div>
              <div className="space-y-1"><Label className="text-xs">Question Count</Label><Input type="number" value={newSection.questionCount} onChange={(e) => setNewSection({ ...newSection, questionCount: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-1"><Label className="text-xs">Marks/Question</Label><Input type="number" step="0.5" value={newSection.marksPerQuestion} onChange={(e) => setNewSection({ ...newSection, marksPerQuestion: parseFloat(e.target.value) || 1 })} /></div>
              <div className="space-y-1"><Label className="text-xs">Negative Marks</Label><Input type="number" step="0.25" value={newSection.negativeMarks} onChange={(e) => setNewSection({ ...newSection, negativeMarks: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addSection} disabled={savingSection || !newSection.name.trim()}>
                {savingSection && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingSection(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sections.map((section) => (
        <Card key={section.id} className="border">
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
          >
            <div className="flex items-center gap-2 min-w-0">
              {expandedSection === section.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span className="font-medium text-sm truncate">{section.name}</span>
              <Badge variant="secondary" className="text-xs shrink-0">{section.questionCount}Q · {section.marksPerQuestion}M</Badge>
              {section.rule ? (
                <Badge className="text-xs bg-blue-100 text-blue-700 shrink-0">{section.rule.selectionType}</Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 shrink-0">No rule</Badge>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive hover:text-destructive h-7 w-7 shrink-0"
              onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {expandedSection === section.id && (
            <div className="border-t p-4">
              <RuleEditor section={section} mockId={mock.id} onSave={(rule) => saveRule(section.id, rule)} />
            </div>
          )}
        </Card>
      ))}

      {sections.length === 0 && !addingSection && (
        <p className="text-sm text-muted-foreground text-center py-4">No sections yet. Add one to configure this mock test.</p>
      )}
    </div>
  );
}

// ── Rule Editor ───────────────────────────────────────────────────────────────

function RuleEditor({ section, mockId, onSave }: { section: SectionWithRule; mockId: string; onSave: (r: any) => Promise<void> }) {
  const { toast } = useToast();
  const [rule, setRule] = useState<Partial<RuleData>>(section.rule ?? { selectionType: "dynamic", randomize: true, easyCount: 0, mediumCount: 0, hardCount: 0 });
  const [saving, setSaving] = useState(false);
  const [qSearch, setQSearch] = useState("");
  const [qResults, setQResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handle = async () => {
    setSaving(true);
    try { await onSave(rule); }
    catch (e: any) { toast({ title: e.message ?? "Failed", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const searchQuestions = async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (rule.examCode) params.set("examCode", rule.examCode);
      if (rule.subjectCode) params.set("subjectCode", rule.subjectCode);
      if (qSearch) params.set("q", qSearch);
      const r = await fetch(`/api/admin/mock-tests/question-bank/search?${params}`, { credentials: "include" });
      setQResults(await r.json());
    } finally { setSearching(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selection Type</Label>
        <div className="flex gap-2">
          {(["dynamic", "fixed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setRule({ ...rule, selectionType: t })}
              className={cn("text-xs px-3 py-1 rounded-full border transition-colors capitalize", rule.selectionType === t ? "bg-primary text-primary-foreground border-primary" : "border-muted text-muted-foreground")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {rule.selectionType === "dynamic" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Exam Code</Label><Input value={rule.examCode ?? ""} onChange={(e) => setRule({ ...rule, examCode: e.target.value })} placeholder="SSC_CGL" /></div>
            <div className="space-y-1"><Label className="text-xs">Subject Code</Label><Input value={rule.subjectCode ?? ""} onChange={(e) => setRule({ ...rule, subjectCode: e.target.value })} placeholder="QA" /></div>
            <div className="space-y-1"><Label className="text-xs">Topic Code (optional)</Label><Input value={rule.topicCode ?? ""} onChange={(e) => setRule({ ...rule, topicCode: e.target.value || undefined })} placeholder="Any topic" /></div>
            <div className="space-y-1"><Label className="text-xs">Language</Label>
              <Select value={rule.language ?? ""} onValueChange={(v) => setRule({ ...rule, language: v || null })}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent><SelectItem value="">Any</SelectItem><SelectItem value="english">English</SelectItem><SelectItem value="hindi">Hindi</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">Difficulty Distribution (set to 0 for single difficulty pool)</p>
            <div className="grid grid-cols-3 gap-3">
              {(["easyCount", "mediumCount", "hardCount"] as const).map((field, i) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs capitalize">{["Easy", "Medium", "Hard"][i]}</Label>
                  <Input type="number" min={0} value={rule[field] ?? 0} onChange={(e) => setRule({ ...rule, [field]: parseInt(e.target.value) || 0 })} />
                </div>
              ))}
            </div>
            {(rule.easyCount ?? 0) + (rule.mediumCount ?? 0) + (rule.hardCount ?? 0) === 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Single Difficulty (optional)</Label>
                <Select value={rule.difficulty ?? ""} onValueChange={(v) => setRule({ ...rule, difficulty: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Any difficulty" /></SelectTrigger>
                  <SelectContent><SelectItem value="">Any</SelectItem>{["easy","medium","hard"].map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={rule.randomize ?? true}
              onCheckedChange={(v) => setRule({ ...rule, randomize: v })}
            />
            <Label className="text-xs">Randomize question order</Label>
          </div>
        </div>
      )}

      {rule.selectionType === "fixed" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={qSearch} onChange={(e) => setQSearch(e.target.value)} placeholder="Search questions..." className="text-sm" onKeyDown={(e) => e.key === "Enter" && searchQuestions()} />
            <Input value={rule.examCode ?? ""} onChange={(e) => setRule({ ...rule, examCode: e.target.value })} placeholder="Exam code" className="w-28 text-sm" />
            <Button size="sm" variant="outline" onClick={searchQuestions} disabled={searching}>
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {qResults.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {qResults.map((q) => (
                <div key={q.id} className="flex items-start justify-between gap-2 p-2.5 border-b last:border-0 hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{q.question}</p>
                    <p className="text-xs text-muted-foreground">{q.subjectCode} · {q.difficulty}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-6 px-2 text-xs"
                    onClick={async () => {
                      if (!section.rule?.id) {
                        toast({ title: "Save the rule first, then add fixed questions", variant: "destructive" });
                        return;
                      }
                      await fetch(`/api/admin/mock-tests/${mockId}/sections/${section.id}/rule/questions`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ questionBankId: q.id }),
                      });
                      toast({ title: "Question added" });
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Button size="sm" onClick={handle} disabled={saving}>
        {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
        Save Rule
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminMockTestsPage() {
  const { toast } = useToast();
  const [mocks, setMocks] = useState<MockTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editMock, setEditMock] = useState<MockTest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedMock, setExpandedMock] = useState<string | null>(null);
  const [expandedMockData, setExpandedMockData] = useState<MockTest | null>(null);
  const [importJson, setImportJson] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("list");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const r = await fetch("/api/admin/mock-tests", { credentials: "include", headers: { "Cache-Control": "no-cache" } });
      setMocks(await r.json());
    } finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const loadMockDetail = async (id: string) => {
    const r = await fetch(`/api/admin/mock-tests/${id}`, { credentials: "include" });
    const data = await r.json();
    setExpandedMockData(data);
  };

  const toggleExpand = async (id: string) => {
    if (expandedMock === id) {
      setExpandedMock(null);
      setExpandedMockData(null);
    } else {
      setExpandedMock(id);
      await loadMockDetail(id);
    }
  };

  const createMock = async (data: any) => {
    const r = await fetch("/api/admin/mock-tests", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error("Failed to create");
    await load();
    toast({ title: "Mock test created" });
  };

  const updateMock = async (data: any) => {
    const r = await fetch(`/api/admin/mock-tests/${editMock!.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error("Failed to update");
    await load();
    toast({ title: "Mock test updated" });
  };

  const deleteMock = async () => {
    if (!deleteId) return;
    await fetch(`/api/admin/mock-tests/${deleteId}`, { method: "DELETE", credentials: "include" });
    setDeleteId(null);
    await load();
    toast({ title: "Mock test deleted" });
  };

  const changeStatus = async (id: string, status: "draft" | "published" | "archived") => {
    setChangingStatusId(id);
    try {
      const r = await fetch(`/api/admin/mock-tests/${id}/status`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error ?? "Status change failed", variant: "destructive" }); return; }
      await load();
      toast({ title: `Mock ${status === "published" ? "published" : status === "archived" ? "archived" : "set to draft"}` });
    } catch { toast({ title: "Status change failed", variant: "destructive" }); }
    finally { setChangingStatusId(null); }
  };

  const handleValidate = async () => {
    if (!importJson.trim()) { toast({ title: "No JSON to validate", variant: "destructive" }); return; }
    let parsed: any;
    try { parsed = JSON.parse(importJson); }
    catch { toast({ title: "Invalid JSON", variant: "destructive" }); return; }
    setValidating(true);
    setValidationResult(null);
    try {
      const r = await fetch("/api/admin/mock-tests/import/validate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await r.json();
      setValidationResult(data);
      if (data.valid) toast({ title: "Validation passed" + (data.warnings?.length ? ` (${data.warnings.length} warnings)` : "") });
      else toast({ title: `${data.issues.length} validation issue(s) found`, variant: "destructive" });
    } catch { toast({ title: "Validation failed", variant: "destructive" }); }
    finally { setValidating(false); }
  };

  const handleImport = async () => {
    if (!importJson.trim()) { toast({ title: "No JSON to import", variant: "destructive" }); return; }
    let parsed: any;
    try { parsed = JSON.parse(importJson); }
    catch { toast({ title: "Invalid JSON", variant: "destructive" }); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const r = await fetch("/api/admin/mock-tests/import/json", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(data);
      await load();
      toast({ title: `"${data.name}" imported successfully` });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const DIFFICULTY_COLORS: Record<string, string> = {
    easy: "bg-green-100 text-green-700",
    medium: "bg-amber-100 text-amber-700",
    hard: "bg-red-100 text-red-700",
    mixed: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-700 flex items-center gap-3">
            <ClipboardList className="h-8 w-8" />
            Mock Test Manager
          </h1>
          <p className="text-muted-foreground mt-1">Create and manage mock tests with dynamic question selection.</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { setActiveTab("import"); }}
            variant="outline"
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" /> Import JSON
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-700 hover:to-orange-600 gap-1.5"
          >
            <Plus className="h-4 w-4" /> Create Mock
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5"><ClipboardList className="h-4 w-4" /> All Mocks ({mocks.length})</TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5"><Upload className="h-4 w-4" /> Import JSON</TabsTrigger>
        </TabsList>

        {/* ── List tab ── */}
        <TabsContent value="list" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>
          ) : mocks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 flex flex-col items-center gap-3">
                <ClipboardList className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">No mock tests yet. Create one or import JSON.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {mocks.map((mock) => (
                <Card key={mock.id} className={cn("border", !mock.isActive && "opacity-60")}>
                  <div className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-muted-foreground">#{mock.mockNumber}</span>
                        <Badge variant="secondary" className="text-xs">{mock.mockType.replace(/_/g, " ")}</Badge>
                        <Badge className={cn("text-xs capitalize", DIFFICULTY_COLORS[mock.difficulty] ?? "bg-muted")}>{mock.difficulty}</Badge>
                        <Badge variant="outline" className="text-xs">{mock.examCode}</Badge>
                        {mock.status === "published" && <Badge className="text-xs bg-green-100 text-green-700 border-green-200"><Globe className="h-3 w-3 mr-0.5" /> Published</Badge>}
                        {mock.status === "draft" && <Badge variant="outline" className="text-xs text-muted-foreground"><FileEdit className="h-3 w-3 mr-0.5" /> Draft</Badge>}
                        {mock.status === "archived" && <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200"><Archive className="h-3 w-3 mr-0.5" /> Archived</Badge>}
                        {!mock.isActive && <Badge variant="destructive" className="text-xs">Deleted</Badge>}
                      </div>
                      <h3 className="font-semibold">{mock.name}</h3>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>{mock.totalMarks} marks</span>
                        <span>{mock.timeLimitMinutes}m</span>
                        <span>{mock.sectionCount} section{mock.sectionCount !== 1 ? "s" : ""}</span>
                        <span>{mock.attemptCount} attempt{mock.attemptCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {/* Status change shortcuts */}
                      {mock.status === "draft" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-8 gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          disabled={changingStatusId === mock.id}
                          onClick={() => changeStatus(mock.id, "published")}
                        >
                          {changingStatusId === mock.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                          Publish
                        </Button>
                      )}
                      {mock.status === "published" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-8 gap-1 text-orange-700 border-orange-300 hover:bg-orange-50"
                          disabled={changingStatusId === mock.id}
                          onClick={() => changeStatus(mock.id, "archived")}
                        >
                          {changingStatusId === mock.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                          Archive
                        </Button>
                      )}
                      {mock.status === "archived" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-8 gap-1 text-xs"
                          disabled={changingStatusId === mock.id}
                          onClick={() => changeStatus(mock.id, "draft")}
                        >
                          {changingStatusId === mock.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileEdit className="h-3.5 w-3.5" />}
                          Restore
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => toggleExpand(mock.id)}>
                        <Settings className="h-3.5 w-3.5" />
                        {expandedMock === mock.id ? "Close" : "Sections"}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditMock(mock)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(mock.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {expandedMock === mock.id && (
                    <div className="border-t p-4 bg-muted/20">
                      {!expandedMockData ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : (
                        <SectionManager
                          mock={expandedMockData}
                          onRefresh={async () => {
                            await load();
                            await loadMockDetail(mock.id);
                          }}
                        />
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Import tab ── */}
        <TabsContent value="import" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Import Mock Test JSON</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs mb-1.5 block">Upload .json file</Label>
                    <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setImportJson(ev.target?.result as string);
                      reader.readAsText(f);
                    }} />
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-1.5" /> Choose File
                    </Button>
                  </div>
                  <Textarea
                    className="font-mono text-xs h-64 resize-none"
                    placeholder="Or paste JSON here..."
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                  />
                  {importJson.trim() && (() => {
                    try { JSON.parse(importJson); return <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Valid JSON</p>; }
                    catch { return <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Invalid JSON</p>; }
                  })()}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleValidate}
                      disabled={validating || importing}
                      variant="outline"
                      className="flex-1"
                    >
                      {validating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</> : <><ShieldCheck className="mr-2 h-4 w-4" /> Validate</>}
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={importing || validating}
                      className="flex-1 bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-700 hover:to-orange-600"
                    >
                      {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</> : <><Send className="mr-2 h-4 w-4" /> Import</>}
                    </Button>
                  </div>

                  {validationResult && (
                    <Card className={validationResult.valid ? "border-green-200 bg-green-50/40" : "border-red-200 bg-red-50/40"}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          {validationResult.valid
                            ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                            : <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
                          <p className={cn("font-semibold text-sm", validationResult.valid ? "text-green-700" : "text-red-700")}>
                            {validationResult.valid ? "Validation passed" : `${validationResult.issues.length} issue(s) found`}
                            {validationResult.warnings.length > 0 && ` · ${validationResult.warnings.length} warning(s)`}
                          </p>
                        </div>
                        {validationResult.issues.map((issue, i) => (
                          <div key={i} className="flex gap-2 text-xs text-red-700">
                            <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span><strong>{issue.section}:</strong> {issue.message}</span>
                          </div>
                        ))}
                        {validationResult.warnings.map((w, i) => (
                          <div key={i} className="flex gap-2 text-xs text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span><strong>{w.section}:</strong> {w.message}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {importResult && (
                    <Card className="border-green-200 bg-green-50/40">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
                          <div>
                            <p className="font-semibold text-green-700">"{importResult.name}" imported</p>
                            <p className="text-sm text-green-600">Mock #{importResult.mockNumber} · {importResult.sectionCount} sections · {importResult.totalMarks} marks · {importResult.status}</p>
                          </div>
                        </div>
                        {importResult.warnings && importResult.warnings.length > 0 && (
                          <div className="space-y-1 pt-2 border-t border-green-200">
                            {importResult.warnings.map((w, i) => (
                              <div key={i} className="flex gap-2 text-xs text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span><strong>{w.section}:</strong> {w.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Format Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">A full mock test with sections, rules, and difficulty distribution.</p>
                <pre className="text-[10px] font-mono bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {EXAMPLE_JSON}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Mock Test</DialogTitle></DialogHeader>
          <MockForm onSave={createMock} onClose={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editMock} onOpenChange={(o) => !o && setEditMock(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Mock Test</DialogTitle></DialogHeader>
          {editMock && <MockForm initial={editMock} onSave={updateMock} onClose={() => setEditMock(null)} />}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this mock test?</AlertDialogTitle>
            <AlertDialogDescription>This will hide it from all users. Existing attempts are preserved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteMock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
