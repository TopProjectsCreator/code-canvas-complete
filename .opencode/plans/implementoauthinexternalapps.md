# Implementing "Login with Code Canvas" in External Apps

This guide explains how to add a **"Login with Code Canvas"** button to any external web application, allowing users to authenticate using their Code Canvas account.

## Overview

Code Canvas uses **Supabase Auth** under the hood. The "Login with Code Canvas" flow works by:

1. The external app redirects the user to Code Canvas with a return URL, CSRF state token, and requested **scope** (permissions)
2. Code Canvas authenticates the user (or checks an existing session)
3. The user sees a consent screen showing exactly what the app is requesting (profile info, Redactor proxy keys, AI chat access)
4. The user approves → Code Canvas redirects back with Supabase **access_token** and **refresh_token** in the URL hash
5. The external app uses these tokens to call Code Canvas's API to get user info, create Redactor proxy keys, and use the user's AI providers

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
│                     │          │  &scope=profile,redactor    │
│                     │          │                              │
│                     │◄─────────┤  [Login screen if needed]   │
│                     │          │  [Consent screen]           │
│                     │          │   ✓ Profile info            │
│                     │          │   ✓ Redactor proxy keys     │
│                     │          │   ✓ AI chat                 │
│                     │          │                              │
│  <return>#          │◄─────────┤  redirect back with tokens  │
│  access_token=...   │          │                              │
│  &refresh_token=... │          │                              │
│  &state=...         │          │                              │
│                     │          │                              │
│  ─── Profile ────── │          │                              │
│  GET /api/oauth/    │──────────►│  verify token, return user  │
│  userinfo           │          │                              │
│                     │◄─────────┤  {id, email, display_name,  │
│                     │          │   avatar_url}                │
│                     │          │                              │
│  ─── Tokens ─────── │          │                              │
│  POST /api/oauth/   │──────────►│  refresh expired tokens     │
│  token/refresh      │          │                              │
│                     │◄─────────┤  {access_token, refresh_token│
│                     │          │   expires_in}                │
│                     │          │                              │
│  ─── Redactor ───── │          │                              │
│  POST /api/oauth/   │──────────►│  generate proxy key,       │
│  redactor/proxy-keys│          │  store hash in Supabase     │
│                     │◄─────────┤  {key:"lvp_live_...", ...}  │
│                     │          │                              │
│  GET /api/oauth/    │──────────►│  list user's proxy keys    │
│  redactor/proxy-keys│          │                              │
│                     │◄─────────┤  [{id, name, prefix, ...}]  │
│                     │          │                              │
│  POST /api/oauth/   │──────────►│  revoke a proxy key        │
│  redactor/proxy-keys│          │                              │
│  /:id/revoke        │          │                              │
│                     │◄─────────┤  {ok: true}                  │
│                     │          │                              │
│  ─── AI Chat ────── │          │                              │
│  POST /api/oauth/   │──────────►│  forward to user's AI      │
│  ai/chat            │          │  provider (OpenAI, etc.)    │
│                     │◄─────────┤  {choices: [...], usage}    │
│                     │          │                              │
│  GET /api/oauth/    │──────────►│  list user's configured    │
│  ai/providers       │          │  AI providers               │
│                     │◄─────────┤  {providers: ["openai",...]}│
└─────────────────────┘          └─────────────────────────────┘
```

---

## Prerequisites

1. **Admin access to Code Canvas** — you need to add your external app's host to the `allowed_oauth_return_hosts` table
2. **Code Canvas's Supabase URL** — this is visible in the browser as `VITE_SUPABASE_URL` (it's public)
3. **Code Canvas's Supabase anon key** — also public, visible as `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Scope Model

When redirecting the user to Code Canvas, you can request specific **scopes** via the `scope` parameter. Scopes are comma-separated:

| Scope | Default | Description | Consent Text |
|---|---|---|---|
| `profile` | ✅ Always included | Read user's email, display name, and avatar | "View your email, display name, and avatar" |
| `redactor` | ❌ Optional | Create, list, and revoke Redactor proxy keys (`lvp_live_...`) on the user's behalf | "Generate API keys through your Redactor proxy" |
| `ai_chat` | ❌ Optional | Send AI chat requests using the user's configured AI providers | "Send AI chat requests using your AI providers" |

