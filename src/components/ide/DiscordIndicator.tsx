import { useDiscord } from "@/contexts/DiscordContext";

export function DiscordIndicator() {
  const { isDiscordActivity, initialized, initError, guildName, channelName } = useDiscord();

  if (!isDiscordActivity) return null;

  const statusColor = initialized ? (initError ? "bg-destructive" : "bg-success") : "bg-warning";
  const statusLabel = initialized ? (initError ? "Error" : "Connected") : "Connecting...";

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
      title={initError || `${guildName ? `${guildName} / ` : ""}${channelName || ""}`}
    >
      <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
      <span className="text-muted-foreground hidden sm:inline">Discord {statusLabel}</span>
    </div>
  );
}
