import { createFileRoute } from "@tanstack/react-router";
import ThreadDetail from "@/pages/threads/ThreadDetail";

export const Route = createFileRoute("/threads/$id")({
  head: () => ({ meta: [{ title: "Thread — Code Canvas" }] }),
  component: ThreadDetail,
});
