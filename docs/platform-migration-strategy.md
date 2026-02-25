# Platform DB & AI Migration Strategy (Phase 2)

This project now autodetects platform (`generic`, `replit`, `lovable`) and routes auth in Phase 1, plus AI + data calls in Phase 2 through provider abstractions.

## 1. Autodetection

Detection order:
1. `VITE_DEPLOY_PLATFORM` explicit override
2. hostname pattern (`*.replit.dev|*.repl.co|*.replit.app`, `*.lovable.app|*.lovable.dev`)
3. auth fallback flags (`VITE_REPLIT_AUTH_ENABLED`, `VITE_LOVABLE_AUTH_ENABLED`)
4. default `generic`

## 2. AI provider routing

- `generic` → Supabase Edge Functions (`ai-chat`, `generate-image`, `generate-music`) with BYOK enabled.
- `replit` / `lovable`:
  - if `VITE_<PLATFORM>_AI_BASE_URL` is set, chat/image/music are sent to that managed endpoint
  - if not set, fallback to Supabase functions to avoid regressions

### Expected managed AI API contract

- `POST /chat` (SSE OpenAI-compatible stream)
- `POST /image` body `{ "prompt": string }` returns `{ "imageUrl": string }`
- `POST /music` body `{ "prompt": string, "bpm"?: number, "duration"?: number }` returns `{ "audioUrl": string, ... }`

## 3. Data provider routing

- `generic` → Supabase tables (`projects`, `project_stars`, `user_api_keys`, `ai_usage_tracking`).
- `replit` / `lovable`:
  - if `VITE_<PLATFORM>_DB_BASE_URL` is set, calls managed DB API
  - optional bearer auth via `VITE_<PLATFORM>_DB_TOKEN`
  - if not set, fallback to Supabase for compatibility

### Expected managed DB API contract

- `GET /projects?user_id=...`
- `POST /projects`
- `PATCH /projects/:id`
- `GET /projects/:id`
- `DELETE /projects/:id?user_id=...`
- `GET /project-stars/find?project_id=...&user_id=...`
- `POST /project-stars`
- `DELETE /project-stars/:id`
- `GET /user-api-keys?user_id=...`
- `PUT /user-api-keys`
- `DELETE /user-api-keys?user_id=...&provider=...`
- `GET /ai-usage?user_id=...&usage_date=YYYY-MM-DD`

## 4. Migration rollout plan

1. Enable platform detection in staging and verify auth parity.
2. Stand up managed AI endpoint with contract compatibility and test stream parsing.
3. Stand up managed DB API and dual-write from backend for a transition window.
4. Backfill Supabase `projects` + `user_api_keys` + usage tables into managed DB.
5. Flip `VITE_<PLATFORM>_DB_BASE_URL` / `VITE_<PLATFORM>_AI_BASE_URL` in prod.
6. Keep Supabase fallback enabled until successful canary period completes.

## 5. Risk controls

- Keep provider-level fallbacks to Supabase to prevent total outages.
- Add provider health checks before rollout.
- Validate schema equivalence for `files` JSON payloads and usage counters.
- Verify OAuth subject/user-id mapping before cutover.
