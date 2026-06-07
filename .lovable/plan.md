## Goal

Make sign-in work cleanly on the Railway-deployed app (and any other non-Lovable host) by routing OAuth and auth-link redirects through `replitclone.lovable.app`, which is the only origin where the Lovable managed OAuth broker (`/~oauth/*`) and configured Supabase email-link redirects work. Sessions are handed back to the originating host via a one-time URL-fragment token transfer, then hydrated with `supabase.auth.setSession`. Also add cross-origin sign-out coordination and a small admin UI for managing the host allowlist.

## How it works

```text
[Railway app]                                  [Lovable bridge app]              [Google]
  click "Sign in with Google"
        │  store {state, intendedPath} in
        │  sessionStorage; redirect:
        │  https://replitclone.lovable.app/auth-bridge
        │    ?return=https://myapp.up.railway.app/auth-callback
        │    &state=<random>
        ▼
                                          /auth-bridge (outbound)
                                          - validate `return` host vs
                                            allowed_oauth_return_hosts
                                          - stash {return,state} in lovable
                                            sessionStorage
                                          - lovable.auth.signInWithOAuth("google", {
                                                redirect_uri:
                                                  origin + "/auth-bridge"
                                            })
                                                                ─────────►
                                                                            Google login
                                                                ◄─────────
                                          /auth-bridge (return)
                                          - getSession()
                                          - re-validate return host
                                          - redirect:
                                              <return>#access_token=…
                                                      &refresh_token=…
                                                      &state=<state>
        ◄─────────────────────────────────
  /auth-callback
  - parse hash, verify state
  - setSession(...)
  - history.replaceState to strip tokens
  - navigate to intendedPath

Email-link flow (signup confirm, password reset, magic link):
  Supabase sends email →  link points at
    https://replitclone.lovable.app/auth-link?next=https://myapp.up.railway.app/auth-callback&type=<type>
  /auth-link runs the same logic as /auth-bridge return mode:
  - Supabase JS picks up the recovery/signup tokens from the URL
  - validate `next` host
  - forward session to <next> via hash
```

## Scope

- Google OAuth from non-Lovable hosts via the bridge.
- Supabase email-link redirects (signup confirm, password reset, magic link, email change) also routed through the bridge so the link always lands on a known Lovable origin first, then forwards to the originating host.
- Sign-out coordination so signing out on Railway also clears the Lovable session.
- Admin UI on the Lovable app for managing the allowlist.

## Changes

### 1. Database — allowlist table

`public.allowed_oauth_return_hosts`:

- `host` (text, primary key) — lowercased, no scheme, no path, e.g. `myapp.up.railway.app`.
- `note` (text, nullable) — admin-readable label.
- `created_at`, `updated_at`.

Access:

- `GRANT SELECT TO anon, authenticated` — bridge needs to read before login.
- `GRANT INSERT, UPDATE, DELETE TO authenticated` gated by an admin RLS policy that calls `public.has_role(auth.uid(), 'admin')`. Service role keeps full access.
- RLS enabled with separate policies for `SELECT` (public), and `INSERT/UPDATE/DELETE` (admin only).

Seed: the current Railway host and any custom domains.

### 2. New routes on the Lovable app

Registered in `src/App.tsx`:

- **`/auth-bridge`** (`src/pages/AuthBridge.tsx`)
  - **Outbound mode** (no session): validate `return` against allowlist, stash `{return,state}` in sessionStorage, call `lovable.auth.signInWithOAuth("google", { redirect_uri: origin + "/auth-bridge" })`. Reject missing/invalid params with a clear UI.
  - **Return mode** (session present): read `{return,state}` from sessionStorage, re-validate `return`, redirect to `<return>#access_token=…&refresh_token=…&state=…&token_type=bearer&expires_in=…`.

- **`/auth-link`** (`src/pages/AuthLink.tsx`) — for email-link flows
  - Mount Supabase JS as usual so it consumes the recovery/signup hash in the URL.
  - On session-present, read `next` from the query string, validate it against the allowlist, and forward `access_token`/`refresh_token` to `<next>#…` exactly like `/auth-bridge` return mode.
  - For password recovery, append `&type=recovery` so the callback page knows to push the user to a "set new password" view rather than the app's normal landing route.

- **`/auth-logout`** (`src/pages/AuthLogout.tsx`) — for cross-origin sign-out
  - On mount: validate `return` against allowlist, call `supabase.auth.signOut()`, then `window.location.replace(return)`.
  - Used by Railway during sign-out to also clear the Lovable session in an invisible top-level navigation (a redirect chain, not an iframe — third-party cookies/storage make iframe sign-out unreliable).

