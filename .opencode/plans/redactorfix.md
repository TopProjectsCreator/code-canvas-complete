# Redactor — Gaps Implementation Plan

## Group A — Data layer (migrations + types)

### A1. New SQL migration
File: `supabase/migrations/20260616000000_redactor_additions.sql`

```sql
ALTER TABLE redactor_proxy_keys ADD COLUMN ip_allowlist TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE redactor_proxy_keys ADD COLUMN monthly_cap_usd INT;

CREATE TABLE IF NOT EXISTS redactor_model_pricing (
  model_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  cost_input NUMERIC(10,4) NOT NULL,
  cost_output NUMERIC(10,4) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE redactor_request_logs ADD COLUMN cost_usd NUMERIC(10,6);
```

### A2. Update Supabase types
File: `src/integrations/supabase/types.ts`

Add `ip_allowlist: string[]`, `monthly_cap_usd: number | null` to `redactor_proxy_keys` Row/Insert/Update.
Add `cost_usd: number | null` to `redactor_request_logs` Row/Insert/Update.

### A3. Drizzle schema (already done)
File: `src/redactor/db/schema.ts` lines 88-89 already define `ipAllowlist` and `monthlyCapUsd`.

Add drizzle table for `redactor_model_pricing`.
Add `costUsd` to `requestLogs` table.

---

## Group B — Quick library wins

### B1. Add keyPattern to 8 providers
Files:
- `src/redactor/lib/providers.ts`
- `supabase/functions/redactor-proxy/providers.ts`

| Provider | keyPattern |
|---|---|
| Mistral | `"[A-Za-z0-9]{32}"` |
| DeepSeek | `"[A-Za-z0-9]{32}"` |
| Together | `"[A-Za-z0-9]{32}"` |
| Cohere | `"^co-"` |
| Fireworks | `"[A-Za-z0-9]{32}"` |
| Cerebras | `"[A-Za-z0-9]{32}"` |
| SambaNova | `"[A-Za-z0-9]{32}"` |
| Custom | `"[A-Za-z0-9_-]{10,}"` |

### B2. Redaction engine tests
File: `src/redactor/lib/redaction.test.ts`

- Test each built-in pattern (emails, API keys, JWTs, credit cards, SSNs, phones, env vars, high-entropy)
- Test `redact()` overlap resolution
- Test `rehydrate()` round-trip
- Test `redactJson()` with nested JSON
- Test `transformJsonStrings()`
- Test custom patterns
- Test name detection (opt-in)

---

## Group C — Proxy key creation UX

### C1. Extend createProxyKey API
File: `src/redactor/lib/dashboard-api.ts`

- Extend the `createProxyKey` opts interface:
  ```ts
  {
    name: string;
    allowedProviders: string[];
    logRequests: boolean;
    rateLimitRpm?: number;
    expiresAt?: string; // ISO date
  }
  ```
- Pass `rate_limit_rpm` and `expires_at` to the DB insert

### C2. Extend the form
File: `src/pages/redactor/ProxyKeys.tsx`

- Add number input for rate limit (RPM)
- Add date picker for expiration
- Add toggle for `log_requests` (currently hardcoded `true`)

---

## Group D — Proxy enforcement (rate limit + IP allowlist)

### D1. Fetch new fields in auth
File: `supabase/functions/redactor-proxy/index.ts` — `authenticateProxyKey()`

Add to the `.select()` call: `rate_limit_rpm, ip_allowlist, monthly_cap_usd`

Add to `AuthedProxyKey` interface:
```ts
rateLimitRpm: number | null;
ipAllowlist: string[];
monthlyCapUsd: number | null;
```

### D2. Rate limiting
File: `supabase/functions/redactor-proxy/index.ts`

In-memory sliding-window counter:
```ts
const keyHits = new Map<string, number[]>();
```
Before `runProxy()`, if `ctx.proxyKey.rateLimitRpm` is set:
1. Get timestamps for this proxy key ID
2. Remove entries older than 60s
3. If count >= rateLimitRpm, return 429
4. Push current timestamp

### D3. IP allowlisting
File: `supabase/functions/redactor-proxy/index.ts` — before `runProxy()`

If `ipAllowlist.length > 0`:
1. Get client IP from `x-forwarded-for` or `x-real-ip`
2. If not in allowlist, return 403

---

## Group E — Pricing data & spend cap

### E1. Seed script
File: `scripts/sync-model-pricing.ts`

