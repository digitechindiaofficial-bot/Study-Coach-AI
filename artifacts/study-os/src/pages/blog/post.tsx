import { useState, useEffect } from "react";
import { Link } from "wouter";
import Footer from "@/components/footer";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  category: string;
  tags: string[] | null;
  author: string | null;
  readTime: number;
  views: number;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string;
  readTime: number;
}

const CATEGORIES: Record<string, string> = {
  bpsc: "BPSC", uppsc: "UPPSC", ssc: "SSC", ibps: "IBPS PO",
  sbi: "SBI", rrb: "RRB NTPC", "current-affairs": "Current Affairs",
  "study-tips": "Study Tips", general: "General",
};

export default function BlogPostPage({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/blog/${slug}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(data => {
        if (data) {
          setPost(data.post);
          setRelated(data.related ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const categoryLabel = post ? (CATEGORIES[post.category] ?? post.category) : "";
  const publishDate = post?.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/">
            <img src="/logo-full.png" alt="GovtGuru" height={36} className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/blog">
              <span className="hover:text-foreground cursor-pointer transition-colors">← All Articles</span>
            </Link>
            <Link href="/signup">
              <span className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                Start Free
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {loading && (
          <div className="max-w-3xl mx-auto px-4 py-16 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
              <div className="h-64 bg-muted rounded mt-8" />
            </div>
          </div>
        )}

        {!loading && notFound && (
          <div className="max-w-3xl mx-auto px-4 py-20 text-center">
            <div className="text-5xl mb-4">😕</div>
            <h1 className="text-2xl font-bold mb-2">Article not found</h1>
            <p className="text-muted-foreground mb-6">This post may have been removed or unpublished.</p>
            <Link href="/blog">
              <span className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                Browse all articles
              </span>
            </Link>
          </div>
        )}

        {!loading && post && (
          <article className="max-w-3xl mx-auto px-4 py-10">
            {/* Breadcrumb */}
            <div className="text-sm text-muted-foreground mb-6 flex items-center gap-1.5">
              <Link href="/"><span className="hover:text-foreground cursor-pointer">Home</span></Link>
              <span>›</span>
              <Link href="/blog"><span className="hover:text-foreground cursor-pointer">Blog</span></Link>
              <span>›</span>
              <span className="text-foreground">{categoryLabel}</span>
            </div>

            {/* Category + meta */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase">
                {categoryLabel}
              </span>
              <span className="text-muted-foreground text-sm">
                ⏱️ {post.readTime} min read · 👁️ {post.views} views
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight mb-5">
              {post.title}
            </h1>

            {/* Author + date */}
            <div className="flex items-center gap-3 pb-6 mb-6 border-b">
              <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
                style={{ background: "#1B2A4A" }}>
                {(post.author ?? "G").charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{post.author ?? "GovtGuru Team"}</p>
                {publishDate && <p className="text-xs text-muted-foreground">{publishDate}</p>}
              </div>
            </div>

            {/* Cover image */}
            {post.coverImage && (
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full rounded-xl object-cover max-h-96 mb-8"
              />
            )}

            {/* Content */}
            <div
              className="prose prose-slate max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground"
              style={{ lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t flex flex-wrap gap-2">
                <span className="text-sm font-semibold text-foreground mr-1">Tags:</span>
                {post.tags.map(tag => (
                  <span key={tag} className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="mt-10 rounded-2xl p-8 text-center text-white"
              style={{ background: "linear-gradient(135deg, #1B2A4A, #2D4A7A)" }}>
              <h3 className="text-xl font-bold mb-2">🎯 Prepare Smarter with GovtGuru</h3>
              <p className="text-blue-200 mb-5 text-sm">
                AI-powered study plans, 4000+ practice questions, and progress tracking — all in one app!
              </p>
              <Link href="/signup">
                <span className="inline-block font-bold px-8 py-3 rounded-lg text-base cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ background: "#F5A623", color: "#1B2A4A" }}>
                  Start Free Today →
                </span>
              </Link>
            </div>

            {/* Related */}
            {related.length > 0 && (
              <div className="mt-12">
                <h3 className="text-xl font-bold mb-5">Related Articles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {related.map(rp => (
                    <Link key={rp.id} href={`/blog/${rp.slug}`}>
                      <div className="rounded-lg border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                        {rp.coverImage && (
                          <img src={rp.coverImage} alt={rp.title} className="w-full h-28 object-cover" />
                        )}
                        <div className="p-3">
                          <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-1">{rp.title}</p>
                          <span className="text-xs text-muted-foreground">⏱️ {rp.readTime} min</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>
        )}
      </main>

      <Footer />
    </div>
  );
}
