import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
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
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Study Planner", href: "/planner", icon: CalendarDays, badge: "AI" },
  { name: "Syllabus", href: "/syllabus", icon: BookOpen },
  { name: "Current Affairs", href: "/current-affairs", icon: Newspaper },
  { name: "Quiz Practice", href: "/quiz", icon: BrainCircuit },
  { name: "Progress", href: "/progress", icon: TrendingUp },
];

const mobileNavItems = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Plan", href: "/planner", icon: CalendarDays },
  { name: "News", href: "/current-affairs", icon: Newspaper },
  { name: "Quiz", href: "/quiz", icon: BrainCircuit },
  { name: "Progress", href: "/progress", icon: TrendingUp },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  
  const { data: profile } = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: !!user,
    }
  });

  const isFree = profile?.planType === "free" || !profile?.planType;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card fixed inset-y-0 z-10">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
              OS
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">AI Study OS</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto bg-accent/20 text-accent font-semibold text-[10px] px-1.5 py-0.5 rounded uppercase">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t space-y-1">
          <Link href="/settings">
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
              location.startsWith("/settings") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </div>
          </Link>
          
          {isFree && (
            <Link href="/upgrade">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer text-accent hover:bg-accent/10">
                <Sparkles className="h-5 w-5" />
                <span>Upgrade to Pro</span>
              </div>
            </Link>
          )}

          <div className="my-2 h-px bg-border" />
          
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium truncate">{user?.fullName || "User"}</span>
              <span className="text-xs text-muted-foreground truncate">{profile?.examType?.replace('_', ' ') || "No exam set"}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0" onClick={() => signOut({ redirectUrl: "/" })}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            OS
          </div>
          <span className="font-bold text-foreground">AI Study OS</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Avatar className="h-8 w-8 border border-border cursor-pointer">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback>{user?.firstName?.[0]}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 flex flex-col min-w-0 pb-[72px] md:pb-0">
        <div className="flex-1 max-w-[1280px] w-full mx-auto p-4 md:p-8">
          {children}
        </div>
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