import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Code2, Home, ArrowLeft, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-lg px-6 text-center">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Code2 className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold tracking-tight">Code Canvas</span>
        </div>

        <div className="mb-2 font-mono text-8xl font-bold text-primary/20 select-none">404</div>

        <div className="mb-4 rounded-md border border-border bg-muted/50 px-4 py-3 font-mono text-sm text-left">
          <span className="text-muted-foreground">$ </span>
          <span className="text-red-400">error</span>
          <span className="text-muted-foreground">: route not found: </span>
          <span className="text-yellow-400">{location.pathname}</span>
        </div>

        <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
        <p className="mb-8 text-muted-foreground">
          The path{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">
            {location.pathname}
          </code>{" "}
          doesn&apos;t exist. It may have been moved, deleted, or you might have mistyped the URL.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button onClick={() => navigate("/")} className="gap-2">
            <Home className="h-4 w-4" />
            Home
          </Button>
          <Button onClick={() => navigate("/editor")} variant="outline" className="gap-2">
            <Terminal className="h-4 w-4" />
            Open editor
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
