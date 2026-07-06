import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Crown, BrainCircuit, Newspaper, TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminStats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  todayQuizAttempts: number;
  totalQuizAttempts: number;
  totalQuestions: number;
  totalCurrentAffairs: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include", headers: { "Cache-Control": "no-cache" } })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load stats");
        return res.json();
      })
      .then((data) => setStats(data))
      .catch(() => setError("Failed to load dashboard stats."))
      .finally(() => setIsLoading(false));
  }, []);

  const cards = stats
    ? [
        { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-red-600 bg-red-100" },
        { label: "Pro Users", value: stats.proUsers, icon: Crown, color: "text-orange-600 bg-orange-100" },
        { label: "Free Users", value: stats.freeUsers, icon: Users, color: "text-slate-600 bg-slate-100" },
        { label: "Quiz Attempts Today", value: stats.todayQuizAttempts, icon: TrendingUp, color: "text-red-600 bg-red-100" },
        { label: "Total Quiz Attempts", value: stats.totalQuizAttempts, icon: BrainCircuit, color: "text-orange-600 bg-orange-100" },
        { label: "Quiz Questions", value: stats.totalQuestions, icon: BrainCircuit, color: "text-red-600 bg-red-100" },
        { label: "Current Affairs Items", value: stats.totalCurrentAffairs, icon: Newspaper, color: "text-orange-600 bg-orange-100" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-red-700">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of GovtGuru platform activity.</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        </div>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Card key={c.label} className="border-orange-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <div className={cn("h-9 w-9 rounded-full flex items-center justify-center", c.color)}>
                  <c.icon className="h-4.5 w-4.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{c.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
