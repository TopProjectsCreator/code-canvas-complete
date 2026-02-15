import { useState } from 'react';
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
import { User, Palette, Shield, Keyboard, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AccountSettingsDialog = ({ open, onOpenChange }: AccountSettingsDialogProps) => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);

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

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const themes = Object.keys(themeInfo) as IDETheme[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="gap-1.5 text-xs">
              <User className="w-3.5 h-3.5" /> Profile
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5 text-xs">
              <Palette className="w-3.5 h-3.5" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="gap-1.5 text-xs">
              <Keyboard className="w-3.5 h-3.5" /> Shortcuts
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-5 mt-0">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{displayName || 'No display name'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
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
                  <label className="text-sm font-medium">Avatar URL</label>
                  <Input
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.png"
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

            {/* Shortcuts Tab */}
            <TabsContent value="shortcuts" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium mb-3">Keyboard Shortcuts</h4>
                <div className="space-y-1">
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
