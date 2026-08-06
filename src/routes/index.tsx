import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Index from "@/pages/Index";
import Landing from "@/pages/Landing";
import { LandingDiscordUpdater } from "@/components/LandingDiscordUpdater";
import { isPublishedHost } from "@/lib/publishing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Code Canvas — Collaborative AI IDE and Workspace" },
      {
        name: "description",
        content:
          "Open-source, browser-based AI IDE with code editor, terminal, live preview, robotics flashing, Office editors, and an agentic assistant.",
      },
    ],
  }),
  component: RootRoute,
});

const landingVariants = [
  "/landing",
  "/landing/living-grid",
  "/landing/terminal-boot",
  "/landing/the-void",
  "/landing/monochrome",
  "/landing/warm-momentum",
  "/landing/terminal-verdict",
] as const;

function getLandingVariant() {
  const roll = Math.random();
  if (roll < 0.99) return "/landing" as const;
  const otherVariants = landingVariants.slice(1);
  const idx = Math.floor(Math.random() * otherVariants.length);
  return otherVariants[idx] ?? ("/landing" as const);
}

function RootRoute() {
  const navigate = useNavigate();
  // Host detection and the random landing-variant roll are browser-only, so the
  // decision is made after hydration to keep server and client renders in sync.
  const [mode, setMode] = useState<"pending" | "index" | "landing">("pending");

  useEffect(() => {
    if (isPublishedHost()) {
      setMode("index");
      return;
    }
    const choice = getLandingVariant();
    if (choice === "/landing") {
      setMode("landing");
      return;
    }
    void navigate({ to: choice, replace: true });
  }, [navigate]);

  if (mode === "index") return <Index />;
  if (mode === "landing") {
    return (
      <LandingDiscordUpdater>
        <Landing />
      </LandingDiscordUpdater>
    );
  }
  return null;
}
