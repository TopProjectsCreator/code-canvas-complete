import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { validateReturnUrl, buildHashHandoff } from '@/lib/authBridge';
import { ExternalOAuthConsent } from '@/components/auth/ExternalOAuthConsent';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldAlert } from 'lucide-react';

type PageStatus = 'loading' | 'error' | 'signin' | 'consent';

const ExternalOAuth = () => {
  const [searchParams] = useSearchParams();
  const { user, profile, session, signIn, signInWithOAuth, availableOAuthProviders, platform } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<PageStatus>('loading');
  const [message, setMessage] = useState('');

  const [returnUrl, setReturnUrl] = useState<URL | null>(null);
  const [stateParam, setStateParam] = useState<string | null>(null);
  const [clientName, setClientName] = useState('this app');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'apple' | 'microsoft'>(null);

  const returnParam = searchParams.get('return');
  const stateFromUrl = searchParams.get('state');
  const clientNameFromUrl = searchParams.get('client_name');

  useEffect(() => {
    if (!returnParam || !stateFromUrl) {
      setStatus('error');
      setMessage('Missing return URL or state parameter.');
      return;
    }

    setStateParam(stateFromUrl);
    setClientName(clientNameFromUrl || 'this app');

    validateReturnUrl(returnParam).then((validated) => {
      if (validated) {
        setReturnUrl(validated);
      } else {
        setStatus('error');
        setMessage('Return URL host is not on the allowlist.');
      }
    });
  }, [returnParam, stateFromUrl, clientNameFromUrl]);

  useEffect(() => {
    if (!returnUrl || !stateParam) return;
    if (status === 'signin' || status === 'error') return;

    if (user && session) {
      setStatus('consent');
    } else {
      setStatus('signin');
    }
  }, [user, session, returnUrl, stateParam, status]);

  const handleConsentContinue = useCallback(() => {
    if (!returnUrl || !stateParam || !session) return;

    setStatus('loading');
    setMessage('Redirecting…');

    const hash = buildHashHandoff({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      state: stateParam,
      expiresIn: session.expires_in ?? null,
    });
    window.location.replace(returnUrl.toString().replace(/#.*$/, '') + hash);
  }, [returnUrl, stateParam, session]);

  const handleConsentCancel = useCallback(() => {
    if (!returnUrl) return;
    const url = new URL(returnUrl.toString());
    url.searchParams.set('error', 'access_denied');
    window.location.replace(url.toString());
  }, [returnUrl]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple' | 'microsoft') => {
    setOauthLoading(provider);
    const { error } = await signInWithOAuth(provider);
    if (error) {
      toast({ title: 'OAuth failed', description: error.message, variant: 'destructive' });
    }
    setOauthLoading(null);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{message || 'Loading…'}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Authorization Error</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <a href="/" className="inline-block text-sm text-primary underline underline-offset-4">
            Go to Code Canvas
          </a>
        </div>
      </div>
    );
  }

  if (status === 'consent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border border-border p-8">
          <ExternalOAuthConsent
            clientName={clientName}
            userEmail={user?.email || ''}
            userAvatar={profile?.avatar_url || null}
            userDisplayName={profile?.display_name || null}
            onContinue={handleConsentContinue}
            onCancel={handleConsentCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Sign in to Code Canvas</h1>
          <p className="text-sm text-muted-foreground">
            to continue to <span className="font-medium text-foreground">{clientName}</span>
          </p>
        </div>

        <div className="rounded-lg border border-border p-6 space-y-4">
          {availableOAuthProviders.includes('google') && (
            <Button variant="outline" className="w-full gap-2" onClick={() => handleOAuthSignIn('google')} disabled={oauthLoading !== null}>
              {oauthLoading === 'google' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </Button>
          )}

          {availableOAuthProviders.includes('apple') && (
            <Button variant="outline" className="w-full gap-2" onClick={() => handleOAuthSignIn('apple')} disabled={oauthLoading !== null}>
              {oauthLoading === 'apple' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.157-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.69 3.56-1.702z"/>
                </svg>
              )}
              Continue with Apple
            </Button>
          )}

          {availableOAuthProviders.includes('microsoft') && (
            <Button variant="outline" className="w-full gap-2" onClick={() => handleOAuthSignIn('microsoft')} disabled={oauthLoading !== null}>
              {oauthLoading === 'microsoft' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="9" height="9" fill="#F25022"/>
                  <rect x="13" y="2" width="9" height="9" fill="#7FBA00"/>
                  <rect x="2" y="13" width="9" height="9" fill="#00A4EF"/>
                  <rect x="13" y="13" width="9" height="9" fill="#FFB900"/>
                </svg>
              )}
              Continue with Microsoft
            </Button>
          )}

          {availableOAuthProviders.length > 0 && (
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
          )}

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-10 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExternalOAuth;
