import { createFileRoute } from "@tanstack/react-router";
import CreateThread from "@/pages/threads/CreateThread";

export const Route = createFileRoute("/threads/new")({
  head: () => ({ meta: [{ title: "New thread — Code Canvas" }] }),
  component: CreateThread,
});
