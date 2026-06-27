import { useGetQuizQuestions, useSubmitQuizAttempt, getGetQuizQuestionsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, ChevronRight, RotateCcw, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  questionText: string;
  options: Record<string,string> | null;
  correctOption: string | null;
  explanation: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
}

export default function QuizSessionPage({ subject }: { subject: string }) {
  const isWeak = subject === "weak";
  const isAll = subject === "all";

  const params = isWeak
    ? { weakOnly: "true", limit: 20 }
    : isAll
    ? { limit: 20 }
    : { subject: decodeURIComponent(subject), limit: 20 };

  const { data: rawQs = [], isLoading } = useGetQuizQuestions(params as any, {
    query: { queryKey: getGetQuizQuestionsQueryKey(params as any) }
  });
  const questions = rawQs as Question[];

  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<{qId:string;selected:string;correct:boolean;timeTaken:number}>>([]);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const submitAttempt = useSubmitQuizAttempt();

  useEffect(() => { setStartTime(Date.now()); }, [qIndex]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary"/>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">No questions found.</p>
        <Link href="/quiz"><Button variant="outline" className="mt-4">Back to Quiz</Button></Link>
      </div>
    );
  }

  const current = questions[qIndex];
  const options = (current?.options ?? {}) as Record<string,string>;
  const isAnswered = selected !== null;
  const isCorrect = selected === current?.correctOption;

  const handleSelect = (key: string) => {
    if (isAnswered) return;
    setSelected(key);
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const correct = key === current.correctOption;
    setAnswers(prev => [...prev, { qId: current.id, selected: key, correct, timeTaken }]);
    submitAttempt.mutate({ data: { questionId: current.id, selectedOption: key, timeTakenSeconds: timeTaken } });
  };

  const handleNext = () => {
    if (qIndex === questions.length - 1) { setFinished(true); return; }
    setQIndex(i => i + 1);
    setSelected(null);
  };

  if (finished) {
    const correct = answers.filter(a => a.correct).length;
    const total = answers.length;
    const pct = Math.round((correct / total) * 100);
    const trophyColor = pct >= 70 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
    const bgColor = pct >= 70 ? "bg-green-100" : pct >= 50 ? "bg-amber-100" : "bg-red-100";
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className={cn("w-24 h-24 rounded-full flex items-center justify-center", bgColor)}>
          <Trophy className={cn("w-12 h-12", trophyColor)}/>
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-2">{pct}%</h1>
          <p className="text-muted-foreground text-lg">{correct} / {total} correct</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {pct >= 80 ? "Excellent! Keep it up! 🎉" : pct >= 60 ? "Good work! A bit more practice will help." : "Keep practicing — you'll improve!"}
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/quiz"><Button variant="outline">Back to Quiz</Button></Link>
          <Button onClick={() => { setQIndex(0); setSelected(null); setAnswers([]); setFinished(false); }}>
            <RotateCcw className="mr-2 w-4 h-4"/>Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{isWeak ? "Weak Area Drill" : isAll ? "Mixed Practice" : decodeURIComponent(subject)}</h1>
          <p className="text-sm text-muted-foreground">Question {qIndex + 1} of {questions.length}</p>
        </div>
        <Link href="/quiz"><Button variant="ghost" size="sm">Exit</Button></Link>
      </div>

      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(qIndex / questions.length) * 100}%` }}/>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {current.subject && <Badge variant="outline" className="text-xs">{current.subject}</Badge>}
            {current.topic && <Badge variant="secondary" className="text-xs">{current.topic}</Badge>}
            {current.difficulty && (
              <Badge className={cn(
                "text-xs capitalize",
                current.difficulty === "easy" ? "bg-green-100 text-green-700" :
                current.difficulty === "hard" ? "bg-red-100 text-red-700" :
                "bg-amber-100 text-amber-700"
              )}>
                {current.difficulty}
              </Badge>
            )}
          </div>
          <p className="text-base font-medium leading-relaxed">{current.questionText}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(options).map(([key, val]) => {
          let cls = "p-4 rounded-lg border text-sm text-left transition-all w-full ";
          if (isAnswered) {
            if (key === current.correctOption) cls += "bg-green-100 border-green-400 text-green-900 font-medium";
            else if (key === selected) cls += "bg-red-100 border-red-400 text-red-900";
            else cls += "bg-muted/30 border-border text-muted-foreground";
          } else {
            cls += "bg-card border-border hover:border-primary hover:bg-primary/5 cursor-pointer";
          }
          return (
            <button key={key} className={cls} onClick={() => handleSelect(key)}>
              <span className="font-bold uppercase mr-2">{key}.</span>{val}
              {isAnswered && key === current.correctOption && <CheckCircle2 className="w-4 h-4 text-green-600 inline ml-2"/>}
              {isAnswered && key === selected && key !== current.correctOption && <XCircle className="w-4 h-4 text-red-600 inline ml-2"/>}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <Card className="border-primary/20 bg-primary/5 animate-in fade-in">
          <CardContent className="p-4 space-y-2">
            <p className={cn("text-sm font-semibold", isCorrect ? "text-green-700" : "text-red-700")}>
              {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
            </p>
            {current.explanation && <p className="text-sm text-muted-foreground leading-relaxed">{current.explanation}</p>}
            <Button onClick={handleNext} className="mt-2">
              {qIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}
              <ChevronRight className="ml-2 w-4 h-4"/>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
