import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Key, Trash2, ExternalLink, Eye, EyeOff, Shield, Zap, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useApiKeys, AIProvider, PROVIDER_INFO } from '@/hooks/useApiKeys';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ApiKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'gemini', 'perplexity', 'deepseek', 'xai', 'cohere', 'openrouter'];

// Format validation rules per provider
const KEY_FORMAT: Record<AIProvider, { prefix?: string[]; minLength: number; label: string }> = {
  openai: { prefix: ['sk-'], minLength: 30, label: 'sk-...' },
  anthropic: { prefix: ['sk-ant-'], minLength: 30, label: 'sk-ant-...' },
  gemini: { prefix: ['AIza'], minLength: 20, label: 'AIza...' },
  perplexity: { prefix: ['pplx-'], minLength: 20, label: 'pplx-...' },
  deepseek: { prefix: ['sk-'], minLength: 20, label: 'sk-...' },
  xai: { prefix: ['xai-'], minLength: 20, label: 'xai-...' },
  cohere: { minLength: 20, label: '20+ characters' },
  openrouter: { prefix: ['sk-or-'], minLength: 20, label: 'sk-or-...' },
};

function validateKeyFormat(provider: AIProvider, key: string): string | null {
  const rules = KEY_FORMAT[provider];
  if (!rules) return null;

  if (key.length < rules.minLength) {
    return `Key too short. ${PROVIDER_INFO[provider].label} keys are typically ${rules.minLength}+ characters`;
  }

  if (rules.prefix && !rules.prefix.some(p => key.startsWith(p))) {
    return `Invalid format. ${PROVIDER_INFO[provider].label} keys should start with ${rules.prefix.join(' or ')}`;
  }

  return null;
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

export const ApiKeysDialog = ({ open, onOpenChange }: ApiKeysDialogProps) => {
  const { apiKeys, saveApiKey, deleteApiKey, loading, getUsageForTier } = useApiKeys();
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [validation, setValidation] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string>('');

  const validateKey = async (provider: AIProvider, key: string): Promise<{ valid: boolean; error?: string }> => {
    // Step 1: Format check
    const formatError = validateKeyFormat(provider, key);
    if (formatError) return { valid: false, error: formatError };

    // Step 2: Server-side validation via edge function (avoids CORS)
    try {
      const { data, error } = await supabase.functions.invoke('validate-api-key', {
        body: { provider, apiKey: key },
      });

      if (error) {
        return { valid: false, error: 'Validation service error' };
      }

      if (data?.valid) {
        return { valid: true };
      } else {
        return { valid: false, error: data?.error || 'Invalid API key' };
      }
    } catch {
      return { valid: false, error: 'Could not verify key' };
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
