import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pencil, Trash2, Rocket, BookmarkMinus,
  Eye, Star, Loader2, FileText,
} from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  category: string;
  tags: string[];
  examCode: string | null;
  author: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  views: number;
  readTime: number;
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
}

type EditorForm = Omit<BlogPost, "id" | "views" | "readTime" | "createdAt" | "publishedAt">;

const CATEGORIES = [
  { value: "bpsc", label: "BPSC" },
  { value: "uppsc", label: "UPPSC" },
  { value: "ssc", label: "SSC" },
  { value: "ibps", label: "IBPS PO" },
  { value: "sbi", label: "SBI" },
  { value: "rrb", label: "RRB NTPC" },
  { value: "current-affairs", label: "Current Affairs" },
  { value: "study-tips", label: "Study Tips" },
  { value: "general", label: "General" },
];

const EXAMS = ["BPSC","UPPSC","SSC_CGL","SSC_CHSL","IBPS_PO","IBPS_CLERK","SBI_PO","SBI_CLERK","RRB_NTPC"];

function generateSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

function calcReadTime(content: string) {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

const BLANK: EditorForm = {
  title: "", slug: "", excerpt: "", content: "",
  coverImage: "", category: "general", examCode: "",
  author: "GovtGuru Team", tags: [],
  isPublished: false, isFeatured: false,
  metaTitle: "", metaDescription: "",
};

// ─── Blog Editor ─────────────────────────────────────────────────────────────

function BlogEditor({ post, onBack }: { post: BlogPost | null; onBack: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<EditorForm>(post ? {
    title: post.title, slug: post.slug, excerpt: post.excerpt ?? "",
    content: post.content, coverImage: post.coverImage ?? "",
    category: post.category, examCode: post.examCode ?? "",
    author: post.author ?? "GovtGuru Team", tags: post.tags ?? [],
    isPublished: post.isPublished, isFeatured: post.isFeatured,
    metaTitle: post.metaTitle ?? "", metaDescription: post.metaDescription ?? "",
  } : { ...BLANK });

  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  function handleTitleChange(title: string) {
    setForm(f => ({
      ...f,
      title,
      slug: post ? f.slug : generateSlug(title),
      metaTitle: f.metaTitle || `${title} — GovtGuru`,
    }));
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      setForm(f => ({ ...f, tags: [...f.tags, tag] }));
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  }

  async function save(publish: boolean) {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Title and content are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const body = {
      ...form,
      isPublished: publish || form.isPublished,
      excerpt: form.excerpt || null,
      coverImage: form.coverImage || null,
      examCode: form.examCode || null,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
    };
    const url = post ? `/api/admin/blog/posts/${post.id}` : "/api/admin/blog/posts";
    const method = post ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: publish ? "🚀 Post Published!" : "✅ Draft Saved!" });
      setTimeout(onBack, 800);
    } else {
      const err = await res.json();
      toast({ title: "Save failed", description: String(err.error ?? "Unknown error"), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h2 className="text-xl font-bold">{post ? "Edit Post" : "New Blog Post"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            💾 Save Draft
          </Button>
          <Button onClick={() => save(true)} disabled={saving}>
            🚀 Publish
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Left — content */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Blog Title *</Label>
            <Input
              value={form.title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="e.g. BPSC 2026 Complete Syllabus Guide"
              className="h-12 text-base font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <Label>URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">govtguru.in/blog/</span>
              <Input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="bpsc-2026-syllabus-guide"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Excerpt <span className="text-muted-foreground text-xs">(shown in blog list)</span></Label>
            <textarea
              value={form.excerpt ?? ""}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
              placeholder="Brief description (150-160 chars for SEO)"
              rows={3}
              maxLength={160}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground text-right">{(form.excerpt ?? "").length}/160</p>
          </div>

          <div className="space-y-1.5">
            <Label>Content * <span className="text-muted-foreground text-xs">(HTML supported)</span></Label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder={`Write your blog post here...\n\nYou can use HTML:\n<h2>Section Heading</h2>\n<p>Paragraph</p>\n<ul><li>List item</li></ul>`}
              rows={22}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Estimated read time: {calcReadTime(form.content)} min</p>
          </div>

          {/* SEO */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <h3 className="font-semibold text-sm">🔍 SEO Settings</h3>
            <div className="space-y-1.5">
              <Label>Meta Title</Label>
              <Input
                value={form.metaTitle ?? ""}
                onChange={e => setForm(f => ({ ...f, metaTitle: e.target.value }))}
                placeholder="SEO title (50-60 chars)"
                maxLength={60}
              />
              <p className={`text-xs text-right ${(form.metaTitle ?? "").length > 55 ? "text-amber-600" : "text-muted-foreground"}`}>
                {(form.metaTitle ?? "").length}/60
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Meta Description</Label>
              <textarea
                value={form.metaDescription ?? ""}
                onChange={e => setForm(f => ({ ...f, metaDescription: e.target.value }))}
                placeholder="SEO description (150-160 chars)"
                maxLength={160}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground text-right">{(form.metaDescription ?? "").length}/160</p>
            </div>
          </div>
        </div>

        {/* Right — settings */}
        <div className="space-y-4">
          {/* Publish settings */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h4 className="font-semibold text-sm">Publish Settings</h4>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.isFeatured}
                onChange={e => setForm(f => ({ ...f, isFeatured: e.target.checked }))} className="rounded" />
              ⭐ Featured Post
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.isPublished}
                onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} className="rounded" />
              🌐 Published
            </label>
          </div>

          {/* Category */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <h4 className="font-semibold text-sm">Category</h4>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Related Exam */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <h4 className="font-semibold text-sm">Related Exam</h4>
            <select
              value={form.examCode ?? ""}
              onChange={e => setForm(f => ({ ...f, examCode: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— None —</option>
              {EXAMS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Cover Image */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <h4 className="font-semibold text-sm">Cover Image URL</h4>
            <Input
              value={form.coverImage ?? ""}
              onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))}
              placeholder="https://example.com/img.jpg"
              className="text-sm"
            />
            {form.coverImage && (
              <img src={form.coverImage} alt="Cover preview" className="w-full h-24 object-cover rounded-md mt-2" />
            )}
          </div>

          {/* Author */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <h4 className="font-semibold text-sm">Author</h4>
            <Input
              value={form.author ?? ""}
              onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
              placeholder="GovtGuru Team"
              className="text-sm"
            />
          </div>

          {/* Tags */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <h4 className="font-semibold text-sm">Tags</h4>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add tag + Enter"
                className="text-sm"
              />
              <Button type="button" size="sm" variant="outline" onClick={addTag}>Add</Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {form.tags.map(t => (
                  <span key={t} className="bg-muted text-muted-foreground text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    #{t}
                    <button onClick={() => removeTag(t)} className="hover:text-destructive ml-0.5 text-xs">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Blog List ────────────────────────────────────────────────────────────────

export default function AdminBlogPage() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "featured">("all");
  const [view, setView] = useState<"list" | "editor">("list");
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const fetchPosts = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/blog/posts?filter=${filter}`)
      .then(r => r.json())
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function togglePublish(post: BlogPost) {
    const res = await fetch(`/api/admin/blog/posts/${post.id}/publish`, { method: "PATCH" });
    if (res.ok) {
      toast({ title: post.isPublished ? "Post unpublished" : "🚀 Post published!" });
      fetchPosts();
    }
  }

  async function deletePost(post: BlogPost) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/blog/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Post deleted" });
      fetchPosts();
    }
  }

  if (view === "editor") {
    return (
      <BlogEditor
        post={editingPost}
        onBack={() => {
          setView("list");
          setEditingPost(null);
          fetchPosts();
        }}
      />
    );
  }

  const FILTERS: { value: typeof filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "published", label: "Published" },
    { value: "draft", label: "Draft" },
    { value: "featured", label: "Featured" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Blog Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Write and manage blog content for SEO</p>
        </div>
        <Button onClick={() => { setEditingPost(null); setView("editor"); }}>
          <Plus className="w-4 h-4 mr-2" /> Write New Post
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-4">No blog posts yet</p>
          <Button onClick={() => { setEditingPost(null); setView("editor"); }}>
            <Plus className="w-4 h-4 mr-2" /> Write First Post
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">Views</th>
                <th className="text-right px-4 py-3 hidden lg:table-cell">Date</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map(post => (
                <tr key={post.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 max-w-xs">
                    <div className="font-medium truncate">{post.title}</div>
                    {post.isFeatured && (
                      <Badge variant="outline" className="mt-0.5 text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                        ⭐ Featured
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase">
                      {post.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {post.isPublished ? (
                      <span className="text-emerald-600 font-medium text-xs">✅ Published</span>
                    ) : (
                      <span className="text-amber-600 font-medium text-xs">📝 Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                    <span className="flex items-center justify-end gap-1">
                      <Eye className="w-3 h-3" /> {post.views}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden lg:table-cell">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Edit"
                        onClick={() => { setEditingPost(post); setView("editor"); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title={post.isPublished ? "Unpublish" : "Publish"}
                        onClick={() => togglePublish(post)}
                      >
                        {post.isPublished ? <BookmarkMinus className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5 text-primary" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={() => deletePost(post)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
