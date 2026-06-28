# Implementing "Login with Code Canvas" in External Apps

This guide explains how to add a **"Login with Code Canvas"** button to any external web application, allowing users to authenticate using their Code Canvas account.

## Overview

Code Canvas uses **Supabase Auth** under the hood. The "Login with Code Canvas" flow works by:

1. The external app redirects the user to Code Canvas with a return URL and CSRF state token
2. Code Canvas authenticates the user (or checks an existing session)
3. The user sees a consent screen and approves sharing their profile
4. Code Canvas redirects back to the external app with Supabase **access_token** and **refresh_token** in the URL hash
5. The external app uses these tokens to call Code Canvas's API to get user info (and optionally refresh tokens)

The external app **does not need its own Supabase project** — it uses Code Canvas as the auth provider via REST APIs.

---

## Architecture

```
┌─────────────────────┐          ┌─────────────────────────────┐
│   External App       │          │   Code Canvas (this repo)   │
│                     │          │                              │
│   [Login with CC]───┼──────────►│  /auth/external-oauth       │
│                     │          │  ?return=<url>              │
│                     │          │  &state=<random>            │
│                     │          │  &client_name=MyApp         │
│                     │          │                              │
│                     │◄─────────┤  [Login screen if needed]   │
│                     │          │  [Consent screen]           │
│                     │          │                              │
│  <return>#          │◄─────────┤  redirect back with tokens  │
│  access_token=...   │          │                              │
│  &refresh_token=... │          │                              │
│  &state=...         │          │                              │
│                     │          │                              │
│  GET /api/oauth/    │──────────►│  verify token, return user  │
│  userinfo           │          │                              │
│                     │◄─────────┤  {id, email, display_name,  │
│                     │          │   avatar_url}                │
│                     │          │                              │
│  POST /api/oauth/   │──────────►│  refresh expired tokens     │
│  token/refresh      │          │                              │
│                     │◄─────────┤  {access_token, refresh_token│
│                     │          │   expires_in}                │
└─────────────────────┘          └─────────────────────────────┘
```

---

## Prerequisites

1. **Admin access to Code Canvas** — you need to add your external app's host to the `allowed_oauth_return_hosts` table
2. **Code Canvas's Supabase URL** — this is visible in the browser as `VITE_SUPABASE_URL` (it's public)
3. **Code Canvas's Supabase anon key** — also public, visible as `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Step 1: Register Your External App's Host

An admin must add your external app's hostname to the allowlist so the OAuth flow will accept return redirects.

**Via the admin UI** (if you have admin access):
1. Go to `https://code-canvas-complete-production.up.railway.app/admin/oauth-hosts`
2. Add your app's hostname (e.g., `myapp.up.railway.app` or `myapp.example.com`)
3. Add a note to describe what the host is for

**Via direct Supabase insert:**
```sql
INSERT INTO allowed_oauth_return_hosts (host, note)
VALUES ('myapp.up.railway.app', 'My external app');
```

> **Important:** The hostname is matched exactly (case-insensitive). For local development, `localhost` and `127.0.0.1` are always allowed with `http://` protocol.

---

## Step 2: Add the "Login with Code Canvas" Button

Create a button component in your external app that initiates the OAuth flow.

### Required State Management

You need a way to generate and store a CSRF state token in `sessionStorage`:

```typescript
// utils/oauth.ts

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function stashOAuthState(state: string) {
  sessionStorage.setItem('cc-oauth:state', state);
}

function readOAuthState(): string | null {
  return sessionStorage.getItem('cc-oauth:state');
}

function clearOAuthState() {
  sessionStorage.removeItem('cc-oauth:state');
}

export function buildOAuthUrl(returnPath?: string): string {
  const state = randomState();
  stashOAuthState(state);
  const returnUrl = encodeURIComponent(
    `${window.location.origin}${returnPath || '/auth/codecanvas-callback'}`
  );
  return `https://code-canvas-complete-production.up.railway.app/auth/external-oauth?return=${returnUrl}&state=${state}&client_name=${encodeURIComponent('Your App Name')}`;
}
```

### Button Component (React example)

```tsx
// components/LoginWithCodeCanvas.tsx
import { useState } from 'react';

