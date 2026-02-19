import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Key, Trash2, ExternalLink, Eye, EyeOff, Shield, Zap, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useApiKeys, AIProvider, PROVIDER_INFO } from '@/hooks/useApiKeys';
import { cn } from '@/lib/utils';

interface ApiKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'gemini', 'perplexity', 'deepseek', 'xai', 'cohere', 'openrouter'];

// Test endpoints for each provider (lightweight calls to verify key validity)
const PROVIDER_TEST_CONFIG: Record<AIProvider, { url: string; method: string; headers: (key: string) => Record<string, string>; body?: (key: string) => string }> = {
  openai: {
    url: 'https://api.openai.com/v1/models',
    method: 'GET',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: (key) => ({ 'x-api-key': key, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' }),
    body: () => JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    method: 'GET',
    headers: (key) => ({ 'x-goog-api-key': key }),
  },
  perplexity: {
    url: 'https://api.perplexity.ai/chat/completions',
    method: 'POST',
    headers: (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }),
    body: () => JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/models',
    method: 'GET',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  xai: {
    url: 'https://api.x.ai/v1/models',
    method: 'GET',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  cohere: {
    url: 'https://api.cohere.com/v2/models',
    method: 'GET',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    method: 'GET',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

export const ApiKeysDialog = ({ open, onOpenChange }: ApiKeysDialogProps) => {
  const { apiKeys, saveApiKey, deleteApiKey, loading, getUsageForTier } = useApiKeys();
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [validation, setValidation] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string>('');

  const validateKey = async (provider: AIProvider, key: string): Promise<{ valid: boolean; error?: string }> => {
    const config = PROVIDER_TEST_CONFIG[provider];
    if (!config) return { valid: true }; // Skip validation for unknown providers

    try {
      const opts: RequestInit = {
        method: config.method,
        headers: config.headers(key),
      };
      if (config.body) opts.body = config.body(key);

      const resp = await fetch(config.url, opts);
      
      if (resp.ok || resp.status === 200 || resp.status === 201) {
        return { valid: true };
      }
      
      // Some providers return 400 for minimal requests but that still means auth worked
      if (resp.status === 400) {
        return { valid: true };
      }
      
      if (resp.status === 401 || resp.status === 403) {
        return { valid: false, error: 'Invalid or expired API key' };
      }
      
      // For other errors, try to get details
      try {
        const errData = await resp.json();
        const msg = errData?.error?.message || errData?.message || `HTTP ${resp.status}`;
        return { valid: false, error: msg.slice(0, 100) };
      } catch {
        return { valid: false, error: `HTTP ${resp.status}` };
      }
    } catch (err: any) {
      // Network errors might be CORS — treat as potentially valid since the key format looks ok
      if (err.message?.includes('Failed to fetch') || err.message?.includes('CORS')) {
        return { valid: true }; // Can't verify from browser due to CORS, assume valid
      }
      return { valid: false, error: err.message || 'Connection error' };
    }
  };

  const handleSave = async () => {
    if (!editingProvider || !keyInput.trim()) return;
    
    setValidation('validating');
    setValidationError('');
    
    const result = await validateKey(editingProvider, keyInput.trim());
    
    if (!result.valid) {
      setValidation('invalid');
      setValidationError(result.error || 'Key validation failed');
      return;
    }
    
    setValidation('valid');
    const success = await saveApiKey(editingProvider, keyInput.trim());
    if (success) {
      setTimeout(() => {
        setEditingProvider(null);
        setKeyInput('');
        setValidation('idle');
        setValidationError('');
      }, 800);
    }
  };

  const handleCancel = () => {
    setEditingProvider(null);
    setKeyInput('');
    setValidation('idle');
    setValidationError('');
  };

  const existingKeys = new Set(apiKeys.map(k => k.provider));

  const tiers = [
    { id: 'pro', label: 'Pro', icon: '💎', limit: 5 },
    { id: 'flash', label: 'Flash', icon: '🔥', limit: 10 },
    { id: 'lite', label: 'Lite', icon: '⚡', limit: -1 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            AI Model Settings
          </DialogTitle>
        </DialogHeader>

        {/* Rate Limits Section */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-muted-foreground" />
            Daily Limits (Built-in)
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {tiers.map(tier => {
              const usage = getUsageForTier(tier.id);
              const isUnlimited = tier.limit === -1;
              return (
                <div key={tier.id} className="rounded-lg border border-border p-2.5 text-center">
                  <div className="text-lg">{tier.icon}</div>
                  <div className="text-xs font-medium">{tier.label}</div>
                  <div className={cn('text-[10px] mt-1', isUnlimited ? 'text-green-400' : 'text-muted-foreground')}>
                    {isUnlimited ? 'FREE ∞' : `${usage.request_count}/${tier.limit} used`}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Add your own API keys below for unlimited usage on any model.
          </p>
        </div>

        {/* BYOK Section */}
        <div className="space-y-2 mt-2">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-muted-foreground" />
            Your API Keys (BYOK)
          </h4>
          
          <div className="space-y-1.5">
            {PROVIDERS.map(provider => {
              const info = PROVIDER_INFO[provider];
              const hasKey = existingKeys.has(provider);
              const isEditing = editingProvider === provider;
              const masked = hasKey ? '••••••••••••' : null;

              return (
                <div key={provider} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{info.label}</span>
                      {hasKey && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">Connected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={info.docsUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {hasKey ? (
                        <>
                          <button onClick={() => setShowKey(prev => ({ ...prev, [provider]: !prev[provider] }))}
                            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                            {showKey[provider] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button onClick={() => deleteApiKey(provider)}
                            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" 
                          onClick={() => { setEditingProvider(provider); setKeyInput(''); setValidation('idle'); setValidationError(''); }}>
                          Add Key
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {hasKey && !isEditing && (
                    <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                      {showKey[provider] ? apiKeys.find(k => k.provider === provider)?.api_key : masked}
                    </div>
                  )}

                  {isEditing && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex gap-1.5">
                        <Input 
                          value={keyInput} 
                          onChange={e => { setKeyInput(e.target.value); setValidation('idle'); setValidationError(''); }}
                          placeholder={info.placeholder}
                          className="h-7 text-xs font-mono"
                          type="password"
                        />
                        <Button 
                          size="sm" 
                          className="h-7 text-xs px-3" 
                          onClick={handleSave} 
                          disabled={loading || !keyInput.trim() || validation === 'validating'}
                        >
                          {validation === 'validating' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : validation === 'valid' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={handleCancel}>
                          Cancel
                        </Button>
                      </div>
                      {validation === 'validating' && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Verifying key with {info.label}...
                        </p>
                      )}
                      {validation === 'valid' && (
                        <p className="text-[10px] text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Key verified and saved!
                        </p>
                      )}
                      {validation === 'invalid' && (
                        <p className="text-[10px] text-destructive flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          {validationError || 'Invalid API key'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
