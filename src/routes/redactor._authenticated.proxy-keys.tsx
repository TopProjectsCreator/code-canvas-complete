import { createFileRoute } from "@tanstack/react-router";
import RedactorProxyKeys from "@/pages/redactor/ProxyKeys";

export const Route = createFileRoute("/redactor/_authenticated/proxy-keys")({
  head: () => ({ meta: [{ title: "Proxy keys — Redactor" }, { name: "robots", content: "noindex" }] }),
  component: RedactorProxyKeys,
});
