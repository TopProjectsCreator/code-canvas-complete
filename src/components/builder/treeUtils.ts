import type { UINode } from "./types";

export function flattenTree(nodes: UINode[]): string[] {
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

export function findContainerParent(nodes: UINode[], childId: string): UINode | null {
  for (const n of nodes) {
    if (n.children.some((c) => c.id === childId)) return n;
    if (n.children.length > 0) {
      const found = findContainerParent(n.children, childId);
      if (found) return found;
    }
  }
  return null;
}

export function findNodeById(nodes: UINode[], id: string): UINode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children.length > 0) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}
