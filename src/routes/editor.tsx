import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Editor — Code Canvas" },
      { name: "description", content: "The Code Canvas browser IDE: code editor, terminal, live preview, and AI assistant." },
    ],
  }),
  component: Index,
});
