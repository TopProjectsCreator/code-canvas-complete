import { createFileRoute } from "@tanstack/react-router";
import RedactorLogs from "@/pages/redactor/Logs";

export const Route = createFileRoute("/redactor/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Logs — Redactor" }, { name: "robots", content: "noindex" }] }),
  component: RedactorLogs,
});