- Fetch `https://models.dev/api.json`
- Walk all providers → models
- Extract `cost.input` and `cost.output` (per-million token, USD)
- Map `provider/modelId` as composite key (e.g. `openai/gpt-4o`)
- Upsert into `redactor_model_pricing`
- Run manually and via cron (weekly)

### E2. Cost computation in writeLog
File: `supabase/functions/redactor-proxy/index.ts` — `writeLog()`

Before writing, look up model pricing from `redactor_model_pricing`:
```sql
SELECT cost_input, cost_output FROM redactor_model_pricing WHERE model_id = $1
```
Compute: `cost_usd = (input_tokens / 1_000_000 * cost_input) + (output_tokens / 1_000_000 * cost_output)`

Store `cost_usd` in the log row.

### E3. Spend cap enforcement
File: `supabase/functions/redactor-proxy/index.ts` — before `runProxy()`

If `monthlyCapUsd` is set on the proxy key:
```sql
SELECT COALESCE(SUM(cost_usd), 0) FROM redactor_request_logs 
WHERE proxy_key_id = $1 AND created_at >= date_trunc('month', now())
```
If `sum >= monthlyCapUsd`, return 429 with explanation.

---

## Group F — Log retention

### F1. Cleanup before insert
File: `supabase/functions/redactor-proxy/index.ts` — `writeLog()`

```ts
const retentionDays = parseInt(Deno.env.get("REDACTOR_LOG_RETENTION_DAYS") ?? "90", 10);
// Fire-and-forget cleanup
supabase.rpc('delete_old_logs', { p_user_id: userId, p_days: retentionDays }).catch(() => {});
```

Or inline SQL:
```sql
DELETE FROM redactor_request_logs 
WHERE user_id = $1 AND created_at < now() - make_interval(days => $2)
```

---

## Group G — Dashboard & analytics

### G1. Time-series chart
File: `src/pages/redactor/Dashboard.tsx`

Use existing `recharts` dependency. Add an `AreaChart` showing requests per day for the last 7/30 days. Query from `redactor_request_logs`.

### G2. Per-key stats
File: `src/pages/redactor/Dashboard.tsx`

Show each proxy key with: request count, total tokens, total cost, total redactions.

### G3. Logs page improvements
File: `src/pages/redactor/Logs.tsx`

- Date range filter (from/to)
- Provider filter dropdown
- Pagination (replace hard `LIMIT 100`)

---

## Group H — Shape translation

### H1. Translation layer
File: `supabase/functions/redactor-proxy/translate.ts`

Functions:
```ts
toAnthropic(openaiBody: unknown): unknown
fromAnthropic(anthropicBody: unknown): unknown
toGemini(openaiBody: unknown): unknown
fromGemini(geminiBody: unknown): unknown
```

Key mappings:
- **OpenAI → Anthropic**: `messages` → `messages` (map `system` role to `system` param, map `developer` role), `tools` → `tools` (syntax differs)
- **Anthropic → OpenAI**: reverse, merge `system` param into messages
- **OpenAI → Gemini**: `messages` → `contents[]`, map roles, `tools` → `tools`
- **Gemini → OpenAI**: reverse

### H2. Wire into proxy
File: `supabase/functions/redactor-proxy/index.ts` — `runProxy()`

After redaction but before forwarding:
- If `ctx.upstream.provider.shape !== "openai"` and request body looks like openai shape, translate
- After upstream response, translate back to openai shape

### H3. Streaming translation
File: `supabase/functions/redactor-proxy/index.ts` — `createRehydrateStream()`

Handle per-provider SSE delta formats:
- Anthropic: `content_block_delta` events → map to `choices[].delta`
- Gemini: `candidates[].content.parts[]` → map to `choices[].delta`
- Apply rehydration after translation (tokens may be in different positions)

---

## Execution order

1. **B1** (keyPattern) — 2 files, trivial
2. **B2** (redaction tests) — validates redaction engine is solid
3. **A1 + A2** (migration + types) — foundation for all proxy enforcement
4. **C1 + C2** (proxy key UX) — lets users set rate limits/expiration
5. **D1 + D2 + D3** (rate limit + IP) — enforcement in proxy
6. **E1** (pricing seed script) — fetch models.dev data
7. **E2 + E3** (cost + spend cap) — depends on pricing data
8. **F1** (log retention) — independent, short
9. **G1 + G2 + G3** (dashboard) — visualization
10. **H1 + H2 + H3** (shape translation) — biggest effort, last
