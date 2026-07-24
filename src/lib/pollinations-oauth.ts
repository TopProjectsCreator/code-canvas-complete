const POLLINATIONS_AUTH_URL = 'https://enter.pollinations.ai/authorize';
const POLLINATIONS_TOKEN_URL = 'https://enter.pollinations.ai/api/oauth/token';
const POLLINATIONS_TOKEN_PROXY_URL = '/api/oauth/pollinations/token';
const POLLINATIONS_OAUTH_STATE_KEY = 'code-canvas:pollinations-oauth-state';
const POLLINATIONS_VERIFIER_KEY = 'code-canvas:pollinations-pkce-verifier';
const POLLINATIONS_CLIENT_ID = (import.meta.env.VITE_POLLINATIONS_CLIENT_ID || import.meta.env.VITE_POLLINATIONS_API_APP_KEY) as string | undefined;

export { POLLINATIONS_OAUTH_STATE_KEY, POLLINATIONS_VERIFIER_KEY, POLLINATIONS_CLIENT_ID };

export function createOAuthState(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generatePKCEVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64urlEncode(array.buffer);
}

async function sha256(ascii: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(ascii);
  return crypto.subtle.digest('SHA-256', data);
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hashed = await sha256(verifier);
  return base64urlEncode(hashed);
}

interface BuildAuthUrlOpts {
  state: string;
  codeChallenge: string;
  redirectUri: string;
  models?: string;
  expiry?: string;
  budget?: string;
}

export function buildPollinationsAuthUrl(opts: BuildAuthUrlOpts): string {
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: opts.redirectUri,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
    models: opts.models || 'openai,openai-large,openai-fast,mistral,deepseek,qwen-coder',
    expiry: opts.expiry || '30',
    budget: opts.budget || '25',
  });
  if (POLLINATIONS_CLIENT_ID?.startsWith('pk_')) {
    params.set('client_id', POLLINATIONS_CLIENT_ID);
  }
  return `${POLLINATIONS_AUTH_URL}?${params.toString()}`;
}

interface ExchangeTokenOpts {
  code: string;
  clientId?: string;
  redirectUri: string;
  codeVerifier: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCodeForToken(opts: ExchangeTokenOpts): Promise<TokenResponse> {
  const formBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  });
  if (opts.clientId) {
    formBody.set('client_id', opts.clientId);
  }

  try {
    const resp = await fetch(POLLINATIONS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });
    let data: Record<string, unknown>;
    try {
      data = await resp.json();
    } catch {
      throw new TypeError('Non-JSON response from token endpoint');
    }
    if (!resp.ok) {
      throw new Error((data.error as string) || (data.error_description as string) || `Token exchange failed (${resp.status})`);
    }
    if (!data.access_token) {
      throw new Error('No access_token in response');
    }
    return data as unknown as TokenResponse;
  } catch (err) {
    if (err instanceof TypeError || err instanceof SyntaxError) {
      const proxyResp = await fetch(POLLINATIONS_TOKEN_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: opts.code,
          client_id: opts.clientId,
          redirect_uri: opts.redirectUri,
          code_verifier: opts.codeVerifier,
        }),
      });
      let proxyData: Record<string, unknown>;
      try {
        proxyData = await proxyResp.json();
      } catch {
        proxyData = { error: 'Invalid response from token proxy' };
      }
      if (!proxyResp.ok) {
        throw new Error((proxyData.error as string) || 'Proxy token exchange failed');
      }
      if (!proxyData.access_token) {
        throw new Error((proxyData.error as string) || 'No access_token in proxy response');
      }
      return proxyData as unknown as TokenResponse;
    }
    throw err;
  }
}

export function clearOAuthState(): void {
  localStorage.removeItem(POLLINATIONS_OAUTH_STATE_KEY);
  localStorage.removeItem(POLLINATIONS_VERIFIER_KEY);
}

export function storeOAuthState(state: string, verifier: string): void {
  localStorage.setItem(POLLINATIONS_OAUTH_STATE_KEY, state);
  localStorage.setItem(POLLINATIONS_VERIFIER_KEY, verifier);
}

export async function startPollinationsOAuth(): Promise<void> {
  const state = createOAuthState();
  const verifier = generatePKCEVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const redirectUri = `${window.location.origin}${window.location.pathname}${window.location.search}`;

  storeOAuthState(state, verifier);

  const url = buildPollinationsAuthUrl({
    state,
    codeChallenge: challenge,
    redirectUri,
  });

  window.location.assign(url);
}
