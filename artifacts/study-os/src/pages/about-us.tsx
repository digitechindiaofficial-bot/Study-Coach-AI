import LegalLayout from "@/components/legal-layout";
import { Target, BookOpen, Zap, TrendingUp, GraduationCap, Users, Heart } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const EXAMS = [
  "BPSC (Bihar Public Service Commission)",
  "UPPSC (UP Public Service Commission)",
  "SSC CGL & CHSL",
  "IBPS PO & Clerk",
  "SBI PO & Clerk",
  "RRB NTPC",
  "And more coming soon!",
];

const STATS = [
  { label: "Practice Questions", value: "4,000+", icon: BookOpen },
  { label: "Govt Exams Covered", value: "10+",    icon: GraduationCap },
  { label: "Subjects per Exam",  value: "8",      icon: TrendingUp },
  { label: "AI Personalisation", value: "100%",   icon: Zap },
];

const FEATURES = [
  { emoji: "🎯", title: "AI Study Planner", desc: "Personalised to YOUR exam date and available time" },
  { emoji: "📚", title: "4000+ Questions",  desc: "Across 10+ major government exams" },
  { emoji: "🔍", title: "Weak Area Detection", desc: "AI automatically finds where you need more practice" },
  { emoji: "💰", title: "Affordable",       desc: "₹129/month — less than the cost of one coaching class!" },
  { emoji: "📱", title: "Available 24/7",   desc: "Study anytime, anywhere on any device" },
];

export default function AboutUsPage() {
  return (
    <LegalLayout>
      <div className="space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <img
            src="/logo-full.png"
            alt="GovtGuru — AI se Sarkari Job Pakki"
            width={300}
            className="mx-auto block"
          />
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            India's AI-powered government exam preparation platform — built by students, for students.
          </p>
        </div>

        {/* Mission */}
        <section className="rounded-2xl bg-primary/5 border border-primary/20 p-8 space-y-3">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Our Mission</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            To make quality government exam preparation accessible and affordable for every student
            in India using the power of Artificial Intelligence.
          </p>
        </section>

        {/* Story */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500" /> Our Story
          </h2>
          <div className="text-muted-foreground leading-relaxed space-y-3">
            <p>
              GovtGuru was built by students, for students. We understand the struggle of preparing for
              government exams without proper guidance, expensive coaching, or personalised study plans.
            </p>
            <p>
              That is why we created GovtGuru — India's first AI-powered government exam preparation
              platform that creates personalised study plans, tracks your progress, and identifies your
              weak areas automatically.
            </p>
          </div>
        </section>

        {/* What makes us different */}
        <section className="space-y-5">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" /> What Makes Us Different
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="flex gap-3 p-4 rounded-xl border bg-card hover:border-primary/30 transition-colors">
                <span className="text-2xl shrink-0">{f.emoji}</span>
                <div>
                  <p className="font-semibold text-sm">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Numbers */}
        <section className="space-y-5">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-500" /> Our Numbers
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map(s => (
              <div key={s.label} className="rounded-xl border bg-card p-5 text-center space-y-2">
                <s.icon className="w-5 h-5 mx-auto text-primary" />
                <div className="text-2xl font-black text-primary">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Exams */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-violet-500" /> Exams We Cover
          </h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {EXAMS.map(e => (
              <li key={e} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        </section>

        {/* Built by */}
        <section className="rounded-xl border bg-muted/30 p-6 space-y-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Built By
          </h2>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Digi Tech India</strong>
            <br />
            <a href="mailto:digitechindiaofficial@gmail.com" className="text-primary hover:underline text-sm">
              digitechindiaofficial@gmail.com
            </a>
          </p>
        </section>

        {/* Vision */}
        <section className="text-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-10 space-y-4">
          <p className="text-3xl">💡</p>
          <h2 className="text-2xl font-bold">Our Vision</h2>
          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
            To help <strong className="text-foreground">1 million students</strong> crack their
            dream government job by 2027.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="mt-2">Start Preparing Free →</Button>
          </Link>
        </section>
      </div>
    </LegalLayout>
  );
}
