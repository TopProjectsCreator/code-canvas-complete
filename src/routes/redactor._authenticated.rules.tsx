import { createFileRoute } from "@tanstack/react-router";
import RedactorRules from "@/pages/redactor/Rules";

export const Route = createFileRoute("/redactor/_authenticated/rules")({
  head: () => ({ meta: [{ title: "Rules — Redactor" }, { name: "robots", content: "noindex" }] }),
  component: RedactorRules,
});
