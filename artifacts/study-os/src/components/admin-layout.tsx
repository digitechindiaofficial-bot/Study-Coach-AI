import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Newspaper,
  Users,
  BrainCircuit,
  BookOpen,
  LogOut,
  ShieldAlert,
  ArrowLeftCircle,
  Menu,
} from "lucide-react";
import { useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Syllabus", href: "/admin/syllabus", icon: BookOpen },
  { name: "Current Affairs", href: "/admin/current-affairs", icon: Newspaper },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Quiz Questions", href: "/admin/quiz", icon: BrainCircuit },
];

function SidebarContent({ location, onNav }: { location: string; onNav?: () => void }) {
  const { signOut } = useClerk();

  return (
    <>
      <div className="p-6">
        <Link href="/admin" className="flex items-center gap-3" onClick={onNav}>
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-foreground tracking-tight block leading-tight">Admin Panel</span>
            <span className="text-[11px] text-muted-foreground">GovtGuru</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === "/admin" ? location === "/admin" : location.startsWith(item.href);
          return (
            <Link key={item.name} href={item.href} onClick={onNav}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-red-600" : "text-muted-foreground")} />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t space-y-2">
        <Link href="/dashboard" onClick={onNav}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeftCircle className="h-5 w-5" />
            <span>Back to App</span>
          </div>
        </Link>
        <Button
          variant="outline"
          className="w-full justify-start text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          onClick={() => signOut({ redirectUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-orange-50/30 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card fixed inset-y-0 z-10">
        <SidebarContent location={location} />
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <span className="font-bold text-foreground">Admin Panel</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 flex flex-col">
            <SidebarContent location={location} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 flex flex-col min-w-0">
        <div className="flex-1 max-w-[1280px] w-full mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
