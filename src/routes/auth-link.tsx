import { createFileRoute } from "@tanstack/react-router";
import AuthLink from "@/pages/AuthLink";

export const Route = createFileRoute("/auth-link")({
  head: () => ({ meta: [{ title: "Linking account — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: AuthLink,
});
