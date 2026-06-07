import { DiscordSDK } from "@discord/embedded-app-sdk";

let discordSdk: DiscordSDK | null = null;
let auth: any = null;
let _isInitialized = false;

export function isInDiscord(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getDiscordSdk(): DiscordSDK | null {
  return discordSdk;
}

export function getDiscordAuth(): any {
  return auth;
}

function getUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function setActivity(activity: {
  details?: string;
  state?: string;
  assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string };
  timestamps?: { start?: number; end?: number };
  party?: { size: [number, number] };
  type?: number;
}): Promise<void> {
  if (!discordSdk || !_isInitialized) return;
  try {
    await discordSdk.commands.setActivity({ activity });
  } catch (err) {
    console.warn("[Discord] setActivity failed:", err);
  }
}

let activityStartTime: number | null = null;

export function getActivityStartTime(): number {
  if (!activityStartTime) {
    activityStartTime = getUnixSeconds();
  }
  return activityStartTime;
}

export async function initDiscordSdk(): Promise<boolean> {
  if (_isInitialized) return true;

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  if (!clientId) {
    console.warn("[Discord] VITE_DISCORD_CLIENT_ID not set — skipping SDK init");
    return false;
  }

  if (!isInDiscord()) {
    return false;
  }

  try {
    discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();
    console.log("[Discord] SDK ready");

    let code: string;
    try {
      const result = await discordSdk.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify", "guilds", "applications.commands", "rpc.activities.write"],
      });
      code = result.code;
    } catch {
      console.log("[Discord] Silent auth failed, requesting consent for new scopes");
      const result = await discordSdk.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        scope: ["identify", "guilds", "applications.commands", "rpc.activities.write"],
      });
      code = result.code;
    }

    const response = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("[Discord] Token exchange failed:", err);
      return false;
    }

    const { access_token } = await response.json();

    auth = await discordSdk.commands.authenticate({ access_token });

    if (!auth) {
      console.error("[Discord] Authenticate command failed");
      return false;
    }

    _isInitialized = true;
    console.log("[Discord] Authenticated as", auth.user?.username);
    return true;
  } catch (err) {
    console.warn("[Discord] Init failed (likely not in Discord):", err);
    discordSdk = null;
    return false;
  }
}
