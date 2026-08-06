import { createFileRoute } from "@tanstack/react-router";
import ThreadsLayout from "@/pages/threads/ThreadsLayout";

export const Route = createFileRoute("/threads")({
  component: ThreadsLayout,
});
