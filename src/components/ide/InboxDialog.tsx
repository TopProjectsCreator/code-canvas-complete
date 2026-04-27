import { useEffect, useMemo, useState } from 'react';
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
import { Inbox, Send, Trash2, Plus, Mail, MailOpen, ArrowLeft } from 'lucide-react';
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
  onOpenChange: (open: boolean