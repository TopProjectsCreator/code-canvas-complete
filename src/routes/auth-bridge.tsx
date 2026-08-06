import { createFileRoute } from "@tanstack/react-router";
import AuthBridge from "@/pages/AuthBridge";

export const Route = createFileRoute("/auth-bridge")({
  head: () => ({ meta: [{ title: "Signing in — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: AuthBridge,
});
