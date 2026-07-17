import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, SignIn, SignUp } from "@clerk/react";
import { setAuthTokenGetter, useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import OnboardingPage from "@/pages/onboarding";
import PlannerPage from "@/pages/planner";
import SyllabusPage from "@/pages/syllabus";
import CurrentAffairsPage from "@/pages/current-affairs";
import QuizHomePage from "@/pages/quiz";
import QuizSessionPage from "@/pages/quiz-session";
import ProgressPage from "@/pages/progress";
import SettingsPage from "@/pages/settings";
import UpgradePage from "@/pages/upgrade";
import Layout from "@/components/layout";
import AdminLayout from "@/components/admin-layout";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminCurrentAffairsPage from "@/pages/admin/current-affairs";
import AdminUsersPage from "@/pages/admin/users";
import AdminQuizPage from "@/pages/admin/quiz";
import AdminSyllabusPage from "@/pages/admin/syllabus";
import AdminQuestionBankPage from "@/pages/admin/question-bank";
import AdminMockTestsPage from "@/pages/admin/mock-tests";
import AdminExamPatternsPage from "@/pages/admin/exam-patterns";
import AdminExamManagerPage from "@/pages/admin/exam-manager";
import MockTestListPage from "@/pages/mock-tests/index";
import MockTestSessionPage from "@/pages/mock-tests/session";
import MockTestResultPage from "@/pages/mock-tests/result";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, skipOnboardingCheck, ...rest }: any) {
  const { isLoaded, isSignedIn } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: profile, isLoading: profileLoading } = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: !!(isLoaded && isSignedIn),
      retry: false,
    },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/login");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  useEffect(() => {
    if (
      isLoaded && isSignedIn && !profileLoading &&
      !skipOnboardingCheck && location !== "/onboarding"
    ) {
      if (!profile?.examType) {
        setLocation("/onboarding");
      }
    }
  }, [isLoaded, isSignedIn, profile, profileLoading, skipOnboardingCheck, location, setLocation]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!skipOnboardingCheck && profileLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <Component {...rest} />
    </Layout>
  );
}

function AdminRoute({ component: Component }: any) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied" | "unauthenticated">("checking");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStatus("unauthenticated");
      setLocation("/login");
      return;
    }
    let cancelled = false;
    fetch("/api/admin/check", { credentials: "include", headers: { "Cache-Control": "no-cache" } })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setStatus("allowed");
        } else {
          setStatus("denied");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, setLocation]);

  if (status === "checking") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4 p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-red-600" style={{ animation: "none" }} />
        </div>
        <h1 className="text-2xl font-bold text-red-700">Access Denied</h1>
        <p className="text-muted-foreground max-w-sm">
          Your account is not authorised to access the admin panel. Make sure you are signed in with the admin email address set in the <strong>ADMIN_EMAIL</strong> secret.
        </p>
        <p className="text-xs text-muted-foreground">Signed-in Clerk ID: <code className="bg-muted px-1 rounded">{userId}</code></p>
        <button
          onClick={() => setLocation("/dashboard")}
          className="mt-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function RootRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded) {
      setLocation(isSignedIn ? "/dashboard" : "/login");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">GG</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Welcome to GovtGuru</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your AI Guru for Govt Exams</p>
        </div>
        <div className="mt-8 flex justify-center">
          <SignIn routing="path" path="/login" signUpUrl="/signup" />
        </div>
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">GG</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Start Your Journey</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create an account to build your study plan.</p>
        </div>
        <div className="mt-8 flex justify-center">
          <SignUp routing="path" path="/signup" signInUrl="/login" />
        </div>
      </div>
    </div>
  );
}

function Router() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={LoginPage} />
      <Route path="/login/:rest*" component={LoginPage} />
      <Route path="/signup" component={SignUpPage} />
      <Route path="/signup/:rest*" component={SignUpPage} />
      
      <Route path="/onboarding">
        <ProtectedRoute component={OnboardingPage} skipOnboardingCheck />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/planner">
        <ProtectedRoute component={PlannerPage} />
      </Route>
      <Route path="/syllabus">
        <ProtectedRoute component={SyllabusPage} />
      </Route>
      <Route path="/current-affairs">
        <ProtectedRoute component={CurrentAffairsPage} />
      </Route>
      <Route path="/mock-tests">
        {() => { window.location.replace("/quiz"); return null; }}
      </Route>
      <Route path="/mock-tests/:id/results/:attemptId">
        {(params) => <ProtectedRoute component={MockTestResultPage} id={params.id} attemptId={params.attemptId} />}
      </Route>
      <Route path="/mock-tests/:id">
        {(params) => <ProtectedRoute component={MockTestSessionPage} id={params.id} />}
      </Route>
      <Route path="/quiz">
        <ProtectedRoute component={QuizHomePage} />
      </Route>
      <Route path="/quiz/:subject">
        {(params) => <ProtectedRoute component={QuizSessionPage} subject={params.subject} />}
      </Route>
      <Route path="/progress">
        <ProtectedRoute component={ProgressPage} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route path="/upgrade">
        <ProtectedRoute component={UpgradePage} />
      </Route>

      <Route path="/admin">
        <AdminRoute component={AdminDashboardPage} />
      </Route>
      <Route path="/admin/current-affairs">
        <AdminRoute component={AdminCurrentAffairsPage} />
      </Route>
      <Route path="/admin/users">
        <AdminRoute component={AdminUsersPage} />
      </Route>
      <Route path="/admin/quiz">
        <AdminRoute component={AdminQuizPage} />
      </Route>
      <Route path="/admin/syllabus">
        <AdminRoute component={AdminSyllabusPage} />
      </Route>
      <Route path="/admin/question-bank">
        <AdminRoute component={AdminQuestionBankPage} />
      </Route>
      <Route path="/admin/mock-tests">
        <AdminRoute component={AdminMockTestsPage} />
      </Route>
      <Route path="/admin/exam-patterns">
        <AdminRoute component={AdminExamPatternsPage} />
      </Route>
      <Route path="/admin/exams">
        <AdminRoute component={AdminExamManagerPage} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;