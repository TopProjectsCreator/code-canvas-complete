## Goal
Stop reading Discord credentials from `.env` / `VITE_*` build-time vars. Source them from Lovable Cloud (Supabase) secrets at runtime.

## Secrets to store in Lovable Cloud
- `DISCORD_CLIENT_ID` — public app ID (currently `VITE_DISCORD_CLIENT_ID`)
- `DISCORD_CLIENT_SECRET` — confidential, used to exchange the OAuth code

Both will be added via `add_secret`. The old `VITE_DISCORD_CLIENT_ID` line in `.env` becomes irrelevant.

## New edge functions

1. **`discord-config`** (public, `verify_jwt = false`)
   - `GET` → `{ clientId: Deno.env.get("DISCORD_CLIENT_ID") }`
   - Lets the browser fetch the client ID without baking it into the build.

2. **`discord-token`** (public, `verify_jwt = false`)
   - `POST { code }` → exchanges the OAuth code with Discord using `DISCORD_CLIENT_ID` + `DISCORD_CLIENT_SECRET`, returns `{ access_token }`.
   - Replaces the existing `/api/token` proxy call (that proxy targets a local dev server which isn't available in the deployed Lovable app).

## Client changes (`src/lib/discord.ts`)

- Remove `import.meta.env.VITE_DISCORD_CLIENT_ID`.
- At the start of `initDiscordSdk`, call the `discord-config` edge function via `supabase.functions.invoke('discord-config')` and cache the returned `clientId` in a module-level variable.
- Replace the `fetch("/api/token", …)` call with `supabase.functions.invoke('discord-token', { body: { code } })`.
- If either call fails or returns no client ID, log a warning and bail out (same behaviour as today when the env var is missing).

## Files touched
| File | Change |
|------|--------|
| `supabase/functions/discord-config/index.ts` | New: returns client ID from secret |
| `supabase/functions/discord-token/index.ts` | New: OAuth code → access token using both secrets |
| `src/lib/discord.ts` | Fetch client ID + token via edge functions instead of env / `/api/token` |

No UI, schema, or RLS changes. The local-dev `/api/token` proxy in `vite.config.ts` becomes unused but is left in place (harmless, used by no other code paths).

## Confirmation needed before building
I'll need to request `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` via the secure secret form once you approve.