const CODE_CANVAS_ORIGIN = 'https://code-canvas-complete-production.up.railway.app';

interface LoginWithCodeCanvasProps {
  appName?: string;
  callbackPath?: string;
  className?: string;
}

export const LoginWithCodeCanvas = ({
  appName = 'this app',
  callbackPath = '/auth/codecanvas-callback',
  className,
}: LoginWithCodeCanvasProps) => {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    const state = randomState();
    stashOAuthState(state);
    const returnUrl = encodeURIComponent(
      `${window.location.origin}${callbackPath}`
    );
    window.location.href =
      `${CODE_CANVAS_ORIGIN}/auth/external-oauth?return=${returnUrl}&state=${state}&client_name=${encodeURIComponent(appName)}`;
  };

  return (
    <button onClick={handleLogin} disabled={loading} className={className}>
      {loading ? 'Redirecting…' : 'Login with Code Canvas'}
    </button>
  );
};

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function stashOAuthState(state: string) {
  sessionStorage.setItem('cc-oauth:state', state);
}
```

### Plain HTML/JS Button

```html
<button onclick="loginWithCodeCanvas()" class="btn">
  Login with Code Canvas
</button>

<script>
  const CODE_CANVAS_ORIGIN = 'https://code-canvas-complete-production.up.railway.app';

  function randomState() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function loginWithCodeCanvas() {
    const state = randomState();
    sessionStorage.setItem('cc-oauth:state', state);
    const returnUrl = encodeURIComponent(window.location.origin + '/auth/codecanvas-callback');
    window.location.href = CODE_CANVAS_ORIGIN + '/auth/external-oauth?return=' + returnUrl + '&state=' + state + '&client_name=' + encodeURIComponent('Your App Name');
  }
</script>
```

---

## Step 3: Handle the OAuth Callback

Create a callback page that receives the tokens from the URL hash.

### Callback Page (React example)

```tsx
// pages/CodeCanvasCallback.tsx
import { useEffect, useState } from 'react';

const CODE_CANVAS_ORIGIN = 'https://code-canvas-complete-production.up.railway.app';

interface CodeCanvasUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface StoredSession {
  access_token: string;
  refresh_token: string;
  user: CodeCanvasUser;
  expires_at: number; // timestamp when access_token expires
}

const CodeCanvasCallback = () => {
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [message, setMessage] = useState('Completing sign in…');

  useEffect(() => {
    const run = async () => {
      try {
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const state = params.get('state');
        const errorParam = params.get('error');

        // User denied consent
        if (errorParam === 'access_denied') {
          setStatus('error');
          setMessage('Sign in was cancelled.');
          return;
        }

        if (!accessToken || !refreshToken) {
          setStatus('error');
          setMessage('Missing tokens in callback URL.');
          return;
        }

        // Validate CSRF state
        const expectedState = sessionStorage.getItem('cc-oauth:state');
        if (state && expectedState && state !== expectedState) {
          setStatus('error');
          setMessage('Sign-in state did not match. Please try again.');
          return;
        }
        sessionStorage.removeItem('cc-oauth:state');

        // Fetch user info from Code Canvas
        const userResp = await fetch(`${CODE_CANVAS_ORIGIN}/api/oauth/userinfo`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userResp.ok) {
          setStatus('error');
          setMessage('Failed to verify token with Code Canvas.');
          return;
        }

        const user: CodeCanvasUser = await userResp.json();

        // Store the session
        const session: StoredSession = {
          access_token: accessToken,
          refresh_token: refreshToken,
          user,
          expires_at: Date.now() + 3600 * 1000, // default 1 hour
        };
        localStorage.setItem('cc-oauth:session', JSON.stringify(session));

        // Clean the URL
        window.history.replaceState(null, '', window.location.pathname);

        setStatus('success');
        setMessage(`Signed in as ${user.display_name || user.email}`);

        // Redirect to app home after a brief delay
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } catch (err) {
        setStatus('error');
        setMessage('An unexpected error occurred.');
      }
    };

    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">
          {status === 'loading' && 'Signing you in…'}
          {status === 'error' && 'Sign-in Error'}
          {status === 'success' && 'Signed In!'}
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        {status === 'error' && (
          <a href="/" className="text-sm text-primary underline">
            Return home
          </a>
        )}
      </div>
    </div>
  );
};

export default CodeCanvasCallback;
```

### Route Setup (React Router)

```tsx
<Route path="/auth/codecanvas-callback" element={<CodeCanvasCallback />} />
```

---

## Step 4: Create an Auth Hook / Context

To manage the authenticated state across your app, create a simple auth context:

```tsx
// contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CodeCanvasUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface StoredSession {
  access_token: string;
  refresh_token: string;
  user: CodeCanvasUser;
  expires_at: number;
}

