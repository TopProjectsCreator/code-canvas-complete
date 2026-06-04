import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorMinimapProps {
  content: string;
  selectedLine: number | null;
  onSelectLine: (line: number) => void;
}

export const EditorMinimap = ({ content, selectedLine, onSelectLine }: EditorMinimapProps) => {
  const lines = content.split("\n");

  return (
    <div className="hidden w-[92px] shrink-0 border-l border-border bg-background/70 px-2 py-3 xl:block">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Radar className="h-3.5 w-3.5" />
        Minimap
      </div>
      <div className="space-y-1">
        {lines.map((line, index) => (
          <button
            key={`mini-${index + 1}`}
            type="button"
            onClick={() => onSelectLine(index + 1)}
            className={cn(
              "block h-1.5 w-full rounded-full bg-muted/70 text-left transition-colors hover:bg-primary/40",
              selectedLine === index + 1 && "bg-primary",
              line.trim().startsWith("function") && "bg-violet-400/80",
              line.includes("class") && "bg-cyan-400/80",
            )}
            title={`Line ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
