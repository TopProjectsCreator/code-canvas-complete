import { createFileRoute } from "@tanstack/react-router";
import AuthLogout from "@/pages/AuthLogout";

export const Route = createFileRoute("/auth-logout")({
  head: () => ({ meta: [{ title: "Signing out — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: AuthLogout,
});
