import { createFileRoute } from "@tanstack/react-router";
import { WarmMomentum } from "@/pages/landings/WarmMomentum";
import { LandingDiscordUpdater } from "@/components/LandingDiscordUpdater";

export const Route = createFileRoute("/landing/warm-momentum")({
  head: () => ({ meta: [{ title: "Code Canvas — Warm Momentum" }] }),
  component: () => (
    <LandingDiscordUpdater>
      <WarmMomentum />
    </LandingDiscordUpdater>
  ),
});
