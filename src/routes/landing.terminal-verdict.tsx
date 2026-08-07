import { createFileRoute } from "@tanstack/react-router";
import { TerminalVerdict } from "@/pages/landings/TerminalVerdict";
import { LandingDiscordUpdater } from "@/components/LandingDiscordUpdater";

export const Route = createFileRoute("/landing/terminal-verdict")({
  head: () => ({ meta: [{ title: "Code Canvas — Terminal Verdict" }] }),
  component: () => (
    <LandingDiscordUpdater>
      <TerminalVerdict />
    </LandingDiscordUpdater>
  ),
});
