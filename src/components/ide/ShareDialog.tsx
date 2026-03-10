import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Copy,
  Check,
  Globe,
  Lock,
  Link2,
  Twitter,
  Linkedin,
  Mail,
  Rocket,
} from 'lucide-react';
import { Project } from '@/hooks/useProjects';
import { createDataProvider } from '@/integrations/data/provider';
import { buildProjectShareUrl, buildPublishedProjectUrl, resolvePublishBaseDomain, sanitizePublishSlug } from '@/lib/publishing';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onProjectUpdated: (project: Project) => void;
}

export const ShareDialog = ({
  open,
  onOpenChange,
  project,
  onProjectUpdated,
}: ShareDialogProps) => {
  const { toast } = useToast();
  const dataProvider = useMemo(() => createDataProvider(), []);
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(project?.is_public ?? false);
  const [publishSlug, setPublishSlug] = useState(project?.publish_slug ?? '');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setIsPublic(project?.is_public ?? false);
    setPublishSlug(project?.publish_slug ?? '');
  }, [project]);

  const fallbackSlug = sanitizePublishSlug(project?.name || 'my-canvas');
  const slugToUse = sanitizePublishSlug(publishSlug) || fallbackSlug;
  const publishUrl = slugToUse ? buildPublishedProjectUrl(slugToUse) : '';

  const shareUrl = project
    ? (isPublic && slugToUse ? publishUrl : buildProjectShareUrl(project.id))
    : window.location.href;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Link copied to clipboard!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
        variant: 'destructive',
      });
    }
  };

  const updateVisibility = async (checked: boolean) => {
    if (!project) return;

    setUpdating(true);
    try {
      const payload = {
        ...project,
        is_public: checked,
        publish_slug: checked ? slugToUse : project.publish_slug,
        published_at: checked ? new Date().toISOString() : project.published_at,
      };
      const updated = await dataProvider.updateProject(payload);
      setIsPublic(checked);
      onProjectUpdated(updated as Project);

      toast({
        title: checked ? 'Project is now public' : 'Project is now private',
        description: checked
          ? 'Anyone with the link can view this project'
          : 'Only you can access this project',
      });
    } catch (error: any) {
      toast({
        title: 'Error updating visibility',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handlePublish = async () => {
    if (!project) return;

    if (!slugToUse) {
      toast({ title: 'Choose a subdomain', description: 'Subdomain cannot be empty.', variant: 'destructive' });
      return;
    }

    await updateVisibility(true);
  };

  const handleSocialShare = (platform: 'twitter' | 'linkedin' | 'email') => {
    const title = project?.name || 'Check out my project';
    const text = `Check out "${title}" on Code Canvas Complete!`;

    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'email':
        url = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + shareUrl)}`;
        break;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const baseDomain = resolvePublishBaseDomain();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Publish Project
          </DialogTitle>
          <DialogDescription>
            Deploy to a subdomain and share your project publicly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {project && (
            <div className="space-y-3">
              <Label>Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={publishSlug}
                  onChange={(e) => setPublishSlug(sanitizePublishSlug(e.target.value))}
                  placeholder="my-canvas"
                  className="font-mono text-sm"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">.{baseDomain}</span>
              </div>
              <Button className="w-full gap-2" onClick={handlePublish} disabled={updating}>
                <Rocket className="w-4 h-4" />
                Publish
              </Button>
            </div>
          )}

          {project && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <Globe className="w-5 h-5 text-green-500" />
                ) : (
                  <Lock className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <Label className="text-sm font-medium">{isPublic ? 'Public' : 'Private'}</Label>
                </div>
              </div>
              <Switch checked={isPublic} onCheckedChange={updateVisibility} disabled={updating} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Project Link</Label>
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Share on</Label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => handleSocialShare('twitter')}>
                <Twitter className="w-4 h-4" />
                Twitter
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={() => handleSocialShare('linkedin')}>
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={() => handleSocialShare('email')}>
                <Mail className="w-4 h-4" />
                Email
              </Button>
            </div>
          </div>

          {!project && (
            <p className="text-sm text-muted-foreground text-center">
              Save your project first to get a publishable link
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
