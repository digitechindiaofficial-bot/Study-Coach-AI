import { useGetMyProfile, useUpsertProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, LogOut, Sparkles, FlaskConical,
  Zap, ArrowDownCircle, CheckCircle2, CalendarIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { usePlan } from "@/hooks/use-plan";

const EXAMS = ["SSC_CGL","SSC_CHSL","IBPS_PO","IBPS_CLERK","SBI_PO","RRB_NTPC","UPPSC","BPSC","OTHER"];

async function setPlanType(planType: "free" | "pro"): Promise<void> {
  const resp = await fetch("/api/profiles/plan", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ planType }),
  });
  if (!resp.ok) throw new Error("Failed to update plan");
}

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const qc = useQueryClient();
  const plan = usePlan();

  const { data: profile, isLoading } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const upsert = useUpsertProfile();

  const [examType, setExamType] = useState("");
  const [examDate, setExamDate] = useState<Date|undefined>();
  const [hours, setHours] = useState([4]);
  const [fullName, setFullName] = useState("");
  const [isTogglingPlan, setIsTogglingPlan] = useState(false);

  useEffect(() => {
    if (profile) {
      setExamType((profile as any).examType??"");
      setHours([(profile as any).dailyStudyHours??4]);
      setFullName((profile as any).fullName??"");
      if ((profile as any).examDate) setExamDate(new Date((profile as any).examDate));
    }
  }, [profile]);

  const handleSave = () => {
    upsert.mutate({ data: { fullName, examType, examDate: examDate?.toISOString(), dailyStudyHours: hours[0] } as any }, {
      onSuccess: () => {
        toast({ title: "Settings saved!" });
        qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" })
    });
  };

  const handleDowngrade = async () => {
    setIsTogglingPlan(true);
    try {
      await setPlanType("free");
      await qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      toast({ title: "Downgraded to Free Plan", description: "Pro features have been deactivated." });
    } catch {
      toast({ title: "Failed to downgrade", variant: "destructive" });
    } finally {
      setIsTogglingPlan(false);
    }
  };

  if (isLoading) return (
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Subscription Plan</CardTitle>
            {plan.isPro && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-300 gap-1">
                <FlaskConical className="w-3 h-3" />
                TEST MODE
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.isPro ? (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-lg">Pro Plan</p>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">Test Mode</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">All Pro features are active. This is a test mode simulation.</p>
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
              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Want to test the free experience?</p>
                  <p className="text-xs text-muted-foreground">Downgrade to Free to see all limits.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                  onClick={handleDowngrade}
                  disabled={isTogglingPlan}
                >
                  {isTogglingPlan
                    ? <Loader2 className="mr-2 w-3.5 h-3.5 animate-spin" />
                    : <ArrowDownCircle className="mr-2 w-3.5 h-3.5" />}
                  Downgrade to Free
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-lg">Free Plan</p>
                <p className="text-sm text-muted-foreground">10 quiz questions/day · Today's top 5 news</p>
              </div>
              <Link href="/upgrade">
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm">
                  <Sparkles className="mr-2 w-4 h-4" />
                  Upgrade
                </Button>
              </Link>
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
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger><SelectValue placeholder="Select exam"/></SelectTrigger>
              <SelectContent>
                {EXAMS.map(e=><SelectItem key={e} value={e}>{e.replace(/_/g,' ')}</SelectItem>)}
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
