import { CircuitBoard } from "lucide-react";

export function CodeCanvasLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/25">
        <CircuitBoard className="h-4.5 w-4.5 text-primary-foreground" />
      </div>
      <span className="font-mono text-lg font-semibold tracking-tight">CodeCanvas</span>
    </div>
  );
}