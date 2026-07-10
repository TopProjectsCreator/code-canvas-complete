import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_SUPABASE_URL = 'https://xlmvlplazxrouscupidi.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXZscGxhenhyb3VzY3VwaWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjYyNjQsImV4cCI6MjA4NTU0MjI2NH0.j5b8QH6RusxDfJ21Fsp7A-ILDPPTL4r6ZpmO_OFoqT8';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;

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

function getAuthStorage() {
  if (typeof window === 'undefined') return localStorage;
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    return localStorage;
  } catch {
    const prefix = 'sb-';
    return {
      getItem: (key: string) => {
        const match = document.cookie.match(new RegExp(`(^| )${prefix}${key}=([^;]+)`));
        return match ? decodeURIComponent(match[2]) : null;
      },
      setItem: (key: string, value: string) => {
        document.cookie = `${prefix}${key}=${encodeURIComponent(value)}; path=/; SameSite=None; Secure; Partitioned; max-age=31536000`;
      },
      removeItem: (key: string) => {
        document.cookie = `${prefix}${key}=; path=/; SameSite=None; Secure; Partitioned; max-age=0`;
      },
    };
  }
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: getAuthStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
  global: { fetch: customFetch } as any,
});
