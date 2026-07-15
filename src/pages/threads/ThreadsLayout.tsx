import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft, MessagesSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/Seo';

export default function ThreadsLayout() {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Seo title="Threads" description="Community discussions" path="/threads" />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/threads" className="flex items-center gap-2 font-semibold text-foreground">
              <MessagesSquare className="h-5 w-5 text-primary" />
              Threads
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to={`/profile/${user.id}`} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{profile?.karma ?? 0}</span>
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(profile?.display_name || user.email || 'U').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/landing">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
