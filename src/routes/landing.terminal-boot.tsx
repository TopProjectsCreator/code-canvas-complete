import { createFileRoute } from "@tanstack/react-router";
import { TerminalBoot } from "@/pages/landings/TerminalBoot";
import { LandingDiscordUpdater } from "@/components/LandingDiscordUpdater";

export const Route = createFileRoute("/landing/terminal-boot")({
  head: () => ({ meta: [{ title: "Code Canvas — Terminal Boot" }] }),
  component: () => (
    <LandingDiscordUpdater>
      <TerminalBoot />
    </LandingDiscordUpdater>
  ),
});
