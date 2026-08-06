import { createFileRoute } from "@tanstack/react-router";
import GlobalWhiteboard from "@/pages/threads/GlobalWhiteboard";

export const Route = createFileRoute("/threads/whiteboard")({
  head: () => ({ meta: [{ title: "Whiteboard — Code Canvas" }] }),
  component: GlobalWhiteboard,
});
