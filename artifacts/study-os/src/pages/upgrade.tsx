import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Sparkles, BrainCircuit, CalendarDays, TrendingUp, Newspaper, BookOpen, Clock, Users, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const COMPARISON = [
  { feature: "Quiz questions per day",        free: "10 questions",       pro: "Unlimited" },
  { feature: "Study plan generation",         free: "Once only",          pro: "Unlimited regeneration" },
  { feature: "Current affairs access",        free: "Last 3 days",        pro: "Full 30 days" },
  { feature: "MCQ from news articles",        free: false,                pro: true },
  { feature: "Weak area detection",           free: false,                pro: true },
  { feature: "Progress analytics & graphs",   free: "Basic only",         pro: "Full analytics" },
  { feature: "Syllabus topic marking",        free: "View only",          pro: "Full tracking" },
  { feature: "Confidence level tracking",     free: false,                pro: true },
  { feature: "Revision planner",             free: false,                pro: true },
  { feature: "All exam types",               free: true,                 pro: true },
];

const WHY_PRO = [
  { icon: BrainCircuit, title: "Unlimited Quiz Engine",    desc: "Practice as much as you want — all subjects, all topics, all day long. No daily caps." },
  { icon: CalendarDays, title: "AI Study Plan",           desc: "Regenerate your personalized weekly schedule anytime with fresh Gemini AI recommendations." },
  { icon: Newspaper,    title: "MCQ from Current Affairs", desc: "Turn any news article into exam-style practice questions instantly." },
  { icon: TrendingUp,  title: "Deep Analytics",           desc: "Track accuracy per topic, spot weak areas early, and see your improvement over time." },
  { icon: BookOpen,    title: "Full Syllabus Tracker",    desc: "Mark every topic as learnt, set confidence levels, and know exactly what's left." },
  { icon: Clock,       title: "Revision Planner",         desc: "Smart spaced-repetition revision schedule so you never forget what you've learnt." },
];

const TRUST_ELEMENTS = [
  { icon: Users,  stat: "10,000+",  label: "Aspirants trust us" },
  { icon: Zap,    stat: "1800+",    label: "Practice questions" },
  { icon: Shield, stat: "100%",     label: "Secure & private" },
];

export default function UpgradePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">

      {/* Hero */}
      <div className="text-center space-y-4">
        <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 text-sm px-4 py-1.5">
          <Sparkles className="w-4 h-4 mr-1.5 inline" />Pro Plan
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight">Supercharge Your Exam Prep</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Join serious aspirants who use AI Study OS to crack SSC, Banking, and Railway exams faster.
        </p>

        {/* Trust row */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
          {TRUST_ELEMENTS.map(({ icon: Icon, stat, label }) => (
            <div key={label} className="flex items-center gap-2 text-muted-foreground">
              <Icon className="w-4 h-4" />
              <span className="font-bold text-foreground">{stat}</span>
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free */}
        <Card className="border-2 flex flex-col">
          <CardContent className="p-6 flex flex-col h-full">
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1">Free</h2>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold">₹0</span>
                <span className="text-muted-foreground mb-1">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Good for getting started</p>
            </div>
            <Button variant="outline" className="w-full mb-6" disabled>Current Plan</Button>
            <div className="space-y-2.5 flex-1">
              {COMPARISON.filter(c => c.free !== false).slice(0, 5).map(c => (
                <div key={c.feature} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{c.feature}: <span className="font-medium text-foreground">{c.free as string}</span></span>
                </div>
              ))}
              {COMPARISON.filter(c => c.free === false).slice(0, 3).map(c => (
                <div key={c.feature} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground/60">{c.feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pro */}
        <Card className="border-2 border-amber-400 relative overflow-hidden shadow-lg flex flex-col">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
            Most Popular
          </div>
          <CardContent className="p-6 flex flex-col h-full">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">Pro</h2>
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold">₹199</span>
                <span className="text-muted-foreground mb-1">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                or <span className="font-semibold text-foreground">₹999/year</span>
                {" "}
                <span className="inline-block bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Save 58%</span>
              </p>
            </div>
            <Button
              className="w-full mb-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-md"
              size="lg"
            >
              <Sparkles className="mr-2 w-4 h-4" />
              Coming Soon — Razorpay Integration
            </Button>
            <div className="space-y-2.5 flex-1">
              {COMPARISON.map(c => (
                <div key={c.feature} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span>
                    {c.feature}:{" "}
                    <span className="font-semibold">
                      {c.pro === true ? "✓ Included" : c.pro as string}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Secure Razorpay payment · Cancel anytime
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Why go pro */}
      <div>
        <h2 className="text-2xl font-bold text-center mb-8">Why 10,000+ Aspirants Choose Pro</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {WHY_PRO.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ / CTA */}
      <div className="text-center space-y-4 py-6 border-t">
        <h2 className="text-xl font-bold">Ready to crack your exam?</h2>
        <p className="text-muted-foreground text-sm">Payment integration coming very soon. Follow us for updates!</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            size="lg"
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-8"
          >
            <Sparkles className="mr-2 w-4 h-4" />
            Notify Me When Pro Launches
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">No commitment required · ₹199/month when live</p>
      </div>
    </div>
  );
}
