import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles, CheckCircle2 } from "lucide-react";

export function ProGateOverlay({ featureName }: { featureName: string }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-md">
      <div className="bg-card border shadow-lg rounded-xl p-8 max-w-sm w-full text-center space-y-6 mx-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mb-4">
          <Sparkles className="h-6 w-6 text-accent" />
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-2">{featureName} is a Pro feature</h3>
          <p className="text-sm text-muted-foreground">
            Upgrade to unlock this and supercharge your exam preparation.
          </p>
        </div>

        <div className="text-left space-y-3 bg-muted/50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Unlimited AI MCQs from News</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Unlimited Plan Regenerations</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Advanced Weak Area Analytics</span>
          </div>
        </div>

        <div className="pt-2">
          <p className="text-2xl font-bold mb-4">₹199<span className="text-sm text-muted-foreground font-normal">/month</span></p>
          <Link href="/upgrade">
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              Upgrade to Pro
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}