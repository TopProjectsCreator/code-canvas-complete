import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createDataProvider } from '@/integrations/data/provider';

export type AIProvider = 
  | 'perplexity' 
  | 'gemini' 
  | 'anthropic' 
  | 'openai' 
  | 'deepseek' 
  | 'xai' 
  | 'cohere' 
  | 'openrouter'
  | 'github'
  | 'meshy'
  | 'sloyd'
  | 'tripo'
  | 'modelslab'
  | 'fal'
  | 'neural4d'
  | 'stability'
  | 'ideogram'
  | 'runway'
  | 'replicate'
  | 'kling'
  | 'higgsfield'
  | 'luma'
  | 'pika';

export interface UserApiKey {
  id: string;
  provider: AIProvider;
  api_key: string;
  created_at: string;
}

export interface UsageInfo {
  model_tier: string;
  request_count: number;
  limit: number;
}

export const PROVIDER_INFO: Record<AIProvider, { label: string; placeholder: string; docsUrl: string }> = {
  perplexity: { label: 'Perplexity', placeholder: 'pplx-...', docsUrl: 'https://docs.perplexity.ai' },
  gemini: { label: 'Gemini (AI Studio / Vertex)', placeholder: 'AIza...', docsUrl: 'https://aistudio.google.com/apikey' },
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...', docsUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { label: 'OpenAI', placeholder: 'sk-...', docsUrl: 'https://platform.openai.com/api-keys' },
  deepseek: { label: 'DeepSeek', placeholder: 'sk-...', docsUrl: 'https://platform.deepseek.com/api_keys' },
  xai: { label: 'xAI (Grok)', placeholder: 'xai-...', docsUrl: 'https://console.x.ai' },
  cohere: { label: 'Cohere', placeholder: '...', docsUrl: 'https://dashboard.cohere.com/api-keys' },
  openrouter: { label: 'OpenRouter', placeholder: 'sk-or-...', docsUrl: 'https://openrouter.ai/keys' },
  github: { label: 'GitHub', placeholder: 'ghp_... or github_pat_...', docsUrl: 'https://github.com/settings/tokens' },
  meshy: { label: 'Meshy (Text-to-3D)', placeholder: 'msy_...', docsUrl: 'https://docs.meshy.ai/api-introduction' },
  sloyd: { label: 'Sloyd (Text-to-3D)', placeholder: 'sloyd_...', docsUrl: 'https://www.sloyd.ai/docs' },
  tripo: { label: 'Tripo (Text-to-3D)', placeholder: 'tsk_...', docsUrl: 'https://platform.tripo3d.ai/docs' },
  modelslab: { label: 'ModelsLab (Text-to-3D)', placeholder: '...', docsUrl: 'https://docs.modelslab.com' },
  fal: { label: 'Fal.ai (Text-to-3D)', placeholder: '...', docsUrl: 'https://fal.ai/docs' },
  neural4d: { label: 'Neural4D (Text-to-3D)', placeholder: '...', docsUrl: 'https://neural4d.com/docs' },
  stability: { label: 'Stability AI (Image)', placeholder: 'sk-...', docsUrl: 'https://platform.stability.ai/account/keys' },
  ideogram: { label: 'Ideogram (Image)', placeholder: '...', docsUrl: 'https://ideogram.ai' },
  runway: { label: 'Runway (Video)', placeholder: 'rw_... or sk-...', docsUrl: 'https://docs.dev.runwayml.com' },
  replicate: { label: 'Replicate (Image/Video)', placeholder: 'r8_... or rpl_...', docsUrl: 'https://replicate.com/account/api-tokens' },
  kling: { label: 'Kling (Video)', placeholder: 'kling_... or fal key', docsUrl: 'https://docs.klingai.com' },
  higgsfield: { label: 'Higgsfield (Video)', placeholder: '...', docsUrl: 'https://higgsfield.ai' },
  luma: { label: 'Luma (Video)', placeholder: '...', docsUrl: 'https://lumalabs.ai/dream-machine/api' },
  pika: { label: 'Pika (Video)', placeholder: '...', docsUrl: 'https://pika.art' },
};

