import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Copy, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuilder } from "./useBuilderStore";
import type { UINode } from "./types";

interface ComponentWrapperProps {
  node: UINode;
  children: React.ReactNode;
}

export function ComponentWrapper({ node, children }: ComponentWrapperProps) {
  const { state, dispatch } = useBuilder();
  const isSelected = state.selectedNodeId === node.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    data: { from: "canvas", node },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group/cw rounded-md min-h-[28px]",
        isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        "hover:ring-1 hover:ring-primary/40",
        "cursor-default",
      )}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: "SELECT_NODE", nodeId: node.id });
      }}
    >
      {/* Drag handle */}
      <div
        className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/cw:opacity-100 cursor-grab active:cursor-grabbing z-20 text-muted-foreground hover:text-foreground transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={10} />
      </div>

      {/* Hover toolbar */}
      <div className="absolute -top-3 right-0 opacity-0 group-hover/cw:opacity-100 z-20 flex items-center gap-0.5 transition-opacity">
        <button
          className="p-0.5 rounded bg-background border border-border shadow-sm hover:bg-accent text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: "DUPLICATE_NODE", nodeId: node.id });
          }}
          title="Duplicate"
        >
          <Copy size={10} />
        </button>
        <button
          className="p-0.5 rounded bg-background border border-border shadow-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: "REMOVE_NODE", nodeId: node.id });
          }}
          title="Delete"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {children}
    </div>
  );
}
