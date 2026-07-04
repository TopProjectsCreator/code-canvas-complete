import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "create_canvas",
  title: "Create canvas",
  description: "Create a new empty CodeCanvas project owned by the signed-in user.",
  inputSchema: {
    name: z.string().trim().min(1).max(120),
    description: z.string().max(500).optional(),
    language: z.string().max(40).optional(),
    is_public: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, description, language, is_public }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const root = [
      {
        id: `root-${Date.now()}`,
        name,
        type: "folder" as const,
        children: [
          {
            id: `readme-${Date.now()}`,
            name: "README.md",
            type: "file" as const,
            content: `# ${name}\n\n${description ?? ""}`,
            language: "markdown",
          },
        ],
      },
    ];
    const { data, error } = await userClient(ctx)
      .from("projects")
      .insert({
        user_id: ctx.getUserId(),
        name,
        description: description ?? null,
        language: language ?? "javascript",
        is_public: is_public ?? false,
        files: root,
      })
      .select("id, name")
      .single();
    if (error) return err(error.message);
    return ok({ canvas: data });
  },
});
