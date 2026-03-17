import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe, Star, User, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Profile {
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
  updated_at: string;
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const [profileRes, projectsRes] = await Promise.all([
        supabase.from('profiles').select('id, user_id, display_name, avatar_url, created_at').eq('user_id', userId).maybeSingle(),
        supabase.from('projects').select('id, name, description, language, stars_count, updated_at').eq('user_id', userId).eq('is_public', true).order('updated_at', { ascending: false }),
      ]);
      setProfile(profileRes.data);
      setProjects(projectsRes.data || []);
      setLoading(false);
    };
    load();
  }, [userId]);

  const totalStars = projects.reduce((sum, p) => sum + (p.stars_count ?? 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">User not found</p>
        <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-8 gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        {/* Profile header */}
        <div className="flex items-center gap-5 mb-10">
          <Avatar className="w-20 h-20">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-2xl bg-secondary">
              <User className="w-8 h-8" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{profile.display_name || 'Anonymous'}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}</span>
              <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> {totalStars} star{totalStars !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {projects.length} public canvas{projects.length !== 1 ? 'es' : ''}</span>
            </div>
          </div>
        </div>

        {/* Projects */}
        <h2 className="text-lg font-semibold mb-4">Public Canvases</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public canvases yet.</p>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/20 transition-all text-left"
              >
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {p.language && <span className="capitalize">{p.language}</span>}
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</span>
                  </div>
                </div>
                {(p.stars_count ?? 0) > 0 && (
                  <div className="flex items-center gap-1 text-xs text-warning shrink-0">
                    <Star className="w-3 h-3 fill-current" />
                    {p.stars_count}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
