import { useGetMyProfile, useUpsertProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, LogOut, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { Link } from "wouter";

const EXAMS = ["SSC_CGL","SSC_CHSL","IBPS_PO","IBPS_CLERK","SBI_PO","RRB_NTPC","UPPSC","BPSC","OTHER"];

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const upsert = useUpsertProfile();

  const [examType, setExamType] = useState("");
  const [examDate, setExamDate] = useState<Date|undefined>();
  const [hours, setHours] = useState([4]);
  const [fullName, setFullName] = useState("");

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
      onSuccess: () => { toast({ title:"Settings saved!" }); qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }); },
      onError: () => toast({ title:"Failed to save", variant:"destructive" })
    });
  };

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="h-32 bg-muted rounded animate-pulse"/>)}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and exam preferences.</p>
      </div>

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
        <CardHeader><CardTitle className="text-base">Exam Preferences</CardTitle></CardHeader>
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
            {upsert.isPending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader><CardTitle className="text-base">Subscription</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-semibold capitalize">{(profile as any)?.planType??"Free"} Plan</p>
            <p className="text-sm text-muted-foreground">{(profile as any)?.planType==="pro"?"Full access to all features":"Limited features"}</p>
          </div>
          {(profile as any)?.planType!=="pro" && (
            <Link href="/upgrade"><Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600"><Sparkles className="mr-2 w-4 h-4"/>Upgrade</Button></Link>
          )}
        </CardContent>
      </Card>

      {/* Sign out */}
      <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={()=>signOut({redirectUrl:"/"})}>
        <LogOut className="mr-2 w-4 h-4"/>Sign Out
      </Button>
    </div>
  );
}
