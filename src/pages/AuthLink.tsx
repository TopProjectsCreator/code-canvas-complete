import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildHashHandoff, validateReturnUrl } from '@/lib/authBridge';

const AuthLink = () => {
  const [message, setMessage] = useState('Finalizing your sign-in…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    const type = params.get('type');

    // Supabase JS consumes the recovery/signup hash on mount. Wait for SIGNED_IN.
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return;
      const returnUrl = await validateReturnUrl(next);
      if (!returnUrl) {
        setMessage('This destination is not allowed.');
        return;
      }
      const hash = buildHashHandoff({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        type,
        expiresIn: session.expires_in ?? null,
      });
      window.location.replace(returnUrl.toString().replace(/#.*$/, '') + hash);
    });

    // Also check existing session in case event already fired.
    void supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) return;
      const returnUrl = await validateReturnUrl(next);
      if (!returnUrl) {
        setMessage('This destination is not allowed.');
        return;
      }
      const hash = buildHashHandoff({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        type,
        expiresIn: session.expires_in ?? null,
      });
      window.location.replace(returnUrl.toString().replace(/#.*$/, '') + hash);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Finishing up…</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default AuthLink;
