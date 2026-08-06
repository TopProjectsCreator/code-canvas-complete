import { createFileRoute } from "@tanstack/react-router";
import RedactorAuth from "@/pages/redactor/Auth";

export const Route = createFileRoute("/redactor/auth")({
  head: () => ({ meta: [{ title: "Sign in — Redactor" }, { name: "robots", content: "noindex" }] }),
  component: RedactorAuth,
});