interface AuthContextType {
  user: CodeCanvasUser | null;
  loading: boolean;
  signOut: () => void;
  getAccessToken: () => string | null;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<CodeCanvasUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('cc-oauth:session');
    if (stored) {
      const session: StoredSession = JSON.parse(stored);
      if (Date.now() < session.expires_at) {
        setUser(session.user);
      } else {
        // Token expired — try refreshing
        refreshTokens(session.refresh_token).then((newSession) => {
          if (newSession) {
            setUser(newSession.user);
          } else {
            localStorage.removeItem('cc-oauth:session');
          }
        });
      }
    }
    setLoading(false);
  }, []);

  const getAccessToken = (): string | null => {
    const stored = localStorage.getItem('cc-oauth:session');
    if (!stored) return null;
    const session: StoredSession = JSON.parse(stored);
    if (Date.now() < session.expires_at) return session.access_token;
    return null;
  };

  const signOut = () => {
    localStorage.removeItem('cc-oauth:session');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, getAccessToken, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

## API Reference

### `GET /api/oauth/userinfo`

Returns the authenticated user's profile.

**Headers:**
- `Authorization: Bearer <supabase-access-token>`

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "display_name": "John Doe",
  "avatar_url": "https://example.com/avatar.png"
}
```

**Response (401):**
```json
{
  "error": "Token invalid or expired"
}
```

### `POST /api/oauth/token/refresh`

Refreshes an expired access token.

**Request body:**
```json
{
  "refresh_token": "..."
}
```

**Response (200):**
```json
{
  "access_token": "new-access-token",
  "refresh_token": "new-refresh-token",
  "expires_in": 3600
}
```

**Response (401):**
```json
{
  "error": "Refresh token invalid or expired"
}
```

---

## Full Authentication Flow (Diagram)

```
External App                           Code Canvas
     │                                      │
     │ 1. User clicks "Login with CC"       │
     ├──────► Generate random state        │
     │       Store state in sessionStorage │
     │       Redirect to:                   │
     │       /auth/external-oauth           │
     │       ?return=<url>                  │
     │       &state=<state>                 │
     │       &client_name=MyApp             │
     │                                      │
     │ 2. Validate return URL against       │
     │    allowed_oauth_return_hosts        │
     │                                      │
     │ 3. User NOT authenticated?           │
     │    → Show login form (email/pw       │
     │      or Google/Apple/Microsoft)      │
     │                                      │
     │ 4. User authenticated → Show consent │
     │    screen: "Allow MyApp to use       │
     │    your Code Canvas account?"        │
     │                                      │
     │ 5. User clicks "Continue"            │
     │    Build hash with Supabase tokens   │
     │◄────── Redirect to <return>#         │
     │        access_token=...&             │
     │        refresh_token=...&            │
     │        state=...                     │
     │                                      │
     │ 6. Read tokens from hash             │
     │    Validate state matches stored     │
     │    Clear state from sessionStorage   │
     │    Clean URL (remove hash)           │
     │                                      │
     │ 7. GET /api/oauth/userinfo           │
     ├─────────────────────────────────────►│
     │◄─────────────────────────────────────┤
     │    { id, email, display_name,        │
     │      avatar_url }                    │
     │                                      │
     │ 8. Store session in localStorage     │
     │    Redirect user to app home         │
     │                                      │
     │ 9. (Later) Token expired             │
     │    POST /api/oauth/token/refresh     │
     ├─────────────────────────────────────►│
     │◄─────────────────────────────────────┤
     │    { access_token, refresh_token,    │
     │      expires_in }                    │
     │                                      │
