import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileJson,
  Send,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  Loader2,
  ClipboardPaste,
  Database,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImportError {
  index: number;
  error: string;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: ImportError[];
  dryRun: boolean;
}

const EXAMPLE_JSON = JSON.stringify(
  {
    questions: [
      {
        examCode: "SSC_CGL",
        subjectCode: "QA",
        topicCode: "SSC_CGL_QA_001",
        difficulty: "easy",
        question: "What is 15% of 200?",
        optionA: "25",
        optionB: "30",
        optionC: "35",
        optionD: "40",
        correctAnswer: "b",
        explanation: "15% of 200 = (15/100) × 200 = 30",
        source: "original",
        examYear: null,
        language: "english",
        tags: ["percentage", "arithmetic"],
      },
    ],
  },
  null,
  2,
);

export default function AdminQuestionBankPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pastedJson, setPastedJson] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [activeTab, setActiveTab] = useState("paste");

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith(".json")) {
      toast({ title: "Please select a .json file", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setFileContent(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleImport = async () => {
    const raw = activeTab === "file" ? fileContent : pastedJson;
    if (!raw?.trim()) {
      toast({ title: "No JSON to import", description: "Paste JSON or upload a file first.", variant: "destructive" });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      toast({ title: "Invalid JSON", description: "The input is not valid JSON. Check syntax and try again.", variant: "destructive" });
      return;
    }

    const body = Array.isArray(parsed) ? { questions: parsed } : parsed;

    setIsImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/question-bank/import/json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Import failed", description: data.error ?? "Server error", variant: "destructive" });
        return;
      }
      setResult(data as ImportResult);
      if (data.inserted > 0) {
        toast({ title: `${data.inserted} question${data.inserted === 1 ? "" : "s"} imported successfully` });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const totalFromResult = result
    ? result.inserted + result.skipped + result.errors.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-red-700 flex items-center gap-3">
          <Database className="h-8 w-8" />
          Question Bank Import
        </h1>
        <p className="text-muted-foreground mt-1">
          Bulk-import questions into the Question Bank by uploading a JSON file or pasting JSON directly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Import panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Import Source</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="paste" className="flex items-center gap-1.5">
                    <ClipboardPaste className="h-4 w-4" />
                    Paste JSON
                  </TabsTrigger>
                  <TabsTrigger value="file" className="flex items-center gap-1.5">
                    <FileJson className="h-4 w-4" />
                    Upload File
                  </TabsTrigger>
                </TabsList>

                {/* Paste JSON tab */}
                <TabsContent value="paste" className="mt-0">
                  <Textarea
                    className="font-mono text-sm h-72 resize-none"
                    placeholder={`Paste your JSON here…\n\nAccepted formats:\n• { "questions": [ ... ] }\n• [ ... ]  (bare array)`}
                    value={pastedJson}
                    onChange={(e) => setPastedJson(e.target.value)}
                  />
                  {pastedJson.trim() && (() => {
                    try { JSON.parse(pastedJson); return <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Valid JSON</p>; }
                    catch { return <p className="text-xs text-destructive mt-1.5 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Invalid JSON — check syntax</p>; }
                  })()}
                </TabsContent>

                {/* File upload tab */}
                <TabsContent value="file" className="mt-0">
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg h-72 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer",
                      isDragging ? "border-red-500 bg-red-50" : "border-muted-foreground/25 hover:border-red-400 hover:bg-red-50/40"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    />
                    {fileName ? (
                      <>
                        <FileJson className="h-10 w-10 text-red-500" />
                        <div className="text-center">
                          <p className="font-medium text-foreground">{fileName}</p>
                          <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1 justify-center">
                            <CheckCircle2 className="h-3.5 w-3.5" /> File loaded — ready to import
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground text-xs"
                          onClick={(e) => { e.stopPropagation(); setFileName(null); setFileContent(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        >
                          Remove file
                        </Button>
                      </>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-muted-foreground/50" />
                        <div className="text-center">
                          <p className="font-medium text-foreground">Drop a .json file here</p>
                          <p className="text-sm text-muted-foreground">or click to browse</p>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-700 hover:to-orange-600 min-w-[160px]"
                >
                  {isImporting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" /> Import Questions</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Import Report */}
          {result && (
            <Card className={cn(
              "border-2",
              result.errors.length === 0 ? "border-green-200 bg-green-50/40" : "border-orange-200 bg-orange-50/40"
            )}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {result.errors.length === 0
                    ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : <AlertTriangle className="h-5 w-5 text-orange-500" />}
                  Import Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-background border p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{totalFromResult}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total Questions</p>
                  </div>
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
                    <p className="text-xs text-green-600 mt-0.5 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Imported
                    </p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
                    <p className="text-xs text-yellow-600 mt-0.5 flex items-center justify-center gap-1">
                      <SkipForward className="h-3 w-3" /> Skipped
                    </p>
                  </div>
                  <div className={cn(
                    "rounded-lg border p-3 text-center",
                    result.errors.length > 0 ? "bg-red-50 border-red-200" : "bg-muted/40 border-muted"
                  )}>
                    <p className={cn("text-2xl font-bold", result.errors.length > 0 ? "text-red-700" : "text-muted-foreground")}>
                      {result.errors.length}
                    </p>
                    <p className={cn("text-xs mt-0.5 flex items-center justify-center gap-1", result.errors.length > 0 ? "text-red-600" : "text-muted-foreground")}>
                      <XCircle className="h-3 w-3" /> Errors
                    </p>
                  </div>
                </div>

                {/* Error list */}
                {result.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">Validation errors (these rows were skipped):</p>
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {result.errors.map((err) => (
                        <div key={err.index} className="flex items-start gap-2 text-sm bg-background rounded border border-red-100 p-2">
                          <Badge variant="outline" className="shrink-0 text-red-600 border-red-300 text-xs mt-0.5">
                            Row {err.index + 1}
                          </Badge>
                          <span className="text-muted-foreground font-mono text-xs leading-relaxed">{err.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — Format reference */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                JSON Format
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Send a JSON object with a <code className="text-xs bg-muted px-1 py-0.5 rounded">questions</code> array,
                or a bare array of question objects.
              </p>
              <div className="space-y-1.5 text-xs">
                {[
                  { field: "examCode", req: true, note: "e.g. SSC_CGL" },
                  { field: "subjectCode", req: true, note: "e.g. QA" },
                  { field: "topicCode", req: true, note: "e.g. SSC_CGL_QA_001" },
                  { field: "question", req: true, note: "question text" },
                  { field: "optionA–D", req: true, note: "four choices" },
                  { field: "correctAnswer", req: true, note: "a / b / c / d" },
                  { field: "difficulty", req: false, note: "easy / medium / hard" },
                  { field: "source", req: false, note: "original / pyq / ai_generated" },
                  { field: "language", req: false, note: "english / hindi" },
                  { field: "explanation", req: false, note: "nullable" },
                  { field: "examYear", req: false, note: "integer or null" },
                  { field: "tags", req: false, note: "string array" },
                ].map(({ field, req, note }) => (
                  <div key={field} className="flex items-baseline gap-2">
                    <code className="shrink-0 font-mono text-foreground">{field}</code>
                    {req
                      ? <Badge className="shrink-0 text-[10px] px-1 py-0 h-4 bg-red-100 text-red-700 border-red-200">required</Badge>
                      : <Badge variant="outline" className="shrink-0 text-[10px] px-1 py-0 h-4 text-muted-foreground">optional</Badge>}
                    <span className="text-muted-foreground truncate">{note}</span>
                  </div>
                ))}
              </div>
              <div className="pt-1 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">Example</p>
                <pre className="text-[10px] font-mono bg-muted rounded p-2.5 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                  {EXAMPLE_JSON}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
