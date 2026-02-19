import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type AIProvider = 
  | 'perplexity' 
  | 'gemini' 
  | 'anthropic' 
  | 'openai' 
  | 'deepseek' 
  | 'xai' 
  | 'cohere' 
  | 'openrouter';

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
};

const DAILY_LIMITS: Record<string, number> = {
  pro: 5,
  flash: 10,
  lite: -1, // unlimited
};

export const useApiKeys = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<UserApiKey[]>([]);
  const [usage, setUsage] = useState<UsageInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchApiKeys = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', user.id);
    if (data) setApiKeys(data as unknown as UserApiKey[]);
  }, [user]);

  const fetchUsage = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('ai_usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('usage_date', today);
    
    const usageList: UsageInfo[] = ['pro', 'flash', 'lite'].map(tier => {
      const row = (data || []).find((d: any) => d.model_tier === tier);
      return {
        model_tier: tier,
        request_count: row ? (row as any).request_count : 0,
        limit: DAILY_LIMITS[tier],
      };
    });
    setUsage(usageList);
  }, [user]);

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
      const { error } = await supabase
        .from('user_api_keys')
        .upsert({ user_id: user.id, provider, api_key: apiKey }, { onConflict: 'user_id,provider' });
      if (error) throw error;
      toast({ title: 'API key saved', description: `${PROVIDER_INFO[provider].label} key saved successfully.` });
      await fetchApiKeys();
      return true;
    } catch (err: any) {
      toast({ title: 'Error saving key', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, toast, fetchApiKeys]);

  const deleteApiKey = useCallback(async (provider: AIProvider) => {
    if (!user) return false;
    try {
      await supabase.from('user_api_keys').delete().eq('user_id', user.id).eq('provider', provider);
      toast({ title: 'API key removed' });
      await fetchApiKeys();
      return true;
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return false;
    }
  }, [user, toast, fetchApiKeys]);

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
    DAILY_LIMITS,
  };
};