export const PROVIDER_MODELS: Record<AIProvider, { id: string; label: string }[]> = {
  openai: [
    { id: 'gpt-5.4', label: 'GPT-5.4' },
    { id: 'gpt-5.4-pro', label: 'GPT-5.4 Pro' },
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { id: 'gpt-5-nano', label: 'GPT-5 Nano' },
    { id: 'gpt-5', label: 'GPT-5' },
    { id: 'gpt-5-pro', label: 'GPT-5 Pro' },
    { id: 'gpt-5.2', label: 'GPT-5.2' },
    { id: 'gpt-5.2-pro', label: 'GPT-5.2 Pro' },
    { id: 'gpt-5.2-mini', label: 'GPT-5.2 Mini' },
    { id: 'gpt-5.3-chat-latest', label: 'GPT-5.3 Chat Latest' },
    { id: 'gpt-5.1-chat-latest', label: 'GPT-5.1 Chat Latest' },
    { id: 'gpt-5-chat-latest', label: 'GPT-5 Chat Latest' },
    { id: 'gpt-5.1', label: 'GPT-5.1' },
    { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' },
    { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max' },
    { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini' },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
    { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex' },
    { id: 'gpt-5-codex', label: 'GPT-5 Codex' },
    { id: 'codex-mini-latest', label: 'Codex Mini Latest' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4o-search-preview', label: 'GPT-4o Search Preview' },
    { id: 'gpt-4o-mini-search-preview', label: 'GPT-4o Mini Search Preview' },
    { id: 'gpt-4o-audio-preview', label: 'GPT-4o Audio Preview' },
    { id: 'gpt-4o-mini-audio-preview', label: 'GPT-4o Mini Audio Preview' },
    { id: 'gpt-4o-realtime-preview', label: 'GPT-4o Realtime Preview' },
    { id: 'gpt-4o-mini-realtime-preview', label: 'GPT-4o Mini Realtime Preview' },
    { id: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe' },
    { id: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe' },
    { id: 'gpt-4o-transcribe-diarize', label: 'GPT-4o Transcribe Diarize' },
    { id: 'gpt-4o-mini-tts', label: 'GPT-4o Mini TTS' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { id: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo Preview' },
    { id: 'gpt-4', label: 'GPT-4' },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { id: 'gpt-5-nano', label: 'GPT-5 Nano' },
    { id: 'gpt-4.5-preview', label: 'GPT-4.5 Preview' },
    { id: 'gpt-realtime', label: 'GPT Realtime' },
    { id: 'gpt-realtime-mini', label: 'GPT Realtime Mini' },
    { id: 'gpt-realtime-1.5', label: 'GPT Realtime 1.5' },
    { id: 'gpt-audio', label: 'GPT Audio' },
    { id: 'gpt-audio-mini', label: 'GPT Audio Mini' },
    { id: 'gpt-audio-1.5', label: 'GPT Audio 1.5' },
    { id: 'tts-1', label: 'TTS 1' },
    { id: 'tts-1-hd', label: 'TTS 1 HD' },
    { id: 'whisper-1', label: 'Whisper' },
    { id: 'gpt-image-1.5', label: 'GPT Image 1.5' },
    { id: 'gpt-image-1', label: 'GPT Image 1' },
    { id: 'gpt-image-1-mini', label: 'GPT Image 1 Mini' },
    { id: 'chatgpt-image-latest', label: 'ChatGPT Image Latest' },
    { id: 'dall-e-3', label: 'DALL·E 3' },
    { id: 'dall-e-2', label: 'DALL·E 2' },
    { id: 'sora-2', label: 'Sora 2' },
    { id: 'sora-2-pro', label: 'Sora 2 Pro' },
    { id: 'computer-use-preview', label: 'computer-use-preview' },
    { id: 'o3', label: 'o3' },
    { id: 'o3-mini', label: 'o3 Mini' },
    { id: 'o3-pro', label: 'o3 Pro' },
    { id: 'o3-deep-research', label: 'o3 Deep Research' },
    { id: 'o4-mini', label: 'o4 Mini' },
    { id: 'o4-mini-deep-research', label: 'o4 Mini Deep Research' },
    { id: 'o1', label: 'o1' },
    { id: 'o1-mini', label: 'o1 Mini' },
    { id: 'o1-pro', label: 'o1 Pro' },
    { id: 'o1-preview', label: 'o1 Preview' },
    { id: 'omni-moderation-latest', label: 'omni-moderation-latest' },
    { id: 'babbage-002', label: 'babbage-002' },
    { id: 'davinci-002', label: 'davinci-002' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6-20250205', label: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6-20250217', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251015', label: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet v2' },
    { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet v1' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { id: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  gemini: [
    { id: 'gemini-3-pro', label: 'Gemini 3 Pro' },
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' },
  ],
  perplexity: [
    { id: 'sonar-pro', label: 'Sonar Pro' },
    { id: 'sonar', label: 'Sonar' },
    { id: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro' },
    { id: 'sonar-reasoning', label: 'Sonar Reasoning' },
    { id: 'sonar-deep-research', label: 'Sonar Deep Research' },
    { id: 'r1-1776', label: 'R1-1776' },
  ],
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek V3' },
    { id: 'deepseek-reasoner', label: 'DeepSeek R1' },
    { id: 'deepseek-coder', label: 'DeepSeek Coder' },
  ],
  xai: [
    { id: 'grok-4.1-fast', label: 'Grok 4.1 Fast' },
    { id: 'grok-4-fast', label: 'Grok 4 Fast' },
    { id: 'grok-3', label: 'Grok 3' },
    { id: 'grok-3-fast', label: 'Grok 3 Fast' },
    { id: 'grok-3-mini', label: 'Grok 3 Mini' },
    { id: 'grok-3-mini-fast', label: 'Grok 3 Mini Fast' },
    { id: 'grok-2', label: 'Grok 2' },
    { id: 'grok-2-mini', label: 'Grok 2 Mini' },
  ],
  cohere: [
    { id: 'command-a-03-2025', label: 'Command A' },
    { id: 'command-r-plus-08-2024', label: 'Command R+ (08-2024)' },
    { id: 'command-r-plus', label: 'Command R+' },
    { id: 'command-r-08-2024', label: 'Command R (08-2024)' },
    { id: 'command-r', label: 'Command R' },
    { id: 'command', label: 'Command' },
    { id: 'command-light', label: 'Command Light' },
  ],
  openrouter: [
    { id: 'openai/gpt-5.2', label: 'GPT-5.2' },
    { id: 'openai/gpt-5', label: 'GPT-5' },
    { id: 'openai/o3', label: 'o3' },
    { id: 'openai/o3-pro', label: 'o3 Pro' },
    { id: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6' },
    { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
    { id: 'anthropic/claude-opus-4', label: 'Claude Opus 4' },
    { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
    { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet' },
    { id: 'google/gemini-3-pro', label: 'Gemini 3 Pro' },
    { id: 'google/gemini-3-flash', label: 'Gemini 3 Flash' },
    { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'x-ai/grok-4.1-fast', label: 'Grok 4.1 Fast' },
    { id: 'x-ai/grok-3', label: 'Grok 3' },
    { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
    { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick' },
    { id: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout' },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    { id: 'mistralai/mistral-large', label: 'Mistral Large' },
    { id: 'mistralai/codestral', label: 'Codestral' },
    { id: 'mistralai/mistral-small', label: 'Mistral Small' },
    { id: 'qwen/qwen3-235b-a22b', label: 'Qwen3 235B' },
    { id: 'qwen/qwen3-32b', label: 'Qwen3 32B' },
    { id: 'nousresearch/hermes-3-llama-3.1-405b', label: 'Hermes 3 405B' },
    { id: 'microsoft/phi-4', label: 'Phi-4' },
    { id: 'perplexity/sonar-pro', label: 'Sonar Pro' },
  ],
  github: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'o3-mini', label: 'o3 Mini' },
    { id: 'o1', label: 'o1' },
    { id: 'o1-mini', label: 'o1 Mini' },
    { id: 'Gemini-3.1-Pro', label: 'Gemini 3.1 Pro' },
    { id: 'Gemini-3.1-Flash', label: 'Gemini 3.1 Flash' },
    { id: 'Gemini-3.1-Flash-Lite', label: 'Gemini 3.1 Flash Lite' },
    { id: 'Gemini-3-Pro', label: 'Gemini 3 Pro' },
    { id: 'Gemini-3-Flash', label: 'Gemini 3 Flash' },
    { id: 'Gemini-3-Flash-Lite', label: 'Gemini 3 Flash Lite' },
    { id: 'Meta-Llama-3.1-405B-Instruct', label: 'Llama 3.1 405B' },
    { id: 'Meta-Llama-3.1-70B-Instruct', label: 'Llama 3.1 70B' },
    { id: 'Meta-Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B' },
    { id: 'Mistral-large-2411', label: 'Mistral Large' },
    { id: 'Mistral-small', label: 'Mistral Small' },
    { id: 'Cohere-command-r-plus', label: 'Command R+' },
    { id: 'AI21-Jamba-1.5-Large', label: 'Jamba 1.5 Large' },
    { id: 'Phi-4', label: 'Phi-4' },
    { id: 'DeepSeek-R1', label: 'DeepSeek R1' },
  ],
  meshy: [
    { id: 'text-to-3d', label: 'Text to 3D' },
    { id: 'image-to-3d', label: 'Image to 3D' },
  ],
  sloyd: [
    { id: 'text-to-3d', label: 'Text to 3D' },
  ],
  tripo: [
    { id: 'text-to-3d', label: 'Text to 3D' },
    { id: 'image-to-3d', label: 'Image to 3D' },
  ],
  modelslab: [
    { id: 'text-to-3d', label: 'Text to 3D' },
  ],
  fal: [
    { id: 'hyper3d-rodin', label: 'Hyper3D Rodin' },
    { id: 'trellis', label: 'Trellis' },
  ],
  neural4d: [
    { id: 'text-to-3d', label: 'Text to 3D' },
  ],
  stability: [
    { id: 'stable-image-core', label: 'Stable Image Core' },
    { id: 'stable-image-ultra', label: 'Stable Image Ultra' },
  ],
  ideogram: [
    { id: 'ideogram-v3', label: 'Ideogram v3' },
    { id: 'ideogram-v2', label: 'Ideogram v2' },
  ],
  runway: [
    { id: 'gen4_turbo', label: 'Gen-4 Turbo' },
    { id: 'gen3a_turbo', label: 'Gen-3 Alpha Turbo' },
  ],
  replicate: [
    { id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro (Image)' },
    { id: 'minimax/video-01', label: 'MiniMax Video-01' },
  ],
  kling: [
    { id: 'kling-v2.1', label: 'Kling v2.1' },
  ],
  higgsfield: [
    { id: 'higgsfield-does-cinema', label: 'Higgsfield Cinema' },
  ],
  luma: [
    { id: 'dream-machine', label: 'Dream Machine' },
  ],
  pika: [
    { id: 'pika-v2.2', label: 'Pika v2.2' },
  ],
};

const DAILY_LIMITS: Record<string, number> = {
  pro: 5,
  flash: 10,
  lite: -1, // unlimited
};

export const useApiKeys = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const dataProvider = useMemo(() => createDataProvider(), []);
  const [apiKeys, setApiKeys] = useState<UserApiKey[]>([]);
  const [usage, setUsage] = useState<UsageInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchApiKeys = useCallback(async () => {
    if (!user) return;
    const data = await dataProvider.listApiKeys(user.id);
    setApiKeys(data as unknown as UserApiKey[]);
  }, [user, dataProvider]);

  const fetchUsage = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const data = await dataProvider.listUsageForDate(user.id, today);
    
    const usageList: UsageInfo[] = ['pro', 'flash', 'lite'].map(tier => {
      const row = (data || []).find((d: { model_tier: string; request_count: number }) => d.model_tier === tier);
      return {
        model_tier: tier,
        request_count: row ? row.request_count : 0,
        limit: DAILY_LIMITS[tier],
      };
    });
    setUsage(usageList);
  }, [user, dataProvider]);

  useEffect(() => {
    if (user) {
      fetchApiKeys();
      fetchUsage();
    }
  }, [user, fetchApiKeys, fetchUsage]);

  const saveApiKey = useCallback(async (provider: AIProvider, apiKey: string) => {
    if (!user) return false;
    setLoading(true);
    try {
      await dataProvider.upsertApiKey(user.id, provider, apiKey);
      toast({ title: 'API key saved', description: `${PROVIDER_INFO[provider].label} key saved successfully.` });
      await fetchApiKeys();
      return true;
    } catch (err: unknown) {
      toast({ title: 'Error saving key', description: err instanceof Error ? err.message : 'Unexpected error', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, toast, fetchApiKeys, dataProvider]);

  const deleteApiKey = useCallback(async (provider: AIProvider) => {
    if (!user) return false;
    try {
      await dataProvider.deleteApiKey(user.id, provider);
      toast({ title: 'API key removed' });
      await fetchApiKeys();
      return true;
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unexpected error', variant: 'destructive' });
      return false;
    }
  }, [user, toast, fetchApiKeys, dataProvider]);

  const hasCustomKey = useCallback((provider?: AIProvider) => {
    if (provider) return apiKeys.some(k => k.provider === provider);
    return apiKeys.length > 0;
  }, [apiKeys]);

  const getUsageForTier = useCallback((tier: string) => {
    return usage.find(u => u.model_tier === tier) || { model_tier: tier, request_count: 0, limit: DAILY_LIMITS[tier] };
  }, [usage]);

  const isAtLimit = useCallback((tier: string) => {
    if (hasCustomKey()) return false; // BYOK = unlimited
    const u = getUsageForTier(tier);
    if (u.limit === -1) return false; // lite is free
    return u.request_count >= u.limit;
  }, [hasCustomKey, getUsageForTier]);

  return {
    apiKeys,
    usage,
    loading,
    saveApiKey,
    deleteApiKey,
    hasCustomKey,
    getUsageForTier,
    isAtLimit,
    fetchUsage,
    fetchApiKeys,
    DAILY_LIMITS,
  };
};
