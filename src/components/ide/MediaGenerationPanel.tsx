import { useMemo, useState } from 'react';
import { WandSparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { isReplitLikePlatform } from '@/lib/platform';
import { detectDeploymentPlatform } from '@/lib/platform';

type MediaMode = 'image' | 'video';
type ProviderId = 'openrouter' | 'openai' | 'gemini' | 'stability' | 'ideogram' | 'replicate' | 'runway' | 'kling' | 'higgsfield' | 'luma' | 'pika';

interface MediaGenerationPanelProps {
  mode: MediaMode;
  onGenerated: (value: string) => void;
}

const MODELS: Record<MediaMode, Record<ProviderId, { id: string; label: string }[]>> = {
  image: {
    openrouter: [
      { id: 'openai/gpt-image-1', label: 'GPT-Image-1' },
      { id: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
      { id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro' },
      { id: 'ideogram/ideogram-v3', label: 'Ideogram v3' },
    ],
    openai: [{ id: 'gpt-image-1', label: 'GPT-Image-1' }],
    gemini: [{ id: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image' }],
    stability: [
      { id: 'stable-image-core', label: 'Stable Image Core' },
      { id: 'stable-image-ultra', label: 'Stable Image Ultra' },
    ],
    ideogram: [
      { id: 'ideogram-v3', label: 'Ideogram v3' },
      { id: 'ideogram-v2', label: 'Ideogram v2' },
    ],
    replicate: [{ id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro (Replicate)' }],
    runway: [],
    kling: [],
    higgsfield: [],
    luma: [],
    pika: [],
  },
  video: {
    openrouter: [
      { id: 'openai/sora', label: 'OpenAI Sora' },
      { id: 'google/veo-3', label: 'Google Veo 3' },
      { id: 'kuaishou/kling-v2.1', label: 'Kling 2.1' },
    ],
    openai: [],
    gemini: [],
    stability: [],
    ideogram: [],
    replicate: [{ id: 'minimax/video-01', label: 'MiniMax Video-01 (Replicate)' }],
    runway: [
      { id: 'gen4_turbo', label: 'Runway Gen-4 Turbo' },
      { id: 'gen3a_turbo', label: 'Runway Gen-3 Alpha Turbo' },
    ],
    kling: [{ id: 'kling-v2.1', label: 'Kling 2.1' }],
    higgsfield: [{ id: 'higgsfield-does-cinema', label: 'Higgsfield Cinema' }],
    luma: [{ id: 'dream-machine', label: 'Dream Machine' }],
    pika: [{ id: 'pika-v2.2', label: 'Pika 2.2' }],
  },
};

const PROVIDERS_BY_MODE: Record<MediaMode, ProviderId[]> = {
  image: ['openrouter', 'openai', 'gemini', 'stability', 'ideogram', 'replicate'],
  video: ['openrouter', 'runway', 'kling', 'higgsfield', 'luma', 'pika', 'replicate'],
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  gemini: 'Gemini',
  stability: 'Stability AI',
  ideogram: 'Ideogram',
  replicate: 'Replicate',
  runway: 'Runway',
  kling: 'Kling',
  higgsfield: 'Higgsfield',
  luma: 'Luma',
  pika: 'Pika',
};

export const MediaGenerationPanel = ({ mode, onGenerated }: MediaGenerationPanelProps) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderId>(PROVIDERS_BY_MODE[mode][0]);
  const [model, setModel] = useState(MODELS[mode][PROVIDERS_BY_MODE[mode][0]][0]?.id || '');

  const models = useMemo(() => MODELS[mode][provider] || [], [mode, provider]);

  const handleProviderChange = (next: ProviderId) => {
    setProvider(next);
    setModel(MODELS[mode][next][0]?.id || '');
  };

  const generate = async () => {
    if (!prompt.trim() || !model) return;
    setLoading(true);
    setError(null);

    try {
      let mediaUrl: string;

      if (isReplitLikePlatform()) {
        const r = await fetch('/api/replit/ai/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, prompt: prompt.trim(), provider, model }),
        });
        const data = await r.json();
        if (!r.ok || !data?.mediaUrl) throw new Error(data?.error || 'Generation failed');
        mediaUrl = data.mediaUrl;
      } else {
        const { data, error } = await supabase.functions.invoke('generate-media-byok', {
          body: { mode, prompt: prompt.trim(), provider, model },
        });
        if (error || !data?.mediaUrl) throw new Error(error?.message || data?.error || 'Generation failed');
        mediaUrl = data.mediaUrl;
      }

      onGenerated(mediaUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl rounded-xl border border-border bg-background/90 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <WandSparkles className="h-3.5 w-3.5" />
        Generate {mode} with BYOK across top providers
      </div>
      <Input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={mode === 'image' ? 'Describe the image to generate…' : 'Describe the video scene…'}
        className="h-9"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
          className="rounded-md border border-border bg-input px-2 py-2 text-sm"
        >
          {PROVIDERS_BY_MODE[mode].map((id) => (
            <option key={id} value={id}>{PROVIDER_LABELS[id]}</option>
          ))}
        </select>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-md border border-border bg-input px-2 py-2 text-sm md:col-span-2"
        >
          {models.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.label}</option>
          ))}
        </select>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button size="sm" onClick={generate} disabled={loading || !prompt.trim() || !model} className="gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
        Generate {mode}
      </Button>
    </div>
  );
};
