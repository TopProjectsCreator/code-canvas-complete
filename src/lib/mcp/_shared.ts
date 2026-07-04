import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export type FileNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  content?: string;
  language?: string;
  children?: FileNode[];
};

export function anonClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function userClient(ctx: ToolContext): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function requireAuth(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Not authenticated. Sign in via OAuth to use this tool.",
        },
      ],
      isError: true,
    };
  }
  return null;
}

export function ok(payload: unknown, text?: string) {
  return {
    content: [
      { type: "text" as const, text: text ?? JSON.stringify(payload, null, 2) },
    ],
    structuredContent: payload as Record<string, unknown>,
  };
}

export function err(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/** Flatten file tree to `{ path, language, size }` list. */
export function flattenFiles(
  nodes: FileNode[] | undefined | null,
  prefix = "",
): Array<{ path: string; language?: string; size: number }> {
  if (!Array.isArray(nodes)) return [];
  const out: Array<{ path: string; language?: string; size: number }> = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "folder") {
      out.push(...flattenFiles(node.children, path));
    } else {
      out.push({
        path,
        language: node.language,
        size: (node.content ?? "").length,
      });
    }
  }
  return out;
}

/** Find a file node by its path (slash-delimited from root). */
export function findFile(
  nodes: FileNode[] | undefined | null,
  path: string,
): FileNode | null {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length || !Array.isArray(nodes)) return null;
  let current: FileNode | undefined = nodes.find((n) => n.name === parts[0]);
  for (let i = 1; i < parts.length && current; i++) {
    if (current.type !== "folder" || !current.children) return null;
    current = current.children.find((n) => n.name === parts[i]);
  }
  return current && current.type === "file" ? current : null;
}

/** Insert/update a file at path. Creates folders as needed. Returns new tree. */
export function upsertFile(
  nodes: FileNode[] | undefined | null,
  path: string,
  content: string,
  language?: string,
): FileNode[] {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) throw new Error("Empty path");
  const tree: FileNode[] = Array.isArray(nodes) ? [...nodes] : [];
  const walk = (arr: FileNode[], depth: number): FileNode[] => {
    const name = parts[depth];
    const isLast = depth === parts.length - 1;
    const idx = arr.findIndex((n) => n.name === name);
    if (isLast) {
      const file: FileNode = {
        id: idx >= 0 ? arr[idx].id : `${name}-${Date.now()}`,
        name,
        type: "file",
        content,
        language,
      };
      const next = [...arr];
      if (idx >= 0) next[idx] = file;
      else next.push(file);
      return next;
    }
    const folder: FileNode =
      idx >= 0 && arr[idx].type === "folder"
        ? arr[idx]
        : {
            id: `${name}-${Date.now()}`,
            name,
            type: "folder",
            children: [],
          };
    const nextChildren = walk(folder.children ?? [], depth + 1);
    const next = [...arr];
    const updated = { ...folder, children: nextChildren };
    if (idx >= 0) next[idx] = updated;
    else next.push(updated);
    return next;
  };
  return walk(tree, 0);
}

/** Delete a file at path. Returns new tree. */
export function deleteAtPath(
  nodes: FileNode[] | undefined | null,
  path: string,
): FileNode[] {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length || !Array.isArray(nodes)) return nodes ?? [];
  const walk = (arr: FileNode[], depth: number): FileNode[] => {
    const name = parts[depth];
    const isLast = depth === parts.length - 1;
    if (isLast) return arr.filter((n) => n.name !== name);
    return arr.map((n) => {
      if (n.name === name && n.type === "folder") {
        return { ...n, children: walk(n.children ?? [], depth + 1) };
      }
      return n;
    });
  };
  return walk(nodes, 0);
}

/** Load a project row scoped to the user. */
export async function loadProject(
  ctx: ToolContext,
  projectId: string,
) {
  const sb = userClient(ctx);
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Project not found or you don't have access." };
  return { project: data };
}
