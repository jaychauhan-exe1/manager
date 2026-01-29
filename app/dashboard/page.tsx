"use client";

import { useEffect } from "react";
import { authClient } from "../../src/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User, Settings, LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-primary">
        <div className="animate-pulse text-2xl font-bold">Loading dashboard...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar / Topnav Mockup */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                M
              </div>
              <span className="text-xl font-bold tracking-tight">Manager.</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </Button>
              <div className="flex items-center gap-3 pl-4 border-l border-border">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{session.user?.name}</p>
                  <p className="text-xs text-muted-foreground">{session.user?.email}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard Overview</h1>
          <p className="text-muted-foreground text-lg">
            Welcome back, <span className="text-primary font-semibold">{session.user?.name}</span>. Here is what&apos;s happening today.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-foreground">Profile Info</CardTitle>
              <User className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">Active</div>
              <p className="text-xs text-muted-foreground mt-1">Verified user account</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-foreground">Current Session</CardTitle>
              <LayoutDashboard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">Secured</div>
              <p className="text-xs text-muted-foreground mt-1">Via Better Auth + OKLCH</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-foreground">System Status</CardTitle>
              <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(95,123,238,0.4)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">Online</div>
              <p className="text-xs text-muted-foreground mt-1">Connected to Neon DB</p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h2 className="text-xl font-semibold mb-4 text-primary">Ready to build?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Authentication is now fully integrated. Your database is connected, and your primary color 
            <span className="text-primary font-mono ml-1 font-bold">#5F7BEE</span> is applied throughout the UI.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" className="px-8 border-border font-semibold text-foreground">Docs</Button>
            <Button className="px-8 bg-primary text-primary-foreground font-semibold">Get Started</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
