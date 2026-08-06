import { createFileRoute } from "@tanstack/react-router";
import { TheVoid } from "@/pages/landings/TheVoid";
import { LandingDiscordUpdater } from "@/components/LandingDiscordUpdater";

export const Route = createFileRoute("/landing/the-void")({
  head: () => ({ meta: [{ title: "Code Canvas — The Void" }] }),
  component: () => (
    <LandingDiscordUpdater>
      <TheVoid />
    </LandingDiscordUpdater>
  ),
});