**Example redirect URLs:**

```text
# Profile only
/auth/external-oauth?return=...&state=...&client_name=MyApp&scope=profile

# Profile + Redactor proxy keys
/auth/external-oauth?return=...&state=...&client_name=MyApp&scope=profile,redactor

# Profile + Redactor + AI chat
/auth/external-oauth?return=...&state=...&client_name=MyApp&scope=profile,redactor,ai_chat

# All (profile is always included if you pass any scope)
/auth/external-oauth?return=...&state=...&client_name=MyApp&scope=profile,redactor,ai_chat
```

If `scope` is omitted, defaults to `profile` only.

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

export type OAuthScope = 'profile' | 'redactor' | 'ai_chat';

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function stashOAuthState(state: string) {
  sessionStorage.setItem('cc-oauth:state', state);
}

export function buildOAuthUrl(options?: {
  returnPath?: string;
  scopes?: OAuthScope[];
  appName?: string;
}): string {
  const state = randomState();
  stashOAuthState(state);
  const returnUrl = encodeURIComponent(
    `${window.location.origin}${options?.returnPath || '/auth/codecanvas-callback'}`
  );
  const scopes = options?.scopes?.length ? options.scopes.join(',') : 'profile';
  const appName = encodeURIComponent(options?.appName || 'this app');
  return `https://code-canvas-complete-production.up.railway.app/auth/external-oauth?return=${returnUrl}&state=${state}&scope=${scopes}&client_name=${appName}`;
}
```

### Button Component (React example)

```tsx
// components/LoginWithCodeCanvas.tsx
import { useState } from 'react';
import type { OAuthScope } from '../utils/oauth';

const CODE_CANVAS_ORIGIN = 'https://code-canvas-complete-production.up.railway.app';

interface LoginWithCodeCanvasProps {
  appName?: string;
  callbackPath?: string;
  scopes?: OAuthScope[];
  className?: string;
}

