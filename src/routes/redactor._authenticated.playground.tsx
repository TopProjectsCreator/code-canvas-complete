import { createFileRoute } from "@tanstack/react-router";
import RedactorPlayground from "@/pages/redactor/Playground";

export const Route = createFileRoute("/redactor/_authenticated/playground")({
  head: () => ({ meta: [{ title: "Playground — Redactor" }, { name: "robots", content: "noindex" }] }),
  component: RedactorPlayground,
});
