import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, BrainCircuit, CalendarDays, TrendingUp, Newspaper } from "lucide-react";

const FREE_FEATURES = ["10 Quiz questions/day","Basic syllabus tracking","Current affairs (last 7 days)","1 study plan/month"];
const PRO_FEATURES = ["Unlimited quiz questions","AI-powered study plan generation","Weak area targeting","Current affairs MCQ generator","Full syllabus tracker","Progress analytics","Priority AI responses","All exam types"];

export default function UpgradePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 text-sm px-4 py-1">
          <Sparkles className="w-4 h-4 mr-1 inline"/>Pro Plan
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight">Supercharge Your Prep</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Get AI-powered coaching, unlimited practice, and advanced analytics. Everything a serious aspirant needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <div className="text-3xl font-bold">₹0<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
          </CardHeader>
          <CardContent className="space-y-3">
            {FREE_FEATURES.map(f=>(
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0"/>{f}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-2 border-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-semibold">
            MOST POPULAR
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500"/>Pro</CardTitle>
            <div>
              <span className="text-3xl font-bold">₹299</span>
              <span className="text-lg text-muted-foreground font-normal">/mo</span>
              <p className="text-xs text-muted-foreground mt-1">or ₹2499/year (save 30%)</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRO_FEATURES.map(f=>(
              <div key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0"/>{f}
              </div>
            ))}
            <Button className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold" size="lg">
              <Sparkles className="mr-2 w-4 h-4"/>Upgrade to Pro
            </Button>
            <p className="text-center text-xs text-muted-foreground">Secure payment • Cancel anytime</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-center mb-6">Why Go Pro?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon:BrainCircuit, title:"AI Quiz Engine", desc:"Unlimited topic-specific MCQs with detailed explanations" },
            { icon:CalendarDays, title:"AI Study Planner", desc:"Week-by-week Gemini-powered personalized schedule" },
            { icon:Newspaper, title:"MCQ from News", desc:"Turn any current affairs article into practice questions" },
            { icon:TrendingUp, title:"Analytics", desc:"Track weak areas and accuracy trends over time" },
          ].map(({icon:Icon,title,desc})=>(
            <Card key={title} className="text-center">
              <CardContent className="p-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-primary"/>
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
