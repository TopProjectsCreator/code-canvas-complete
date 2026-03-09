import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRight, Brain } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PROVIDER_MODELS, AIProvider } from '@/hooks/useApiKeys';
import ReactMarkdown from 'react-markdown';

interface ModelConfig {
  provider: AIProvider;
  model: string;
}

const COMPARISON_PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'gemini', 'perplexity', 'deepseek', 'xai', 'cohere', 'openrouter', 'github'];

export function AIComparisonPanel() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [modelA, setModelA] = useState<ModelConfig>({ provider: 'gemini', model: 'gemini-2.5-flash' });
  const [modelB, setModelB] = useState<ModelConfig>({ provider: 'openai', model: 'gpt-4o' });
  const [responseA, setResponseA] = useState('');
  const [responseB, setResponseB] = useState('');
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  const runComparison = useCallback(async () => {
    if (!prompt.trim() || !user) return;

    setResponseA('');
    setResponseB('');
    setLoadingA(true);
    setLoadingB(true);

    const callModel = async (
      config: ModelConfig,
      setResponse: (s: string) => void,
      setLoading: (b: boolean) => void
    ) => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;

        const byokProvider = config.provider;
        const byokModel = config.model;
        const model = 'lite';

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              messages: [{ role: 'user', content: prompt }],
              currentFile: null,
              consoleErrors: null,
              workflows: null,
              agentMode: false,
              model,
              byokProvider,
              byokModel,
            }),
          }
        );

        if (!res.ok) {
          setResponse(`Error: ${res.status} ${res.statusText}`);
          setLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) { setLoading(false); return; }
        const decoder = new TextDecoder();
        let full = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (json === '[DONE]') break;
            try {
              const parsed = JSON.parse(json);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                full += content;
                setResponse(full);
              }
            } catch {}
          }
        }
        setLoading(false);
      } catch (err) {
        setResponse(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        setLoading(false);
      }
    };

    callModel(modelA, setResponseA, setLoadingA);
    callModel(modelB, setResponseB, setLoadingB);
  }, [prompt, modelA, modelB, user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Brain className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">Sign in to compare AI models</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-1">Compare AI Models</h4>
        <p className="text-xs text-muted-foreground">Send the same prompt to two models side-by-side</p>
      </div>

      <Textarea
        placeholder="Enter a prompt to compare..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        className="text-xs"
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Model A */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Model A</label>
          <Select value={modelA.provider} onValueChange={(v) => {
            const p = v as AIProvider;
            setModelA({ provider: p, model: PROVIDER_MODELS[p]?.[0]?.id || '' });
          }}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPARISON_PROVIDERS.map(p => (
                <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={modelA.model} onValueChange={(v) => setModelA(prev => ({ ...prev, model: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(PROVIDER_MODELS[modelA.provider] || []).map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model B */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Model B</label>
          <Select value={modelB.provider} onValueChange={(v) => {
            const p = v as AIProvider;
            setModelB({ provider: p, model: PROVIDER_MODELS[p]?.[0]?.id || '' });
          }}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPARISON_PROVIDERS.map(p => (
                <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={modelB.model} onValueChange={(v) => setModelB(prev => ({ ...prev, model: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(PROVIDER_MODELS[modelB.provider] || []).map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button size="sm" onClick={runComparison} disabled={!prompt.trim() || loadingA || loadingB} className="w-full gap-1.5">
        {(loadingA || loadingB) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
        Compare
      </Button>

      {(responseA || responseB || loadingA || loadingB) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3 max-h-[200px] overflow-y-auto">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              {modelA.provider} / {modelA.model}
            </p>
            {loadingA && !responseA ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="prose prose-sm dark:prose-invert text-xs max-w-none">
                <ReactMarkdown>{responseA}</ReactMarkdown>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border p-3 max-h-[200px] overflow-y-auto">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              {modelB.provider} / {modelB.model}
            </p>
            {loadingB && !responseB ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="prose prose-sm dark:prose-invert text-xs max-w-none">
                <ReactMarkdown>{responseB}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
