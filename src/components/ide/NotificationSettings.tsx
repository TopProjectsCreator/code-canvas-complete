import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useNotifications, EmailProvider, SmsProvider } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import {
  Bell, BellRing, Mail, Eye, EyeOff, Check, Info, MessageSquare, Inbox, Users,
} from 'lucide-react';

const EMAIL_PROVIDERS: { id: EmailProvider; label: string; placeholder: string; docs: string }[] = [
  { id: 'resend', label: 'Resend', placeholder: 're_...', docs: 'https://resend.com/api-keys' },
  { id: 'mailgun', label: 'Mailgun', placeholder: 'domain:key-...', docs: 'https://app.mailgun.com/settings/api_security' },
  { id: 'postmark', label: 'Postmark', placeholder: 'Server token', docs: 'https://account.postmarkapp.com/servers' },
  { id: 'twilio', label: 'Twilio SendGrid', placeholder: 'SG....', docs: 'https://app.sendgrid.com/settings/api_keys' },
];

const SMS_PROVIDERS: {
  id: SmsProvider;
  label: string;
  fromHint: string;
  docs: string;
  sidLabel?: string;
  sidPlaceholder?: string;
  tokenLabel: string;
  tokenPlaceholder: string;
}[] = [
  {
    id: 'twilio',
    label: 'Twilio SMS',
    fromHint: '+15551234567 (E.164) or messaging service SID',
    docs: 'https://console.twilio.com',
    sidLabel: 'Account SID',
    sidPlaceholder: 'AC...',
    tokenLabel: 'Auth token',
    tokenPlaceholder: 'auth token',
  },
  {
    id: 'vonage',
    label: 'Vonage (Nexmo)',
    fromHint: 'Sender ID or +E.164 number',
    docs: 'https://dashboard.nexmo.com/settings',
    sidLabel: 'API key',
    sidPlaceholder: 'api_key',
    tokenLabel: 'API secret',
    tokenPlaceholder: 'api_secret',
  },
  {
    id: 'messagebird',
    label: 'MessageBird',
    fromHint: 'Sender ID or +E.164 number',
    docs: 'https://dashboard.messagebird.com/developers/access',
    tokenLabel: 'Access key',
    tokenPlaceholder: 'live_xxx',
  },
];

