import { createFileRoute } from "@tanstack/react-router";
import RedactorProviderKeys from "@/pages/redactor/ProviderKeys";

export const Route = createFileRoute("/redactor/_authenticated/provider-keys")({
  head: () => ({ meta: [{ title: "Provider keys — Redactor" }, { name: "robots", content: "noindex" }] }),
  component: RedactorProviderKeys,
});
