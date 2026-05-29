import { createContext, useContext, useReducer, useCallback } from "react";
import type { UINode, BuilderState, BuilderAction, DropPosition } from "./types";
import { getRegistryEntry } from "./registry";
import { generateCode } from "./codeGenerator";

const MAX_HISTORY = 50;

let nodeCounter = 0;
function generateNodeId(): string {
  return `node_${++nodeCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

function createNode(componentType: string): UINode {
  const config = getRegistryEntry(componentType);
  return {
    id: generateNodeId(),
    componentType,
    props: config ? { ...config.defaultProps } : {},
    children: [],
  };
}

function findNode(nodes: UINode[], id: string): { node: UINode; parent: UINode[]; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { node: nodes[i], parent: nodes, index: i };
    if (nodes[i].children.length > 0) {
      const found = findNode(nodes[i].children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(nodes: UINode[], id: string): UINode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({
      ...n,
      children: removeNode(n.children, id),
    }));
}

function deepCloneNode(node: UINode): UINode {
  return {
    ...node,
    id: generateNodeId(),
    children: node.children.map((c) => deepCloneNode(c)),
  };
}

function insertNode(nodes: UINode[], node: UINode, position: DropPosition): UINode[] {
  if (position.parentId === null) {
    const copy = [...nodes];
    copy.splice(position.index, 0, node);
    return copy;
  }
  return nodes.map((n) => {
    if (n.id === position.parentId) {
      const childrenCopy = [...n.children];
      childrenCopy.splice(position.index, 0, node);
      return { ...n, children: childrenCopy };
    }
    return { ...n, children: insertNode(n.children, node, position) };
  });
}

function removeNodeAt(nodes: UINode[], nodeId: string): UINode[] {
  const found = findNode(nodes, nodeId);
  if (!found) return nodes;
  const parent = found.parent;
  parent.splice(found.index, 1);
  return [...nodes];
}

function pushHistory(state: BuilderState): BuilderState {
  const history = state.history.slice(0, state.historyIndex + 1);
  history.push(JSON.parse(JSON.stringify(state.rootNodes)));
  if (history.length > MAX_HISTORY) history.shift();
  return { ...state, history, historyIndex: history.length - 1 };
}

function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "ADD_NODE": {
      const node = createNode(action.componentType);
      const rootNodes = insertNode(state.rootNodes, node, action.position);
      return pushHistory({ ...state, rootNodes, selectedNodeId: node.id, dropPosition: null, isDragging: false });
    }

    case "REMOVE_NODE": {
      const rootNodes = removeNode(state.rootNodes, action.nodeId);
      return pushHistory({
        ...state,
        rootNodes,
        selectedNodeId: state.selectedNodeId === action.nodeId ? null : state.selectedNodeId,
      });
    }

    case "UPDATE_PROPS": {
      const rootNodes = JSON.parse(JSON.stringify(state.rootNodes));
      const found = findNode(rootNodes, action.nodeId);
      if (found) {
        found.node.props = { ...found.node.props, ...action.props };
      }
      return { ...state, rootNodes };
    }

    case "MOVE_NODE": {
      const found = findNode(state.rootNodes, action.nodeId);
      if (!found) return state;
      const removed = removeNodeAt(state.rootNodes, action.nodeId);
      const node = found.node;
      const rootNodes = insertNode(removed, node, action.position);
      return pushHistory({ ...state, rootNodes, dropPosition: null, isDragging: false });
    }

    case "SELECT_NODE":
      return { ...state, selectedNodeId: action.nodeId };

    case "DUPLICATE_NODE": {
      const found = findNode(state.rootNodes, action.nodeId);
      if (!found) return state;
      const clone = deepCloneNode(found.node);
      const position: DropPosition = { parentId: null, index: found.index + 1 };
      if (found.parent !== state.rootNodes) {
        const parentFound = findNode(state.rootNodes, found.parent?.[0]?.id ?? "");
        if (parentFound) position.parentId = parentFound.node.id;
      }
      const rootNodes = insertNode(state.rootNodes, clone, position);
      return pushHistory({ ...state, rootNodes, selectedNodeId: clone.id });
    }

    case "SET_DROP_POSITION":
      return { ...state, dropPosition: action.position };

    case "SET_DRAGGING":
      return { ...state, isDragging: action.isDragging, activeDragNode: action.dragNode ?? null };

    case "LOAD":
      return {
        ...state,
        rootNodes: action.rootNodes,
        selectedNodeId: null,
        dropPosition: null,
        history: [JSON.parse(JSON.stringify(action.rootNodes))],
        historyIndex: 0,
      };

    case "UNDO": {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        ...state,
        rootNodes: JSON.parse(JSON.stringify(state.history[newIndex])),
        historyIndex: newIndex,
      };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        ...state,
        rootNodes: JSON.parse(JSON.stringify(state.history[newIndex])),
        historyIndex: newIndex,
      };
    }

    default:
      return state;
  }
}

const initialState: BuilderState = {
  rootNodes: [],
  selectedNodeId: null,
  dropPosition: null,
  isDragging: false,
  activeDragNode: null,
  history: [[]],
  historyIndex: 0,
};

interface BuilderStore {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  getCode: () => string;
  toJSON: () => string;
  loadFromJSON: (json: string) => void;
}

const BuilderContext = createContext<BuilderStore | null>(null);

export function BuilderProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const getCode = useCallback(() => {
    return generateCode(state.rootNodes);
  }, [state.rootNodes]);

  const toJSON = useCallback(() => {
    return JSON.stringify({ version: 1, rootNodes: state.rootNodes }, null, 2);
  }, [state.rootNodes]);

  const loadFromJSON = useCallback(
    (json: string) => {
      try {
        const data = JSON.parse(json);
        if (data.rootNodes) {
          dispatch({ type: "LOAD", rootNodes: data.rootNodes });
        }
      } catch {
        dispatch({ type: "LOAD", rootNodes: [] });
      }
    },
    [],
  );

  return (
    <BuilderContext.Provider value={{ state, dispatch, getCode, toJSON, loadFromJSON }}>
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder(): BuilderStore {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used within a BuilderProvider");
  return ctx;
}
