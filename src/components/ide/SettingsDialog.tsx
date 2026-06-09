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
import { detectDeploymentPlatform, isReplitLikePlatform } from '@/lib/platform';
import { isInDiscord, loadDiscordPresenceConfig, saveDiscordPresenceConfig, defaultPresenceConfig } from '@/lib/discord';
import type { DiscordPresenceConfig } from '@/lib/discord';
import { 
  User, Palette, Keyboard, Check, Upload, Loader2, Key, Shield, Zap,
  ExternalLink, Eye, EyeOff, Trash2, CheckCircle, XCircle, Settings2, Server, Sparkles, Bell, Brain, BarChart3,
  Plus, Library, Download, Pencil, Share2, Gamepad2
} from 'lucide-react';
import { ThemeCreator } from './ThemeCreator';
import { ThemeLibrary } from './ThemeLibrary';
import { ThemeImportDialog, getThemeShareUrl } from './ThemeImportDialog';
import { CustomTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { MCPServersPanel, AgentSkillsPanel } from './MCPSkillsPanel';
import { NotificationSettings } from './NotificationSettings';
import { AIComparisonPanel } from './AIComparisonPanel';
import { AIUsageStats } from './AIUsageStats';
import { PasskeySettings } from './PasskeySettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

const PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'gemini', 'perplexity', 'deepseek', 'xai', 'cohere', 'openrouter', 'pollinations', 'github', 'mistral', 'groq', 'openai-compatible', 'stability', 'ideogram', 'replicate', 'runway', 'kling', 'higgsfield', 'luma', 'pika', 'meshy', 'sloyd', 'tripo', 'modelslab', 'fal', 'neural4d'];

