import { TestTube2, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorStatusBarProps {
  language: string;
  cursorPosition: { line: number; col: number };
  selectedLine: number | null;
  currentScope: { name: string } | null;
  fileName: string;
  content: string;
  showWorkbench: boolean;
  onGenerateTest: () => void;
  onToggleWorkbench: () => void;
}

export const EditorStatusBar = ({
  language,
  cursorPosition,
  selectedLine,
  currentScope,
  fileName,
  content,
  showWorkbench,
  onGenerateTest,
  onToggleWorkbench,
}: EditorStatusBarProps) => {
  return (
    <div className="flex items-center justify-between border-t border-border bg-background px-4 py-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>{language || "Plain Text"}</span>
        <span>UTF-8</span>
        {selectedLine !== null && <span>Comment lane: Ln {selectedLine}</span>}
        <span className="text-muted-foreground/70">{currentScope?.name || "Global"}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="hover:text-foreground transition-colors"
          onClick={onGenerateTest}
          title="Generate test file"
        >
          <TestTube2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={cn("hover:text-foreground transition-colors", showWorkbench && "text-primary")}
          onClick={onToggleWorkbench}
          title={showWorkbench ? "Hide dock" : "Show dock"}
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
        </button>
        <span className="ml-2">
          Ln {cursorPosition.line}, Col {cursorPosition.col}
        </span>
        <span>Spaces: 2</span>
      </div>
    </div>
  );
};
