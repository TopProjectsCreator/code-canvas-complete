import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — Code Canvas" },
      { name: "description", content: "Your Code Canvas workspace: projects, templates, and the browser-based IDE." },
    ],
  }),
  component: Index,
});
