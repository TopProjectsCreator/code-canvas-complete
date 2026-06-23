import { useRef, useEffect, useCallback } from "react";
import { ChevronRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Cm6EditorHandle } from "./Cm6Editor";

interface ScopeEntry {
  name: string;
  kind: string;
  line: number;
  endLine: number;
}

interface EditorGutterProps {
  content: string;
  selectedLine: number | null;
  commentsByLine: Map<number, any[]>;
  activePresence: { userId: string; cursorLine?: number; color: string; displayName: string }[];
  scopes: ScopeEntry[];
  foldedScopeSet: Set<string>;
  onSelectLine: (line: number) => void;
  onToggleFold: (scopeId: string) => void;
  editorRef: React.RefObject<Cm6EditorHandle | null>;
}

export const EditorGutter = ({
  content,
  selectedLine,
  commentsByLine,
  activePresence,
  scopes,
  foldedScopeSet,
  onSelectLine,
  onToggleFold,
  editorRef,
}: EditorGutterProps) => {
  const gutterRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    const view = editorRef.current?.getEditorView();
    if (!view) return;
    const cmScroller = view.scrollDOM;
    const gutter = gutterRef.current;
    if (cmScroller && gutter) {
      gutter.scrollTop = cmScroller.scrollTop;
    }
  }, [editorRef]);

  useEffect(() => {
    const view = editorRef.current?.getEditorView();
    if (!view) return;
    const cmScroller = view.scrollDOM;
    cmScroller.addEventListener("scroll", syncScroll, { passive: true });
    return () => cmScroller.removeEventListener("scroll", syncScroll);
  }, [editorRef, syncScroll]);

  useEffect(() => {
    syncScroll();
  }, [content, syncScroll]);

  const lineCount = content.split("\n").length;

  return (
    <div
      ref={gutterRef}
      className="overflow-hidden shrink-0 flex bg-editor pt-[2px] font-mono text-sm leading-6 text-muted-foreground"
    >
      <div className="flex flex-col">
        {Array.from({ length: lineCount }, (_, index) => {
          const lineNumber = index + 1;
          const lineComments = commentsByLine.get(lineNumber) || [];
          const selected = selectedLine === lineNumber;
          const peers = activePresence.filter((entry) => entry.cursorLine === lineNumber);
          return (
            <button
              key={lineNumber}
              type="button"
              onClick={() => onSelectLine(lineNumber)}
              className={cn(
                "flex h-6 min-w-[1.25rem] items-center justify-center gap-1 text-right text-xs leading-6 transition-colors",
                selected ? "bg-primary/10 text-primary" : "hover:bg-muted/40",
              )}
            >
              {lineComments.length > 0 && <MessageSquare className="h-3 w-3 text-primary" />}
              {peers.length > 0 && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col bg-editor/95 px-1 pt-[2px] text-xs text-muted-foreground">
        {Array.from({ length: lineCount }, (_, index) => {
          const lineNumber = index + 1;
          const scope = scopes.find((entry) => entry.line === lineNumber);
          if (!scope) return <div key={`fold-${lineNumber}`} className="h-6 w-5" />;
          const scopeId = `${scope.name}-${scope.line}`;
          const isFolded = foldedScopeSet.has(scopeId);
          return (
            <button
              key={scopeId}
              type="button"
              className={cn(
                "flex h-6 w-5 items-center justify-center rounded-sm transition-colors hover:bg-muted/50",
                isFolded && "bg-primary/10 text-primary",
              )}
              onClick={() => onToggleFold(scopeId)}
              title={`${isFolded ? "Expand" : "Fold"} ${scope.name}`}
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", !isFolded && "rotate-90")} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
