import { useState, useEffect } from "react";
import { Link } from "wouter";
import Footer from "@/components/footer";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string;
  author: string | null;
  readTime: number;
  views: number;
  isFeatured: boolean;
  publishedAt: string | null;
}

const CATEGORIES = [
  { value: "all", label: "All Posts" },
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

function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORIES.find(c => c.value === category)?.label ?? category;
  return (
    <span className="inline-block bg-blue-50 text-blue-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
      {label}
    </span>
  );
}

function PlaceholderCover({ emoji = "📚" }: { emoji?: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-5xl"
      style={{ background: "linear-gradient(135deg, #1B2A4A, #2D4A7A)" }}>
      {emoji}
    </div>
  );
}

export default function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);
    fetch(`/api/blog?${params}`)
      .then(r => r.json())
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [category, search]);

  const featured = posts.find(p => p.isFeatured);
  const regular = posts.filter(p => !p.isFeatured || category !== "all" || search);
  const displayRegular = (category !== "all" || search) ? posts : regular;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/">
            <img src="/logo-full.png" alt="GovtGuru" height={36} className="h-9 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/login">
              <span className="hover:text-foreground cursor-pointer transition-colors">Sign In</span>
            </Link>
            <Link href="/signup">
              <span className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 cursor-pointer transition-colors">
                Start Free
              </span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white py-14 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">GovtGuru Blog</h1>
            <p className="text-blue-200 text-base md:text-lg max-w-xl mx-auto mb-6">
              Exam guides, preparation tips, and current affairs for Indian government exam aspirants.
            </p>
            <input
              type="text"
              placeholder="Search articles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md mx-auto block px-4 py-2.5 rounded-lg text-foreground bg-white border-0 shadow focus:outline-none focus:ring-2 focus:ring-[#F5A623] text-sm"
            />
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-8">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === cat.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="rounded-xl border bg-card animate-pulse h-64" />
              ))}
            </div>
          )}

          {!loading && (
            <>
              {/* Featured hero post */}
              {featured && !search && category === "all" && (
                <Link href={`/blog/${featured.slug}`}>
                  <div className="rounded-2xl overflow-hidden border bg-card mb-8 cursor-pointer hover:shadow-md transition-shadow group">
                    <div className="md:flex">
                      <div className="md:w-1/2 h-56 md:h-auto overflow-hidden relative">
                        {featured.coverImage
                          ? <img src={featured.coverImage} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          : <PlaceholderCover />}
                        <span className="absolute top-3 left-3 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">⭐ Featured</span>
                      </div>
                      <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
                        <CategoryBadge category={featured.category} />
                        <h2 className="text-xl md:text-2xl font-bold text-foreground mt-3 mb-3 leading-tight group-hover:text-primary transition-colors">
                          {featured.title}
                        </h2>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-3">{featured.excerpt}</p>
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span>✍️ {featured.author}</span>
                          <span>⏱️ {featured.readTime} min read</span>
                          <span>👁️ {featured.views} views</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {/* Grid */}
              {displayRegular.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {displayRegular.map(post => (
                    <Link key={post.id} href={`/blog/${post.slug}`}>
                      <div className="rounded-xl border bg-card overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
                        <div className="h-44 overflow-hidden">
                          {post.coverImage
                            ? <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
                            : <PlaceholderCover />}
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <CategoryBadge category={post.category} />
                          <h3 className="font-bold text-base text-foreground mt-2 mb-2 leading-snug line-clamp-2">{post.title}</h3>
                          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 flex-1">{post.excerpt}</p>
                          <div className="flex justify-between mt-4 pt-3 border-t text-xs text-muted-foreground">
                            <span>✍️ {post.author}</span>
                            <span>⏱️ {post.readTime} min</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {posts.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">📝</div>
                  <p className="text-muted-foreground">No articles found.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
