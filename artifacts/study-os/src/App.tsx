import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, SignIn, SignUp } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useEffect } from "react";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/login");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || !isSignedIn) {
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
            <span className="text-primary-foreground font-bold text-xl">OS</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Welcome to AI Study OS</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your premium coaching institute in your pocket.</p>
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
            <span className="text-primary-foreground font-bold text-xl">OS</span>
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
        <ProtectedRoute component={OnboardingPage} />
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