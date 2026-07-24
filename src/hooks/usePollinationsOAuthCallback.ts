import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { exchangeCodeForToken, clearOAuthState, POLLINATIONS_OAUTH_STATE_KEY, POLLINATIONS_VERIFIER_KEY, POLLINATIONS_CLIENT_ID } from '@/lib/pollinations-oauth';
import type { AIProvider } from '@/hooks/useApiKeys';

export function usePollinationsOAuthCallback(saveApiKey: (provider: AIProvider, key: string) => Promise<boolean>) {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    if (!code && !error) return;

    const returnedState = params.get('state');
    const redirectUri = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);

    const expectedState = localStorage.getItem(POLLINATIONS_OAUTH_STATE_KEY);
    const verifier = localStorage.getItem(POLLINATIONS_VERIFIER_KEY);
    clearOAuthState();

    if (!expectedState || returnedState !== expectedState) {
      toast({ title: 'Pollinations connection blocked', description: 'OAuth state did not match. Please try connecting again.', variant: 'destructive' });
      return;
    }

    if (error) {
      toast({ title: 'Pollinations connection cancelled', description: error, variant: 'destructive' });
      return;
    }

    if (!verifier || !code) {
      toast({ title: 'Pollinations connection failed', description: 'OAuth session expired. Please try connecting again.', variant: 'destructive' });
      return;
    }

    exchangeCodeForToken({
      code,
      clientId: POLLINATIONS_CLIENT_ID,
      redirectUri,
      codeVerifier: verifier,
    })
      .then(data => {
        if (!data.access_token) throw new Error('No access token in response');
        void saveApiKey('pollinations', data.access_token);
      })
      .catch(err => {
        toast({ title: 'Pollinations connection failed', description: err instanceof Error ? err.message : 'Token exchange failed', variant: 'destructive' });
      });
  }, [saveApiKey, toast]);
}
