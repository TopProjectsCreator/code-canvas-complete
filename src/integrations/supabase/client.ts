import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isDiscordIframe = typeof window !== 'undefined' && (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const customFetch: typeof fetch = isDiscordIframe
  ? (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const proxied = url.startsWith(SUPABASE_URL)
        ? url.replace(SUPABASE_URL, '/api/supabase')
        : url;
      return fetch(proxied, init);
    }
  : fetch;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: { fetch: customFetch } as any,
});
