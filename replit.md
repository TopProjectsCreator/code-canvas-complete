# Code Canvas Complete — Online IDE

## Overview
Code Canvas Complete is a feature-rich browser-based online IDE built with React, Vite, TypeScript, and Tailwind CSS. It supports multi-language code execution (via Wandbox), AI chat assistance, Arduino/FTC breadboard simulation, collaborative editing, 3D model generation, and much more.

## Architecture

### Frontend Only
This project is a **pure frontend application** — there is no custom backend server. All data persistence and auth is handled by an external Supabase project.

- **Framework**: React 18 + Vite 5
- **Styling**: Tailwind CSS + shadcn/ui (Radix UI)
- **Auth & Database**: Supabase (`xlmvlplazxrouscupidi`)
- **Edge Functions**: Supabase Edge Functions (Deno) in `supabase/functions/`
- **State Management**: React Query (@tanstack/react-query)
- **Routing**: React Router v6

### Key Integrations
- `src/integrations/supabase/` — Supabase client and TypeScript types
- `src/integrations/auth/` — Auth provider abstraction (Supabase/Lovable/Replit)
- `src/integrations/ai/` — AI provider abstraction for chat, image, music
- `src/integrations/datalovable/` — Lovable-specific data layer

### Platform Detection
`src/lib/platform.ts` detects the deployment platform (replit/lovable/generic) based on the hostname or `VITE_DEPLOY_PLATFORM` env var. On Replit, it automatically uses Replit-specific auth flows.

## Development

### Running
```bash
npm run dev
```
Runs on port **5000** (required by Replit webview).

### Building
```bash
npm run build
```

### Testing
```bash
npm test
```

## Environment Variables
These are set as Replit environment variables:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

## Supabase Edge Functions
Located in `supabase/functions/`, these are Deno-based edge functions deployed to Supabase:
- `ai-chat` — Main AI chat completions
- `generate-command` — AI shell command generation
- `generate-music` — Music generation via Lyria
- `generate-image` — Image generation
- `compile-arduino` — Arduino sketch compilation via Godbolt
- `compile-ftc` — FTC Java/Kotlin compilation
- `execute-code` — Code execution via Wandbox
- `github-proxy` — GitHub API proxy
- `manage-env-secrets` — Project environment secrets
- `session-recorder-sync` — Session recording persistence
- And more...

## Notable Features
- Multi-language code execution (JS, TS, Python, Java, C++, Go, Rust, and 30+ more)
- Arduino IDE with breadboard circuit designer and simulation
- FTC (FIRST Tech Challenge) robot programming
- AI coding assistant with file-aware context
- Real-time collaboration
- Extension marketplace
- Team management
- 3D model generation (Meshy, Tripo, Fal.ai, etc.)
- Image and music generation
- Office document editing (Word, Excel, PowerPoint)
- Scratch visual programming
- CAD model viewer
- Git integration

## Replit Migration Notes
- Vite dev server configured on port **5000** with `host: "0.0.0.0"` and `allowedHosts: true`
- Supabase credentials stored as Replit env vars (not in `.env`)
- `.env` added to `.gitignore`
- The app uses the existing external Supabase project for all backend functionality