export const LoginWithCodeCanvas = ({
  appName = 'this app',
  callbackPath = '/auth/codecanvas-callback',
  scopes = ['profile'],
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
      `${CODE_CANVAS_ORIGIN}/auth/external-oauth?return=${returnUrl}&state=${state}&scope=${scopes.join(',')}&client_name=${encodeURIComponent(appName)}`;
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
<button onclick="loginWithCodeCanvas('profile,redactor')" class="btn">
  Login with Code Canvas
</button>

<script>
  const CODE_CANVAS_ORIGIN = 'https://code-canvas-complete-production.up.railway.app';

  function randomState() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function loginWithCodeCanvas(scopes) {
    const state = randomState();
    sessionStorage.setItem('cc-oauth:state', state);
    const returnUrl = encodeURIComponent(window.location.origin + '/auth/codecanvas-callback');
    window.location.href = CODE_CANVAS_ORIGIN + '/auth/external-oauth?return=' + returnUrl + '&state=' + state + '&scope=' + encodeURIComponent(scopes || 'profile') + '&client_name=' + encodeURIComponent('Your App Name');
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
  expires_at: number;
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

        const expectedState = sessionStorage.getItem('cc-oauth:state');
        if (state && expectedState && state !== expectedState) {
          setStatus('error');
          setMessage('Sign-in state did not match. Please try again.');
          return;
        }
        sessionStorage.removeItem('cc-oauth:state');

        const userResp = await fetch(`${CODE_CANVAS_ORIGIN}/api/oauth/userinfo`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userResp.ok) {
          setStatus('error');
          setMessage('Failed to verify token with Code Canvas.');
          return;
        }

        const user: CodeCanvasUser = await userResp.json();

        const session: StoredSession = {
          access_token: accessToken,
          refresh_token: refreshToken,
          user,
          expires_at: Date.now() + 3600 * 1000,
        };
        localStorage.setItem('cc-oauth:session', JSON.stringify(session));

        window.history.replaceState(null, '', window.location.pathname);

        setStatus('success');
        setMessage(`Signed in as ${user.display_name || user.email}`);

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

## Step 5: Using Redactor Proxy Keys

If you requested the `redactor` scope, you can create Redactor proxy keys that allow you to call AI providers through the user's Redactor proxy. These `lvp_live_...` keys work with any OpenAI-compatible SDK.

### Create a Proxy Key

```typescript
const token = await getValidAccessToken();
if (!token) return;

const resp = await fetch(`${CODE_CANVAS_ORIGIN}/api/oauth/redactor/proxy-keys`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'My App Integration',
    allowed_providers: ['openai'],        // empty = all providers
    rate_limit_rpm: 60,                   // optional
    monthly_cap_usd: 5000,                // optional ($50.00)
  }),
});

const data = await resp.json();
// data.key = "lvp_live_..."  ← show this to the user once
// data.id, data.name, data.prefix, etc.
```

**Response:**
```json
{
  "id": "abc123",
  "name": "My App Integration",
  "key": "lvp_live_abc123def456...",
  "prefix": "lvp_live_abc123d",
  "allowed_providers": ["openai"],
  "rate_limit_rpm": 60,
  "monthly_cap_usd": 5000,
  "expires_at": null,
  "created_at": "2026-06-28T..."
}
```

### Using the Proxy Key (OpenAI-compatible SDK)

The generated `lvp_live_...` key can be used with any OpenAI-compatible SDK by pointing the base URL to the Redactor proxy:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'lvp_live_abc123def456...',
  baseURL: 'https://code-canvas-complete-production.up.railway.app/redactor/public/v1',
});

const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### List Proxy Keys

```typescript
const resp = await fetch(`${CODE_CANVAS_ORIGIN}/api/oauth/redactor/proxy-keys`, {
  headers: { Authorization: `Bearer ${token}` },
});
const keys = await resp.json(); // array of keys (without the full key value)
```

### Revoke a Proxy Key

```typescript
const resp = await fetch(
  `${CODE_CANVAS_ORIGIN}/api/oauth/redactor/proxy-keys/${keyId}/revoke`,
  { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
);
```

---

## Step 6: Using AI Chat

If you requested the `ai_chat` scope, you can send chat requests using the user's configured AI providers (OpenAI, Anthropic, Gemini, etc.). No API key on the external app side is needed — the user's own keys are automatically used.

### Send a Chat Request

```typescript
const token = await getValidAccessToken();
if (!token) return;

const resp = await fetch(`${CODE_CANVAS_ORIGIN}/api/oauth/ai/chat`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ],
    temperature: 0.7,
    max_tokens: 500,
  }),
});

const data = await resp.json();
// data = standard OpenAI-compatible response
// { choices: [{ message: { role: "assistant", content: "..." } }], usage: { ... } }
```

**Response:** Standard OpenAI-compatible JSON:
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30
  }
}
```

**Optional provider selection:**
```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "messages": [...]
}
```

If no provider is specified, the first available configured provider is auto-selected.

### List Available Providers

```typescript
const resp = await fetch(`${CODE_CANVAS_ORIGIN}/api/oauth/ai/providers`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await resp.json();
// data.providers = ["openai", "anthropic", "gemini", ...]
```

---

## API Reference

### Profile Endpoint

#### `GET /api/oauth/userinfo`

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
{ "error": "Token invalid or expired" }
```

### Token Endpoint

#### `POST /api/oauth/token/refresh`

Refreshes an expired access token.

**Request body:**
```json
{ "refresh_token": "..." }
```

**Response (200):**
```json
{
  "access_token": "new-access-token",
  "refresh_token": "new-refresh-token",
  "expires_in": 3600
}
```

### Redactor Endpoints

#### `POST /api/oauth/redactor/proxy-keys`

Creates a new Redactor proxy key (`lvp_live_...`). The full key is returned once and cannot be retrieved again.

**Headers:** `Authorization: Bearer <token>`

**Request body:**
```json
{
  "name": "My Integration",
  "allowed_providers": ["openai", "anthropic"],
  "rate_limit_rpm": 60,
  "monthly_cap_usd": 5000,
  "ip_allowlist": ["203.0.113.0/24"],
  "log_requests": true,
  "redact_images": true,
  "redact_videos": true,
  "expires_at": "2027-01-01T00:00:00Z"
}
```

All fields except `name` are optional.

**Response (201):**
```json
{
  "id": "abc123",
  "name": "My Integration",
  "key": "lvp_live_abc123def456...",
  "prefix": "lvp_live_abc123d",
  "allowed_providers": ["openai", "anthropic"],
  "rate_limit_rpm": 60,
  "monthly_cap_usd": 5000,
  "expires_at": "2027-01-01T00:00:00Z",
  "created_at": "2026-06-28T..."
}
```

#### `GET /api/oauth/redactor/proxy-keys`

Lists all proxy keys for the authenticated user (without the full key value).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": "abc123",
    "name": "My Integration",
    "key_prefix": "lvp_live_abc123d",
    "allowed_providers": ["openai"],
    "rate_limit_rpm": 60,
    "created_at": "...",
    "revoked_at": null
  }
]
```

#### `POST /api/oauth/redactor/proxy-keys/:id/revoke`

Revokes a proxy key. Revoked keys immediately stop working.

**Headers:** `Authorization: Bearer <token>`

**Response (200):** `{ "ok": true }`

### AI Chat Endpoints

#### `POST /api/oauth/ai/chat`

Sends a chat completion request using the user's configured AI provider. Automatically uses the user's own API keys — no external app API key needed.

**Headers:** `Authorization: Bearer <token>`

**Request body:**
```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "max_tokens": 500,
  "provider": "openai"
}
```

- `provider` is optional — auto-selects first available provider if omitted
- `temperature` and `max_tokens` are optional
- The request body follows the OpenAI chat completions format

**Response (200):** Standard OpenAI-compatible response:
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "Hello!" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15 }
}
```

