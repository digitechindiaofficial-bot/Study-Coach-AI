import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Users as UsersIcon, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  clerkUserId: string;
  fullName: string;
  email: string;
  examType: string | null;
  planType: string | null;
  streakCount: number | null;
  createdAt: string;
  lastActiveDate: string | null;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async (searchTerm?: string) => {
    setIsLoading(true);
    try {
      const qs = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const res = await fetch(`/api/admin/users${qs}`, { credentials: "include", headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      toast({ title: "Failed to load users", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => load(search), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  const togglePlan = async (user: AdminUser) => {
    const newPlan = user.planType === "pro" ? "free" : "pro";
    setUpdatingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planType: newPlan }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, planType: newPlan } : u)));
      toast({ title: `${user.fullName || "User"} moved to ${newPlan === "pro" ? "Pro" : "Free"} plan` });
    } catch {
      toast({ title: "Failed to update plan", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-red-700">Users</h1>
        <p className="text-muted-foreground mt-1">View registered users and manage their subscription plan.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        </div>
      )}

      {!isLoading && users.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-2">
            <UsersIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No users found.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && users.length > 0 && (
        <Card className="border-orange-100 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Streak</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>{user.examType ? <Badge variant="secondary">{user.examType.replace(/_/g, " ")}</Badge> : "—"}</TableCell>
                    <TableCell>
                      <Badge className={cn(
                        user.planType === "pro"
                          ? "bg-amber-100 text-amber-700 border-amber-300"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {user.planType === "pro" ? "Pro" : "Free"}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.streakCount ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(user.createdAt), "PP")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingId === user.id}
                        onClick={() => togglePlan(user)}
                        className={cn(
                          user.planType === "pro"
                            ? "text-destructive border-destructive/30 hover:bg-destructive/5"
                            : "text-orange-600 border-orange-300 hover:bg-orange-50"
                        )}
                      >
                        {updatingId === user.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : user.planType === "pro" ? (
                          <><ArrowDownCircle className="mr-1.5 h-3.5 w-3.5" />Downgrade</>
                        ) : (
                          <><ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" />Upgrade</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
