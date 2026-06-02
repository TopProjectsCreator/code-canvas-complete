import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { BuilderProvider, useBuilder } from "./useBuilderStore";
import { ComponentPalette } from "./ComponentPalette";
import { Canvas, DragPreview, findNodeById, findContainerParent } from "./Canvas";
import { ComponentTree } from "./ComponentTree";
import { PropertiesPanel } from "./PropertiesPanel";
import { CodePreview } from "./CodePreview";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { getRegistryEntry } from "./registry";
import type { FileNode } from "@/types/ide";
import type { UINode } from "./types";

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current;
      let dragNode: { type: string; label: string } | null = null;
      if (data?.from === "palette") {
        const config = getRegistryEntry(data.type as string);
        dragNode = { type: data.type as string, label: config?.label ?? data.type };
      } else if (data?.from === "canvas" && data?.node) {
        const config = getRegistryEntry((data.node as UINode).componentType);
        dragNode = { type: (data.node as UINode).componentType, label: config?.label ?? (data.node as UINode).componentType };
      }
      dispatch({ type: "SET_DRAGGING", isDragging: true, dragNode });
    },
    [dispatch],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) {
        dispatch({ type: "SET_DRAGGING", isDragging: false });
        return;
      }

      const activeData = active.data.current;
      if (activeData?.from === "palette") {
        const componentType = activeData.type as string;
        const overId = over.id as string;

        let parentId: string | null = null;
        let index = 0;

        if (overId === "root") {
          parentId = null;
          index = state.rootNodes.length;
        } else {
          const overNode = findNodeById(state.rootNodes, overId);
          if (overNode && overNode.children.length > 0 && getRegistryEntry(overNode.componentType)?.isContainer) {
            parentId = overNode.id;
            index = overNode.children.length;
          } else {
            const container = findContainerParent(state.rootNodes, overId);
            if (container) {
              parentId = container.id;
              const idx = container.children.findIndex((c) => c.id === overId);
              index = idx >= 0 ? idx + 1 : container.children.length;
            } else {
              parentId = null;
              const idx = state.rootNodes.findIndex((n) => n.id === overId);
              index = idx >= 0 ? idx + 1 : state.rootNodes.length;
            }
          }
        }

        dispatch({
          type: "ADD_NODE",
          componentType,
          position: { parentId, index },
        });
      } else if (activeData?.from === "canvas") {
        const nodeId = active.id as string;
        const overId = over.id as string;

        let parentId: string | null = null;
        let index = 0;

        if (overId === "root") {
          parentId = null;
          index = state.rootNodes.length;
        } else {
          const overNode = findNodeById(state.rootNodes, overId);
          if (overNode && overNode.children.length > 0 && getRegistryEntry(overNode.componentType)?.isContainer) {
            parentId = overNode.id;
            index = overNode.children.length;
          } else {
            const container = findContainerParent(state.rootNodes, overId);
            if (container) {
              parentId = container.id;
              const idx = container.children.findIndex((c) => c.id === overId);
              index = idx >= 0 ? idx + 1 : container.children.length;
            } else {
              parentId = null;
              const idx = state.rootNodes.findIndex((n) => n.id === overId);
              index = idx >= 0 ? idx + 1 : state.rootNodes.length;
            }
          }
        }

        dispatch({
          type: "MOVE_NODE",
          nodeId,
          position: { parentId, index },
        });
      }

      dispatch({ type: "SET_DRAGGING", isDragging: false });
      dispatch({ type: "SET_DROP_POSITION", position: null });
    },
    [dispatch, state.rootNodes],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) {
        dispatch({ type: "SET_DROP_POSITION", position: null });
        return;
      }

      const overId = over.id as string;
      if (overId === "root") {
        dispatch({
          type: "SET_DROP_POSITION",
          position: { parentId: null, index: state.rootNodes.length },
        });
      } else {
        const overNode = findNodeById(state.rootNodes, overId);
        if (overNode && overNode.children.length > 0 && getRegistryEntry(overNode.componentType)?.isContainer) {
          dispatch({
            type: "SET_DROP_POSITION",
            position: { parentId: overNode.id, index: overNode.children.length },
          });
        } else {
          const container = findContainerParent(state.rootNodes, overId);
          if (container) {
            const idx = container.children.findIndex((c) => c.id === overId);
            dispatch({
              type: "SET_DROP_POSITION",
              position: { parentId: container.id, index: idx >= 0 ? idx + 1 : container.children.length },
            });
          }
        }
      }
    },
    [dispatch, state.rootNodes],
  );

  const dndContent = viewMode === "code" ? (
    <CodePreview />
  ) : (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
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

      <DragOverlay>
        {state.isDragging && state.activeDragNode ? (
          <DragPreview type={state.activeDragNode.type} label={state.activeDragNode.label} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );

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
        {dndContent}
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
