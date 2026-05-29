import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { BuilderProvider, useBuilder } from "./useBuilderStore";
import { ComponentPalette } from "./ComponentPalette";
import { Canvas } from "./Canvas";
import { ComponentTree } from "./ComponentTree";
import { PropertiesPanel } from "./PropertiesPanel";
import { CodePreview } from "./CodePreview";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import type { FileNode } from "@/types/ide";

interface BuilderLayoutProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

type ViewMode = "design" | "code";

function BuilderLayoutInner({ file, onContentChange }: BuilderLayoutProps) {
  const { state, dispatch, getCode, toJSON, loadFromJSON } = useBuilder();
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!initialLoadDone.current && file.content) {
      loadFromJSON(file.content);
      initialLoadDone.current = true;
    }
  }, [file.id, file.content, loadFromJSON]);

  useEffect(() => {
    if (initialLoadDone.current) {
      const json = toJSON();
      onContentChange(file.id, json);
    }
  }, [state.rootNodes, file.id, onContentChange, toJSON]);

  const handleUndo = useCallback(() => dispatch({ type: "UNDO" }), [dispatch]);
  const handleRedo = useCallback(() => dispatch({ type: "REDO" }), [dispatch]);
  const handleDelete = useCallback(() => {
    if (state.selectedNodeId) dispatch({ type: "REMOVE_NODE", nodeId: state.selectedNodeId });
  }, [dispatch, state.selectedNodeId]);
  const handleDuplicate = useCallback(() => {
    if (state.selectedNodeId) dispatch({ type: "DUPLICATE_NODE", nodeId: state.selectedNodeId });
  }, [dispatch, state.selectedNodeId]);
  const handleDeselect = useCallback(() => dispatch({ type: "SELECT_NODE", nodeId: null }), [dispatch]);

  const shortcuts = useMemo(() => ({
    "Delete": handleDelete,
    "Backspace": handleDelete,
    "Cmd+Z": handleUndo,
    "Ctrl+Z": handleUndo,
    "Cmd+Shift+Z": handleRedo,
    "Ctrl+Shift+Z": handleRedo,
    "Cmd+Y": handleRedo,
    "Ctrl+Y": handleRedo,
    "Escape": handleDeselect,
    "Cmd+D": handleDuplicate,
    "Ctrl+D": handleDuplicate,
  }), [handleDelete, handleUndo, handleRedo, handleDeselect, handleDuplicate]);

  useKeyboardShortcuts(shortcuts);

  const [viewMode, setViewMode] = useState<ViewMode>("design");

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground mr-2">UI Designer</span>
          <button
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={handleUndo}
            disabled={state.historyIndex <= 0}
            title="Undo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </button>
          <button
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={handleRedo}
            disabled={state.historyIndex >= state.history.length - 1}
            title="Redo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-muted rounded-md p-0.5">
            <button
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                viewMode === "design"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("design")}
            >
              Design
            </button>
            <button
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                viewMode === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("code")}
            >
              Code
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground ml-2">
            {state.rootNodes.length} component{state.rootNodes.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "code" ? (
          <CodePreview />
        ) : (
          <ResizablePanelGroup direction="horizontal">
            {/* Left: Palette */}
            <ResizablePanel defaultSize={18} minSize={12} maxSize={28}>
              <ComponentPalette />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Center: Canvas + Component Tree */}
            <ResizablePanel defaultSize={55} minSize={30}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={75} minSize={40}>
                  <Canvas />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={25} minSize={15} maxSize={45}>
                  <ComponentTree />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right: Properties */}
            <ResizablePanel defaultSize={27} minSize={15} maxSize={40}>
              <PropertiesPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}

export function BuilderLayout(props: BuilderLayoutProps) {
  return (
    <BuilderProvider>
      <BuilderLayoutInner {...props} />
    </BuilderProvider>
  );
}
