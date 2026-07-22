import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useUpsertProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, ArrowLeft, CheckCircle2, Target, Calendar, Clock, Zap, User, Phone, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { useExams } from "@/hooks/use-exams";
import { useToast } from "@/hooks/use-toast";

const OTHER_EXAM = { label: "Other", value: "OTHER", icon: "🎯", desc: "Other government exam" };
const STEP_LABELS = ["Personal Details", "Verify Phone", "Choose Exam"];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const upsert = useUpsertProfile();
  const { exams: fetchedExams, loading: examsLoading } = useExams();
  const { toast } = useToast();

  const [step, setStep] = useState(1);

  // Step 1 — Personal Details
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Step 2 — OTP
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 — Exam
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
  const isPhoneValid = /^[6-9]\d{9}$/.test(phone);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startResendTimer() {
    setTimer(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSendOtp() {
    if (!isNameValid || !isPhoneValid) return;
    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed to send OTP", description: data.error, variant: "destructive" });
        return;
      }
      setOtp("");
      setStep(2);
      startResendTimer();
      toast({ title: "OTP sent!", description: `Verification code sent to +91 ${phone}` });
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) return;
    setIsVerifying(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Verification failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Phone verified!", description: "Your number has been confirmed." });
      setStep(3);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendOtp() {
    if (timer > 0) return;
    setOtp("");
    await handleSendOtp();
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

  const selectedExam = EXAMS.find(e => e.value === examType);

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
            <span className="text-xs font-medium text-muted-foreground">Step {step} of 3</span>
            <span className="text-xs font-semibold text-primary">{STEP_LABELS[step - 1]}</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
          {/* Step dots */}
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

        {/* ── STEP 1: Personal Details ── */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <User className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Welcome to GovtGuru! 🎓</h1>
              <p className="text-muted-foreground text-sm">Let's set up your profile</p>
            </div>

            {/* Full Name */}
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
                className="h-12 text-base"
              />
              {nameTouched && !isNameValid && (
                <p className="text-xs text-destructive">Name must be at least 2 characters.</p>
              )}
            </div>

            {/* Mobile Number */}
            <div className="space-y-2">
              <Label htmlFor="phone-number" className="text-sm font-semibold flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-primary" />
                Mobile Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="h-12 px-4 flex items-center rounded-lg border border-input bg-muted text-base font-medium shrink-0">
                  +91
                </span>
                <Input
                  id="phone-number"
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onBlur={() => setPhoneTouched(true)}
                  className="h-12 text-base"
                />
              </div>
              {phoneTouched && !isPhoneValid && (
                <p className="text-xs text-destructive">
                  {phone.length > 0 && !/^[6-9]/.test(phone)
                    ? "Number must start with 6, 7, 8, or 9."
                    : "Enter a valid 10-digit mobile number."}
                </p>
              )}
            </div>

            <Button
              className="w-full h-12 text-base"
              disabled={!isNameValid || !isPhoneValid || isSendingOtp}
              onClick={handleSendOtp}
            >
              {isSendingOtp
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending OTP…</>
                : <>Send OTP →</>}
            </Button>
          </div>
        )}

        {/* ── STEP 2: OTP Verification ── */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Verify Your Number 📱</h1>
              <p className="text-muted-foreground text-sm">
                OTP sent to <span className="font-semibold text-foreground">+91 {phone}</span>
              </p>
            </div>

            {/* 6-digit OTP boxes */}
            <div className="flex flex-col items-center gap-4">
              <Label className="text-sm font-semibold self-start">Enter 6-digit OTP</Label>
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                containerClassName="gap-3"
              >
                <InputOTPGroup className="gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-12 w-12 text-lg rounded-lg border-2"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              className="w-full h-12 text-base"
              disabled={otp.length !== 6 || isVerifying}
              onClick={handleVerifyOtp}
            >
              {isVerifying
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                : <><CheckCircle2 className="mr-2 h-4 w-4" /> Verify OTP</>}
            </Button>

            {/* Resend + back */}
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              {timer > 0 ? (
                <p>Resend OTP in <span className="font-semibold text-foreground">{timer}s</span></p>
              ) : (
                <button
                  type="button"
                  className="text-primary font-semibold hover:underline"
                  onClick={handleResendOtp}
                  disabled={isSendingOtp}
                >
                  Resend OTP
                </button>
              )}
              <button
                type="button"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Change Number
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Exam + Schedule ── */}
        {step === 3 && (
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

            <Button
              className="w-full h-12 text-base font-semibold"
              disabled={!examType || upsert.isPending}
              onClick={handleFinish}
            >
              {upsert.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                : <><Zap className="mr-2 h-4 w-4" /> Complete Setup →</>}
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
