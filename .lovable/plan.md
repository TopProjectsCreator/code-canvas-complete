## Root cause of Render deployment error:

The Canvas Shell renders only when `isReplitLikePlatform(platform)` returns `false`. Since you've set `VITE_DEPLOY_PLATFORM=replit` and you're still seeing Canvas Shell, the value baked into the bundle is `generic`. Two reasons this happens on Railway:

1. `**VITE_*` is evaluated at build time, not runtime.** If Railway ran `npm run build` before you added the variable (or in a build phase that didn't expose service variables), the compiled JS contains the old value forever — restarting won't help, only a redeploy.
2. **No hostname fallback for Railway.** `src/lib/platform.ts` only matches `.replit.dev`, `.repl.co`, `.replit.app`, `.lovable.app`, `.lovable.dev`. `*.up.railway.app` falls through to `generic`.

## Fix (one change, robust to both causes)

Add Railway/custom-domain hostname detection to `src/lib/platform.ts` so the platform resolves correctly even when the env var didn't make it into the bundle. This is the same pattern already used for Replit.

### `src/lib/platform.ts` change

- Add a new constant alongside `REPLIT_HOST_PATTERNS`:
  ```ts
  const RAILWAY_HOST_PATTERNS = ['.up.railway.app', '.railway.app'];
  ```
- In `getHostPlatform`, after the Replit check, add:
  ```ts
  if (RAILWAY_HOST_PATTERNS.some((p) => normalizedHost.endsWith(p))) {
    return 'replit'; // same architecture: long-running server + pty
  }
  ```
- (Optional) also add `'.codecanvas.app'` to the same list so any custom domain you point at the Railway service is detected too.

### Why this works

- `XTerminal` reaches `wss://<host>/api/replit/pty`. Your Railway service already listens on port 3001 and Railway is proxying its public domain to that port (per your screenshot). So the WS will succeed as soon as the React side decides to render `XTerminal` instead of Canvas Shell.
- `server.mjs` already serves `dist/`, handles `/api/replit/*`, and upgrades `/api/replit/pty`. No server change needed since you've matched the port.

## Verification after redeploy

1. Open the Railway URL, hard-refresh (Cmd-Shift-R) to bust the SW cache.
2. In DevTools console: `localStorage; new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/replit/pty')` — should emit `onopen`.
3. The bottom panel should show xterm.js with the `project$` prompt instead of the green "Welcome to Canvas Shell!" banner.

## If it still shows Canvas Shell after redeploy

- Confirm the bundle actually rebuilt: check Railway build logs for `vite build` running after the variable was added.
- Quick sanity check in browser console: paste `Object.keys(import.meta)` won't work (stripped), so instead inspect the source — search the deployed JS for the string `replit` near `getHostPlatform`. If the new patterns aren't there, the build didn't pick up your latest commit.

## Notes / scope

- No server changes, no UI changes, no behavior changes for Replit or local dev.
- I'll leave `VITE_DEPLOY_PLATFORM` as a respected override so you can still force `generic` for testing.
- Not touching `server.mjs` PORT logic since target port 3001 already matches what Railway expects.