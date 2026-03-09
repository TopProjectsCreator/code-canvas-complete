import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, themeInfo, IDETheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { useApiKeys, AIProvider, PROVIDER_INFO } from '@/hooks/useApiKeys';
import { supabase } from '@/integrations/supabase/client';
import { 
  User, Palette, Keyboard, Check, Upload, Loader2, Key, Shield, Zap,
  ExternalLink, Eye, EyeOff, Trash2, CheckCircle, XCircle, Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

const PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'gemini', 'perplexity', 'deepseek', 'xai', 'cohere', 'openrouter', 'github', 'meshy', 'sloyd', 'tripo', 'modelslab', 'fal', 'neural4d'];

const KEY_FORMAT: Record<AIProvider, { prefix?: string[]; minLength: number; label: string }> = {
  openai: { prefix: ['sk-'], minLength: 30, label: 'sk-...' },
  anthropic: { prefix: ['sk-ant-'], minLength: 30, label: 'sk-ant-...' },
  gemini: { prefix: ['AIza'], minLength: 20, label: 'AIza...' },
  perplexity: { prefix: ['pplx-'], minLength: 20, label: 'pplx-...' },
  deepseek: { prefix: ['sk-'], minLength: 20, label: 'sk-...' },
  xai: { prefix: ['xai-'], minLength: 20, label: 'xai-...' },
  cohere: { minLength: 20, label: '20+ characters' },
  openrouter: { prefix: ['sk-or-'], minLength: 20, label: 'sk-or-...' },
  github: { prefix: ['ghp_', 'github_pat_'], minLength: 20, label: 'ghp_... or github_pat_...' },
  meshy: { prefix: ['msy_'], minLength: 20, label: 'msy_...' },
  sloyd: { prefix: ['sloyd_'], minLength: 20, label: 'sloyd_...' },
  tripo: { prefix: ['tsk_'], minLength: 20, label: 'tsk_...' },
  modelslab: { minLength: 20, label: '20+ characters' },
  fal: { minLength: 20, label: '20+ characters' },
  neural4d: { minLength: 20, label: '20+ characters' },
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

export const SettingsDialog = ({ open, onOpenChange, defaultTab = 'profile' }: SettingsDialogProps) => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { apiKeys, saveApiKey, deleteApiKey, loading: apiLoading, getUsageForTier, fetchApiKeys } = useApiKeys();
  
  // Profile state
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Keys state
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [validation, setValidation] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string>('');

  // Editor settings state
  const [shellExecutorMode, setShellExecutorMode] = useState<'webcontainer' | 'wandbox'>(() => {
    if (typeof window === 'undefined') return 'webcontainer';
    const saved = window.localStorage.getItem('ide.shellExecutorMode');
    return saved === 'wandbox' ? 'wandbox' : 'webcontainer';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ide.shellExecutorMode', shellExecutorMode);
    window.dispatchEvent(new Event('ide-shell-executor-mode-changed'));
  }, [shellExecutorMode]);

  // Refresh API keys when dialog opens
  useEffect(() => {
    if (open) {
      fetchApiKeys();
    }
  }, [open, fetchApiKeys]);

  // Profile handlers
  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await updateProfile({
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated' });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 2MB allowed', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setAvatarUrl(publicUrl);
    await updateProfile({ avatar_url: publicUrl });
    setUploading(false);
    toast({ title: 'Avatar updated' });
    e.target.value = '';
  };

  // API Keys handlers
  const validateKey = async (provider: AIProvider, key: string): Promise<{ valid: boolean; error?: string }> => {
    const formatError = validateKeyFormat(provider, key);
    if (formatError) return { valid: false, error: formatError };

    try {
      const { data, error } = await supabase.functions.invoke('validate-api-key', {
        body: { provider, apiKey: key },
      });

      if (error) return { valid: false, error: 'Validation service error' };
      if (data?.valid) return { valid: true };
      return { valid: false, error: data?.error || 'Invalid API key' };
    } catch {
      return { valid: false, error: 'Could not verify key' };
    }
  };

  const handleSaveKey = async () => {
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

  const handleCancelKey = () => {
    setEditingProvider(null);
    setKeyInput('');
    setValidation('idle');
    setValidationError('');
  };

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const themes = Object.keys(themeInfo) as IDETheme[];
  const existingKeys = new Set(apiKeys.map(k => k.provider));
  
  const tiers = [
    { id: 'pro', label: 'Pro', icon: '💎', limit: 5 },
    { id: 'flash', label: 'Flash', icon: '🔥', limit: 10 },
    { id: 'lite', label: 'Lite', icon: '⚡', limit: -1 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="gap-1.5 text-xs">
              <User className="w-3.5 h-3.5" /> Profile
            </TabsTrigger>
            <TabsTrigger value="apikeys" className="gap-1.5 text-xs">
              <Key className="w-3.5 h-3.5" /> API Keys
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5 text-xs">
              <Palette className="w-3.5 h-3.5" /> Theme
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-1.5 text-xs">
              <Keyboard className="w-3.5 h-3.5" /> Editor
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4 pr-2">
            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-5 mt-0">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {uploading ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{displayName || 'No display name'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-primary hover:underline"
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Change avatar'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input value={user?.email || ''} disabled className="opacity-60" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} disabled={saving} size="sm">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium text-destructive mb-2">Danger Zone</h4>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    signOut();
                    onOpenChange(false);
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </TabsContent>

            {/* API Keys Tab */}
            <TabsContent value="apikeys" className="space-y-4 mt-0">
              {/* Rate Limits */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  Daily Limits (Built-in AI)
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {tiers.map(tier => {
                    const usage = getUsageForTier(tier.id);
                    const isUnlimited = tier.limit === -1;
                    return (
                      <div key={tier.id} className="rounded-lg border border-border p-2.5 text-center">
                        <div className="text-lg">{tier.icon}</div>
                        <div className="text-xs font-medium">{tier.label}</div>
                        <div className={cn('text-[10px] mt-1', isUnlimited ? 'text-green-500' : 'text-muted-foreground')}>
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
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                  Your API Keys (BYOK)
                </h4>
                
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
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
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500">Connected</span>
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
                                onClick={handleSaveKey} 
                                disabled={apiLoading || !keyInput.trim() || validation === 'validating'}
                              >
                                {validation === 'validating' ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : validation === 'valid' ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  'Save'
                                )}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={handleCancelKey}>
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
                              <p className="text-[10px] text-green-500 flex items-center gap-1">
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
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium mb-3">Editor Theme</h4>
                <div className="grid grid-cols-2 gap-2">
                  {themes.map((t) => {
                    const info = themeInfo[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all',
                          theme === t
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{info.name}</span>
                          {theme === t && <Check className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <span className="text-xs text-muted-foreground">{info.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Editor Tab */}
            <TabsContent value="editor" className="space-y-4 mt-0">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Editor Settings</h4>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto-save</span>
                  <input type="checkbox" defaultChecked className="accent-primary" />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Word wrap</span>
                  <input type="checkbox" defaultChecked className="accent-primary" />
                </label>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Shell executor</span>
                    <select
                      value={shellExecutorMode}
                      onChange={(e) => setShellExecutorMode(e.target.value as 'webcontainer' | 'wandbox')}
                      className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                    >
                      <option value="webcontainer">WebContainer (browser Node.js)</option>
                      <option value="wandbox">Wandbox API</option>
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use WebContainer for native Node.js shell commands in browser, or switch back to Wandbox routing.
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium mb-3">Keyboard Shortcuts</h4>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {[
                    { keys: 'Ctrl+S', action: 'Save project' },
                    { keys: 'Ctrl+P', action: 'Quick file open' },
                    { keys: 'Ctrl+Shift+F', action: 'Search in files' },
                    { keys: 'Ctrl+`', action: 'Toggle terminal' },
                    { keys: 'Ctrl+B', action: 'Toggle sidebar' },
                    { keys: 'Ctrl+/', action: 'Toggle comment' },
                    { keys: 'Ctrl+Z', action: 'Undo' },
                    { keys: 'Ctrl+Shift+Z', action: 'Redo' },
                    { keys: 'Ctrl+D', action: 'Select next occurrence' },
                    { keys: 'Ctrl+H', action: 'Find and replace' },
                    { keys: 'F5', action: 'Run code' },
                    { keys: 'Ctrl+Enter', action: 'Run current file' },
                  ].map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/50"
                    >
                      <span className="text-sm text-muted-foreground">{shortcut.action}</span>
                      <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};