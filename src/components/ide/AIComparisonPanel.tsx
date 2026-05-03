import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, ArrowRight, Brain, ChevronDown, Settings2, Wrench, Globe, Code, Server, Thermometer, Hash, Clock, Paperclip, Image, FileVideo, FileAudio, FileText, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PROVIDER_MODELS, AIProvider } from '@/hooks/useApiKeys';
import ReactMarkdown from 'react-markdown';
import { useAttachments } from '@/hooks/useAttachments';
import { detectDeploymentPlatform } from '@/lib/platform';

interface ModelConfig {
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  thinkingBudget: number;
  enableWebSearch: boolean;
  enableCodeExecution: boolean;
  enableMCP: boolean;
  systemPrompt: string;
}

const COMPARISON_PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'gemini', 'perplexity', 'deepseek', 'xai', 'cohere', 'openrouter', 'github'];

const defaultConfig = (provider: AIProvider, model: string): ModelConfig => ({
  provider,
  model,
  temperature: 0.7,
  maxTokens: 4096,
  thinkingBudget: 0,
  enableWebSearch: true,
  enableCodeExecution: false,
  enableMCP: true,
  systemPrompt: '',
});

function ModelConfigurator({
  label,
  config,
  onChange,
}: {
  label: string;
  config: ModelConfig;
  onChange: (c: ModelConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [modelFilter, setModelFilter] = useState('');

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>

      {/* Provider */}
      <Select
        value={config.provider}
        onValueChange={(v) => {
          const p = v as AIProvider;
          onChange({ ...config, provider: p, model: PROVIDER_MODELS[p]?.[0]?.id || '' });
        }}
      >
        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {COMPARISON_PROVIDERS.map(p => (
            <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Model */}
      <div className="space-y-2">
        <input
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          placeholder="Search models..."
          className="w-full rounded border border-border bg-input px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
        />
        <Select value={config.model} onValueChange={(v) => onChange({ ...config, model: v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(PROVIDER_MODELS[config.provider] || [])
              .filter((m) =>
                modelFilter.trim()
                  ? m.label.toLowerCase().includes(modelFilter.toLowerCase()) || m.id.toLowerCase().includes(modelFilter.toLowerCase())
                  : true
              )
              .map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Settings */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full py-1">
            <Settings2 className="w-3 h-3" />
            <span>Advanced</span>
            <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2.5 pt-1">
          {/* Temperature */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Thermometer className="w-3 h-3" /> Temperature
              </label>
              <span className="text-[10px] font-mono text-foreground">{config.temperature.toFixed(2)}</span>
            </div>
            <Slider
              value={[config.temperature]}
              onValueChange={([v]) => onChange({ ...config, temperature: v })}
              min={0}
              max={2}
              step={0.05}
              className="w-full"
            />
          </div>

          {/* Max Tokens */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Hash className="w-3 h-3" /> Max Tokens
            </label>
            <Input
              type="number"
              value={config.maxTokens}
              onChange={(e) => onChange({ ...config, maxTokens: Math.max(1, parseInt(e.target.value) || 1) })}
              className="h-6 text-xs font-mono"
              min={1}
              max={128000}
            />
          </div>

          {/* Thinking Budget */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Thinking Budget
              </label>
              <span className="text-[10px] font-mono text-foreground">
                {config.thinkingBudget === 0 ? 'Off' : `${config.thinkingBudget} tokens`}
              </span>
            </div>
            <Slider
              value={[config.thinkingBudget]}
              onValueChange={([v]) => onChange({ ...config, thinkingBudget: v })}
              min={0}
              max={32768}
              step={1024}
              className="w-full"
            />
            <p className="text-[9px] text-muted-foreground">Extended thinking (Anthropic/Gemini). 0 = disabled.</p>
          </div>

          {/* Tool Toggles */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Tools
            </label>
            <div className="space-y-1.5 pl-1">
              <label className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Globe className="w-2.5 h-2.5" /> Web Search
                </span>
                <Switch
                  checked={config.enableWebSearch}
                  onCheckedChange={(v) => onChange({ ...config, enableWebSearch: v })}
                  className="scale-75"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Code className="w-2.5 h-2.5" /> Code Execution
                </span>
                <Switch
                  checked={config.enableCodeExecution}
                  onCheckedChange={(v) => onChange({ ...config, enableCodeExecution: v })}
                  className="scale-75"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Server className="w-2.5 h-2.5" /> MCP Servers
                </span>
                <Switch
                  checked={config.enableMCP}
                  onCheckedChange={(v) => onChange({ ...config, enableMCP: v })}
                  className="scale-75"
                />
              </label>
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">System Prompt (optional)</label>
            <Textarea
              value={config.systemPrompt}
              onChange={(e) => onChange({ ...config, systemPrompt: e.target.value })}
              placeholder="Custom system instructions..."
              rows={2}
              className="text-[10px] min-h-[40px]"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const isShellEnabledForPlatform = () => detectDeploymentPlatform() === 'replit';

export function AIComparisonPanel() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const {
    attachments,
    fileInputRef,
    addFiles,
    removeAttachment,
    openFilePicker,
    clearAttachments,
    buildContentParts,
    acceptString,
  } = useAttachments();
  const [modelA, setModelA] = useState<ModelConfig>(defaultConfig('gemini', 'gemini-2.5-flash'));
  const [modelB, setModelB] = useState<ModelConfig>(defaultConfig('openai', 'gpt-4o'));
  const [responseA, setResponseA] = useState('');
  const [responseB, setResponseB] = useState('');
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [metaA, setMetaA] = useState<{ time?: number; tokens?: number }>({});
  const [metaB, setMetaB] = useState<{ time?: number; tokens?: number }>({});

  const runComparison = useCallback(async () => {
    if ((!prompt.trim() && attachments.length === 0) || !user) return;

    setResponseA('');
    setResponseB('');
    setMetaA({});
    setMetaB({});
    setLoadingA(true);
    setLoadingB(true);

    const callModel = async (
      config: ModelConfig,
      setResponse: (s: string) => void,
      setLoading: (b: boolean) => void,
      setMeta: (m: { time?: number; tokens?: number }) => void,
    ) => {
      const start = Date.now();
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              messages: [
                ...(config.systemPrompt ? [{ role: 'system', content: `SYSTEM INSTRUCTIONS ONLY:\n${config.systemPrompt}` }] : []),
                {
                  role: 'user',
                  content: attachments.length > 0 ? buildContentParts(prompt, attachments) : prompt,
                },
              ],
              currentFile: null,
              consoleErrors: null,
              workflows: null,
              agentMode: true,
              model: 'lite',
              byokProvider: config.provider,
              byokModel: config.model,
              // Pass advanced settings
              temperature: config.temperature,
              maxTokens: config.maxTokens,
              thinkingBudget: config.thinkingBudget > 0 ? config.thinkingBudget : undefined,
              enableWebSearch: config.enableWebSearch,
              enableCodeExecution: config.enableCodeExecution && isShellEnabledForPlatform(),
              enableMCP: config.enableMCP,
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
        let tokenCount = 0;

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
                tokenCount += 1; // rough approximation
                setResponse(full);
              }
            } catch {}
          }
        }
        setMeta({ time: Date.now() - start, tokens: tokenCount });
        setLoading(false);
      } catch (err) {
        setResponse(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        setLoading(false);
      }
    };

    callModel(modelA, setResponseA, setLoadingA, setMetaA);
    callModel(modelB, setResponseB, setLoadingB, setMetaB);
    clearAttachments();
  }, [prompt, modelA, modelB, user, attachments, buildContentParts, clearAttachments]);

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
        <p className="text-xs text-muted-foreground">Send the same prompt to two models side-by-side with custom settings</p>
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Enter a prompt to compare..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="text-xs"
        />

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map(att => (
              <div key={att.id} className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/50 border border-border text-[11px]">
                {att.type === 'image' ? <Image className="w-3 h-3 text-primary" /> :
                  att.type === 'video' ? <FileVideo className="w-3 h-3 text-primary" /> :
                    att.type === 'audio' ? <FileAudio className="w-3 h-3 text-primary" /> :
                      <FileText className="w-3 h-3 text-primary" />}
                <span className="max-w-[160px] truncate text-foreground">{att.name}</span>
                <button onClick={() => removeAttachment(att.id)} className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptString}
            className="hidden"
            onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = ''; } }}
          />
          <Button size="sm" variant="outline" onClick={openFilePicker} className="h-7 gap-1.5 text-xs">
            <Paperclip className="w-3.5 h-3.5" />
            Attach files
          </Button>
          <span className="text-[10px] text-muted-foreground">Images, audio, video, and PDFs are supported.</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ModelConfigurator label="Model A" config={modelA} onChange={setModelA} />
        <ModelConfigurator label="Model B" config={modelB} onChange={setModelB} />
      </div>

      <Button size="sm" onClick={runComparison} disabled={(!prompt.trim() && attachments.length === 0) || loadingA || loadingB} className="w-full gap-1.5">
        {(loadingA || loadingB) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
        Compare
      </Button>

      {(responseA || responseB || loadingA || loadingB) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3 max-h-[300px] overflow-y-auto">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {modelA.provider} / {modelA.model}
              </p>
              {metaA.time && (
                <span className="text-[9px] text-muted-foreground font-mono">
                  {(metaA.time / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            {loadingA && !responseA ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="prose prose-sm dark:prose-invert text-xs max-w-none">
                <ReactMarkdown>{responseA}</ReactMarkdown>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border p-3 max-h-[300px] overflow-y-auto">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {modelB.provider} / {modelB.model}
              </p>
              {metaB.time && (
                <span className="text-[9px] text-muted-foreground font-mono">
                  {(metaB.time / 1000).toFixed(1)}s
                </span>
              )}
            </div>
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
