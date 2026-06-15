/**
 * Catalog of known AI providers + how to route requests to them.
 * The proxy accepts requests in OpenAI shape and translates if needed.
 */

export interface ProviderDef {
  id: string;
  name: string;
  /** Default base URL of the upstream API. */
  baseUrl: string;
  /** The header used to authenticate. "bearer" => Authorization: Bearer <key>. */
  authStyle: "bearer" | "x-api-key" | "google";
  /** Native API shape — used to decide if we need to translate. */
  shape: "openai" | "anthropic" | "gemini";
  /** Model-name prefixes that should auto-route to this provider. */
  modelPrefixes?: string[];
  /** Docs URL for the dashboard hint. */
  docsUrl?: string;
  /** Regex describing what a real key typically looks like (for hint UX only). */
  keyPattern?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    authStyle: "bearer",
    shape: "openai",
    modelPrefixes: ["gpt-", "o1", "o3", "o4", "chatgpt", "text-embedding"],
    docsUrl: "https://platform.openai.com/api-keys",
    keyPattern: "^sk-",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    authStyle: "x-api-key",
    shape: "anthropic",
    modelPrefixes: ["claude-"],
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPattern: "^sk-ant-",
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    authStyle: "google",
    shape: "gemini",
    modelPrefixes: ["gemini-"],
    docsUrl: "https://aistudio.google.com/apikey",
    keyPattern: "^AIza",
  },
  {
    id: "xai",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    authStyle: "bearer",
    shape: "openai",
    modelPrefixes: ["grok-"],
    docsUrl: "https://console.x.ai/",
    keyPattern: "^xai-",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    authStyle: "bearer",
    shape: "openai",
    modelPrefixes: ["llama-", "mixtral-"],
    docsUrl: "https://console.groq.com/keys",
    keyPattern: "^gsk_",
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    authStyle: "bearer",
    shape: "openai",
    modelPrefixes: ["mistral-", "open-mistral"],
    docsUrl: "https://console.mistral.ai/api-keys/",
    keyPattern: "[A-Za-z0-9]{32}",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    authStyle: "bearer",
    shape: "openai",
    docsUrl: "https://openrouter.ai/keys",
    keyPattern: "^sk-or-",
  },

  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    authStyle: "bearer",
    shape: "openai",
    modelPrefixes: ["deepseek-"],
    docsUrl: "https://platform.deepseek.com/api_keys",
    keyPattern: "[A-Za-z0-9]{32}",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    authStyle: "bearer",
    shape: "openai",
    modelPrefixes: ["sonar", "pplx-"],
    docsUrl: "https://www.perplexity.ai/settings/api",
    keyPattern: "^pplx-",
  },
  {
    id: "togetherai",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    authStyle: "bearer",
    shape: "openai",
    docsUrl: "https://api.together.ai/settings/api-keys",
    keyPattern: "[A-Za-z0-9]{32}",
  },
  {
    id: "cohere",
    name: "Cohere",
    baseUrl: "https://api.cohere.com/v2",
    authStyle: "bearer",
    shape: "openai",
    modelPrefixes: ["command-"],
    docsUrl: "https://dashboard.cohere.com/api-keys",
    keyPattern: "^co-",
  },
  {
    id: "fireworks-ai",
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    authStyle: "bearer",
    shape: "openai",
    docsUrl: "https://fireworks.ai/account/api-keys",
    keyPattern: "[A-Za-z0-9]{32}",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    authStyle: "bearer",
    shape: "openai",
    docsUrl: "https://cloud.cerebras.ai/",
    keyPattern: "[A-Za-z0-9]{32}",
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    baseUrl: "",
    authStyle: "bearer",
    shape: "openai",
  },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function inferProviderFromModel(model: string): string | undefined {
  return resolveModelRouting(model).providerId;
}

/**
 * Resolve the provider + upstream model name from a user-supplied model string.
 *
 * Routing rules (in order):
 *  1. Explicit `<providerId>/<rest>` prefix matching any known provider id
 *     routes to that provider. The `<providerId>/` prefix is stripped before
 *     forwarding.
 *     OpenRouter is special: its native model ids are also `vendor/model`
 *     (including `openrouter/owl-alpha`), so only strip `openrouter/` when
 *     the remaining value is still a full `vendor/model` id.
 *  2. Otherwise fall back to `modelPrefixes` heuristics (e.g. `gpt-` → openai).
 *
 * If nothing matches, `providerId` is undefined and `model` is returned as-is.
 */
export function resolveModelRouting(model: string): {
  providerId: string | undefined;
  model: string;
} {
  const slash = model.indexOf("/");
  if (slash > 0) {
    const head = model.slice(0, slash);
    const rest = model.slice(slash + 1);
    const match = PROVIDERS.find((p) => p.id === head);
    if (match) {
      if (match.id === "openrouter") {
        const upstreamModel = rest.includes("/") ? rest : model;
        return { providerId: match.id, model: upstreamModel };
      }
      return { providerId: match.id, model: rest };
    }
  }
  for (const p of PROVIDERS) {
    if (!p.modelPrefixes) continue;
    if (p.modelPrefixes.some((pref) => model.startsWith(pref))) {
      return { providerId: p.id, model };
    }
  }
  return { providerId: undefined, model };
}

