import { createFileRoute } from "@tanstack/react-router";
import OAuthAppsPublic from "@/pages/OAuthApps";

export const Route = createFileRoute("/oauth-apps")({
  head: () => ({
    meta: [
      { title: "Connected Apps — Code Canvas" },
      { name: "description", content: "Apps and integrations that connect to Code Canvas via OAuth." },
    ],
  }),
  component: OAuthAppsPublic,
});
