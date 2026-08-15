import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { useBuilder } from "./useBuilderStore";
import { ComponentWrapper } from "./ComponentWrapper";
import { DropIndicator } from "./DropIndicator";
import { getRegistryEntry } from "./registry";
import { flattenTree } from "./treeUtils";
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

export function DragPreview({ label }: { type: string; label: string }) {
  return (
    <div className="px-3 py-1.5 rounded-md bg-background border border-primary/50 shadow-lg text-sm font-medium text-foreground flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-primary" />
      {label}
    </div>
  );
}

export function Canvas() {
  const { state, dispatch } = useBuilder();

  const allIds = useMemo(() => flattenTree(state.rootNodes), [state.rootNodes]);

  return (
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

  if (config.isVoid) {
    return <Comp {...node.props} className={undefined} />;
  }

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
