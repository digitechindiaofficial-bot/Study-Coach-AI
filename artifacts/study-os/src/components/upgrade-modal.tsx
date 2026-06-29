import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Sparkles, BrainCircuit, CalendarDays, Newspaper,
  TrendingUp, BookOpen, CheckCircle2, Clock,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  variant: "quiz_limit" | "study_plan" | "current_affairs" | "syllabus";
}

const VARIANTS = {
  quiz_limit: {
    icon: BrainCircuit,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    title: "You've used your 10 free questions today!",
    subtitle: "Free plan includes 10 quiz questions per day. Upgrade to practice unlimited questions, anytime.",
    footerNote: "Come back tomorrow for 10 more free questions.",
    showFooter: true,
  },
  study_plan: {
    icon: CalendarDays,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    title: "Study Plan Regeneration is a Pro Feature",
    subtitle: "Your current plan is working great! Upgrade to regenerate your study plan anytime with fresh AI recommendations.",
    footerNote: "Your existing plan continues to work perfectly.",
    showFooter: true,
  },
  current_affairs: {
    icon: Newspaper,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    title: "Unlock Full Current Affairs Access",
    subtitle: "Free plan shows the last 3 days. Upgrade to access 30 days of current affairs plus AI-generated MCQs on every article.",
    footerNote: null,
    showFooter: false,
  },
  syllabus: {
    icon: BookOpen,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "Full Syllabus Tracking is a Pro Feature",
    subtitle: "Free users can view the syllabus. Upgrade to mark topics, set confidence levels, and track detailed progress.",
    footerNote: null,
    showFooter: false,
  },
};

const PRO_BENEFITS = [
  { icon: BrainCircuit, text: "Unlimited quiz questions every day" },
  { icon: CalendarDays, text: "Unlimited AI study plan regeneration" },
  { icon: Newspaper, text: "30-day current affairs + MCQ generator" },
  { icon: TrendingUp, text: "Full analytics & weak area detection" },
  { icon: BookOpen, text: "Complete syllabus tracker with confidence" },
];

export default function UpgradeModal({ open, onClose, variant }: Props) {
  const v = VARIANTS[variant];
  const Icon = v.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-6 text-white text-center">
          <div className={`w-16 h-16 rounded-full ${v.iconBg} flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-8 h-8 ${v.iconColor}`} />
          </div>
          <Badge className="bg-white/20 text-white border-white/30 mb-3">
            <Sparkles className="w-3 h-3 mr-1" />
            Upgrade to Pro
          </Badge>
          <h2 className="text-xl font-bold leading-tight">{v.title}</h2>
          <p className="text-sm text-white/85 mt-2 leading-relaxed">{v.subtitle}</p>
        </div>

        {/* Benefits */}
        <div className="p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Everything in Pro</p>
          {PRO_BENEFITS.map(({ icon: BIcon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <BIcon className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm">{text}</span>
              <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto shrink-0" />
            </div>
          ))}
        </div>

        {/* Pricing + CTA */}
        <div className="px-5 pb-5 space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold">₹199</span>
              <span className="text-muted-foreground text-sm">/month</span>
              <p className="text-xs text-muted-foreground">or ₹999/year — save 58%</p>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-200">Best Value</Badge>
          </div>

          <Link href="/upgrade" onClick={onClose}>
            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
              size="lg"
            >
              <Sparkles className="mr-2 w-4 h-4" />
              Upgrade to Pro — ₹199/month
            </Button>
          </Link>

          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onClose}>
            Maybe later
          </Button>

          {v.showFooter && v.footerNote && (
            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {v.footerNote}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
