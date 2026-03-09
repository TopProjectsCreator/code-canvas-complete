import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type EmailProvider = 'resend' | 'mailgun' | 'postmark' | 'twilio';

export interface NotificationSettings {
  desktopEnabled: boolean;
  desktopPermission: NotificationPermission;
  emailProvider: EmailProvider | null;
  emailApiKey: string;
  emailFrom: string;
}

const STORAGE_KEY = 'ide-notification-settings';

export function useNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      desktopEnabled: false,
      desktopPermission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',
      emailProvider: null,
      emailApiKey: '',
      emailFrom: '',
    };
  });

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Request desktop notification permission
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

  const updateEmailSettings = useCallback((updates: Partial<Pick<NotificationSettings, 'emailProvider' | 'emailApiKey' | 'emailFrom'>>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Send desktop notification
  const sendDesktopNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    if (!settings.desktopEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `collab-${Date.now()}`,
    });
    if (onClick) n.onclick = onClick;
    // Auto-close after 8s
    setTimeout(() => n.close(), 8000);
  }, [settings.desktopEnabled]);

  // Send email notification via edge function
  const sendEmailNotification = useCallback(async (to: string, subject: string, body: string) => {
    if (!settings.emailProvider || !settings.emailApiKey) return false;
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

  // High-level: notify about collab event
  const notifyCollabEvent = useCallback(async (
    type: 'invite' | 'comment' | 'review_request' | 'review_update',
    details: { name: string; email?: string; projectName?: string; message?: string }
  ) => {
    const titles: Record<string, string> = {
      invite: `${details.name} invited you to collaborate`,
      comment: `${details.name} commented on your code`,
      review_request: `${details.name} requested a code review`,
      review_update: `${details.name} updated a review`,
    };

    const title = titles[type] || 'Collaboration update';
    const body = details.message || `on ${details.projectName || 'a project'}`;

    // Desktop notification
    sendDesktopNotification(title, body);

    // Email notification
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
  }, [sendDesktopNotification, sendEmailNotification, settings.emailProvider, settings.emailApiKey]);

  return {
    settings,
    toggleDesktop,
    requestDesktopPermission,
    updateEmailSettings,
    sendDesktopNotification,
    sendEmailNotification,
    notifyCollabEvent,
  };
}
