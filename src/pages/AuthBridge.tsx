import { useEffect, useState } from 'react';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';
import {
  buildHashHandoff,
  clearOutbound,
  readOutbound,
  stashOutbound,
  validateReturnUrl,
} from '@/lib/authBridge';

type Status = 'working' | 'error';

const AuthBridge = () => {
  const [status, setStatus] = useState<Status>('working');
  const [message, setMessage] = useState('Connecting to Google…');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        // Outbound mode: validate return + state, stash, kick off OAuth.
        const params = new URLSearchParams(window.location.search);
        const returnParam = params.get('return');
        const stateParam = params.get('state');

        if (!returnParam || !stateParam) {
          setStatus('error');
          setMessage('Missing return URL or state.');
          return;
        }

        const returnUrl = await validateReturnUrl(returnParam);
        if (!returnUrl) {
          setStatus('error');
          setMessage('This return host is not allowed.');
          return;
        }
        if (cancelled) return;

        stashOutbound(stateParam, returnUrl.toString());

        const result = await lovable.auth.signInWithOAuth('google', {
          redirect_uri: `${window.location.origin}/auth-bridge`,
        });
        if (result.error) {
          setStatus('error');
          setMessage(result.error.message || 'Failed to start Google sign-in.');
        }
        // If redirected, browser navigates away.
        return;
      }

      // Return mode: we have a session, forward tokens to the saved return URL.
      const { state, returnUrl: savedReturn } = readOutbound();
      if (!savedReturn) {
        setStatus('error');
        setMessage('No pending sign-in found. Please start over from your app.');
        return;
      }
      const returnUrl = await validateReturnUrl(savedReturn);
      if (!returnUrl) {
        setStatus('error');
        setMessage('Saved return host is no longer allowed.');
        return;
      }

      clearOutbound();
      const hash = buildHashHandoff({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        state,
        expiresIn: session.expires_in ?? null,
      });
      window.location.replace(returnUrl.toString().replace(/#.*$/, '') + hash);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold text-foreground">
          {status === 'working' ? 'Signing you in…' : 'Sign-in error'}
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        {status === 'error' && (
          <a href="/" className="text-sm text-primary underline underline-offset-4">
            Return home
          </a>
        )}
      </div>
    </div>
  );
};

export default AuthBridge;
