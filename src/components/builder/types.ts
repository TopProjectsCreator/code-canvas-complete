import type React from "react";

export interface UINode {
  id: string;
  componentType: string;
  props: Record<string, any>;
  children: UINode[];
}

export interface BuilderComponentConfig {
  type: string;
  label: string;
  icon: string;
  category: "layout" | "form" | "display" | "feedback" | "navigation" | "html";
  component: React.ComponentType<any>;
  defaultProps: Record<string, any>;
  propsConfig: PropConfig[];
  allowedChildren: string[];
  isContainer: boolean;
  isVoid: boolean;
  textContent?: string;
  importPath: string;
  importName: string;
}

export interface PropConfig {
  name: string;
  label: string;
  type: "string" | "boolean" | "number" | "select" | "class";
  options?: { label: string; value: string }[];
  defaultValue: any;
  category: "content" | "appearance" | "behavior";
}

export interface DropPosition {
  parentId: string | null;
  index: number;
}

export interface BuilderState {
  rootNodes: UINode[];
  selectedNodeId: string | null;
  dropPosition: DropPosition | null;
  isDragging: boolean;
  activeDragNode: { type: string; label: string } | null;
  history: UINode[][];
  historyIndex: number;
}

export type BuilderAction =
  | { type: "ADD_NODE"; componentType: string; position: DropPosition }
  | { type: "REMOVE_NODE"; nodeId: string }
  | { type: "UPDATE_PROPS"; nodeId: string; props: Record<string, any> }
  | { type: "MOVE_NODE"; nodeId: string; position: DropPosition }
  | { type: "SELECT_NODE"; nodeId: string | null }
  | { type: "DUPLICATE_NODE"; nodeId: string }
  | { type: "SET_DROP_POSITION"; position: DropPosition | null }
  | { type: "SET_DRAGGING"; isDragging: boolean; dragNode?: { type: string; label: string } | null }
  | { type: "LOAD"; rootNodes: UINode[] }
  | { type: "UNDO" }
  | { type: "REDO" };
