import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RichTextComposer } from './RichTextComposer';
import { InboxRulesManager } from './inbox/InboxRulesManager';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { sanitizeRichText } from '@/lib/richText';
import { inboxEvents } from '@/lib/inboxEvents';
import { ruleMatches, type InboxRule } from '@/lib/inboxRules';
import {
  Inbox, Send, Trash2, Plus, Mail, MailOpen, ArrowLeft, Search, Paperclip,
  Tag, X, Settings2, Download, FileText, Image as ImageIcon, Forward,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Attachment {
  name: string;
  path: string;
  size: number;
  mime: string;
}

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body_html: string;
  kind: string;
  read_at: string | null;
  created_at: string;
  labels?: string[] | null;
  attachments?: Attachment[] | null;
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

type View = 'inbox' | 'sent' | 'compose' | 'thread' | 'rules';

const ATTACHMENT_BUCKET = 'inbox-attachments';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export const InboxDialog = ({ open, onOpenChange }: InboxDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<View>('inbox');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MessageRow | null>(null);
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [rules, setRules] = useState<InboxRule[]>([]);

  // Compose state
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState<ProfileRow[]>([]);
  const [recipient, setRecipient] = useState<ProfileRow | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composeIdRef = useRef<string>(crypto.randomUUID());

  const profilesRef = useRef(profiles);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);

  const loadProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter((id) => id && !profilesRef.current[id]);
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
  }, []);

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
    const ids = Array.from(new Set(rows.flatMap((m) => [m.sender_id, m.recipient_id]).filter(Boolean)));
    loadProfiles(ids);
  }, [user, toast, loadProfiles]);

  const loadRules = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('inbox_rules' as never)
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true });
    setRules(((data || []) as unknown) as InboxRule[]);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    loadMessages();
    loadRules();
  }, [open, loadMessages, loadRules]);

  // Apply rules to a newly-arrived message (sender's perspective: recipient_id === me)
  const applyRulesToIncoming = useCallback(async (m: MessageRow) => {
    if (!user || m.recipient_id !== user.id) return;
    if (rules.length === 0) return;
    const senderName = profilesRef.current[m.sender_id]?.display_name || null;
    const evalCtx = { sender_id: m.sender_id, sender_name: senderName, subject: m.subject, body_html: m.body_html };
    let labelsToAdd: string[] = [...(m.labels || [])];
    let markRead = false;
    let toDelete = false;
    const forwards: string[] = [];
    for (const r of rules) {
      if (!ruleMatches(evalCtx, r)) continue;
      for (const a of r.actions) {
        if (a.type === 'add_label' && a.value) {
          if (!labelsToAdd.includes(a.value)) labelsToAdd.push(a.value);
        } else if (a.type === 'mark_read') {
          markRead = true;
        } else if (a.type === 'delete') {
          toDelete = true;
        } else if (a.type === 'forward' && a.value) {
          forwards.push(a.value);
        }
      }
    }
    if (toDelete) {
      await supabase.from('messages').delete().eq('id', m.id);
      return;
    }
    const patch: Record<string, unknown> = {};
    if (labelsToAdd.length !== (m.labels || []).length) patch.labels = labelsToAdd;
    if (markRead && !m.read_at) patch.read_at = new Date().toISOString();
    if (Object.keys(patch).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('messages') as any).update(patch).eq('id', m.id);
    }
    for (const fwd of forwards) {
      await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: fwd,
        subject: m.subject.startsWith('Fwd: ') ? m.subject : `Fwd: ${m.subject}`,
        body_html: `<div style="color:#888;font-size:12px">Forwarded by rule</div>${m.body_html}`,
        kind: 'message',
      });
    }
  }, [rules, user]);

  // Realtime updates
  useEffect(() => {
    if (!open || !user) return;
    const channel = supabase
      .channel('messages-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        loadMessages();
        if (payload.eventType === 'INSERT') {
          const m = payload.new as MessageRow;
          applyRulesToIncoming(m);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, user, loadMessages, applyRulesToIncoming]);

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

  const knownLabels = useMemo(() => {
    const set = new Set<string>();
    messages.forEach((m) => (m.labels || []).forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [messages]);

  const filteredList = useMemo(() => {
    const base = view === 'sent' ? sent : inbox;
    const q = search.trim().toLowerCase();
    return base.filter((m) => {
      if (labelFilter && !(m.labels || []).includes(labelFilter)) return false;
      if (!q) return true;
      const other = m.sender_id === user?.id ? profiles[m.recipient_id] : profiles[m.sender_id];
      const senderName = (other?.display_name || '').toLowerCase();
      const subj = (m.subject || '').toLowerCase();
      const bodyText = stripHtml(m.body_html || '').toLowerCase();
      return senderName.includes(q) || subj.includes(q) || bodyText.includes(q);
    });
  }, [view, sent, inbox, search, labelFilter, profiles, user]);

  const setReadState = useCallback(async (m: MessageRow, makeRead: boolean) => {
    const next = makeRead ? new Date().toISOString() : null;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: next } : x)));
    if (selected?.id === m.id) setSelected({ ...m, read_at: next });
    inboxEvents.emit('inbox:read-changed');
    const { error } = await supabase.from('messages').update({ read_at: next }).eq('id', m.id);
    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
      loadMessages();
    } else {
      inboxEvents.emit('inbox:read-changed');
    }
  }, [selected, toast, loadMessages]);

  const openMessage = async (m: MessageRow) => {
    setSelected(m);
    setView('thread');
    if (!m.read_at && m.recipient_id === user?.id) {
      await setReadState(m, true);
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
    inboxEvents.emit('inbox:read-changed');
    toast({ title: 'Message deleted' });
  };

  const toggleLabel = async (m: MessageRow, label: string) => {
    const current = m.labels || [];
    const next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, labels: next } : x)));
    if (selected?.id === m.id) setSelected({ ...m, labels: next });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('messages') as any).update({ labels: next }).eq('id', m.id);
    if (error) {
      toast({ title: 'Could not update labels', description: error.message, variant: 'destructive' });
      loadMessages();
    }
  };

  const startCompose = (preset?: { recipient?: ProfileRow; subject?: string; body?: string; attachments?: Attachment[] }) => {
    setRecipient(preset?.recipient ?? null);
    setRecipientQuery(preset?.recipient?.display_name ?? '');
    setSubject(preset?.subject ?? '');
    setBody(preset?.body ?? '');
    setComposeAttachments(preset?.attachments ?? []);
    composeIdRef.current = crypto.randomUUID();
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

  const forwardMessage = (m: MessageRow) => {
    startCompose({
      subject: m.subject.startsWith('Fwd: ') ? m.subject : `Fwd: ${m.subject}`,
      body: `<blockquote>${m.body_html}</blockquote>`,
    });
  };

  const onPickAttachments = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast({ title: `${file.name} is too large`, description: `Max ${formatBytes(MAX_ATTACHMENT_BYTES)} per file`, variant: 'destructive' });
          continue;
        }
        const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
        const path = `${user.id}/${composeIdRef.current}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
        if (error) {
          toast({ title: `Upload failed: ${file.name}`, description: error.message, variant: 'destructive' });
          continue;
        }
        uploaded.push({ name: file.name, path, size: file.size, mime: file.type || 'application/octet-stream' });
      }
      if (uploaded.length > 0) setComposeAttachments((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeComposeAttachment = async (a: Attachment) => {
    setComposeAttachments((prev) => prev.filter((x) => x.path !== a.path));
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([a.path]);
  };

  const downloadAttachment = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(a.path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not download', description: error?.message, variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const send = async () => {
    if (!user) return;
    if (!recipient) {
      toast({ title: 'Pick a recipient first', variant: 'destructive' });
      return;
    }
    const cleanBody = sanitizeRichText(body);
    if (!cleanBody.replace(/<[^>]*>/g, '').trim() && composeAttachments.length === 0) {
      toast({ title: 'Message is empty', variant: 'destructive' });
      return;
    }
    setSending(true);
    const payload: Record<string, unknown> = {
      sender_id: user.id,
      recipient_id: recipient.user_id,
      subject: subject.trim() || '(no subject)',
      body_html: cleanBody,
      kind: 'message',
    };
    if (composeAttachments.length > 0) payload.attachments = composeAttachments;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('messages') as any).insert(payload);
    setSending(false);
    if (error) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Message sent' });
    setView('sent');
    setBody(''); setSubject(''); setRecipient(null); setRecipientQuery('');
    setComposeAttachments([]);
    composeIdRef.current = crypto.randomUUID();
    loadMessages();
  };

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
          <Button
            size="sm"
            variant={view === 'rules' ? 'default' : 'ghost'}
            onClick={() => { setView('rules'); setSelected(null); }}
          >
            <Settings2 className="w-3.5 h-3.5 mr-1" /> Rules
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={() => startCompose()}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Compose
          </Button>
        </div>

        {(view === 'inbox' || view === 'sent') && (
          <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by sender, subject, or text…"
                className="h-8 pl-7 pr-7 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {knownLabels.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant={labelFilter === null ? 'secondary' : 'ghost'}
                  className="h-7 text-xs"
                  onClick={() => setLabelFilter(null)}
                >
                  All
                </Button>
                {knownLabels.map((l) => (
                  <Button
                    key={l}
                    size="sm"
                    variant={labelFilter === l ? 'secondary' : 'ghost'}
                    className="h-7 text-xs"
                    onClick={() => setLabelFilter(labelFilter === l ? null : l)}
                  >
                    <Tag className="w-3 h-3 mr-1" />{l}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

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
                  minHeightClassName="min-h-[180px]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Attachments</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Paperclip className="w-3.5 h-3.5 mr-1" />
                    {uploading ? 'Uploading…' : 'Attach files'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => onPickAttachments(e.target.files)}
                  />
                </div>
                {composeAttachments.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No files attached. Up to {formatBytes(MAX_ATTACHMENT_BYTES)} per file.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {composeAttachments.map((a) => (
                      <div key={a.path} className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1 bg-muted/40">
                        {a.mime.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        <span className="font-medium truncate max-w-[180px]">{a.name}</span>
                        <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeComposeAttachment(a)}
                          aria-label="Remove attachment"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setView('inbox')}>Cancel</Button>
                <Button onClick={send} disabled={sending || uploading}>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </div>
          )}

          {view === 'thread' && selected && (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
                <Button size="sm" variant="ghost" onClick={() => { setSelected(null); setView('inbox'); }}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <div className="flex-1" />
                {selected.recipient_id === user?.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReadState(selected, !selected.read_at)}
                  >
                    {selected.read_at ? <Mail className="w-3.5 h-3.5 mr-1" /> : <MailOpen className="w-3.5 h-3.5 mr-1" />}
                    Mark {selected.read_at ? 'unread' : 'read'}
                  </Button>
                )}
                <LabelPicker
                  selected={selected.labels || []}
                  knownLabels={knownLabels}
                  onToggle={(l) => toggleLabel(selected, l)}
                />
                <Button size="sm" variant="ghost" onClick={() => replyTo(selected)}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Reply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => forwardMessage(selected)}>
                  <Forward className="w-3.5 h-3.5 mr-1" /> Forward
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
                <h3 className="text-lg font-semibold mb-2">{selected.subject || '(no subject)'}</h3>
                {(selected.labels || []).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mb-3">
                    {(selected.labels || []).map((l) => (
                      <Badge key={l} variant="secondary" className="text-[10px]">
                        <Tag className="w-3 h-3 mr-1" />{l}
                        <button
                          type="button"
                          className="ml-1 opacity-70 hover:opacity-100"
                          onClick={() => toggleLabel(selected, l)}
                          aria-label={`Remove label ${l}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(selected.body_html) }}
                />
                {(selected.attachments || []).length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Attachments ({(selected.attachments || []).length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(selected.attachments || []).map((a) => (
                        <button
                          key={a.path}
                          type="button"
                          onClick={() => downloadAttachment(a)}
                          className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1 bg-muted/40 hover:bg-accent transition-colors"
                        >
                          {a.mime.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                          <span className="font-medium">{a.name}</span>
                          <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {view === 'rules' && (
            <InboxRulesManager knownLabels={knownLabels} />
          )}

          {(view === 'inbox' || view === 'sent') && (
            <ScrollArea className="h-full">
              {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
              {!loading && filteredList.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  {search || labelFilter
                    ? 'No messages match your filters.'
                    : view === 'inbox' ? 'Your inbox is empty.' : 'No sent messages yet.'}
                </div>
              )}
              {!loading && filteredList.map((m) => {
                const other = otherUserOf(m);
                const unread = !m.read_at && m.recipient_id === user?.id;
                const hasAttachments = (m.attachments || []).length > 0;
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
                        {hasAttachments && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                        <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                          {new Date(m.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={cn('text-sm truncate', unread ? 'font-medium' : 'text-muted-foreground')}>
                        {m.subject || '(no subject)'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {stripHtml(sanitizeRichText(m.body_html)).slice(0, 120)}
                      </div>
                      {(m.labels || []).length > 0 && (
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          {(m.labels || []).map((l) => (
                            <span
                              key={l}
                              className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                            >
                              <Tag className="w-2.5 h-2.5 mr-0.5" />{l}
                            </span>
                          ))}
                        </div>
                      )}
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

const LabelPicker = ({
  selected,
  knownLabels,
  onToggle,
}: {
  selected: string[];
  knownLabels: string[];
  onToggle: (label: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onToggle(v);
    setDraft('');
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          <Tag className="w-3.5 h-3.5 mr-1" /> Labels
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="text-xs font-medium mb-2">Apply labels</div>
        <div className="flex gap-1 mb-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            placeholder="New label…"
            className="h-7 text-xs"
          />
          <Button size="sm" className="h-7" onClick={submit}>Add</Button>
        </div>
        {knownLabels.length === 0 ? (
          <div className="text-xs text-muted-foreground">No labels yet.</div>
        ) : (
          <div className="max-h-48 overflow-auto space-y-0.5">
            {knownLabels.map((l) => {
              const isOn = selected.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => onToggle(l)}
                  className={cn(
                    'w-full text-left text-xs px-2 py-1 rounded hover:bg-accent flex items-center justify-between',
                    isOn && 'bg-accent'
                  )}
                >
                  <span className="flex items-center"><Tag className="w-3 h-3 mr-1" />{l}</span>
                  {isOn && <span className="text-primary">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
