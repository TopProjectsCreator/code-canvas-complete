import { createFileRoute } from "@tanstack/react-router";
import { MonochromePrecision } from "@/pages/landings/MonochromePrecision";
import { LandingDiscordUpdater } from "@/components/LandingDiscordUpdater";

export const Route = createFileRoute("/landing/monochrome")({
  head: () => ({ meta: [{ title: "Code Canvas — Monochrome" }] }),
  component: () => (
    <LandingDiscordUpdater>
      <MonochromePrecision />
    </LandingDiscordUpdater>
  ),
});
