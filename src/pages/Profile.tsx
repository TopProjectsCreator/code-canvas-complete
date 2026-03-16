import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Globe, Star, GitFork, Code2, Calendar, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProfileData {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface PublicProject {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  stars_count: number | null;
  forked_from: string | null;
  updated_at: string;
  created_at: string;
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setLoading(true);

      const [profileRes, projectsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, display_name, avatar_url, created_at')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('projects')
          .select('id, name, description, language, stars_count, forked_from, updated_at, created_at')
          .eq('user_id', userId)
          .eq('is_public', true)
          .order('stars_count', { ascending: false }),
      ]);

      if (profileRes.error || !profileRes.data) {
        setNotFound(true);
      } else {
        setProfile(profileRes.data);
        setProjects(projectsRes.data || []);
      }

      setLoading(false);
    };

    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-6">
        <h1 className="text-2xl font-bold">User not found</h1>
        <p className="text-muted-foreground">This profile doesn't exist or hasn't been set up yet.</p>
        <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Button>
      </div>
    );
  }

  const displayName = profile.display_name || 'Anonymous';
  const initials = displayName.slice(0, 2).toUpperCase();
  const totalStars = projects.reduce((sum, p) => sum + (p.stars_count ?? 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center gap-3 h-14 px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium">{displayName}'s Profile</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10">
          <Avatar className="w-24 h-24 border-4 border-border shadow-lg">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Code2 className="w-4 h-4" />
                <span>{projects.length} public project{projects.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4" />
                <span>{totalStars} star{totalStars !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Projects */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Public Projects</h2>

          {projects.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground rounded-xl border border-dashed border-border">
              No public projects yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {projects.map((p) => (
                <Card
                  key={p.id}
                  className="p-4 cursor-pointer hover:border-primary/30 transition-colors group"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <Globe className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium group-hover:text-primary transition-colors">{p.name}</span>
                        {p.language && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                            {p.language}
                          </span>
                        )}
                        {p.forked_from && <GitFork className="w-3 h-3 text-muted-foreground" />}
                      </div>
                      {p.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    {(p.stars_count ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-warning shrink-0">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {p.stars_count}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
