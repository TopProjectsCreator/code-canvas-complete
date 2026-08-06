import { createFileRoute } from "@tanstack/react-router";
import OAuthConsent from "@/pages/OAuthConsent";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  head: () => ({ meta: [{ title: "Authorize — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: OAuthConsent,
});
