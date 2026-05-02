import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

interface IncomingMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body_html: string;
  kind: string;
  created_at: string;
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const SEEN_KEY = 'ide-inbox-notified-ids';
const SEEN_LIMIT = 200;

const loadSeen = (): Set<string> => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};

const persistSeen = (set: Set<string>) => {
  const arr = Array.from(set).slice(-SEEN_LIMIT);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
};

/**
 * Invisible component that watches for new inbox messages and dispatches
 * desktop / email / SMS notifications via the user's configured providers.
 */
export const InboxNotifier = () => {
  const auth = useOptionalAuth();
  const { notifyInboxMessage, settings } = useNotifications();
  const user = auth?.user ?? null;
  const seenRef = useRef<Set<string>>(loadSeen());
  // Stash the latest notify fn in a ref so the realtime channel doesn't
  // resubscribe every time settings change.
  const notifyRef = useRef(notifyInboxMessage);
  useEffect(() => { notifyRef.current = notifyInboxMessage; }, [notifyInboxMessage]);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const userEmail = user.email || undefined;

    const channel = supabase
      .channel(`inbox-notifier-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}` },
        async (payload) => {
          const m = payload.new as IncomingMessage;
          if (!m || !m.id) return;
          if (seenRef.current.has(m.id)) return;
          seenRef.current.add(m.id);
          persistSeen(seenRef.current);

          // Skip notifications for messages we sent to ourselves.
          if (m.sender_id === userId) return;

          // Resolve the sender's display name for a friendlier message.
          let senderName = 'Someone';
          try {
            const { data } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', m.sender_id)
              .maybeSingle();
            if (data?.display_name) senderName = data.display_name;
          } catch { /* ignore */ }

          const preview = stripHtml(m.body_html || '').slice(0, 160);
          notifyRef.current({
            senderName,
            subject: m.subject || '',
            preview,
            recipientEmail: userEmail,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // We intentionally only depend on `user` to keep the realtime channel
    // alive across notification-settings tweaks. Settings are read through the ref.
  }, [user]);

  // Reading settings here makes the hook re-render when they change so the ref stays current,
  // but we don't need to subscribe to anything else.
  void settings;
  return null;
};
