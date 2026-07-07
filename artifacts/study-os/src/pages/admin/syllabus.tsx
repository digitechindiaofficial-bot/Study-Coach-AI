import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Trash2, BookOpen, ChevronDown, ChevronRight, AlertCircle, CheckCircle } from "lucide-react";

interface AdminExam {
  id: string;
  name: string;
  code: string;
  description: string | null;
  subjectCount: number;
  topicCount: number;
  createdAt: string;
}

export default function AdminSyllabusPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadExams = () => {
    setIsLoading(true);
    setError(null);
    fetch("/api/admin/syllabus/exams", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load exams");
        return r.json();
      })
      .then(setExams)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadExams(); }, []);

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText(ev.target?.result as string ?? "");
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImportResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setImportResult({ success: false, message: "Invalid JSON — check your file format." });
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/admin/syllabus/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportResult({ success: false, message: data.error ?? "Import failed" });
      } else {
        setImportResult({ success: true, message: data.message ?? "Import successful!" });
        setJsonText("");
        if (fileRef.current) fileRef.current.value = "";
        loadExams();
      }
    } catch {
      setImportResult({ success: false, message: "Network error during import." });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its subjects/topics? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/syllabus/exams/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setExams((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert("Delete failed.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Syllabus Manager</h1>
        <p className="text-muted-foreground mt-1">Import and manage exam syllabi. The app reads all data from this database.</p>
      </div>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" />
            Import Syllabus JSON
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="font-medium text-foreground">Expected JSON format:</p>
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{`{
  "exam": "SSC CGL",
  "code": "SSC_CGL",
  "description": "Staff Selection Commission",
  "subjects": [
    {
      "name": "Quantitative Aptitude",
      "topics": ["Number System", "Percentage", "Ratio & Proportion"]
    }
  ]
}

// Or an array of exams: [ { ... }, { ... } ]`}</pre>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Load JSON File
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileLoad} />
            <span className="text-xs text-muted-foreground">or paste JSON below</span>
          </div>

          <textarea
            className="w-full h-48 rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder='Paste your JSON here, or load a .json file above...'
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />

          {importResult && (
            <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${importResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {importResult.success
                ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              }
              {importResult.message}
            </div>
          )}

          <Button onClick={handleImport} disabled={!jsonText.trim() || importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import Syllabus
          </Button>
        </CardContent>
      </Card>

      {/* Exam List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Imported Exams ({exams.length})</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="text-red-600 text-sm">{error}</div>
        ) : exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No exams imported yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Use the import form above to add your first exam.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((exam) => (
              <Card key={exam.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{exam.name}</span>
                      <Badge variant="secondary" className="text-xs font-mono">{exam.code}</Badge>
                    </div>
                    {exam.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{exam.description}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{exam.subjectCount} subjects</span>
                      <span>{exam.topicCount} topics</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    disabled={deletingId === exam.id}
                    onClick={() => handleDelete(exam.id, exam.name)}
                  >
                    {deletingId === exam.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
