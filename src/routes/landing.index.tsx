import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/pages/Landing";
import { LandingDiscordUpdater } from "@/components/LandingDiscordUpdater";

export const Route = createFileRoute("/landing/")({
  head: () => ({
    meta: [
      { title: "Code Canvas — Collaborative AI IDE and Workspace" },
      { name: "description", content: "Build, run, and ship code in your browser with Code Canvas — the open-source collaborative AI IDE." },
      { property: "og:title", content: "Code Canvas — Collaborative AI IDE and Workspace" },
      { property: "og:description", content: "Build, run, and ship code in your browser with Code Canvas — the open-source collaborative AI IDE." },
    ],
  }),
  component: () => (
    <LandingDiscordUpdater>
      <Landing />
    </LandingDiscordUpdater>
  ),
});
