import { useState } from "react";
import { useLocation } from "wouter";
import { useUpsertProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, Target, Calendar, Clock, Zap, User } from "lucide-react";
import { format } from "date-fns";
import { useExams } from "@/hooks/use-exams";

const OTHER_EXAM = { label: "Other", value: "OTHER", icon: "🎯", desc: "Other government exam" };
const STEP_LABELS = ["Personal Details", "Choose Exam"];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const upsert = useUpsertProfile();
  const { exams: fetchedExams, loading: examsLoading } = useExams();

  const [step, setStep] = useState(1);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  // Step 2
  const [examType, setExamType] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState([4]);

  const EXAMS = [
    ...fetchedExams.map(e => ({
      label: e.name,
      value: e.code,
      icon: e.icon_emoji,
      desc: e.exam_full_name ?? e.name,
    })),
    OTHER_EXAM,
  ];

  const isNameValid = fullName.trim().length >= 2;

  function handleNext() {
    if (!isNameValid) { setNameTouched(true); return; }
    setStep(2);
  }

  function handleFinish() {
    upsert.mutate(
      {
        data: {
          fullName: fullName.trim(),
          examType,
          examDate: examDate || undefined,
          dailyStudyHours: dailyHours[0],
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
          setLocation("/dashboard");
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/logo-full.png" alt="GovtGuru" width={200} className="block" />
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">Step {step} of 2</span>
            <span className="text-xs font-semibold text-primary">{STEP_LABELS[step - 1]}</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className={`w-2 h-2 rounded-full transition-colors ${i + 1 <= step ? "bg-primary" : "bg-muted-foreground/30"}`} />
                <span className={`text-[10px] font-medium ${i + 1 === step ? "text-primary" : "text-muted-foreground/60"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── STEP 1: Name ── */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <User className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Welcome to GovtGuru! 🎓</h1>
              <p className="text-muted-foreground text-sm">Let's set up your profile</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full-name" className="text-sm font-semibold flex items-center gap-1.5">
                <User className="w-4 h-4 text-primary" />
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full-name"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                onBlur={() => setNameTouched(true)}
                onKeyDown={e => e.key === "Enter" && handleNext()}
                className="h-12 text-base"
                autoFocus
              />
              {nameTouched && !isNameValid && (
                <p className="text-xs text-destructive">Name must be at least 2 characters.</p>
              )}
            </div>

            <Button className="w-full h-12 text-base" onClick={handleNext} disabled={!isNameValid}>
              Continue →
            </Button>
          </div>
        )}

        {/* ── STEP 2: Exam + Schedule ── */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Choose Your Target Exam 🎯</h1>
              <p className="text-muted-foreground text-sm">We'll personalise your study plan accordingly.</p>
            </div>

            {/* Exam grid */}
            <div className="grid grid-cols-2 gap-3">
              {examsLoading && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[88px] rounded-xl border-2 border-border bg-muted animate-pulse" />
              ))}
              {!examsLoading && EXAMS.map(exam => (
                <button
                  key={exam.value}
                  onClick={() => setExamType(exam.value)}
                  className={`
                    relative text-left p-4 rounded-xl border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    ${examType === exam.value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"}
                  `}
                >
                  {examType === exam.value && (
                    <CheckCircle2 className="w-4 h-4 text-primary absolute top-2.5 right-2.5" />
                  )}
                  <span className="text-xl block mb-1">{exam.icon}</span>
                  <span className="font-semibold text-sm block leading-tight">{exam.label}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight mt-0.5 block">{exam.desc}</span>
                </button>
              ))}
            </div>

            {/* Exam date */}
            <div className="space-y-2">
              <Label htmlFor="exam-date" className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                Exam Date
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <input
                id="exam-date"
                type="date"
                value={examDate}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={e => setExamDate(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Daily hours */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                Daily Study Hours
              </Label>
              <div className="bg-muted/40 rounded-xl p-5 space-y-4 border">
                <div className="text-center">
                  <span className="text-5xl font-bold text-primary">{dailyHours[0]}</span>
                  <span className="text-lg text-muted-foreground ml-1.5">hrs/day</span>
                </div>
                <Slider
                  value={dailyHours}
                  onValueChange={setDailyHours}
                  min={1}
                  max={10}
                  step={1}
                  className="my-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1h</span>
                  <span className="italic">
                    {dailyHours[0] <= 3 ? "Steady start 🌱" : dailyHours[0] <= 6 ? "Solid commitment 💪" : "Intense focus 🔥"}
                  </span>
                  <span>10h</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="h-12 px-5" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button
                className="flex-1 h-12 text-base font-semibold"
                disabled={!examType || upsert.isPending}
                onClick={handleFinish}
              >
                {upsert.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                  : <><Zap className="mr-2 h-4 w-4" /> Complete Setup →</>}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