**Response (503):**
```json
{ "error": "No AI API key configured for this user." }
```

#### `GET /api/oauth/ai/providers`

Lists which AI providers the user has configured (no key values returned).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{ "providers": ["openai", "anthropic", "gemini"] }
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
     │       &scope=profile,redactor        │
     │       &client_name=MyApp             │
     │                                      │
     │ 2. Validate return URL + scope       │
     │                                      │
     │ 3. User NOT authenticated?           │
     │    → Show login form                 │
     │                                      │
     │ 4. User authenticated → Show consent │
     │    screen with requested scopes:     │
     │    ✓ View your profile               │
     │    ✓ Generate Redactor proxy keys    │
     │                                      │
     │ 5. User clicks "Continue"            │
     │    Build hash with Supabase tokens   │
     │◄────── Redirect to <return>#         │
     │        access_token=...&             │
     │        refresh_token=...&            │
     │        state=...                     │
     │                                      │
     │ 6. Read tokens, validate state       │
     │    Fetch user profile + store        │
     │                                      │
     │ 7. POST /api/oauth/redactor/         │
     │    proxy-keys (Bearer token)          │
     ├─────────────────────────────────────►│
     │  [Generate lvp key, store hash,      │
     │   return full key]                   │
     │◄─────────────────────────────────────┤
     │  { key: "lvp_live_...", name, ... }  │
     │                                      │
     │ 8. Use lvp key with OpenAI SDK:      │
     │    baseURL = /redactor/public/v1     │
     │    → AI calls go through Redactor    │
     │    → PII redaction, rate limiting    │
     │                                      │
     │ Or use AI chat directly via OAuth:   │
     │ POST /api/oauth/ai/chat              │
     ├─────────────────────────────────────►│
     │  [Looks up user's AI keys, forwards  │
     │   to OpenAI/Anthropic/Gemini]        │
     │◄─────────────────────────────────────┤
     │  { choices: [...], usage: {...} }    │
     │                                      │
