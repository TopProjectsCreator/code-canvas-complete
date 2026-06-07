import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateReturnUrl } from '@/lib/authBridge';

const AuthLogout = () => {
  const [message, setMessage] = useState('Signing you out…');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const returnParam = params.get('return');
      const returnUrl = await validateReturnUrl(returnParam);

      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }

      if (returnUrl) {
        window.location.replace(returnUrl.toString());
      } else {
        setMessage('Signed out. No return URL provided.');
      }
    };
    void run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Signing out…</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default AuthLogout;
