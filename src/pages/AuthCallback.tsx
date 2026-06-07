import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { clearOutbound, readOutbound } from '@/lib/authBridge';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Finishing sign-in…');

  useEffect(() => {
    const run = async () => {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const state = params.get('state');
      const type = params.get('type');

      if (!accessToken || !refreshToken) {
        setMessage('Missing tokens in callback URL.');
        return;
      }

      const { state: expectedState, intendedPath } = readOutbound();
      // State check only applies to OAuth flow (recovery links have no state).
      if (expectedState && state && expectedState !== state) {
        setMessage('Sign-in state did not match. Please try again.');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        setMessage(error.message || 'Failed to set session.');
        return;
      }

      // Strip tokens from URL bar.
      window.history.replaceState(null, '', window.location.pathname);
      clearOutbound();

      if (type === 'recovery') {
        navigate('/reset-password', { replace: true });
        return;
      }
      navigate(intendedPath || '/', { replace: true });
    };
    void run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Signing you in…</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
