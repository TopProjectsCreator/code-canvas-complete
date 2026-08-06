import { createFileRoute } from "@tanstack/react-router";
import OAuthHostsAdmin from "@/pages/admin/OAuthHosts";

export const Route = createFileRoute("/admin/oauth-hosts")({
  head: () => ({ meta: [{ title: "OAuth Hosts — Admin — Code Canvas" }, { name: "robots", content: "noindex" }] }),
  component: OAuthHostsAdmin,
});
