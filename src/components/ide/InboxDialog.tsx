import { useEffect, useMemo, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextComposer } from './RichTextComposer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { sanitizeRichText } from '@/lib/richText';
import { Inbox, Send, Trash2, Plus, Mail, MailOpen, ArrowLeft, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body_html: string;
  kind: string;
  read_at: string | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface InboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type View = 'inbox' | 'sent' | 'compose' | 'thread';

export const InboxDialog = ({ open, onOpenChange }: InboxDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<View>('inbox');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MessageRow | null>(null);

  // Compose state
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState<ProfileRow[]>([]);
  const [recipient, setRecipient] = useState<ProfileRow | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', missing);
    if (data) {
      setProfiles((prev) => {
        const next = { ...prev };
        data.forEach((p) => { next[p.user_id] = p as ProfileRow; });
        return next;
      });
    }
  }, [profiles]);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`recipient_id.eq.${user.id},sender_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast({ title: 'Failed to load messages', description: error.message, variant: 'destructive' });
      return;
    }
    const rows = (data || []) as MessageRow[];
    setMessages(rows);
    const ids = Array.from(new Set(rows.flatMap((m) => [m.sender_id, m.recipient_id])));
    loadProfiles(ids);
  }, [user, toast, loadProfiles]);

  useEffect(() => {
    if (!open) return;
    loadMessages();
  }, [open, loadMessages]);

  // Realtime updates
  useEffect(() => {
    if (!open || !user) return;
    const channel = supabase
      .channel('messages-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, user, loadMessages]);

  // Recipient search (debounced)
  useEffect(() => {
    if (!recipientQuery.trim()) { setRecipientResults([]); return; }
    const handle = setTimeout(async () => {
      const q = `%${recipientQuery.trim()}%`;
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .ilike('display_name', q)
        .limit(8);
      setRecipientResults((data || []) as ProfileRow[]);
    }, 200);
    return () => clearTimeout(handle);
  }, [recipientQuery]);

  const inbox = useMemo(
    () => messages.filter((m) => m.recipient_id === user?.id),
    [messages, user]
  );
  const sent = useMemo(
    () => messages.filter((m) => m.sender_id === user?.id),
    [messages, user]
  );
  const unreadCount = inbox.filter((m) => !m.read_at).length;

  const openMessage = async (m: MessageRow) => {
    setSelected(m);
    setView('thread');
    if (!m.read_at && m.recipient_id === user?.id) {
      await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
  };

  const deleteMessage = async (m: MessageRow) => {
    const { error } = await supabase.from('messages').delete().eq('id', m.id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    if (selected?.id === m.id) { setSelected(null); setView('inbox'); }
    toast({ title: 'Message deleted' });
  };

  const startCompose = (preset?: { recipient?: ProfileRow; subject?: string }) => {
    setRecipient(preset?.recipient ?? null);
    setRecipientQuery(preset?.recipient?.display_name ?? '');
    setSubject(preset?.subject ?? '');
    setBody('');
    setView('compose');
  };

  const replyTo = (m: MessageRow) => {
    const otherId = m.sender_id === user?.id ? m.recipient_id : m.sender_id;
    const other = profiles[otherId];
    startCompose({
      recipient: other ?? { user_id: otherId, display_name: 'User', avatar_url: null },
      subject: m.subject.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`,
    });
  };

  const send = async () => {
    if (!user) return;
    if (!recipient) {
      toast({ title: 'Pick a recipient first', variant: 'destructive' });
      return;
    }
    const cleanBody = sanitizeRichText(body);
    if (!cleanBody.replace(/<[^>]*>/g, '').trim()) {
      toast({ title: 'Message body is empty', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: recipient.user_id,
      subject: subject.trim() || '(no subject)',
      body_html: cleanBody,
      kind: 'message',
    });
    setSending(false);
    if (error) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Message sent' });
    setView('sent');
    setBody(''); setSubject(''); setRecipient(null); setRecipientQuery('');
    loadMessages();
  };

  const list = view === 'sent' ? sent : inbox;
  const otherUserOf = (m: MessageRow) =>
    m.sender_id === user?.id ? profiles[m.recipient_id] : profiles[m.sender_id];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="w-4 h-4" /> Inbox
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-1">{unreadCount} new</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
          <Button
            size="sm"
            variant={view === 'inbox' ? 'default' : 'ghost'}
            onClick={() => { setView('inbox'); setSelected(null); }}
          >
            <Mail className="w-3.5 h-3.5 mr-1" /> Inbox
          </Button>
          <Button
            size="sm"
            variant={view === 'sent' ? 'default' : 'ghost'}
            onClick={() => { setView('sent'); setSelected(null); }}
          >
            <Send className="w-3.5 h-3.5 mr-1" /> Sent
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={() => startCompose()}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Compose
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {view === 'compose' && (
            <div className="h-full flex flex-col p-4 gap-3 overflow-auto">
              <div>
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <div className="relative">
                  <Input
                    placeholder="Search by display name…"
                    value={recipientQuery}
                    onChange={(e) => { setRecipientQuery(e.target.value); setRecipient(null); }}
                  />
                  {recipient && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Sending to <span className="text-foreground font-medium">{recipient.display_name || recipient.user_id}</span>
                    </div>
                  )}
                  {!recipient && recipientResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-auto">
                      {recipientResults.map((p) => (
                        <button
                          key={p.user_id}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                          onClick={() => { setRecipient(p); setRecipientQuery(p.display_name || ''); setRecipientResults([]); }}
                        >
                          {p.display_name || p.user_id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <label className="text-xs font-medium text-muted-foreground mb-1">Message</label>
                <RichTextComposer
                  value={body}
                  onChange={setBody}
                  placeholder="Write your message…"
                  minHeightClassName="min-h-[200px]"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setView('inbox')}>Cancel</Button>
                <Button onClick={send} disabled={sending}>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </div>
          )}

          {view === 'thread' && selected && (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <Button size="sm" variant="ghost" onClick={() => { setSelected(null); setView('inbox'); }}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <div className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => replyTo(selected)}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Reply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteMessage(selected)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {selected.sender_id === user?.id ? 'To' : 'From'}: <span className="text-foreground font-medium">
                    {otherUserOf(selected)?.display_name || (selected.sender_id === user?.id ? selected.recipient_id : selected.sender_id)}
                  </span>
                  {' · '}{new Date(selected.created_at).toLocaleString()}
                </div>
                <h3 className="text-lg font-semibold mb-3">{selected.subject || '(no subject)'}</h3>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(selected.body_html) }}
                />
              </ScrollArea>
            </div>
          )}

          {(view === 'inbox' || view === 'sent') && (
            <ScrollArea className="h-full">
              {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
              {!loading && list.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  {view === 'inbox' ? 'Your inbox is empty.' : 'No sent messages yet.'}
                </div>
              )}
              {!loading && list.map((m) => {
                const other = otherUserOf(m);
                const unread = !m.read_at && m.recipient_id === user?.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => openMessage(m)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-border/60 hover:bg-accent/50 transition-colors flex items-start gap-3',
                      unread && 'bg-primary/5'
                    )}
                  >
                    <div className="mt-0.5">
                      {unread ? <Mail className="w-4 h-4 text-primary" /> : <MailOpen className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm truncate', unread && 'font-semibold')}>
                          {other?.display_name || (view === 'sent' ? m.recipient_id : m.sender_id)}
                        </span>
                        {m.kind === 'feedback' && <Badge variant="secondary" className="text-[10px]">Feedback</Badge>}
                        <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                          {new Date(m.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={cn('text-sm truncate', unread ? 'font-medium' : 'text-muted-foreground')}>
                        {m.subject || '(no subject)'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {sanitizeRichText(m.body_html).replace(/<[^>]*>/g, ' ').trim().slice(0, 120)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
