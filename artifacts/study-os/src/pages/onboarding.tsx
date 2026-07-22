import { useState } from "react";
import { useLocation } from "wouter";
import { useUpsertProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2, ArrowLeft, CheckCircle2, Target, Calendar, Clock, Zap, Phone } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { useExams } from "@/hooks/use-exams";

const OTHER_EXAM = { label: "Other", value: "OTHER", icon: "🎯", desc: "Other government exam" };

const STEP_LABELS = ["Choose Exam", "Set Schedule", "You're All Set!"];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const upsert = useUpsertProfile();
  const { exams: fetchedExams, loading: examsLoading } = useExams();

  const [step, setStep] = useState(1);
  const [examType, setExamType] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState([4]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Build display list from API + hardcoded "Other" at end
  const EXAMS = [
    ...fetchedExams.map(e => ({
      label: e.name,
      value: e.code,
      icon: e.icon_emoji,
      desc: e.exam_full_name ?? e.name,
    })),
    OTHER_EXAM,
  ];

  const selectedExam = EXAMS.find(e => e.value === examType);
  const isPhoneValid = /^\d{10}$/.test(phoneNumber);

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value.replace(/\D/g, "").slice(0, 10));
  };

  const handleFinish = () => {
    upsert.mutate(
      {
        data: {
          examType,
          examDate: examDate || undefined,
          dailyStudyHours: dailyHours[0],
          phoneNumber: `+91${phoneNumber}`,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
          setLocation("/dashboard");
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/logo-full.png" alt="GovtGuru — AI se Sarkari Job Pakki" width={200} className="block" />
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">Step {step} of 3</span>
            <span className="text-xs font-semibold text-primary">{STEP_LABELS[step - 1]}</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* ── STEP 1: Choose Exam ── */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Which exam are you preparing for?</h1>
              <p className="text-muted-foreground text-sm">We'll personalise your study plan accordingly.</p>
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="phone-number" className="text-sm font-semibold flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-primary" />
                What's your mobile number?
              </Label>
              <div className="flex items-center gap-2">
                <span className="h-12 px-4 flex items-center rounded-lg border border-input bg-muted text-base font-medium shrink-0">
                  +91
                </span>
                <Input
                  id="phone-number"
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={e => handlePhoneChange(e.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="98765 43210"
                  className="h-12 text-base"
                />
              </div>
              {phoneTouched && !isPhoneValid && (
                <p className="text-xs text-destructive">Enter a valid 10-digit mobile number.</p>
              )}
            </div>

            <Button
              className="w-full h-12 text-base"
              disabled={!examType || !isPhoneValid}
              onClick={() => setStep(2)}
            >
              Continue →
            </Button>
          </div>
        )}

        {/* ── STEP 2: Date + Hours ── */}
        {step === 2 && (
          <div className="space-y-7 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">When is your exam and how many hours daily?</h1>
              <p className="text-muted-foreground text-sm">This shapes your entire study schedule.</p>
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
                  <span className="text-center italic">
                    {dailyHours[0] <= 3 ? "Steady start 🌱" : dailyHours[0] <= 6 ? "Solid commitment 💪" : "Intense focus 🔥"}
                  </span>
                  <span>10h</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="h-12 px-5" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button className="flex-1 h-12 text-base" onClick={() => setStep(3)}>
                Continue →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Summary ── */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 mb-2">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">You're all set!</h1>
              <p className="text-muted-foreground text-sm">Review your choices and generate your personalised plan.</p>
            </div>

            {/* Summary card */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 bg-muted/50 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Study Profile</p>
              </div>
              <div className="divide-y">
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className="text-2xl">{selectedExam?.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Exam</p>
                    <p className="font-bold text-base">{selectedExam?.label}</p>
                    <p className="text-xs text-muted-foreground">{selectedExam?.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-8 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Mobile Number</p>
                    <p className="font-bold text-base">+91 {phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-8 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Exam Date</p>
                    <p className="font-semibold">
                      {examDate
                        ? format(new Date(examDate + "T00:00:00"), "d MMMM yyyy")
                        : "Not specified — 12-week plan"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-8 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Daily Study</p>
                    <p className="font-semibold">{dailyHours[0]} hours per day</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="h-12 px-5" onClick={() => setStep(2)} disabled={upsert.isPending}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                className="flex-1 h-12 text-base font-semibold"
                onClick={handleFinish}
                disabled={upsert.isPending}
              >
                {upsert.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  : <><Zap className="mr-2 h-4 w-4" /> Generate My Study Plan</>}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