const KEY_FORMAT: Record<AIProvider, { prefix?: string[]; minLength: number; label: string }> = {
  openai: { prefix: ['sk-'], minLength: 30, label: 'sk-...' },
  anthropic: { prefix: ['sk-ant-'], minLength: 30, label: 'sk-ant-...' },
  gemini: { prefix: ['AIza'], minLength: 20, label: 'AIza...' },
  perplexity: { prefix: ['pplx-'], minLength: 20, label: 'pplx-...' },
  deepseek: { prefix: ['sk-'], minLength: 20, label: 'sk-...' },
  xai: { prefix: ['xai-'], minLength: 20, label: 'xai-...' },
  cohere: { minLength: 20, label: '20+ characters' },
  openrouter: { prefix: ['sk-or-'], minLength: 20, label: 'sk-or-...' },
  pollinations: { prefix: ['sk_'], minLength: 12, label: 'sk_...' },
  github: { prefix: ['ghp_', 'github_pat_'], minLength: 20, label: 'ghp_... or github_pat_...' },
  mistral: { prefix: ['mistral-'], minLength: 20, label: 'mistral-...' },
  meshy: { prefix: ['msy_'], minLength: 20, label: 'msy_...' },
  sloyd: { prefix: ['sloyd_'], minLength: 20, label: 'sloyd_...' },
  tripo: { prefix: ['tsk_'], minLength: 20, label: 'tsk_...' },
  modelslab: { minLength: 20, label: '20+ characters' },
  fal: { minLength: 20, label: '20+ characters' },
  neural4d: { minLength: 20, label: '20+ characters' },
  stability: { prefix: ['sk-'], minLength: 20, label: 'sk-...' },
  ideogram: { minLength: 16, label: '16+ characters' },
  replicate: { minLength: 20, label: '20+ characters' },
  runway: { minLength: 20, label: '20+ characters' },
  kling: { minLength: 12, label: '12+ characters' },
  higgsfield: { minLength: 12, label: '12+ characters' },
  luma: { minLength: 12, label: '12+ characters' },
  pika: { minLength: 12, label: '12+ characters' },
  groq: { prefix: ['gsk_'], minLength: 20, label: 'gsk_...' },
  'openai-compatible': { minLength: 1, label: 'Any key' },
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

const POLLINATIONS_AUTH_URL = 'https://enter.pollinations.ai/authorize';
const POLLINATIONS_OAUTH_STATE_KEY = 'code-canvas:pollinations-oauth-state';
const POLLINATIONS_CLIENT_ID = import.meta.env.VITE_POLLINATIONS_CLIENT_ID as string | undefined;

function createOAuthState(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const SettingsDialog = ({ open, onOpenChange, defaultTab = 'profile' }: SettingsDialogProps) => {
  const { user, profile, updateProfile, signOut, scheduleDeletion, cancelDeletion } = useAuth();
  const { theme, setTheme, customThemes, addCustomTheme, deleteCustomTheme, updateCustomTheme } = useTheme();
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
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [validation, setValidation] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string>('');

  // Appearance sub-view state
  type AppearanceView = 'main' | 'creator' | 'library' | { type: 'edit'; theme: CustomTheme };
  const [appearanceView, setAppearanceView] = useState<AppearanceView>('main');

  type ConnectionsView = 'main' | { app: string };
  const [connectionsView, setConnectionsView] = useState<ConnectionsView>('main');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Editor settings state
  const [shellExecutorMode, setShellExecutorMode] = useState<'webcontainer' | 'wandbox'>(() => {
    if (typeof window === 'undefined') return 'webcontainer';
    const saved = window.localStorage.getItem('ide.shellExecutorMode');
    if (saved === 'wandbox' || saved === 'webcontainer') return saved;
    // Default to Wandbox on Lovable (WebContainers require COOP/COEP that Lovable preview lacks).
    return detectDeploymentPlatform() === 'lovable' ? 'wandbox' : 'webcontainer';
  });

  const [pythonExecutorMode, setPythonExecutorMode] = useState<'auto' | 'pyodide' | 'container'>(() => {
    if (typeof window === 'undefined') return 'auto';
    const saved = window.localStorage.getItem('ide.pythonExecutorMode');
    return saved === 'pyodide' || saved === 'container' ? saved : 'auto';
  });

  const [pyodideSource, setPyodideSource] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('ide.pyodideSource') || '';
  });

  // Discord presence settings state
  const [discordConfig, setDiscordConfig] = useState<DiscordPresenceConfig>(() => {
    if (typeof window === 'undefined') return defaultPresenceConfig();
    return loadDiscordPresenceConfig();
  });

  const handleDiscordConfigChange = (partial: Partial<DiscordPresenceConfig>) => {
    const next = { ...discordConfig, ...partial };
    setDiscordConfig(next);
    saveDiscordPresenceConfig(next);
  };

  const handleDiscordSectionChange = (section: 'landing' | 'editing' | 'running', field: 'enabled' | 'details' | 'state', value: boolean | string) => {
    const next = {
      ...discordConfig,
      [section]: { ...discordConfig[section], [field]: value },
    };
    setDiscordConfig(next);
    saveDiscordPresenceConfig(next);
  };

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ide.shellExecutorMode', shellExecutorMode);
    window.dispatchEvent(new Event('ide-shell-executor-mode-changed'));
  }, [shellExecutorMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ide.pythonExecutorMode', pythonExecutorMode);
    window.dispatchEvent(new Event('ide-python-executor-mode-changed'));
  }, [pythonExecutorMode]);

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || !deletePassword) return;
    setDeleting(true);
    const { error, scheduledDeletion } = await scheduleDeletion(deletePassword);
    setDeleting(false);
    if (error || !scheduledDeletion) {
      toast({ title: 'Error', description: error?.message || 'Failed to schedule deletion', variant: 'destructive' });
      return;
    }
    setShowDeleteDialog(false);
    setDeleteConfirmText('');
    setDeletePassword('');
    toast({
      title: 'Deletion scheduled',
      description: `Your account will be permanently deleted on ${new Date(scheduledDeletion).toLocaleDateString()}. Log in within 30 days to cancel.`,
      duration: 8000,
    });
  };

  // API Keys handlers
  const validateKey = async (provider: AIProvider, key: string): Promise<{ valid: boolean; error?: string }> => {
    const formatError = validateKeyFormat(provider, key);
    if (formatError) return { valid: false, error: formatError };

    if (isReplitLikePlatform()) {
      return { valid: true };
    }

    try {
      const { data, error } = await supabase.functions.invoke('validate-api-key', {
        body: { provider, apiKey: key, baseUrl: baseUrlInput.trim() || undefined },
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
    const success = await saveApiKey(editingProvider, keyInput.trim(), baseUrlInput.trim() || undefined);
    if (success) {
      setTimeout(() => {
        setEditingProvider(null);
        setKeyInput('');
        setBaseUrlInput('');
        setValidation('idle');
        setValidationError('');
      }, 800);
    }
  };

  const handleCancelKey = () => {
    setEditingProvider(null);
    setKeyInput('');
    setBaseUrlInput('');
    setValidation('idle');
    setValidationError('');
  };

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const startPollinationsOAuth = () => {
    const state = createOAuthState();
    localStorage.setItem(POLLINATIONS_OAUTH_STATE_KEY, state);
    const redirectUri = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      state,
      models: 'openai,openai-large,openai-fast,mistral,deepseek,qwen-coder',
      expiry: '30',
      budget: '25',
    });
    if (POLLINATIONS_CLIENT_ID?.startsWith('pk_')) {
      params.set('client_id', POLLINATIONS_CLIENT_ID);
    }
    window.location.assign(`${POLLINATIONS_AUTH_URL}?${params.toString()}`);
  };

  useEffect(() => {
    if (!user || typeof window === 'undefined' || !window.location.hash) return;
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const apiKey = hashParams.get('api_key');
    const error = hashParams.get('error');
    if (!apiKey && !error) return;

    const returnedState = hashParams.get('state');
    const expectedState = localStorage.getItem(POLLINATIONS_OAUTH_STATE_KEY);
    localStorage.removeItem(POLLINATIONS_OAUTH_STATE_KEY);
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);

    if (!expectedState || returnedState !== expectedState) {
      toast({ title: 'Pollinations connection blocked', description: 'OAuth state did not match. Please try connecting again.', variant: 'destructive' });
      return;
    }

    if (error) {
      toast({ title: 'Pollinations connection cancelled', description: error, variant: 'destructive' });
      return;
    }

    if (!apiKey?.startsWith('sk_')) {
      toast({ title: 'Pollinations connection failed', description: 'Pollinations did not return a valid user key.', variant: 'destructive' });
      return;
    }

    void saveApiKey('pollinations', apiKey);
  }, [user, saveApiKey, toast]);

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile" className="gap-1 text-xs">
              <User className="w-3.5 h-3.5" /> Profile
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1 text-xs">
              <Brain className="w-3.5 h-3.5" /> AI
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1 text-xs">
              <Bell className="w-3.5 h-3.5" /> Notify
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1 text-xs">
              <Palette className="w-3.5 h-3.5" /> Theme
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-1 text-xs">
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
                <PasskeySettings />
              </div>

              {/* Connections section */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium mb-3">Connections</h4>
                {connectionsView === 'main' ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => setConnectionsView({ app: 'discord' })}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                    >
                      <Gamepad2 className="w-5 h-5 text-[#5865F2]" />
                      <div>
                        <p className="text-sm font-medium">Discord</p>
                        <p className="text-xs text-muted-foreground">Rich Presence activity status</p>
                      </div>
                    </button>
                  </div>
                ) : connectionsView.app === 'discord' ? (
                  <div className="space-y-4">
                    <button
                      onClick={() => setConnectionsView('main')}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      ← Back to Connections
                    </button>
                    {!isInDiscord() ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        Discord Rich Presence is only available when running as a Discord Activity.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <h5 className="text-sm font-medium">Rich Presence</h5>

                        <label className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Show elapsed time</span>
                          <input
                            type="checkbox"
                            checked={discordConfig.showElapsedTime}
                            onChange={(e) => handleDiscordConfigChange({ showElapsedTime: e.target.checked })}
                            className="accent-primary"
                          />
                        </label>

                        <div className="border-t border-border pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium">Landing Page</h5>
                            <label className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Custom</span>
                              <input
                                type="checkbox"
                                checked={discordConfig.landing.enabled}
                                onChange={(e) => handleDiscordSectionChange('landing', 'enabled', e.target.checked)}
                                className="accent-primary"
                              />
                            </label>
                          </div>
                          {discordConfig.landing.enabled && (
                            <div className="space-y-2 pl-2 border-l-2 border-border">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Details</label>
                                <input
                                  type="text"
                                  value={discordConfig.landing.details}
                                  onChange={(e) => handleDiscordSectionChange('landing', 'details', e.target.value)}
                                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">State</label>
                                <input
                                  type="text"
                                  value={discordConfig.landing.state}
                                  onChange={(e) => handleDiscordSectionChange('landing', 'state', e.target.value)}
                                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-border pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium">Editing Files</h5>
                            <label className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Custom</span>
                              <input
                                type="checkbox"
                                checked={discordConfig.editing.enabled}
                                onChange={(e) => handleDiscordSectionChange('editing', 'enabled', e.target.checked)}
                                className="accent-primary"
                              />
                            </label>
                          </div>
                          {discordConfig.editing.enabled && (
                            <div className="space-y-2 pl-2 border-l-2 border-border">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Details</label>
                                <input
                                  type="text"
                                  value={discordConfig.editing.details}
                                  onChange={(e) => handleDiscordSectionChange('editing', 'details', e.target.value)}
                                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">State</label>
                                <input
                                  type="text"
                                  value={discordConfig.editing.state}
                                  onChange={(e) => handleDiscordSectionChange('editing', 'state', e.target.value)}
                                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-border pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium">Running Code</h5>
                            <label className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Custom</span>
                              <input
                                type="checkbox"
                                checked={discordConfig.running.enabled}
                                onChange={(e) => handleDiscordSectionChange('running', 'enabled', e.target.checked)}
                                className="accent-primary"
                              />
                            </label>
                          </div>
                          {discordConfig.running.enabled && (
                            <div className="space-y-2 pl-2 border-l-2 border-border">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Details</label>
                                <input
                                  type="text"
                                  value={discordConfig.running.details}
                                  onChange={(e) => handleDiscordSectionChange('running', 'details', e.target.value)}
                                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">State</label>
                                <input
                                  type="text"
                                  value={discordConfig.running.state}
                                  onChange={(e) => handleDiscordSectionChange('running', 'state', e.target.value)}
                                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium text-destructive mb-2">Danger Zone</h4>
                <div className="space-y-2">
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

                  {profile?.deletion_scheduled_at ? (
                    <div className="pt-2 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Account deletion scheduled for{' '}
                        {new Date(profile.deletion_scheduled_at).toLocaleDateString()}.
                        Log in within 30 days to cancel.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const { error } = await cancelDeletion();
                          if (error) {
                            toast({ title: 'Error', description: error.message, variant: 'destructive' });
                          } else {
                            toast({ title: 'Deletion cancelled' });
                          }
                        }}
                      >
                        Cancel Deletion
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        Delete Account
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* AI Tab (Keys + MCP + Skills + Compare + Stats) */}
            <TabsContent value="ai" className="space-y-6 mt-0">
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
                
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
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
                            {info.docsUrl && (
                              <a href={info.docsUrl} target="_blank" rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
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
                            ) : provider === 'pollinations' ? (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={startPollinationsOAuth}>
                                Connect
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" 
                                onClick={() => { setEditingProvider(provider); setKeyInput(''); setBaseUrlInput(''); setValidation('idle'); setValidationError(''); }}>
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

                        {!hasKey && provider === 'pollinations' && !isEditing && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            OAuth BYOK lets users authorize Code Canvas to spend their own Pollen without pasting a secret key.
                          </p>
                        )}

                        {isEditing && (
                            <div className="mt-2 space-y-1.5">
                              {provider === 'openai-compatible' && (
                                <Input
                                  value={baseUrlInput}
                                  onChange={e => { setBaseUrlInput(e.target.value); setValidation('idle'); setValidationError(''); }}
                                  placeholder="https://api.example.com/v1/chat/completions"
                                  className="h-7 text-xs font-mono"
                                />
                              )}
                              <div className="flex gap-1.5">
                                <Input 
                                  value={keyInput} 
                                  onChange={e => { setKeyInput(e.target.value); setValidation('idle'); setValidationError(''); }}
                                  placeholder={provider === 'openai-compatible' ? 'API Key (use dummy if not required)' : info.placeholder}
                                  className="h-7 text-xs font-mono"
                                  type="password"
                                />
                              <Button 
                                size="sm" 
                                className="h-7 text-xs px-3" 
                                onClick={handleSaveKey} 
                                disabled={apiLoading || validation === 'validating' || !keyInput.trim() || (provider === 'openai-compatible' && !baseUrlInput.trim())}
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

              {/* Divider */}
              <div className="border-t border-border" />

              {/* AI Comparison */}
              <AIComparisonPanel />

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Usage Stats */}
              <AIUsageStats />

              {/* Divider */}
              <div className="border-t border-border" />

              {/* MCP Servers */}
              <MCPServersPanel />

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Agent Skills */}
              <AgentSkillsPanel />
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="mt-0">
              <NotificationSettings />
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="mt-0 h-full">
              {appearanceView === 'creator' ? (
                <ThemeCreator
                  onSave={(ct) => { addCustomTheme(ct); setAppearanceView('main'); }}
                  onBack={() => setAppearanceView('main')}
                />
              ) : appearanceView === 'library' ? (
                <ThemeLibrary
                  existingThemeNames={customThemes.map(ct => ct.name)}
                  onImport={(ct) => { addCustomTheme(ct); setAppearanceView('main'); }}
                  onBack={() => setAppearanceView('main')}
                />
              ) : typeof appearanceView === 'object' && appearanceView.type === 'edit' ? (
                <ThemeCreator
                  existingTheme={appearanceView.theme}
                  onSave={(ct) => { updateCustomTheme(ct); setTheme(`custom-${ct.id}`); setAppearanceView('main'); }}
                  onBack={() => setAppearanceView('main')}
                />
              ) : (
                <div className="space-y-5">
                  {/* Built-in themes */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Built-in Themes</h4>
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

                  {/* Custom themes */}
                  {customThemes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">My Custom Themes</h4>
                      <div className="space-y-2">
                        {customThemes.map((ct) => {
                          const isActive = theme === `custom-${ct.id}`;
                          return (
                            <div
                              key={ct.id}
                              className={cn(
                                'rounded-lg border p-2.5 transition-all',
                                isActive ? 'border-primary bg-primary/5' : 'border-border'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <button
                                  className="flex items-center gap-2.5 flex-1 text-left"
                                  onClick={() => setTheme(`custom-${ct.id}`)}
                                >
                                  <div className="flex gap-0.5 shrink-0">
                                    {[ct.colors.background, ct.colors.primary, ct.colors.syntaxKeyword, ct.colors.syntaxString].map((c, i) => (
                                      <div key={i} className="w-4 h-4 rounded-sm border border-border/50" style={{ backgroundColor: c }} />
                                    ))}
                                  </div>
                                  <span className="text-sm font-medium">{ct.name}</span>
                                  {isActive && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                                </button>
                                <div className="flex items-center gap-0.5 ml-2">
                                  <button
                                    title="Share theme"
                                    onClick={() => {
                                      const url = getThemeShareUrl(ct);
                                      navigator.clipboard.writeText(url);
                                      toast({ title: 'Share link copied!' });
                                    }}
                                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    title="Edit theme"
                                    onClick={() => setAppearanceView({ type: 'edit', theme: ct })}
                                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    title="Delete theme"
                                    onClick={() => deleteCustomTheme(ct.id)}
                                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-medium mb-3">Custom Themes</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setAppearanceView('creator')}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setAppearanceView('library')}
                      >
                        <Library className="w-3.5 h-3.5" />
                        Library
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setImportDialogOpen(true)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Import
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <ThemeImportDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onImport={(ct) => { addCustomTheme(ct); setImportDialogOpen(false); }}
              />
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
                <label className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sticky scope header</span>
                  <input
                    type="checkbox"
                    checked={typeof window !== 'undefined' && localStorage.getItem('showStickyScope') === 'true'}
                    onChange={(e) => {
                      localStorage.setItem('showStickyScope', String(e.target.checked));
                      window.dispatchEvent(new Event('ide-sticky-scope-changed'));
                    }}
                    className="accent-primary"
                  />
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
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Python executor</span>
                    <select
                      value={pythonExecutorMode}
                      onChange={(e) => setPythonExecutorMode(e.target.value as 'auto' | 'pyodide' | 'container')}
                      className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                    >
                      <option value="auto">Auto (Pyodide → Container)</option>
                      <option value="pyodide">Pyodide (browser Python)</option>
                      <option value="container">Container (pip/uv, system)</option>
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto runs simple scripts in-browser via Pyodide and falls back to the cloud container for pip/uv or system imports.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Pyodide source</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={pyodideSource}
                        onChange={(e) => setPyodideSource(e.target.value)}
                        placeholder="default (pyodide/pyodide)"
                        className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground w-56"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = pyodideSource.trim();
                          if (val) window.localStorage.setItem('ide.pyodideSource', val);
                          else window.localStorage.removeItem('ide.pyodideSource');
                          window.location.reload();
                        }}
                        className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Override the Pyodide distribution. Accepts <code>owner/repo</code>, <code>owner/repo@ref</code>, a full GitHub URL, or a direct CDN URL that hosts <code>pyodide.mjs</code>. Example: <code>techsmartkids/pyodide</code>. Reloads the page on apply.
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data, including
              projects, messages, API keys, uploaded files, and settings.
              You have <strong>30 days</strong> to cancel by logging in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">
                Type <span className="font-mono text-destructive">DELETE</span> to confirm
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Enter your password</label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Password"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteConfirmText('');
                setDeletePassword('');
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConfirmText !== 'DELETE' || !deletePassword || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? 'Scheduling...' : 'Schedule Deletion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};