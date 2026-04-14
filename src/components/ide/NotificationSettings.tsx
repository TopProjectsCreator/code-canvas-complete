import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useNotifications, EmailProvider } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import {
  Bell, BellRing, Mail, Eye, EyeOff, Check, Info,
} from 'lucide-react';

const EMAIL_PROVIDERS: { id: EmailProvider; label: string; placeholder: string; docs: string }[] = [
  { id: 'resend', label: 'Resend', placeholder: 're_...', docs: 'https://resend.com/api-keys' },
  { id: 'mailgun', label: 'Mailgun', placeholder: 'domain:key-...', docs: 'https://app.mailgun.com/settings/api_security' },
  { id: 'postmark', label: 'Postmark', placeholder: 'Server token', docs: 'https://account.postmarkapp.com/servers' },
  { id: 'twilio', label: 'Twilio SendGrid', placeholder: 'SG....', docs: 'https://app.sendgrid.com/settings/api_keys' },
];

export function NotificationSettings() {
  const { settings, toggleDesktop, requestDesktopPermission, updateEmailSettings } = useNotifications();
  const [showKey, setShowKey] = useState(false);

  const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === settings.emailProvider);

  return (
    <div className="space-y-6">
      {/* Desktop Notifications */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <BellRing className="w-4 h-4" /> Desktop Notifications
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
            <div className="flex-1">
              <p className="text-sm font-medium">Push notifications</p>
              <p className="text-xs text-muted-foreground">
                Get notified about collab invites, comments, and reviews
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
              <Bell className="w-3.5 h-3.5" /> Grant Permission
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
          <Mail className="w-4 h-4" /> Email Notifications
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Send email notifications for collab events using your own email provider
        </p>

        <div className="space-y-3">
          <Select
            value={settings.emailProvider || ''}
            onValueChange={v => updateEmailSettings({ emailProvider: (v || null) as EmailProvider | null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select email provider" />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_PROVIDERS.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {settings.emailProvider && (
            <>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={selectedProvider?.placeholder || 'API Key'}
                  value={settings.emailApiKey}
                  onChange={e => updateEmailSettings({ emailApiKey: e.target.value })}
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
                onChange={e => updateEmailSettings({ emailFrom: e.target.value })}
              />

              {selectedProvider && (
                <a
                  href={selectedProvider.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Get your {selectedProvider.label} API key →
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* Provider info cards */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Supported Providers
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
              onClick={() => updateEmailSettings({ emailProvider: p.id })}
            >
              <p className="text-sm font-medium">{p.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