- **`/admin/oauth-hosts`** (`src/pages/admin/OAuthHosts.tsx`) — allowlist admin UI
  - Gated by `has_role(auth.uid(), 'admin')` (already in the project per the existing `user_roles` table).
  - Table view of `allowed_oauth_return_hosts` with add / edit / delete. Hostnames normalized to lowercase before insert. Inline note field.
  - Read uses anon-accessible SELECT; mutations require the admin role and rely on RLS for safety, not just the UI check.

### 3. New routes on the Railway app

Registered in `src/App.tsx`:

- **`/auth-callback`** (`src/pages/AuthCallback.tsx`)
  - Parse `location.hash` for `access_token`, `refresh_token`, `state`, optional `type`.
  - Compare `state` against the value Railway stashed in sessionStorage before redirecting out. Reject on mismatch.
  - `await supabase.auth.setSession({ access_token, refresh_token })`.
  - `history.replaceState(null, "", "/")` to scrub tokens from the URL and history.
  - If `type === "recovery"`, navigate to `/reset-password`; otherwise navigate to the stashed `intendedPath` (fallback `/`).

- **`/reset-password`** (`src/pages/ResetPassword.tsx`)
  - Standard "enter new password" form that calls `supabase.auth.updateUser({ password })`. Required because Supabase's recovery flow expects a dedicated page after the link is consumed.

### 4. Auth provider wiring

`src/integrations/auth/provider.ts`:

- Keep current `lovableProvider` for the Lovable host (unchanged).
- Add a `bridgedProvider` used when `detectDeploymentPlatform()` is not `lovable`. It overrides:
  - **`signInWithOAuth("google")`** — generate `state`, store `{state, intendedPath}` in sessionStorage, redirect to `<BRIDGE>/auth-bridge?return=<origin>/auth-callback&state=<state>`.
  - **`signUp`** — call Supabase signUp with `emailRedirectTo = <BRIDGE>/auth-link?next=<origin>/auth-callback`.
  - **`resetPassword`** — call Supabase resetPasswordForEmail with `redirectTo = <BRIDGE>/auth-link?next=<origin>/auth-callback&type=recovery`.
  - **`signOut`** — `await supabase.auth.signOut()` locally, then `window.location.assign("<BRIDGE>/auth-logout?return=<origin>/")` so the Lovable session is also cleared in the same browsing context.
- `createAuthProvider()` picks between `lovableProvider` and `bridgedProvider` by platform.
- Bridge origin configurable via `VITE_AUTH_BRIDGE_URL`; defaults to `https://replitclone.lovable.app`.

### 5. PWA / service worker bypass

`/auth-bridge`, `/auth-link`, `/auth-logout`, `/admin/oauth-hosts` on Lovable and `/auth-callback`, `/reset-password` on Railway must bypass any SW navigation caching, same rule already applied to `/~oauth`. Add them to the `vite-plugin-pwa` navigation-fallback denylist where a SW is registered. If no SW is registered on a given project, no-op.

### 6. Platform detection — no changes

`src/lib/platform.ts` already differentiates Lovable vs Railway hosts. We just consume that signal in `createAuthProvider()`.

## Security considerations

- **Open redirect**: every redirect target is checked against `allowed_oauth_return_hosts`, on both legs of the bridge, only `https:`, exact-hostname match (no suffix tricks).
- **Token-in-URL**: tokens are placed in `location.hash`, not the query string, so they are not sent to the server and not written to most access logs. Callback strips them immediately with `history.replaceState`.
- **CSRF / replay**: `state` is generated on the originating host, round-tripped via sessionStorage + URL fragment, and compared on return.
- **Allowlist mutations**: gated by `has_role(auth.uid(), 'admin')` at the RLS layer. The admin UI is a convenience; security does not depend on it.
- **Sign-out coordination**: handled via top-level navigation through `/auth-logout` rather than hidden iframes (third-party storage partitioning makes iframe sign-out unreliable in Safari and increasingly elsewhere).
- **Recovery links**: `type=recovery` is propagated end-to-end so Railway can route to `/reset-password` without trusting URL contents for auth state — the actual session is what `setSession` validates.

## Verification

1. Google sign-in from Railway → Google → Lovable bridge → Railway `/auth-callback`, session populated, hash stripped.
2. Open password-reset email from Railway-initiated reset → link lands on Lovable `/auth-link` → forwards to Railway `/auth-callback?type=recovery` → Railway routes to `/reset-password` → updateUser succeeds.
3. Signup confirmation email from Railway signup → same as above, lands authenticated on Railway.
4. Sign out from Railway → Railway session cleared → redirected through Lovable `/auth-logout` → Lovable session cleared → back on Railway.
5. Open `/admin/oauth-hosts` as a non-admin → blocked (UI and RLS).
6. Add a Railway host via the admin UI → sign-in from that host immediately works.
7. Manually pass `return=https://evil.example.com/...` to `/auth-bridge` → rejected before initiating OAuth.
8. Tamper with `state` in the URL on `/auth-callback` → rejected, no session written.
9. Sign-in still works directly on Lovable with no bridge involvement.
