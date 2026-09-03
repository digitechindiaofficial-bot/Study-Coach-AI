import { useGetMyProfile, useGetProgressSummary, useGetDailyTasks, useGetCurrentAffairs, useGetWeakAreas, getGetMyProfileQueryKey, getGetProgressSummaryQueryKey, getGetDailyTasksQueryKey, getGetCurrentAffairsQueryKey, getGetWeakAreasQueryKey, useCompleteTask, useGenerateStudyPlan } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Flame, Target, BookOpen, BrainCircuit, BookMarked, RefreshCw, Zap, Newspaper, AlertCircle, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { isPreviewEnvironment } from "@/lib/app-auth";
import { createPreviewStudyPlan, readPreviewProfile, savePreviewStudyPlan } from "@/lib/preview-data";
import { useLocation } from "wouter";

export default function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const queryClient = useQueryClient();
  const preview = isPreviewEnvironment();
  const [, navigate] = useLocation();
  
  const { data: apiProfile, isLoading: profileLoading } = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: !preview,
    }
  });
  const profile = apiProfile ?? (preview ? readPreviewProfile() : undefined);
  
  const { data: summary, isLoading: summaryLoading } = useGetProgressSummary({
    query: { queryKey: getGetProgressSummaryQueryKey(), enabled: !preview }
  });
  
  const { data: tasks, isLoading: tasksLoading } = useGetDailyTasks({ date: today }, {
    query: { queryKey: getGetDailyTasksQueryKey({ date: today }), enabled: !preview }
  });
  
  const { data: news, isLoading: newsLoading } = useGetCurrentAffairs({ days: 1 }, {
    query: { queryKey: getGetCurrentAffairsQueryKey({ days: 1 }), enabled: !preview }
  });
  
  const { data: weakAreas, isLoading: weakLoading } = useGetWeakAreas({
    query: { queryKey: getGetWeakAreasQueryKey(), enabled: !preview }
  });

  const completeTask = useCompleteTask();
  const generatePlan = useGenerateStudyPlan();

  const handleGeneratePlan = () => {
    if (preview) {
      const generated = { plan: createPreviewStudyPlan(profile ?? readPreviewProfile()) };
      savePreviewStudyPlan(generated);
      navigate("/planner");
      return;
    }
    generatePlan.mutate();
  };

  const handleTaskComplete = (id: string) => {
    completeTask.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDailyTasksQueryKey({ date: today }) });
      },
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const daysToExam = profile?.examDate ? Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))) : 0;

  if (profileLoading && !preview) {
    return <div className="space-y-6"><Skeleton className="h-12 w-1/3" /><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{getGreeting()}, {profile?.fullName?.split(' ')[0] || 'Aspirant'}! 🎯</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          {daysToExam > 0 ? <span className="font-semibold text-foreground">{daysToExam} days</span> : "Time"} to {profile?.examType?.replace('_', ' ')}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center text-muted-foreground mb-2">
              <Target className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Today's Tasks</span>
            </div>
            <div className="text-3xl font-bold">
              {tasks?.filter(t => t.isCompleted).length || 0} / {tasks?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center text-accent mb-2">
              <Flame className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Day Streak</span>
            </div>
            <div className="text-3xl font-bold text-accent">{profile?.streakCount || 0} 🔥</div>
            <div className="text-xs text-muted-foreground mt-1">Best streak: {profile?.longestStreak || 0} days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center text-muted-foreground mb-2">
              <BookOpen className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Syllabus Done</span>
            </div>
            <div className="text-3xl font-bold">{summary?.syllabusCompletionPercent || 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center text-muted-foreground mb-2">
              <BrainCircuit className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Avg Quiz Score</span>
            </div>
            <div className="text-3xl font-bold">{summary?.avgQuizAccuracy || 0}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Content - Left 2 cols */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Today's Plan */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Today's Study Plan</h2>
              <Link href="/planner" className="text-sm font-medium text-primary hover:underline">View Full Plan</Link>
            </div>
            
            {tasksLoading ? (
              <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            ) : tasks?.length ? (
              <div className="space-y-3">
                {tasks.map(task => {
                  const Icon = task.taskType === 'study' ? BookMarked : task.taskType === 'revision' ? RefreshCw : task.taskType === 'quiz' ? Zap : Newspaper;
                  return (
                    <Card key={task.id} className={task.isCompleted ? "opacity-60 bg-muted/50" : ""}>
                      <CardContent className="p-4 flex items-start gap-4">
                        <Checkbox 
                          checked={task.isCompleted} 
                          onCheckedChange={() => !task.isCompleted && handleTaskComplete(task.id)}
                          disabled={task.isCompleted || completeTask.isPending}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="font-normal text-xs bg-background">{task.subject}</Badge>
                            <Badge variant="secondary" className="font-normal text-xs flex items-center gap-1">
                              <Icon className="w-3 h-3" />
                              <span className="capitalize">{task.taskType?.replace('_', ' ')}</span>
                            </Badge>
                          </div>
                          <p className={`font-medium ${task.isCompleted ? "line-through text-muted-foreground" : ""}`}>{task.topic}</p>
                        </div>
                        <div className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                          {task.durationMinutes} min
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-2 bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No tasks for today</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">You haven't generated an AI study plan yet or there are no tasks scheduled for today.</p>
                   <Button onClick={handleGeneratePlan} disabled={generatePlan.isPending}>
                    {generatePlan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate AI Study Plan
                  </Button>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Current Affairs */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Daily Current Affairs</h2>
              <Link href="/current-affairs" className="text-sm font-medium text-primary hover:underline">Read All</Link>
            </div>
            
            {newsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
            ) : news?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {news.slice(0, 4).map(article => (
                  <Card key={article.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => window.location.href = "/current-affairs"}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="secondary" className="text-[10px]">{article.category}</Badge>
                        <span className="text-xs text-muted-foreground">{article.publishedDate ? format(new Date(article.publishedDate), 'MMM d') : ''}</span>
                      </div>
                      <h3 className="font-semibold line-clamp-2 text-sm mb-2 leading-snug">{article.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No current affairs loaded for today.</p>
            )}
          </section>

        </div>

        {/* Sidebar - Right 1 col */}
        <div className="space-y-6">
          {/* Weak Areas Alert */}
          {weakAreas && weakAreas.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  Weak Areas Alert
                </CardTitle>
                <CardDescription>Topics needing immediate revision</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {weakAreas.slice(0, 3).map((wa, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                       <span className="text-sm font-medium truncate pr-2">{wa.topicName}</span>
                        <span className="text-xs font-bold text-destructive">{wa.accuracy}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-destructive" style={{ width: `${wa.accuracy}%` }} />
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full mt-4 bg-background" asChild>
                    <Link href="/quiz">Practice Weak Areas <ArrowRight className="w-4 h-4 ml-2" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="secondary" className="w-full justify-start" asChild>
                <Link href="/quiz"><Zap className="w-4 h-4 mr-2" /> Start Random Quiz</Link>
              </Button>
              <Button variant="secondary" className="w-full justify-start" asChild>
                <Link href="/syllabus"><BookOpen className="w-4 h-4 mr-2" /> Update Syllabus</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Imports for icon that was missing
import { Calendar, Sparkles } from "lucide-react";