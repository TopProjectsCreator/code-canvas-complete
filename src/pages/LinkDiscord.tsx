import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const LinkDiscord = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp, signInWithOAuth } = useAuth();
  const code = searchParams.get('code');

  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkDone, setLinkDone] = useState(false);
  const [_discordUsername, setDiscordUsername] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLinkError('');
    setLinkDone(false);
  }, [code]);

  const doLink = async () => {
    if (!user || !code) return;
    setLinking(true);
    setLinkError('');
    try {
      const res = await fetch('/api/discord/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLinkError(data.error || 'Failed to link');
      } else {
        setLinkDone(true);
        setDiscordUsername(data.discordUserId || '');
      }
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLinking(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (isSignUp) {
      const { error } = await signUp(email, password, displayName || email.split('@')[0]);
      if (error) setAuthError(error.message);
    } else {
      const { error } = await signIn(email, password);
      if (error) setAuthError(error.message);
    }
  };

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Invalid Link
            </CardTitle>
            <CardDescription>
              No linking code found in the URL. DM the Code Canvas bot on Discord to get a code.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (linkDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Account Linked!
            </CardTitle>
            <CardDescription>
              Your Discord account has been linked to Code Canvas. Return to Discord and send a message to start chatting with AI.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    // Authenticated — show link button
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-indigo-500" />
              Link Discord Account
            </CardTitle>
            <CardDescription>
              Signed in as <strong>{user.email}</strong>. Click below to link your Discord account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{linkError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button className="w-full" onClick={doLink} disabled={linking}>
              {linking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Linking...</> : 'Link Discord Account'}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Not authenticated — show sign-in
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignUp ? 'Create Account' : 'Sign In'}</CardTitle>
          <CardDescription>
            Sign in to link your Discord account with Code Canvas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>
          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => signInWithOAuth('google')}>
              Continue with Google
            </Button>
            <Button variant="outline" onClick={() => signInWithOAuth('apple')}>
              Continue with Apple
            </Button>
            <Button variant="outline" onClick={() => signInWithOAuth('microsoft')}>
              Continue with Microsoft
            </Button>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="link" onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LinkDiscord;
