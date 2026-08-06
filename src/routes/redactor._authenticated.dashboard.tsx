import { createFileRoute } from "@tanstack/react-router";
import RedactorDashboard from "@/pages/redactor/Dashboard";

export const Route = createFileRoute("/redactor/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Overview — Redactor" }, { name: "robots", content: "noindex" }] }),
  component: RedactorDashboard,
});
