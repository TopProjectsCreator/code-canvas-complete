import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, Shield } from 'lucide-react';

interface ExternalOAuthConsentProps {
  clientName: string;
  userEmail: string;
  userAvatar: string | null;
  userDisplayName: string | null;
  onContinue: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ExternalOAuthConsent = ({
  clientName,
  userEmail,
  userAvatar,
  userDisplayName,
  onContinue,
  onCancel,
  loading = false,
}: ExternalOAuthConsentProps) => {
  const initials = (userDisplayName || userEmail)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Shield className="w-5 h-5" />
        <span className="text-sm font-medium">Sign in with Code Canvas</span>
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          Allow this app to access your Code Canvas account?
        </p>
        <p className="text-lg font-semibold text-foreground">{clientName}</p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border p-4 w-full max-w-sm">
        <Avatar className="w-10 h-10">
          <AvatarImage src={userAvatar || undefined} alt={userDisplayName || userEmail} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {userDisplayName || 'User'}
          </p>
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
        </div>
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
      </div>

      <div className="w-full max-w-sm space-y-2">
        <p className="text-xs text-muted-foreground font-medium">This will allow {clientName} to:</p>
        <ul className="space-y-1.5">
          {['View your email address', 'View your display name', 'View your avatar'].map((perm) => (
            <li key={perm} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{perm}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3 w-full max-w-sm">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={onContinue} disabled={loading}>
          {loading ? 'Redirecting…' : 'Continue'}
        </Button>
      </div>
    </div>
  );
};
