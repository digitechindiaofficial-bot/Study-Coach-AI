import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useUpsertProfile, useSeedSyllabus, useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { Loader2, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, differenceInWeeks } from "date-fns";
import { cn } from "@/lib/utils";

const EXAMS = [
  "SSC_CGL", "SSC_CHSL", "IBPS_PO", "IBPS_CLERK", 
  "SBI_PO", "RRB_NTPC", "UPPSC", "BPSC", "OTHER"
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [exam, setExam] = useState<string>("");
  const [date, setDate] = useState<Date>();
  const [hours, setHours] = useState<number[]>([4]);

  const { data: profile, isLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() }
  });

  const upsertProfile = useUpsertProfile();
  const seedSyllabus = useSeedSyllabus();

  useEffect(() => {
    if (profile?.examType) {
      setLocation("/dashboard");
    }
  }, [profile, setLocation]);

  const handleComplete = async () => {
    if (!exam || !date) return;
    
    await upsertProfile.mutateAsync({
      data: {
        examType: exam,
        examDate: date.toISOString(),
        dailyStudyHours: hours[0]
      }
    });

    seedSyllabus.mutate({});
    setLocation("/dashboard");
  };

  if (isLoading || profile?.examType) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const weeksRemaining = date ? differenceInWeeks(date, new Date()) : 0;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {['Select Exam', 'Target Date', 'Commitment'].map((label, i) => (
            <div key={label} className={cn("flex flex-col items-center gap-2", step >= i + 1 ? "text-primary" : "text-muted-foreground")}>
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm", step >= i + 1 ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:block">{label}</span>
            </div>
          ))}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-2">What's your target exam?</h2>
            <p className="text-muted-foreground">Select the exam you're preparing for to customize your study plan.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {EXAMS.map(e => (
              <Card 
                key={e} 
                className={cn("cursor-pointer hover:border-primary transition-colors", exam === e && "border-primary bg-primary/5")}
                onClick={() => setExam(e)}
              >
                <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[120px]">
                  <span className="font-bold text-lg">{e.replace('_', ' ')}</span>
                  {exam === e && <CheckCircle2 className="h-5 w-5 text-primary mt-2 absolute top-2 right-2" />}
                </CardContent>
              </Card>
            ))}
          </div>
          <Button className="w-full" size="lg" disabled={!exam} onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-2">When is your exam?</h2>
            <p className="text-muted-foreground">This helps us schedule your syllabus and revision effectively.</p>
          </div>
          <div className="flex flex-col items-center justify-center py-8">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-[280px] justify-start text-left font-normal text-lg h-14", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-5 w-5" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
            
            {date && (
              <div className="mt-8 p-6 bg-primary/10 rounded-xl text-center max-w-sm">
                <div className="text-4xl font-bold text-primary mb-2">{weeksRemaining}</div>
                <div className="font-medium text-foreground">Weeks Remaining</div>
                <p className="text-sm text-muted-foreground mt-2">Perfect time to build a solid foundation and revise.</p>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <Button variant="outline" size="lg" onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1" size="lg" disabled={!date} onClick={() => setStep(3)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Commit to your success</h2>
            <p className="text-muted-foreground">How many hours can you realistically study every day?</p>
          </div>
          
          <div className="py-12 px-6 bg-card border rounded-xl">
            <div className="text-center mb-8">
              <span className="text-6xl font-bold text-primary">{hours[0]}</span>
              <span className="text-xl text-muted-foreground ml-2">hours/day</span>
            </div>
            
            <Slider 
              value={hours} 
              onValueChange={setHours} 
              max={12} 
              min={1} 
              step={1}
              className="mb-8"
            />
            
            <p className="text-center italic text-muted-foreground font-medium">
              {hours[0] <= 3 ? "A steady start. Consistency is key." : 
               hours[0] <= 6 ? "Solid commitment. You'll cover a lot of ground." : 
               "Intense focus. Make sure to take breaks to avoid burnout."}
            </p>
          </div>

          <div className="flex gap-4">
            <Button variant="outline" size="lg" onClick={() => setStep(2)}>Back</Button>
            <Button className="flex-1" size="lg" disabled={upsertProfile.isPending} onClick={handleComplete}>
              {upsertProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Complete Setup
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}