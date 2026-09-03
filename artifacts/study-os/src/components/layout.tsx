import { ReactNode } from "react";
import Footer from "@/components/footer";
import { Link, useLocation } from "wouter";
import { isPreviewEnvironment, useAppClerk, useAppUser } from "@/lib/app-auth";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Newspaper,
  BrainCircuit,
  TrendingUp,
  Settings,
  LogOut,
  Sparkles,
  Zap,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlan, FREE_DAILY_QUIZ_LIMIT } from "@/hooks/use-plan";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";

const navItems = [
  { name: "Dashboard",       href: "/dashboard",       icon: LayoutDashboard },
  { name: "Study Planner",   href: "/planner",          icon: CalendarDays,   badge: "AI" },
  { name: "Syllabus",        href: "/syllabus",         icon: BookOpen },
  { name: "Current Affairs", href: "/current-affairs",  icon: Newspaper },
  { name: "Blog",            href: "/blog",             icon: FileText },
  { name: "Quiz Practice",   href: "/quiz",             icon: BrainCircuit },
  { name: "Progress",        href: "/progress",         icon: TrendingUp },
];

const mobileNavItems = [
  { name: "Home",     href: "/dashboard",      icon: LayoutDashboard },
  { name: "Plan",     href: "/planner",        icon: CalendarDays },
  { name: "News",     href: "/current-affairs", icon: Newspaper },
  { name: "Quiz",     href: "/quiz",           icon: BrainCircuit },
  { name: "Progress", href: "/progress",       icon: TrendingUp },
];

function SidebarContent({ location, onNav }: { location: string; onNav?: () => void }) {
  const { user } = useAppUser();
  const { signOut } = useAppClerk();
  const plan = usePlan();
  const { data: profileData } = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: !isPreviewEnvironment(),
    },
  });

  const isFree = !plan.isPro;
  const quizLeft = plan.quizQuestionsLeft;
  const isQuizLow = isFree && quizLeft <= 3;

  return (
    <>
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-1.5" onClick={onNav}>
          <img src="/logo-icon.png" alt="GovtGuru" width={36} height={36} className="rounded-lg shrink-0" />
          <span className="font-bold text-lg text-foreground tracking-tight">GovtGuru</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.startsWith(item.href);
          const isQuiz = item.href === "/quiz";
          return (
            <Link key={item.name} href={item.href} onClick={onNav}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span>{item.name}</span>
                {item.badge && (
                  <span className="ml-auto bg-accent/20 text-accent font-semibold text-[10px] px-1.5 py-0.5 rounded uppercase">
                    {item.badge}
                  </span>
                )}
                {isQuiz && isFree && plan.isLoaded && (
                  <span className={cn(
                    "ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    isQuizLow
                      ? "bg-red-100 text-red-700"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {quizLeft === 0 ? "Limit hit" : `${quizLeft} left`}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t space-y-2">
        <Link href="/settings" onClick={onNav}>
          <div className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
            location.startsWith("/settings") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}>
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </div>
        </Link>

        {isFree && (
          <Link href="/upgrade" onClick={onNav}>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-sm hover:from-amber-600 hover:to-orange-600 transition-all">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Upgrade to Pro</span>
              <Badge className="ml-auto bg-white/20 text-white border-0 text-[10px] px-1.5">₹129/mo</Badge>
            </div>
          </Link>
        )}

        {!isFree && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10">
            <Zap className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-700">Pro Plan Active</span>
            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wide">
              Pro
            </span>
          </div>
        )}

        <div className="h-px bg-border" />

        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{profileData?.fullName || user?.fullName || "User"}</span>
            <span className="text-xs text-muted-foreground truncate capitalize">
              {plan.planType === "pro" ? "✦ Pro" : "Free Plan"}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0" onClick={() => signOut({ redirectUrl: "/" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card fixed inset-y-0 z-10">
        <SidebarContent location={location} />
      </aside>

      {/* Mobile Header */}
      <MobileHeader location={location} />

      {/* Main Content */}
      <main className="flex-1 md:pl-64 flex flex-col min-w-0 pb-[72px] md:pb-0">
        <div className="flex-1 max-w-[1280px] w-full mx-auto p-4 md:p-8">
          {children}
        </div>
        <Footer className="hidden md:block" />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-20 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          {mobileNavItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href}>
                <div className="flex flex-col items-center justify-center w-16 h-full space-y-1 cursor-pointer">
                  <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-[10px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
                    {item.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function MobileHeader({ location }: { location: string }) {
  const { user } = useAppUser();
  const plan = usePlan();

  return (
    <header className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
      <Link href="/dashboard" className="flex items-center gap-2">
        <img src="/logo-icon.png" alt="GovtGuru" width={28} height={28} className="rounded-md shrink-0" />
        <span className="font-bold text-foreground">GovtGuru</span>
      </Link>
      <div className="flex items-center gap-2">
        {!plan.isPro && (
          <Link href="/upgrade">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold">
              <Sparkles className="h-3 w-3" />
              Pro
            </div>
          </Link>
        )}
        <Link href="/settings">
          <Avatar className="h-8 w-8 border border-border cursor-pointer">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback>{user?.firstName?.[0]}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
