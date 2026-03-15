import { detectDeploymentPlatform, type DeploymentPlatform } from '@/lib/platform';

interface AIRequestOptions {
  accessToken?: string;
  signal?: AbortSignal;
}

interface ChatPayload {
  messages: Array<{ role: 'assistant' | 'user'; content: unknown }>;
  currentFile: { name: string; language?: string; content?: string } | null;
  consoleErrors: string | null;
  workflows: Array<{ name: string; type: string; command: string }> | null;
  agentMode: boolean;
  model: string;
  byokProvider?: string;
  byokModel?: string;
  template?: string;
}

interface MusicPayload {
  prompt: string;
  bpm?: number;
  duration?: number;
}

export interface AIProvider {
  platform: DeploymentPlatform;
  supportsManagedAI: boolean;
  allowsBYOK: boolean;
  chat: (payload: ChatPayload, options?: AIRequestOptions) => Promise<Response>;
  generateImage: (prompt: string, options?: AIRequestOptions) => Promise<Response>;
  generateMusic: (payload: MusicPayload, options?: AIRequestOptions) => Promise<Response>;
}

const jsonHeaders = (accessToken?: string) => ({
  'Content-Type': 'application/json',
  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
});

const createSupabaseAIProvider = (): AIProvider => {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return {
    platform: 'generic',
    supportsManagedAI: true,
    allowsBYOK: true,
    chat: (payload, options) =>
      fetch(`${base}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: jsonHeaders(options?.accessToken),
        body: JSON.stringify(payload),
        signal: options?.signal,
      }),
    generateImage: (prompt, options) =>
      fetch(`${base}/functions/v1/generate-image`, {
        method: 'POST',
        headers: jsonHeaders(options?.accessToken),
        body: JSON.stringify({ prompt }),
        signal: options?.signal,
      }),
    generateMusic: (payload, options) =>
      fetch(`${base}/functions/v1/generate-music`, {
        method: 'POST',
        headers: jsonHeaders(options?.accessToken),
        body: JSON.stringify(payload),
        signal: options?.signal,
      }),
  };
};

const createManagedAIProvider = (platform: 'replit' | 'lovable'): AIProvider => {
  const envBase =
    platform === 'replit'
      ? import.meta.env.VITE_REPLIT_AI_BASE_URL
      : import.meta.env.VITE_LOVABLE_AI_BASE_URL;

  const fallback = createSupabaseAIProvider();
  if (!envBase) {
    return {
      ...fallback,
      platform,
      supportsManagedAI: false,
      allowsBYOK: true,
    };
  }

  return {
    platform,
    supportsManagedAI: true,
    allowsBYOK: false,
    chat: (payload, options) =>
      fetch(`${envBase}/chat`, {
        method: 'POST',
        headers: jsonHeaders(options?.accessToken),
        body: JSON.stringify(payload),
        signal: options?.signal,
      }),
    generateImage: (prompt, options) =>
      fetch(`${envBase}/image`, {
        method: 'POST',
        headers: jsonHeaders(options?.accessToken),
        body: JSON.stringify({ prompt }),
        signal: options?.signal,
      }),
    generateMusic: (payload, options) =>
      fetch(`${envBase}/music`, {
        method: 'POST',
        headers: jsonHeaders(options?.accessToken),
        body: JSON.stringify(payload),
        signal: options?.signal,
      }),
  };
};

export const createAIProvider = (): AIProvider => {
  const platform = detectDeploymentPlatform();

  if (platform === 'replit') return createManagedAIProvider('replit');
  if (platform === 'lovable') return createManagedAIProvider('lovable');

  return createSupabaseAIProvider();
};
