import { useState } from "react";
import { ChevronRight, ChevronDown, Square, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBuilder } from "./useBuilderStore";
import { getRegistryEntry } from "./registry";
import type { UINode } from "./types";

function TreeNode({ node, depth }: { node: UINode; depth: number }) {
  const { state, dispatch } = useBuilder();
  const isSelected = state.selectedNodeId === node.id;
  const hasChildren = node.children.length > 0;
  const [collapsed, setCollapsed] = useState(false);
  const config = getRegistryEntry(node.componentType);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-sm cursor-pointer text-xs",
          "hover:bg-accent/50",
          isSelected && "bg-accent text-accent-foreground",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => dispatch({ type: "SELECT_NODE", nodeId: node.id })}
      >
        {hasChildren ? (
          <button
            className="p-0 hover:text-foreground text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="text-muted-foreground shrink-0">
          <Square size={10} />
        </span>
        <span className="truncate">{config?.label ?? node.componentType}</span>
        {isSelected && (
          <span className="ml-auto flex gap-0.5">
            <button
              className="p-0.5 hover:text-foreground text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); dispatch({ type: "DUPLICATE_NODE", nodeId: node.id }); }}
            >
              <Copy size={10} />
            </button>
            <button
              className="p-0.5 hover:text-destructive text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); dispatch({ type: "REMOVE_NODE", nodeId: node.id }); }}
            >
              <Trash2 size={10} />
            </button>
          </span>
        )}
      </div>
      {hasChildren && !collapsed && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ComponentTree() {
  const { state } = useBuilder();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Component Tree</h3>
      </div>
      <ScrollArea className="flex-1 py-1">
        {state.rootNodes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No components yet</p>
        ) : (
          state.rootNodes.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
