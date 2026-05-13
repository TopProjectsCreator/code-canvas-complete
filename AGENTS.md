# Code Canvas Complete — Agent Guide

## Quick start

```bash
npm install        # uses npm (ignore bun.lock)
npm run dev        # dev server on port 5000
npm run build      # production build to dist/
npm run test       # Vitest run
npm run lint       # ESLint (very permissive config)
npm run preview    # serve dist/ on port 4173
npm run build:dev  # dev-mode build
npm run server:replit  # Express+node-pty server on port 3001
```

## Architecture

- **Vite + React 18 SPA**, styled with Tailwind 3 + shadcn/ui (Radix primitives).
- **Path alias**: `@/` → `src/`. Always use `@/` imports, not relative paths.
- **React Router v6** routes in `src/App.tsx`. Landing variants in `src/pages/landings/`.
- **TanStack React Query** for async state.
- **TypeScript is NOT strict**: `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`. Don't expect strict type checking to catch issues.
- **ESLint is very permissive**: `no-unused-vars`, `no-explicit-any`, `prefer-const`, `no-require-imports` all **off**. Lint only catches hook rules and export patterns.

## Key files & entrypoints

| What | Where |
|------|-------|
| App entry | `src/main.tsx` (also handles PWA SW logic) |
| App routes | `src/App.tsx` |
| AI assistant driver | `src/hooks/useAgentChat.ts` (1300+ lines) |
| Code execution | `src/hooks/useCodeExecution.ts` |
| WebContainer | `src/hooks/useWebContainer.ts` |
| shadcn/ui components | `src/components/ui/` |
| Feature components | `src/components/{ide,arduino,scratch,ftc,auth,brand}/` |
| Tests | `src/**/*.{test,spec}.{ts,tsx}` (Vitest + jsdom) |
| Test setup | `src/test/setup.ts` |
| Supabase Edge Functions | `supabase/functions/` (30+ Deno functions) |
| Server (Replit) | `server.mjs` (Express + node-pty + WS, port 3001) — proxied via Vite at `/api/replit` |
| Arduino bridge | `tools/arduino-bridge/` |
| Platform detection | `src/lib/platform.ts` (hostname or `VITE_DEPLOY_PLATFORM`) |
| Integrations | `src/integrations/{supabase,auth,ai,datalovable}/` |
| Notifications | `src/hooks/useNotifications.ts` + `src/components/ide/InboxNotifier.tsx` |

## Backend (Supabase Edge Functions)

- Located in `supabase/functions/`, written in Deno TypeScript.
- Most functions have `verify_jwt = false` in `supabase/config.toml`.
- Deploy with Supabase CLI: `supabase functions deploy <name>`.
- Project ID: `xlmvlplazxrouscupidi`.

## Testing quirks

- Tests use `jsdom` environment with globals enabled.
- Import pattern: `@testing-library/react` + `@testing-library/jest-dom`.
- Test files in `src/test/` — look for existing examples before writing new ones.

## Framework quirks

- **PWA service worker** is registered from `main.tsx`. It auto-unregisters in iframes/previews to avoid cache conflicts on Lovable/Replit.
- **WebContainer** (`@webcontainer/api`) runs browser-side Node. Python/pip/uv commands are **blocked** in WebContainers; they fall back to the Supabase `execute-code` edge function.
- **Cross-Origin headers** (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) required for WebContainer in production — pre-configured in `vite.config.ts`.
- **Three.js / React Three Fiber** used for 3D editor (`@react-three/fiber`, `@react-three/drei`, `three`).
- **Scratch** VM integration: `scratch-vm`, `scratch-render`, `scratch-storage`, `scratch-audio`.

## Conventions

- **CSS**: Tailwind utility classes + CSS variables for theming (see `tailwind.config.ts` for custom color tokens). No CSS modules.
- **Components**: Functional components with hooks. shadcn/ui uses `forwardRef` + CVA for variants.
- **AI tools**: Adding a new assistant tool means wiring it through `useAgentChat.ts` and its `UseAgentChatProps` interface.
- **Version control**: The `.gitignore` excludes `.env.*`, `aikeys.json`, `.agents/`, and Rust `target/`.

## Existing instruction files

- `.github/copilot-instructions.md` — redirects to this file (outdated content replaced).