```

---

## Token Refresh Strategy

Tokens from Supabase Auth expire (~1 hour). Implement a refresh interceptor:

```typescript
const CODE_CANVAS_ORIGIN = 'https://code-canvas-complete-production.up.railway.app';

export async function getValidAccessToken(): Promise<string | null> {
  const stored = localStorage.getItem('cc-oauth:session');
  if (!stored) return null;

  const session = JSON.parse(stored);
  const REFRESH_MARGIN_MS = 5 * 60 * 1000;

  if (Date.now() < session.expires_at - REFRESH_MARGIN_MS) {
    return session.access_token;
  }

  try {
    const resp = await fetch(`${CODE_CANVAS_ORIGIN}/api/oauth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!resp.ok) { localStorage.removeItem('cc-oauth:session'); return null; }

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

async function callApi(endpoint: string, options?: RequestInit) {
  const token = await getValidAccessToken();
  if (!token) {
    window.location.href = '/login';
    return null;
  }

  const resp = await fetch(
    `https://code-canvas-complete-production.up.railway.app${endpoint}`,
    {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return resp.json();
}

// Usage examples:
// const user = await callApi('/api/oauth/userinfo');
// const aiResp = await callApi('/api/oauth/ai/chat', {
//   method: 'POST',
//   body: JSON.stringify({ model: 'gpt-4o', messages: [...] }),
// });
// const proxyKey = await callApi('/api/oauth/redactor/proxy-keys', {
//   method: 'POST',
//   body: JSON.stringify({ name: 'My Key' }),
// });
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

## Security Notes

| Concern | Mitigation |
|---|---|
| **CSRF / replay attacks** | `state` parameter is a random 128-bit token. Validated on return. |
| **Token interception** | Tokens passed in URL hash fragment (`#`), never sent to server in HTTP requests. |
| **Token expiry** | Access tokens expire after ~1 hour. Use the refresh endpoint. |
| **Unauthorized apps** | Only hosts in `allowed_oauth_return_hosts` can receive tokens. Admin-managed. |
| **Phishing** | Consent screen shows app name + user details + exact requested permissions. |
| **Redactor proxy keys** | Full key shown once, only SHA-256 hash stored. Revocable. Never stored by the server after creation. |
| **AI key access** | User's AI API keys never exposed to the external app. The OAuth `/ai/chat` endpoint proxies requests without revealing the key. |
| **Token storage** | Store tokens in `localStorage` or httpOnly cookies. |

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| "Return URL host is not on the allowlist" | External app's hostname not in DB | Add it via `/admin/oauth-hosts` |
| "Sign-in state did not match" | CSRF state mismatch | SessionStorage cleared. User restarts flow. |
| "Token invalid or expired" | Access token expired | Refresh via `/api/oauth/token/refresh` |
| "No AI API key configured for this user" | User hasn't added AI keys in Code Canvas | User adds API key in Code Canvas settings |
| Redactor proxy key returns 401 | Key revoked or expired | Create a new key |
| OAuth redirect goes to wrong URL | `return` param incorrectly encoded | Use `encodeURIComponent()` |
| User stays on Code Canvas after login | Callback URL incorrect | Check `callbackPath` matches your route |

---

## Code Canvas Implementation (Reference)

The feature was implemented in these files within the Code Canvas repo:

| File | Purpose |
|---|---|
| `src/pages/ExternalOAuth.tsx` | Main OAuth page — handles login + consent flow with scopes |
| `src/components/auth/ExternalOAuthConsent.tsx` | Dynamic consent screen UI — renders permissions based on scope |
| `server.mjs` (routes: `/api/oauth/userinfo`, `/api/oauth/token/refresh`, `/api/oauth/redactor/proxy-keys`, `/api/oauth/redactor/proxy-keys/:id/revoke`, `/api/oauth/ai/chat`, `/api/oauth/ai/providers`) | Server-side API for profile, token refresh, Redactor proxy key CRUD, and AI chat proxy |
| `src/App.tsx` | Route: `/auth/external-oauth` |
| `vite.config.ts` | PWA navigateFallbackDenylist includes `/auth/external-oauth` and `/admin/` |
