import { useGetMyProfile, useUpsertProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { isPreviewEnvironment, useAppClerk, useAppUser } from "@/lib/app-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2, LogOut, Sparkles,
  Zap, CheckCircle2, CalendarIcon,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PaymentButton } from "@/components/payment-button";
import { usePlan } from "@/hooks/use-plan";
import { useExams } from "@/hooks/use-exams";
import { readPreviewProfile } from "@/lib/preview-data";

export default function SettingsPage() {
  const { user } = useAppUser();
  const { signOut } = useAppClerk();
  const { toast } = useToast();
  const qc = useQueryClient();
  const preview = isPreviewEnvironment();
  const plan = usePlan();
  const [, navigate] = useLocation();

  const { data: apiProfile, isLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), enabled: !preview },
  });
  const previewProfile = useMemo(
    () => (preview ? readPreviewProfile() : undefined),
    [preview],
  );
  const profile = apiProfile ?? previewProfile;
  const upsert = useUpsertProfile();
  const { exams, loading: examsLoading } = useExams();

  const [examType, setExamType] = useState("");
  const [examDate, setExamDate] = useState<Date|undefined>();
  const [hours, setHours] = useState([4]);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);

  const isPhoneValid = /^\d{10}$/.test(phoneNumber);

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value.replace(/\D/g, "").slice(0, 10));
  };

  useEffect(() => {
    if (profile) {
      setExamType((profile as any).examType??"");
      setHours([(profile as any).dailyStudyHours??4]);
      setFullName((profile as any).fullName??"");
      setPhoneNumber(((profile as any).phoneNumber??"").replace(/^\+91/, ""));
      if ((profile as any).examDate) setExamDate(new Date((profile as any).examDate));
    }
  }, [profile]);

  const handleSave = () => {
    if (!isPhoneValid) {
      setPhoneTouched(true);
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    const oldExam = (profile as any)?.examType ?? "";
    const examChanged = oldExam && oldExam !== examType;

    if (preview) {
      const updatedProfile = {
        ...readPreviewProfile(),
        fullName,
        examType,
        examDate: examDate ? format(examDate, "yyyy-MM-dd") : null,
        dailyStudyHours: hours[0],
      };
      try {
        window.localStorage.setItem("govtguru-preview-profile", JSON.stringify(updatedProfile));
      } catch {
        // Keep the current form state when storage is unavailable.
      }
      qc.setQueryData(getGetMyProfileQueryKey(), updatedProfile);
      toast({ title: examChanged ? "Exam preferences saved!" : "Settings saved!" });
      if (examChanged) navigate("/planner");
      return;
    }

    upsert.mutate({ data: { fullName, phoneNumber: `+91${phoneNumber}`, examType, examDate: examDate?.toISOString(), dailyStudyHours: hours[0] } as any }, {
      onSuccess: async () => {
        qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        if (examChanged) {
          toast({ title: "Exam changed!", description: `Generating new study plan for ${examType.replace(/_/g, " ")}…` });
          try {
            await fetch("/api/study-plans/current", { method: "DELETE", credentials: "include" });
          } catch {
            // non-fatal — planner will handle stale plan
          }
          setTimeout(() => navigate("/planner"), 1200);
        } else {
          toast({ title: "Settings saved!" });
        }
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" })
    });
  };

  if (isLoading && !preview) return (
    <div className="max-w-2xl space-y-4">
      {[1,2,3,4].map(i=><div key={i} className="h-32 bg-muted rounded animate-pulse"/>)}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and exam preferences.</p>
      </div>

      {/* Current Plan Card */}
      <Card className={cn(
        "border-2",
        plan.isPro ? "border-amber-300 bg-amber-50/50" : "border-border"
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Subscription Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.isPro ? (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-lg">Pro Plan</p>
                  <p className="text-sm text-muted-foreground">Your Pro subscription is active.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {["Unlimited quiz questions","Study plan regeneration","All 15 daily news","MCQ from news","Full analytics","Syllabus tracking"].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">{f}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-bold text-lg">Free Plan</p>
                  <p className="text-sm text-muted-foreground">10 quiz questions/day · Today's top 5 news</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {["Unlimited quiz questions","AI study plan regeneration","All 15 daily news","MCQ from current affairs","Full progress analytics","Complete syllabus tracking"].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span className="text-xs">{f}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-3">Unlock all Pro features for just ₹129/month</p>
                <PaymentButton
                  userName={user?.fullName ?? ""}
                  userEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
                  onSuccess={() => qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle className="text-base">Your Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={user?.imageUrl}/>
              <AvatarFallback className="text-lg">{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{user?.fullName}</p>
              <p className="text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your name"/>
          </div>
          <div className="space-y-2">
            <Label>Mobile Number</Label>
            <div className="flex items-center gap-2">
              <span className="h-10 px-3 flex items-center rounded-md border border-input bg-muted text-sm font-medium shrink-0">
                +91
              </span>
              <Input
                type="tel"
                inputMode="numeric"
                value={phoneNumber}
                onChange={e=>handlePhoneChange(e.target.value)}
                onBlur={() => setPhoneTouched(true)}
                placeholder="98765 43210"
              />
            </div>
            {phoneTouched && !isPhoneValid && (
              <p className="text-xs text-destructive">Enter a valid 10-digit mobile number.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exam Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exam Preferences</CardTitle>
          <CardDescription>These settings are used to personalize your AI study plan and quiz questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Target Exam</Label>
            <Select value={examType} onValueChange={setExamType} disabled={examsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={examsLoading ? "Loading exams…" : "Select exam"} />
              </SelectTrigger>
              <SelectContent>
                {exams.map(e => (
                  <SelectItem key={e.code} value={e.code}>
                    {e.icon_emoji} {e.name}
                  </SelectItem>
                ))}
                <SelectItem value="OTHER">🎯 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Exam Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal",!examDate&&"text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4"/>
                  {examDate?format(examDate,"PPP"):"Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={examDate} onSelect={setExamDate} initialFocus disabled={d=>d<new Date()}/>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-4">
            <Label>Daily Study Hours: <span className="text-primary font-bold">{hours[0]}h</span></Label>
            <Slider value={hours} onValueChange={setHours} max={12} min={1} step={1}/>
          </div>

          <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Button
        variant="outline"
        className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => signOut({ redirectUrl: "/" })}
      >
        <LogOut className="mr-2 w-4 h-4"/>Sign Out
      </Button>
    </div>
  );
}
