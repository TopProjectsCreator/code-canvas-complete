import { useState, useEffect, useCallback } from 'react';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type EmailProvider = 'resend' | 'mailgun' | 'postmark' | 'twilio';
export type SmsProvider = 'twilio' | 'vonage' | 'messagebird';

export interface NotificationSettingsState {
  desktopEnabled: boolean;
  desktopPermission: NotificationPermission;
  emailProvider: EmailProvider | null;
  emailApiKey: string;
  emailFrom: string;
  // New: per-event toggles
  notifyInbox: boolean;
  notifyCollab: boolean;
  // New: SMS
  smsEnabled: boolean;
  smsProvider: SmsProvider | null;
  smsAccountSid: string; // Twilio Account SID, or Vonage api_key
  smsAuthToken: string;  // Twilio Auth Token, Vonage api_secret, or MessageBird access key
  smsFrom: string;
  smsTo: string;
}

// Backwards-compatible alias
export type NotificationSettings = NotificationSettingsState;

const STORAGE_KEY = 'ide-notification-settings';

const DEFAULTS: NotificationSettingsState = {
  desktopEnabled: false,
  desktopPermission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  emailProvider: null,
  emailApiKey: '',
  emailFrom: '',
  notifyInbox: true,
  notifyCollab: true,
  smsEnabled: false,
  smsProvider: null,
  smsAccountSid: '',
  smsAuthToken: '',
  smsFrom: '',
  smsTo: '',
};

export function useNotifications() {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const { toast } = useToast();

  const [settings, setSettings] = useState<NotificationSettingsState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return DEFAULTS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const requestDesktopPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      toast({ title: 'Not supported', description: 'Desktop notifications are not supported in this browser', variant: 'destructive' });
      return;
    }
    const permission = await Notification.requestPermission();
    setSettings(prev => ({
      ...prev,
      desktopPermission: permission,
      desktopEnabled: permission === 'granted',
    }));
    if (permission === 'granted') {
      toast({ title: 'Notifications enabled', description: 'You will receive desktop notifications' });
    }
  }, [toast]);

  const toggleDesktop = useCallback(async (enabled: boolean) => {
    if (enabled && settings.desktopPermission !== 'granted') {
      await requestDesktopPermission();
      return;
    }
    setSettings(prev => ({ ...prev, desktopEnabled: enabled }));
  }, [settings.desktopPermission, requestDesktopPermission]);

  const updateSettings = useCallback((updates: Partial<NotificationSettingsState>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Kept name for backwards-compat
  const updateEmailSettings = updateSettings;

  const sendDesktopNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    if (!settings.desktopEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `ide-${Date.now()}`,
    });
    if (onClick) n.onclick = onClick;
    setTimeout(() => n.close(), 8000);
  }, [settings.desktopEnabled]);

  const sendEmailNotification = useCallback(async (to: string, subject: string, body: string) => {
    if (!settings.emailProvider || !settings.emailApiKey || !to) return false;
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.functions.invoke('send-collab-notification', {
        body: {
          provider: settings.emailProvider,
          apiKey: settings.emailApiKey,
          from: settings.emailFrom || 'noreply@ide.app',
          to,
          subject,
          html: body,
        },
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to send email notification:', err);
      return false;
    }
  }, [settings.emailProvider, settings.emailApiKey, settings.emailFrom]);

  const sendSmsNotification = useCallback(async (text: string, toOverride?: string) => {
    const to = toOverride || settings.smsTo;
    if (!settings.smsEnabled || !settings.smsProvider || !settings.smsAuthToken || !settings.smsFrom || !to) return false;
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.functions.invoke('send-sms-notification', {
        body: {
          provider: settings.smsProvider,
          accountSid: settings.smsAccountSid,
          authToken: settings.smsAuthToken,
          from: settings.smsFrom,
          to,
          body: text.slice(0, 320),
        },
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to send SMS notification:', err);
      return false;
    }
  }, [settings.smsEnabled, settings.smsProvider, settings.smsAuthToken, settings.smsAccountSid, settings.smsFrom, settings.smsTo]);

  const notifyCollabEvent = useCallback(async (
    type: 'invite' | 'comment' | 'review_request' | 'review_update',
    details: { name: string; email?: string; projectName?: string; message?: string }
  ) => {
    if (!settings.notifyCollab) return;
    const titles: Record<string, string> = {
      invite: `${details.name} invited you to collaborate`,
      comment: `${details.name} commented on your code`,
      review_request: `${details.name} requested a code review`,
      review_update: `${details.name} updated a review`,
    };
    const title = titles[type] || 'Collaboration update';
    const body = details.message || `on ${details.projectName || 'a project'}`;
    sendDesktopNotification(title, body);
    if (details.email && settings.emailProvider && settings.emailApiKey) {
      await sendEmailNotification(
        details.email,
        title,
        `<div style="font-family:sans-serif;padding:20px;">
          <h2 style="color:#6366f1;">${title}</h2>
          <p>${body}</p>
          <p style="color:#6b7280;font-size:12px;margin-top:20px;">— Sent from your IDE</p>
        </div>`
      );
    }
    await sendSmsNotification(`${title}: ${body}`);
  }, [settings.notifyCollab, sendDesktopNotification, sendEmailNotification, sendSmsNotification, settings.emailProvider, settings.emailApiKey]);

  const notifyInboxMessage = useCallback(async (
    details: { senderName: string; subject: string; preview: string; recipientEmail?: string }
  ) => {
    if (!settings.notifyInbox) return;
    const title = `New message from ${details.senderName}`;
    const body = details.subject ? `${details.subject} — ${details.preview}` : details.preview;
    sendDesktopNotification(title, body);
    if (details.recipientEmail && settings.emailProvider && settings.emailApiKey) {
      await sendEmailNotification(
        details.recipientEmail,
        title,
        `<div style="font-family:sans-serif;padding:20px;">
          <h2 style="color:#6366f1;">${title}</h2>
          <p style="font-weight:600;">${details.subject || '(no subject)'}</p>
          <p style="color:#374151;">${details.preview}</p>
          <p style="color:#6b7280;font-size:12px;margin-top:20px;">— Sent from your IDE</p>
        </div>`
      );
    }
    await sendSmsNotification(`${title}: ${body.slice(0, 240)}`);
  }, [settings.notifyInbox, sendDesktopNotification, sendEmailNotification, sendSmsNotification, settings.emailProvider, settings.emailApiKey]);

  // Suppress unused-var lint without changing behavior
  void user;

  return {
    settings,
    toggleDesktop,
    requestDesktopPermission,
    updateEmailSettings,
    updateSettings,
    sendDesktopNotification,
    sendEmailNotification,
    sendSmsNotification,
    notifyCollabEvent,
    notifyInboxMessage,
  };
}
