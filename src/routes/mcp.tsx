import { createFileRoute } from "@tanstack/react-router";
import MCP from "@/pages/MCP";

export const Route = createFileRoute("/mcp")({
  head: () => ({
    meta: [
      { title: "MCP Server — Code Canvas" },
      { name: "description", content: "Connect Claude Code, Codex, OpenCode, and Cursor to Code Canvas via the Model Context Protocol." },
      { property: "og:title", content: "MCP Server — Code Canvas" },
      { property: "og:description", content: "Connect Claude Code, Codex, OpenCode, and Cursor to Code Canvas via the Model Context Protocol." },
    ],
  }),
  component: MCP,
});
