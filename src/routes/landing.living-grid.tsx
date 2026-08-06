import { createFileRoute } from "@tanstack/react-router";
import { LivingGrid } from "@/pages/landings/LivingGrid";
import { LandingDiscordUpdater } from "@/components/LandingDiscordUpdater";

export const Route = createFileRoute("/landing/living-grid")({
  head: () => ({ meta: [{ title: "Code Canvas — Living Grid" }] }),
  component: () => (
    <LandingDiscordUpdater>
      <LivingGrid />
    </LandingDiscordUpdater>
  ),
});
