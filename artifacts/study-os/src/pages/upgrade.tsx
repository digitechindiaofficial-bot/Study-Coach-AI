import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, Sparkles, BrainCircuit, CalendarDays,
  TrendingUp, Newspaper, BookOpen, Clock, Users, Shield, Zap,
  FlaskConical, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { usePlan } from "@/hooks/use-plan";

const COMPARISON = [
  { feature: "Quiz questions per day",        free: "10 questions",   pro: "Unlimited" },
  { feature: "Study plan generation",         free: "Once only",      pro: "Unlimited regeneration" },
  { feature: "Current affairs access",        free: "Today's top 5",  pro: "All 15 daily + 30-day archive" },
  { feature: "News MCQ generation",           free: false,            pro: true },
  { feature: "Weak area detection",           free: false,            pro: true },
  { feature: "Progress analytics",            free: "Basic",          pro: "Full analytics" },
  { feature: "Syllabus topic tracking",       free: "View only",      pro: "Full tracking" },
  { feature: "Confidence level tracking",     free: false,            pro: true },
  { feature: "News refresh (manual)",         free: false,            pro: true },
  { feature: "All exam types",                free: true,             pro: true },
];

const WHY_PRO = [
  { icon: BrainCircuit, title: "Unlimited Quiz Engine",     desc: "Practice as much as you want — all subjects, all topics, all day long. No daily caps." },
  { icon: CalendarDays, title: "AI Study Plan Regeneration", desc: "Regenerate your personalized weekly schedule anytime with fresh Gemini AI recommendations." },
  { icon: Newspaper,    title: "MCQ from Current Affairs",   desc: "Turn any news article into an exam-style practice question instantly." },
  { icon: TrendingUp,  title: "Deep Analytics",             desc: "Track accuracy per topic, spot weak areas early, and see your improvement over time." },
  { icon: BookOpen,    title: "Full Syllabus Tracker",       desc: "Mark every topic as learnt, set confidence levels, and know exactly what's left." },
  { icon: Clock,       title: "30-Day News Archive",         desc: "Access a full month of current affairs and refresh today's news anytime." },
];

const TRUST = [
  { icon: Users,  stat: "10,000+", label: "Aspirants trust us" },
  { icon: Zap,    stat: "1800+",   label: "Practice questions" },
  { icon: Shield, stat: "100%",    label: "Secure & private" },
];

async function updatePlan(planType: "free" | "pro"): Promise<void> {
  const resp = await fetch("/api/profiles/plan", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ planType }),
  });
  if (!resp.ok) throw new Error("Failed to update plan");
}

export default function UpgradePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const plan = usePlan();

  const [showTestModal, setShowTestModal] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const handleActivatePro = async () => {
    setIsActivating(true);
    try {
      await updatePlan("pro");
      await qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      toast({ title: "🎉 Pro Plan Activated! (Test Mode)", description: "All Pro features are now unlocked." });
      setShowTestModal(false);
      navigate("/dashboard");
    } catch {
      toast({ title: "Failed to activate Pro", variant: "destructive" });
    } finally {
      setIsActivating(false);
    }
  };

  const isAlreadyPro = plan.isPro;

  return (
    <div className="max-w-4xl mx-auto space-y-12">

      {/* Test Mode Banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg">
        <FlaskConical className="w-5 h-5 text-orange-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-900">Developer Test Mode</p>
          <p className="text-xs text-orange-700">Payments are simulated. Click "Upgrade to Pro (Test Mode)" to unlock all Pro features instantly.</p>
        </div>
        <Badge className="bg-orange-100 text-orange-700 border-orange-300 shrink-0">TEST MODE</Badge>
      </div>

      {/* Hero */}
      <div className="text-center space-y-4">
        <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 text-sm px-4 py-1.5">
          <Sparkles className="w-4 h-4 mr-1.5 inline" />Pro Plan
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight">Supercharge Your Exam Prep</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Join serious aspirants who use AI Study OS to crack SSC, Banking, and Railway exams faster.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
          {TRUST.map(({ icon: Icon, stat, label }) => (
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
            <Button variant="outline" className="w-full mb-6" disabled>
              {isAlreadyPro ? "Downgrade in Settings" : "Current Plan"}
            </Button>
            <div className="space-y-2.5 flex-1">
              {COMPARISON.filter(c => c.free !== false).slice(0, 5).map(c => (
                <div key={c.feature} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{c.feature}: <span className="font-medium text-foreground">{c.free as string}</span></span>
                </div>
              ))}
              {COMPARISON.filter(c => c.free === false).slice(0, 4).map(c => (
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

            {isAlreadyPro ? (
              <div className="w-full mb-6 flex items-center justify-center gap-2 py-3 rounded-lg bg-green-100 border border-green-300 text-green-800 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Pro Plan Active (Test Mode)
              </div>
            ) : (
              <Button
                className="w-full mb-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-md"
                size="lg"
                onClick={() => setShowTestModal(true)}
              >
                <FlaskConical className="mr-2 w-4 h-4" />
                Upgrade to Pro (Test Mode)
              </Button>
            )}

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
              Razorpay integration coming soon · ₹199/month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Why Pro */}
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

      {/* Bottom CTA */}
      {!isAlreadyPro && (
        <div className="text-center space-y-4 py-6 border-t">
          <h2 className="text-xl font-bold">Ready to unlock everything?</h2>
          <Button
            size="lg"
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-8"
            onClick={() => setShowTestModal(true)}
          >
            <FlaskConical className="mr-2 w-4 h-4" />
            Upgrade to Pro (Test Mode)
          </Button>
          <p className="text-xs text-muted-foreground">No real payment · Test mode only · ₹199/month when Razorpay goes live</p>
        </div>
      )}

      {/* Test Mode Modal */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-orange-600" />
              </div>
              <DialogTitle>Test Mode Activation</DialogTitle>
            </div>
            <DialogDescription className="text-left text-sm leading-relaxed">
              This is a <span className="font-semibold text-orange-600">test mode</span> payment simulation.
              No real money will be charged.
              <br /><br />
              Clicking <span className="font-semibold">Confirm</span> will instantly activate all Pro features
              so you can test the full experience.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-muted rounded-lg space-y-1.5 text-sm">
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">You'll unlock:</p>
            {["Unlimited quiz questions", "Study plan regeneration", "All 15 daily news + archive", "MCQ from news articles", "Full analytics"].map(f => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setShowTestModal(false)} disabled={isActivating}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
              onClick={handleActivatePro}
              disabled={isActivating}
            >
              {isActivating ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Sparkles className="mr-2 w-4 h-4" />}
              {isActivating ? "Activating…" : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
