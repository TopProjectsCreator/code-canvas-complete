import { Outlet, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { KeyRound, Shield, Activity, Sliders, Beaker, FileText, LogOut } from "lucide-react";
import { RedactorFavicon } from "@/redactor/components/RedactorFavicon";

const NAV = [
  { to: "/redactor/dashboard", label: "Overview", icon: Activity },
  { to: "/redactor/provider-keys", label: "Provider keys", icon: Shield },
  { to: "/redactor/proxy-keys", label: "Proxy keys", icon: KeyRound },
  { to: "/redactor/playground", label: "Playground", icon: Beaker },
  { to: "/redactor/rules", label: "Rules", icon: Sliders },
  { to: "/redactor/logs", label: "Logs", icon: FileText },
] as const;

export default function RedactorAuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/redactor/auth" replace />;
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="min-h-screen bg-background">
      <RedactorFavicon />
      <aside className="fixed inset-y-0 left-0 w-56 border-r border-border/60 bg-card/40 p-4 flex flex-col">
        <Link to="/redactor" className="font-mono text-sm font-semibold mb-6 flex items-center gap-2">
          <img src="/redactor-logo.png" alt="" className="size-5" />
          redactor
        </Link>
        <nav className="space-y-1 flex-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start">
          <LogOut className="size-4 mr-2" />
          Sign out
        </Button>
      </aside>
      <main className="ml-56 p-8">
        <Outlet />
      </main>
    </div>
  );
}
