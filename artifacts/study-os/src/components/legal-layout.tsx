import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/footer";

export default function LegalLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isInsideApp = typeof window !== "undefined" && document.referrer.includes(window.location.host);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Simple header */}
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo-icon.png" alt="GovtGuru" width={28} height={28} className="rounded-md shrink-0" />
              <span className="font-bold text-foreground">GovtGuru</span>
            </div>
          </Link>
          <Link href="/dashboard">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-10">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export function LegalPage({
  title,
  subtitle,
  lastUpdated,
  children,
}: {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  children: ReactNode;
}) {
  return (
    <article className="space-y-8">
      <div className="space-y-1 pb-6 border-b">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">Last Updated: {lastUpdated}</p>
        )}
      </div>
      {children}
    </article>
  );
}
