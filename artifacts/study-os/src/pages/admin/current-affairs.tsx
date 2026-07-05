import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, Star, Newspaper } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CurrentAffairItem {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  examRelevance: string[] | null;
  publishedDate: string;
  source: string | null;
  isFeatured: boolean | null;
  createdAt: string;
}

const CATEGORIES = ["Economy", "Polity", "Science", "Sports", "International", "Environment", "Awards"];
const EXAMS = ["SSC_CGL", "SSC_CHSL", "IBPS_PO", "IBPS_CLERK", "SBI_PO", "RRB_NTPC", "UPPSC", "BPSC"];

const emptyForm = {
  title: "",
  summary: "",
  category: "",
  examRelevance: [] as string[],
  publishedDate: new Date().toISOString().split("T")[0],
  isFeatured: false,
};

export default function AdminCurrentAffairsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<CurrentAffairItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/current-affairs", { credentials: "include", headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) throw new Error();
      setItems(await res.json());
    } catch {
      toast({ title: "Failed to load current affairs", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: CurrentAffairItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      summary: item.summary ?? "",
      category: item.category ?? "",
      examRelevance: item.examRelevance ?? [],
      publishedDate: item.publishedDate,
      isFeatured: !!item.isFeatured,
    });
    setDialogOpen(true);
  };

  const toggleExam = (exam: string) => {
    setForm((f) => ({
      ...f,
      examRelevance: f.examRelevance.includes(exam)
        ? f.examRelevance.filter((e) => e !== exam)
        : [...f.examRelevance, exam],
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const url = editingId ? `/api/admin/current-affairs/${editingId}` : "/api/admin/current-affairs";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast({ title: editingId ? "Article updated" : "Article created" });
      setDialogOpen(false);
      load();
    } catch {
      toast({ title: "Failed to save article", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/current-affairs/${deleteId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      toast({ title: "Article deleted" });
      setItems((prev) => prev.filter((i) => i.id !== deleteId));
    } catch {
      toast({ title: "Failed to delete article", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-700">Current Affairs Manager</h1>
          <p className="text-muted-foreground mt-1">Add, edit, and remove current affairs articles.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-700 hover:to-orange-600" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Article" : "New Article"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Article headline" />
              </div>
              <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={4} placeholder="Short summary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Published Date</Label>
                  <Input type="date" value={form.publishedDate} onChange={(e) => setForm({ ...form, publishedDate: e.target.value })} />
                </div>
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
                        form.examRelevance.includes(exam)
                          ? "bg-red-100 text-red-700 border-red-300"
                          : "bg-muted text-muted-foreground border-transparent"
                      )}
                    >
                      {exam.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border rounded-md p-3">
                <Label className="cursor-pointer">Feature this article</Label>
                <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-red-600 hover:bg-red-700 text-white">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Create Article"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-2">
            <Newspaper className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No current affairs articles yet.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="border-orange-100">
            <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {item.isFeatured && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                  <h3 className="font-semibold">{item.title}</h3>
                </div>
                {item.summary && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.summary}</p>}
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  {item.category && <Badge variant="secondary">{item.category}</Badge>}
                  <span>{format(new Date(item.publishedDate), "PP")}</span>
                  {item.examRelevance && item.examRelevance.length > 0 && (
                    <span>· {item.examRelevance.join(", ")}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this article?</AlertDialogTitle>
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
