import { useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { useBuilder } from "./useBuilderStore";
import { ComponentWrapper } from "./ComponentWrapper";
import { DropIndicator } from "./DropIndicator";
import { getRegistryEntry } from "./registry";
import type { UINode } from "./types";

function CanvasDroppable({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[60px] transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/40 rounded-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

function DragPreview({ type, label }: { type: string; label: string }) {
  return (
    <div className="px-3 py-1.5 rounded-md bg-background border border-primary/50 shadow-lg text-sm font-medium text-foreground flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-primary" />
      {label}
    </div>
  );
}

function flattenTree(nodes: UINode[]): string[] {
  const ids: string[] = [];
  function walk(list: UINode[]) {
    for (const n of list) {
      ids.push(n.id);
      if (n.children.length > 0) walk(n.children);
    }
  }
  walk(nodes);
  return ids;
}

function findContainerParent(nodes: UINode[], childId: string): UINode | null {
  for (const n of nodes) {
    if (n.children.some((c) => c.id === childId)) return n;
    if (n.children.length > 0) {
      const found = findContainerParent(n.children, childId);
      if (found) return found;
    }
  }
  return null;
}

export function Canvas() {
  const { state, dispatch } = useBuilder();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const allIds = useMemo(() => flattenTree(state.rootNodes), [state.rootNodes]);

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="h-full w-full overflow-auto p-4" onClick={() => dispatch({ type: "SELECT_NODE", nodeId: null })}>
        <CanvasDroppable id="root" className="min-h-full">
          {state.rootNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[200px]">
              <div className="text-center p-8 border-2 border-dashed border-muted-foreground/30 rounded-xl">
                <p className="text-muted-foreground text-sm mb-1">Drag components here</p>
                <p className="text-muted-foreground/50 text-xs">Choose from the palette on the left</p>
              </div>
            </div>
          ) : (
            <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
              <NodeList nodes={state.rootNodes} parentId={null} depth={0} />
            </SortableContext>
          )}
        </CanvasDroppable>
      </div>

      <DragOverlay>
        {state.isDragging && state.activeDragNode ? (
          <DragPreview type={state.activeDragNode.type} label={state.activeDragNode.label} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function NodeList({
  nodes,
  parentId,
  depth,
}: {
  nodes: UINode[];
  parentId: string | null;
  depth: number;
}) {
  const { state } = useBuilder();
  const isDropHere = (index: number) =>
    state.dropPosition?.parentId === parentId && state.dropPosition?.index === index;

  return (
    <div className="flex flex-col gap-0.5">
      <DropIndicator parentId={parentId} index={0} isActive={isDropHere(0)} />
      {nodes.map((node, i) => (
        <div key={node.id}>
          <ComponentWrapper node={node}>
            <RenderNode node={node} depth={depth} />
          </ComponentWrapper>
          <DropIndicator parentId={parentId} index={i + 1} isActive={isDropHere(i + 1)} />
        </div>
      ))}
    </div>
  );
}

function RenderNode({ node, depth }: { node: UINode; depth: number }) {
  const config = getRegistryEntry(node.componentType);

  if (!config) {
    return <div className="text-xs text-muted-foreground">Unknown: {node.componentType}</div>;
  }

  const Comp = config.component;
  const children = node.children.length > 0 ? (
    <NodeList nodes={node.children} parentId={node.id} depth={depth + 1} />
  ) : null;

  return (
    <Comp {...node.props} className={undefined}>
      <div className={node.props.className ?? ""}>
        {children ?? node.props.children ?? config.textContent ?? ""}
      </div>
    </Comp>
  );
}

function findNodeById(nodes: UINode[], id: string): UINode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children.length > 0) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}
