import { useState } from 'react';
import { Loader2, AlertCircle, FolderGit2, GitBranch } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useGitProviderImport, detectProvider } from '@/hooks/useGitProviderImport';
import { FileNode } from '@/types/ide';

interface GitProviderImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (files: FileNode[], repoName: string) => void;
}

export const GitProviderImportDialog = ({ open, onOpenChange, onImport }: GitProviderImportDialogProps) => {
  const [repoUrl, setRepoUrl] = useState('');

  const { importRepository, isImporting, importProgress, error, clearError } = useGitProviderImport();

  const handleImport = async (urlOrFullName: string) => {
    clearError();
    const provider = detectProvider(urlOrFullName) || 'github';
    const files = await importRepository(urlOrFullName, provider);
    if (files && files.length > 0) {
      onImport(files, files[0].name);
      onOpenChange(false);
      setRepoUrl('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim()) handleImport(repoUrl);
  };

  const detectedProvider = detectProvider(repoUrl);
  const providerLabel = detectedProvider ? detectedProvider[0].toUpperCase() + detectedProvider.slice(1) : 'Auto';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Import from Git
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Repository URL (auto-detected)
            </label>
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="GitHub, GitLab, Bitbucket, Replit, Bolt, or Firebase Studio URL"
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Detected provider: <span className="font-medium">{providerLabel}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isImporting && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 text-primary text-sm">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{importProgress}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!repoUrl.trim() || isImporting}>
              {isImporting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importing...</>
              ) : (
                <><FolderGit2 className="w-4 h-4 mr-2" />Import</>
              )}
            </Button>
          </div>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Paste any supported URL. We auto-detect the provider and import only public repositories.
        </p>
      </DialogContent>
    </Dialog>
  );
};
