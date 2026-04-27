import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { SettingsDialog } from './SettingsDialog';
import { TeamAdminDialog } from './team/TeamAdminDialog';
import { InboxDialog } from './InboxDialog';
import { FeedbackDialog } from './FeedbackDialog';
import { supabase } from '@/integrations/supabase/client';
import { inboxEvents } from '@/lib/inboxEvents';
import { User, LogOut, Settings, FolderOpen, Key, Users, Inbox, MessageSquare } from 'lucide-react';

interface UserMenuProps {
  onOpenProjects: () => void;
}

interface UserMenuProps {
  onOpenProjects: () => void;
}

export const UserMenu = ({ onOpenProjects }: UserMenuProps) => {
  const { user, profile, signOut, loading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTeamAdmin, setShowTeamAdmin] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settingsTab, setSettingsTab] = useState('profile');

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    let cancelled = false;
    const refresh = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null);
      if (!cancelled) setUnreadCount(count ?? 0);
    };
    refresh();
    const channel = supabase
      .channel('usermenu-inbox-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, refresh)
      .subscribe();
    const offRead = inboxEvents.on('inbox:read-changed', refresh);
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      offRead();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!user) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAuthDialog(true)}
          className="gap-2"
        >
          <User className="w-4 h-4" />
          <span className="hidden sm:inline">Sign In</span>
        </Button>
        <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
      </>
    );
  }

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  const openSettings = (tab: string) => {
    setSettingsTab(tab);
    setShowSettings(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-accent transition-colors">
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">{profile?.display_name || 'User'}</span>
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenProjects}>
            <FolderOpen className="w-4 h-4 mr-2" />
            My Projects
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowInbox(true)}>
            <Inbox className="w-4 h-4 mr-2" />
            Inbox
            {unreadCount > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowFeedback(true)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Send Feedback
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSettings('profile')}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSettings('ai')}>
            <Key className="w-4 h-4 mr-2" />
            AI Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowTeamAdmin(true)}>
            <Users className="w-4 h-4 mr-2" />
            Team Management
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} defaultTab={settingsTab} />
      <TeamAdminDialog open={showTeamAdmin} onOpenChange={setShowTeamAdmin} />
      <InboxDialog open={showInbox} onOpenChange={setShowInbox} />
      <FeedbackDialog open={showFeedback} onOpenChange={setShowFeedback} />
    </>
  );
};