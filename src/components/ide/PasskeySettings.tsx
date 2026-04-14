import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePasskeys } from '@/hooks/usePasskeys';
import { useToast } from '@/hooks/use-toast';
import { Fingerprint, Plus, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const PasskeySettings = () => {
  const { isSupported, credentials, loading, registering, register, remove } = usePasskeys();
  const { toast } = useToast();
  const [deviceName, setDeviceName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        <p>Passkeys are not supported in this browser. Try Chrome, Safari, or Edge.</p>
      </div>
    );
  }

  const handleRegister = async () => {
    const { error } = await register(deviceName || undefined);
    if (error) {
      toast({ title: 'Passkey Error', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Passkey registered successfully' });
      setDeviceName('');
      setShowAdd(false);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    const { error } = await remove(id);
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    } else {
      toast({ title: `Passkey "${name}" removed` });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Fingerprint className="w-4 h-4 text-muted-foreground" />
          Passkeys
        </h4>
        {!showAdd && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Passkey
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Sign in faster and more securely with biometrics or your device's screen lock.
      </p>

      {showAdd && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
          <label className="text-xs font-medium">Device Name (optional)</label>
          <Input
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="e.g. MacBook Pro, iPhone"
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRegister} disabled={registering} className="gap-1.5">
              {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              {registering ? 'Registering...' : 'Register Passkey'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} disabled={registering}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading passkeys...
        </div>
      ) : credentials.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">No passkeys registered yet.</div>
      ) : (
        <div className="space-y-1.5">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{cred.device_name || 'Passkey'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Added {formatDistanceToNow(new Date(cred.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive h-7 w-7 p-0"
                onClick={() => handleRemove(cred.id, cred.device_name || 'Passkey')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
