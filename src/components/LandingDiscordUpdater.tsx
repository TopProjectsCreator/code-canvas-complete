import { useEffect, type ReactNode } from "react";
import { useDiscord } from "@/contexts/DiscordContext";

export function LandingDiscordUpdater({ children }: { children: ReactNode }) {
  const { updateRichPresence } = useDiscord();
  useEffect(() => {
    updateRichPresence(null, null, null, false, "landing");
  }, [updateRichPresence]);
  return <>{children}</>;
}
