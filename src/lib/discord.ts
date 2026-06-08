import { DiscordSDK } from "@discord/embedded-app-sdk";

let discordSdk: DiscordSDK | null = null;
let auth: any = null;
let _isInitialized = false;

export function isInDiscord(): boolean {
  try {
    if (window.self === window.top) return false;
  } catch {
    return false;
  }
  const ref = document.referrer || '';
  if (ref.includes('discord.com') || ref.includes('discordapp.com')) return true;
  const params = new URLSearchParams(window.location.search);
  return params.has('frame_id');
}

export function getDiscordSdk(): DiscordSDK | null {
  return discordSdk;
}

export function getDiscordAuth(): any {
  return auth;
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
    activityStartTime = Math.floor(Date.now() / 1000);
  }
  return activityStartTime;
}

export interface DiscordPresenceConfig {
  showElapsedTime: boolean;
  landing: { enabled: boolean; details: string; state: string };
  editing: { enabled: boolean; details: string; state: string };
  running: { enabled: boolean; details: string; state: string };
}

const DISCORD_STORAGE_KEY = 'discordPresence';

export function defaultPresenceConfig(): DiscordPresenceConfig {
  return {
    showElapsedTime: true,
    landing: { enabled: true, details: 'Canvas IDE', state: 'Looking at home' },
    editing: { enabled: false, details: 'Editing {fileName}', state: 'Working in {language}' },
    running: { enabled: false, details: 'Running {fileName}', state: 'Executing' },
  };
}

export function loadDiscordPresenceConfig(): DiscordPresenceConfig {
  if (typeof window === 'undefined') return defaultPresenceConfig();
  try {
    const raw = window.localStorage.getItem(DISCORD_STORAGE_KEY);
    if (!raw) return defaultPresenceConfig();
    return { ...defaultPresenceConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultPresenceConfig();
  }
}

export function saveDiscordPresenceConfig(config: DiscordPresenceConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISCORD_STORAGE_KEY, JSON.stringify(config));
}

export async function updateRichPresence(
  fileName?: string | null,
  language?: string | null,
  projectName?: string | null,
  isRunning?: boolean,
  context?: 'landing' | 'editing' | 'running' | 'idle'
): Promise<void> {
  const settings = loadDiscordPresenceConfig();
  const label = language ? (formatLanguage(language) || language) : null;
  let details: string;
  let state: string;

  if (context && settings[context]?.enabled) {
    const substitute = (s: string) =>
      s.replace(/{fileName}/g, fileName || '')
       .replace(/{language}/g, label || language || '')
       .replace(/{projectName}/g, projectName || '');
    details = substitute(settings[context].details);
    state = substitute(settings[context].state);
  } else if (isRunning) {
    details = `Running ${fileName || projectName || "code"}`;
    state = label ? `${label} — Executing` : "Executing";
  } else if (fileName) {
    details = `Editing ${fileName}`;
    state = label ? `Working in ${label}` : "Coding";
  } else if (projectName) {
    details = `In project: ${projectName}`;
    state = label ? `Using ${label}` : "Browsing files";
  } else {
    details = "Canvas IDE";
    state = "Getting started";
  }

  await setActivity({
    type: 0,
    details,
    state,
    ...(settings.showElapsedTime ? { timestamps: { start: getActivityStartTime() } } : {}),
  });
}

function formatLanguage(lang: string): string | null {
  const map: Record<string, string> = {
    javascript: "JavaScript", typescript: "TypeScript", python: "Python",
    java: "Java", cpp: "C++", csharp: "C#", go: "Go", rust: "Rust",
    ruby: "Ruby", php: "PHP", bash: "Bash", lua: "Lua", html: "HTML",
    css: "CSS", react: "React", nodejs: "Node.js", arduino: "Arduino",
    ftc: "FTC Robotics", scratch: "Scratch", sqlite: "SQLite",
    database: "Database", cad: "CAD", latex: "LaTeX", mermaid: "Mermaid",
    jupyter: "Jupyter", swift: "Swift", kotlin: "Kotlin", r: "R",
    haskell: "Haskell", elixir: "Elixir", erlang: "Erlang", julia: "Julia",
    scala: "Scala", vim: "Vim", perl: "Perl", zig: "Zig", nim: "Nim",
    lisp: "Lisp", groovy: "Groovy", pascal: "Pascal", crystal: "Crystal",
    ocaml: "OCaml", pony: "Pony", d: "D", c: "C",
  };
  return map[lang] || null;
}

export async function initDiscordSdk(): Promise<boolean> {
  if (_isInitialized) return true;

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  if (!clientId) {
    console.warn("[Discord] VITE_DISCORD_CLIENT_ID not set");
    return false;
  }

  if (!isInDiscord()) {
    return false;
  }

  try {
    discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();

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

    updateRichPresence(null, null, null, false);

    return true;
  } catch (err) {
    console.warn("[Discord] Init failed:", err);
    discordSdk = null;
    return false;
  }
}
