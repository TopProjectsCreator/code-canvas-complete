import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadProject, ok, err, flattenFiles, findFile, type FileNode } from "../_shared";

export default defineTool({
  name: "search_in_canvas",
  title: "Search inside a canvas",
  description: "Grep-style substring search across every file in a canvas. Returns matching path, line number, and line text.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    query: z.string().min(1),
    case_sensitive: z.boolean().optional(),
    max_results: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ canvas_id, query, case_sensitive, max_results }, ctx) => {
    const { project, error } = await loadProject(ctx, canvas_id);
    if (error) return err(error);
    const files = flattenFiles(project.files as FileNode[]);
    const cap = max_results ?? 50;
    const needle = case_sensitive ? query : query.toLowerCase();
    const matches: Array<{ path: string; line: number; text: string }> = [];
    for (const f of files) {
      const node = findFile(project.files as FileNode[], f.path);
      const content = node?.content ?? "";
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const hay = case_sensitive ? lines[i] : lines[i].toLowerCase();
        if (hay.includes(needle)) {
          matches.push({ path: f.path, line: i + 1, text: lines[i].slice(0, 300) });
          if (matches.length >= cap) return ok({ matches, truncated: true });
        }
      }
    }
    return ok({ matches, truncated: false });
  },
});
