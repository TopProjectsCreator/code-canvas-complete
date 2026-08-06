import { useState } from 'react';
import { useNavigate, Link } from '@/lib/router-compat';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Seo } from '@/components/Seo';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ThreadEditor } from '@/components/threads/ThreadEditor';
import { createThread, uploadMedia } from '@/hooks/useThreads';
import { useThreadCategories } from '@/hooks/useThreadCategories';

export default function CreateThread() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { categories } = useThreadCategories();

  if (!user) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-medium mb-2">Sign in to create a thread</h2>
        <p className="text-sm text-muted-foreground mb-4">You need an account to post.</p>
        <Button asChild>
          <Link to="/landing">Sign in</Link>
        </Button>
      </div>
    );
  }

  const handleUploadMedia = async (file: File): Promise<string> => {
    return uploadMedia(file, user.id);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const threadId = await createThread(user.id, title, content, category || null);
      toast({ title: 'Thread created!' });
      navigate(`/threads/${threadId}`);
    } catch (err: any) {
      toast({ title: 'Failed to create thread', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Seo title="Create a thread — Threads" description="Start a new discussion" path="/threads/new" />

      <Link to="/threads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to threads
      </Link>

      <h1 className="text-2xl font-bold mb-6">Create a thread</h1>

      <Card className="p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="What's on your mind?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            className="text-base font-medium"
          />
        </div>

        <div className="space-y-2">
          <Label>Body</Label>
          <ThreadEditor
            value={content}
            onChange={setContent}
            placeholder="Write your post content here... (optional, supports rich text, images, video, audio)"
            onUploadMedia={handleUploadMedia}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category" className="w-full sm:w-64">
              <SelectValue placeholder="Select a category (optional)" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" asChild>
            <Link to="/threads">Cancel</Link>
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || submitting}>
            {submitting ? 'Posting...' : 'Post'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
