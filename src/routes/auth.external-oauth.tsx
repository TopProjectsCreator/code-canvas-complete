import { createFileRoute } from "@tanstack/react-router";
import ExternalOAuth from "@/pages/ExternalOAuth";

export const Route = createFileRoute("/auth/external-oauth")({
  head: () => ({ meta: [{ title: "External OAuth — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: ExternalOAuth,
});
