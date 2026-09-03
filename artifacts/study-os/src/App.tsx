import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignIn, SignUp } from "@clerk/react";
import { setAuthTokenGetter, useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { isPreviewEnvironment, useAppAuth } from "@/lib/app-auth";

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
import AdminQuestionStatsPage from "@/pages/admin/question-stats";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import TermsOfServicePage from "@/pages/terms-of-service";
import RefundPolicyPage from "@/pages/refund-policy";
import CancellationPolicyPage from "@/pages/cancellation-policy";
import ContactUsPage from "@/pages/contact-us";
import AboutUsPage from "@/pages/about-us";
import FAQPage from "@/pages/faq";
import MockTestListPage from "@/pages/mock-tests/index";
import MockTestSessionPage from "@/pages/mock-tests/session";
import MockTestResultPage from "@/pages/mock-tests/result";
import BlogListPage from "@/pages/blog/index";
import BlogPostPage from "@/pages/blog/post";
import AdminBlogPage from "@/pages/admin/blog";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, skipOnboardingCheck, ...rest }: any) {
  const { isLoaded, isSignedIn } = useAppAuth();
  const [location, setLocation] = useLocation();

  const { data: profile, isLoading: profileLoading } = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: !!(isLoaded && isSignedIn) && !isPreviewEnvironment(),
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
      !skipOnboardingCheck && !isPreviewEnvironment() && location !== "/onboarding"
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
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied" | "unauthenticated">("checking");
  const [denyHint, setDenyHint] = useState<{ clerkEmail?: string; adminEmailPrefix?: string } | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStatus("unauthenticated");
      setLocation("/login");
      return;
    }
    if (isPreviewEnvironment()) {
      setStatus("allowed");
      return;
    }
    let cancelled = false;
    fetch("/api/admin/check", { credentials: "include", headers: { "Cache-Control": "no-cache" } })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          setStatus("allowed");
        } else {
          try {
            const body = await res.json();
            setDenyHint({ clerkEmail: body.clerkEmail, adminEmailPrefix: body.adminEmailPrefix });
          } catch { /* ignore */ }
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
          Your account is not authorised to access the admin panel. The email Clerk returned for your account must exactly match the <strong>ADMIN_EMAIL</strong> environment variable on the server.
        </p>
        {denyHint && (
          <div className="text-xs text-muted-foreground bg-muted rounded px-4 py-2 text-left space-y-1 max-w-sm">
            <p>Your Clerk email: <code className="font-mono">{denyHint.clerkEmail ?? "unknown"}</code></p>
            <p>ADMIN_EMAIL starts with: <code className="font-mono">{denyHint.adminEmailPrefix ?? "NOT_SET"}</code></p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Clerk User ID: <code className="bg-muted px-1 rounded">{userId}</code></p>
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
  const { isLoaded, isSignedIn } = useAppAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded) {
      setLocation(isSignedIn ? "/dashboard" : "/login");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4" style={{ backgroundColor: "#1B2A4A" }}>
      <img
        src="/logo-icon.png"
        alt="GovtGuru"
        width={80}
        height={80}
        className="animate-pulse rounded-2xl"
      />
      <p className="text-lg font-bold" style={{ color: "#F5A623" }}>GovtGuru</p>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>AI se Sarkari Job Pakki</p>
    </div>
  );
}

function LoginPage() {
  const { enterPreview } = useAppAuth();
  const [, setLocation] = useLocation();

  if (isPreviewEnvironment()) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4 py-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <img
            src="/logo-full.png"
            alt="GovtGuru — AI se Sarkari Job Pakki"
            width={280}
            className="mx-auto"
          />
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Preview mode</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Clerk production authentication is restricted to govtguru.com.
                Use the local preview session to inspect the app here.
              </p>
            </div>
            <button
              onClick={() => {
                enterPreview();
                setLocation("/dashboard");
              }}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue to app preview
            </button>
            <p className="text-xs text-muted-foreground">
              Preview data requests still require a real production sign-in.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img
            src="/logo-full.png"
            alt="GovtGuru — AI se Sarkari Job Pakki"
            width={280}
            className="mx-auto mb-2"
          />
        </div>
        <div className="flex justify-center">
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
          <img
            src="/logo-full.png"
            alt="GovtGuru — AI se Sarkari Job Pakki"
            width={280}
            className="mx-auto mb-2"
          />
        </div>
        <div className="flex justify-center">
          <SignUp routing="path" path="/signup" signInUrl="/login" />
        </div>
      </div>
    </div>
  );
}

function Router() {
  const { getToken } = useAppAuth();

  // Set synchronously on every render so the getter is always available
  // before any child query fires (avoids race with useEffect timing).
  setAuthTokenGetter(getToken);

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
      <Route path="/admin/question-stats">
        <AdminRoute component={AdminQuestionStatsPage} />
      </Route>

      {/* Public blog pages — no auth required (SEO crawlable) */}
      <Route path="/blog" component={BlogListPage} />
      <Route path="/blog/:slug">
        {(params) => <BlogPostPage slug={params.slug} />}
      </Route>

      <Route path="/admin/blog">
        <AdminRoute component={AdminBlogPage} />
      </Route>

      {/* Public legal & info pages — no auth required */}
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route path="/refund-policy" component={RefundPolicyPage} />
      <Route path="/cancellation-policy" component={CancellationPolicyPage} />
      <Route path="/contact-us" component={ContactUsPage} />
      <Route path="/about-us" component={AboutUsPage} />
      <Route path="/faq" component={FAQPage} />

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