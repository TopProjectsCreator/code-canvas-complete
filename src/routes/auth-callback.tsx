import { createFileRoute } from "@tanstack/react-router";
import AuthCallback from "@/pages/AuthCallback";

export const Route = createFileRoute("/auth-callback")({
  head: () => ({ meta: [{ title: "Signing in — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: AuthCallback,
});
