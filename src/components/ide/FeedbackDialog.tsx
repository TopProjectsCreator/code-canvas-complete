import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextComposer } from './RichTextComposer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { sanitizeRichText } from '@/lib/richText';
import { MessageSquare, Send, Loader2 } from 'lucide-react';

const FEEDBACK_RECIPIENT_DISPLAY_NAME = 'Demo1';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedbackDialog = ({ open, onOpenChange }: FeedbackDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!user) {
      toast({ title: 'Sign in to send feedback', variant: 'destructive' });
      return;
    }
    const cleanBody = sanitizeRichText(body);
    if (!cleanBody.replace(/<[^>]*>/g, '').trim()) {
      toast({ title: 'Please add some feedback before sending', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      // Resolve recipient (demo1) by display name
      const { data: recipientProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('display_name', FEEDBACK_RECIPIENT_DISPLAY_NAME)
        .limit(1)
        .maybeSingle();
      if (profileErr) throw profileErr;
      if (!recipientProfile?.user_id) {
        throw new Error(`Feedback recipient "${FEEDBACK_RECIPIENT_DISPLAY_NAME}" not found.`);
      }

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: recipientProfile.user_id,
        subject: subject.trim() || 'New feedback',
        body_html: cleanBody,
        kind: 'feedback',
      });
      if (error) throw error;

      toast({ title: 'Feedback sent', description: 'Thank you! Your feedback was delivered.' });
      setSubject('');
      setBody('');
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Could not send feedback',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Send feedback
          </DialogTitle>
          <DialogDescription>
            Your feedback goes straight to the {FEEDBACK_RECIPIENT_DISPLAY_NAME} account's inbox.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subject (optional)</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this about?"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Feedback</label>
            <RichTextComposer
              value={body}
              onChange={setBody}
              placeholder="Tell us what's on your mind…"
              minHeightClassName="min-h-[180px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={sending}>
              {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
              {sending ? 'Sending…' : 'Send feedback'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