export function NotificationSettings() {
  const { settings, toggleDesktop, requestDesktopPermission, updateSettings, sendSmsNotification, sendDesktopNotification } = useNotifications();
  const [showKey, setShowKey] = useState(false);
  const [showSmsToken, setShowSmsToken] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);

  const selectedEmail = EMAIL_PROVIDERS.find(p => p.id === settings.emailProvider);
  const selectedSms = SMS_PROVIDERS.find(p => p.id === settings.smsProvider);

  const sendTestSms = async () => {
    setSmsTesting(true);
    try {
      const ok = await sendSmsNotification('Test message from your IDE notifications.');
      if (ok) sendDesktopNotification('SMS sent', `A test SMS was dispatched to ${settings.smsTo}`);
    } finally {
      setSmsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Event toggles */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4" /> What to notify me about
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
            <div className="flex items-center gap-3">
              <Inbox className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">New inbox messages</p>
                <p className="text-xs text-muted-foreground">Ping me when someone sends me a message.</p>
              </div>
            </div>
            <Switch
              checked={settings.notifyInbox}
              onCheckedChange={(v) => updateSettings({ notifyInbox: v })}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Collab events</p>
                <p className="text-xs text-muted-foreground">Invites, comments, and review updates.</p>
              </div>
            </div>
            <Switch
              checked={settings.notifyCollab}
              onCheckedChange={(v) => updateSettings({ notifyCollab: v })}
            />
          </div>
        </div>
      </div>

      {/* Desktop Notifications */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <BellRing className="w-4 h-4" /> Desktop notifications
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
            <div className="flex-1">
              <p className="text-sm font-medium">Push notifications</p>
              <p className="text-xs text-muted-foreground">
                Browser pop-ups for the events you've enabled above.
              </p>
            </div>
            <Switch
              checked={settings.desktopEnabled}
              onCheckedChange={toggleDesktop}
            />
          </div>

          {settings.desktopPermission === 'denied' && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-warning/30 bg-warning/5">
              <Info className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Notifications are blocked by your browser. Enable them in your browser settings for this site.
              </p>
            </div>
          )}

          {settings.desktopPermission === 'default' && (
            <Button variant="outline" size="sm" onClick={requestDesktopPermission} className="gap-2">
              <Bell className="w-3.5 h-3.5" /> Grant permission
            </Button>
          )}

          {settings.desktopEnabled && (
            <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/30">
              <Check className="w-3 h-3" /> Active
            </Badge>
          )}
        </div>
      </div>

      {/* Email Notifications */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4" /> Email notifications
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Send email notifications using your own email provider.
        </p>

        <div className="space-y-3">
          <Select
            value={settings.emailProvider || ''}
            onValueChange={v => updateSettings({ emailProvider: (v || null) as EmailProvider | null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select email provider" />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_PROVIDERS.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {settings.emailProvider && (
            <>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={selectedEmail?.placeholder || 'API Key'}
                  value={settings.emailApiKey}
                  onChange={e => updateSettings({ emailApiKey: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <Input
                type="email"
                placeholder="From address (e.g. noreply@yourapp.com)"
                value={settings.emailFrom}
                onChange={e => updateSettings({ emailFrom: e.target.value })}
              />

              {selectedEmail && (
                <a
                  href={selectedEmail.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Get your {selectedEmail.label} API key →
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* SMS Notifications */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> SMS notifications
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Get a text message for the events you've enabled above. Bring your own SMS provider.
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
            <div className="flex-1">
              <p className="text-sm font-medium">Send me text messages</p>
              <p className="text-xs text-muted-foreground">Standard provider rates apply.</p>
            </div>
            <Switch
              checked={settings.smsEnabled}
              onCheckedChange={(v) => updateSettings({ smsEnabled: v })}
            />
          </div>

          {settings.smsEnabled && (
            <>
              <Select
                value={settings.smsProvider || ''}
                onValueChange={v => updateSettings({ smsProvider: (v || null) as SmsProvider | null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select SMS provider" />
                </SelectTrigger>
                <SelectContent>
                  {SMS_PROVIDERS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedSms && (
                <>
                  {selectedSms.sidLabel && (
                    <Input
                      placeholder={selectedSms.sidPlaceholder || selectedSms.sidLabel}
                      value={settings.smsAccountSid}
                      onChange={e => updateSettings({ smsAccountSid: e.target.value })}
                    />
                  )}
                  <div className="relative">
                    <Input
                      type={showSmsToken ? 'text' : 'password'}
                      placeholder={selectedSms.tokenPlaceholder}
                      value={settings.smsAuthToken}
                      onChange={e => updateSettings({ smsAuthToken: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmsToken(!showSmsToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showSmsToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <Input
                    placeholder={`From: ${selectedSms.fromHint}`}
                    value={settings.smsFrom}
                    onChange={e => updateSettings({ smsFrom: e.target.value })}
                  />
                  <Input
                    placeholder="Your phone number, e.g. +15555550123"
                    value={settings.smsTo}
                    onChange={e => updateSettings({ smsTo: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <a
                      href={selectedSms.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Get your {selectedSms.label} credentials →
                    </a>
                    <div className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={smsTesting || !settings.smsTo || !settings.smsAuthToken || !settings.smsFrom}
                      onClick={sendTestSms}
                    >
                      {smsTesting ? 'Sending…' : 'Send test SMS'}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Provider info cards */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Supported email providers
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {EMAIL_PROVIDERS.map(p => (
            <div
              key={p.id}
              className={cn(
                "p-3 rounded-lg border text-center cursor-pointer transition-colors",
                settings.emailProvider === p.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/50 bg-muted/20 hover:border-border"
              )}
              onClick={() => updateSettings({ emailProvider: p.id })}
            >
              <p className="text-sm font-medium">{p.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