```

---

## Security Notes

| Concern | Mitigation |
|---|---|
| **CSRF / replay attacks** | `state` parameter is a random 128-bit token. The external app generates it, stashes it, and validates it on return. |
| **Token interception** | Tokens are passed in the URL hash fragment (`#`), which is never sent to the server in HTTP requests. |
| **Token expiry** | Access tokens expire after 1 hour. Use the refresh endpoint to get new ones. |
| **Unauthorized apps** | Only hosts in the `allowed_oauth_return_hosts` DB table can receive tokens. Admin-managed. |
| **Phishing** | The consent screen always shows the app name and user's email/avatar, so users know exactly what they're approving. |
| **Token storage** | Store tokens in `localStorage` (or httpOnly cookies if you have a backend). `sessionStorage` is safer but doesn't persist across tabs. |

---

## Token Refresh Strategy

Tokens from Supabase Auth expire. Implement a refresh interceptor:

```typescript
const CODE_CANVAS_ORIGIN = 'https://code-canvas-complete-production.up.railway.app';

export async function getValidAccessToken(): Promise<string | null> {
  const stored = localStorage.getItem('cc-oauth:session');
  if (!stored) return null;

  const session = JSON.parse(stored);
  const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

  if (Date.now() < session.expires_at - REFRESH_MARGIN_MS) {
    return session.access_token;
  }

  // Token expired or expiring soon — refresh
  try {
    const resp = await fetch(`${CODE_CANVAS_ORIGIN}/api/oauth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!resp.ok) {
      localStorage.removeItem('cc-oauth:session');
      return null;
    }

    const data = await resp.json();
    const newSession = {
      ...session,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };
    localStorage.setItem('cc-oauth:session', JSON.stringify(newSession));
    return data.access_token;
  } catch {
    localStorage.removeItem('cc-oauth:session');
    return null;
  }
}
```

---

## Making Authenticated API Calls

```typescript
import { getValidAccessToken } from './oauth';

async function fetchUserData() {
  const token = await getValidAccessToken();
  if (!token) {
    // Redirect to login
    window.location.href = '/login';
    return;
  }

  const resp = await fetch('https://code-canvas-complete-production.up.railway.app/api/oauth/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}
```

---

## Configuration Overview

| Environment Variable | Where to set | Required | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Code Canvas .env | Yes | Public — visible in browser |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Code Canvas .env | Yes | Public — visible in browser |
| `allowed_oauth_return_hosts` table | Supabase DB | Yes | Add each external app's hostname |
| `CODE_CANVAS_ORIGIN` | External app config | Yes | The URL where Code Canvas is hosted |

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| "Return URL host is not on the allowlist" | External app's hostname not in DB | Add it via `/admin/oauth-hosts` or insert into `allowed_oauth_return_hosts` |
| "Sign-in state did not match" | CSRF state mismatch | SessionStorage may have been cleared. User should restart the flow. |
| "Token invalid or expired" from userinfo | Access token expired | Call the refresh endpoint, or re-initiate OAuth flow |
| OAuth redirect goes to wrong URL | `return` param incorrectly encoded | Make sure `encodeURIComponent()` is applied to the return URL |
| User stays on Code Canvas after login | External app's callback URL incorrect | Check the `callbackPath` parameter matches the actual route in your external app |
| Login page loops on Code Canvas | Session cookie from previous login exists | The user should be automatically shown the consent screen. If they keep seeing login, check that `supabase.auth.getSession()` returns a session. |

---

## Code Canvas Implementation (Reference)

The feature was implemented in these files within the Code Canvas repo:

| File | Purpose |
|---|---|
| `src/pages/ExternalOAuth.tsx` | Main OAuth page — handles login + consent flow |
| `src/components/auth/ExternalOAuthConsent.tsx` | Consent screen UI component |
| `server.mjs` (routes: `/api/oauth/userinfo`, `/api/oauth/token/refresh`) | Server-side API for token verification and refresh |
| `src/App.tsx` | Route: `/auth/external-oauth` |

No Supabase edge functions were needed — all server logic is in `server.mjs` using the existing Express server to proxy to Supabase's REST API.
