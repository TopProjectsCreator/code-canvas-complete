import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/project/$projectId")({
  head: () => ({ meta: [{ title: "Project — Code Canvas" }] }),
  component: Index,
});
