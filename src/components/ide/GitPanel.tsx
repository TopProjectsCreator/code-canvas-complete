import { useState } from 'react';
import { 
  GitBranch, 
  GitCommit as GitCommitIcon, 
  Plus, 
  Minus, 
  Edit3, 
  Check, 
  ChevronDown, 
  ChevronRight,
  RefreshCw,
  Upload,
  Download,
  MoreHorizontal,
  Clock,
  User
} from 'lucide-react';
import { GitState, GitChange, GitCommit } from '@/types/ide';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GitPanelProps {
  gitState: GitState;
  onCommit: (message: string) => void;
  onStageFile: (fileId: string) => void;
  onUnstageFile: (fileId: string) => void;
  onDiscardChanges: (fileId: string) => void;
  onCreateBranch: (name: string) => void;
  onSwitchBranch: (name: string) => void;
  onInitRepo: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const GitPanel = ({
  gitState,
  onCommit,
  onStageFile,
  onUnstageFile,
  onDiscardChanges,
  onCreateBranch,
  onSwitchBranch,
  onInitRepo,
}: GitPanelProps) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [isChangesExpanded, setIsChangesExpanded] = useState(true);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  const currentBranch = gitState.branches.find(b => b.name === gitState.currentBranch);
  const stagedChanges = gitState.changes.filter(c => c.status !== 'deleted');
  const unstagedChanges = gitState.changes;

  const handleCommit = () => {
    if (!commitMessage.trim() || gitState.changes.length === 0) return;
    onCommit(commitMessage.trim());
    setCommitMessage('');
  };

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return;
    onCreateBranch(newBranchName.trim());
    setNewBranchName('');
    setIsCreatingBranch(false);
    setIsBranchDropdownOpen(false);
  };

  const getStatusIcon = (status: GitChange['status']) => {
    switch (status) {
      case 'added':
        return <Plus className="w-3.5 h-3.5 text-green-500" />;
      case 'modified':
        return <Edit3 className="w-3.5 h-3.5 text-yellow-500" />;
      case 'deleted':
        return <Minus className="w-3.5 h-3.5 text-red-500" />;
    }
  };

  const getStatusLabel = (status: GitChange['status']) => {
    switch (status) {
      case 'added':
        return 'A';
      case 'modified':
        return 'M';
      case 'deleted':
        return 'D';
    }
  };

  if (!gitState.isInitialized) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <GitBranch className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Git Repository</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Initialize a Git repository to track changes and manage versions.
        </p>
        <button
          onClick={onInitRepo}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <GitBranch className="w-4 h-4" />
          Initialize Repository
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Source Control</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 rounded hover:bg-accent text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-1 rounded hover:bg-accent text-muted-foreground">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Branch selector */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <button
            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md bg-accent/50 hover:bg-accent transition-colors text-sm"
          >
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-left font-medium">{gitState.currentBranch}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>

          {isBranchDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="p-2 border-b border-border">
                {isCreatingBranch ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="Branch name..."
                      className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                    />
                    <button
                      onClick={handleCreateBranch}
                      className="p-1 rounded bg-primary text-primary-foreground"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreatingBranch(true)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create new branch
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto">
                {gitState.branches.map((branch) => (
                  <button
                    key={branch.name}
                    onClick={() => {
                      onSwitchBranch(branch.name);
                      setIsBranchDropdownOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors",
                      branch.name === gitState.currentBranch && "bg-accent"
                    )}
                  >
                    <GitBranch className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 text-left">{branch.name}</span>
                    {branch.name === gitState.currentBranch && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {/* Commit input */}
        <div className="p-3 border-b border-border">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            className="w-full px-3 py-2 text-sm bg-accent/30 border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={2}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || gitState.changes.length === 0}
            className={cn(
              "w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              commitMessage.trim() && gitState.changes.length > 0
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Check className="w-4 h-4" />
            Commit ({gitState.changes.length} file{gitState.changes.length !== 1 ? 's' : ''})
          </button>
        </div>

        {/* Changes section */}
        <div className="border-b border-border">
          <button
            onClick={() => setIsChangesExpanded(!isChangesExpanded)}
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent/50 transition-colors"
          >
            {isChangesExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Changes</span>
            <span className="ml-auto text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
              {gitState.changes.length}
            </span>
          </button>

          {isChangesExpanded && (
            <div className="pb-2">
              {gitState.changes.length === 0 ? (
                <p className="px-6 py-2 text-sm text-muted-foreground">No changes</p>
              ) : (
                gitState.changes.map((change) => (
                  <div
                    key={change.fileId}
                    className="group flex items-center gap-2 px-4 py-1.5 hover:bg-accent/50 transition-colors"
                  >
                    {getStatusIcon(change.status)}
                    <span className="flex-1 text-sm truncate">{change.fileName}</span>
                    <span className={cn(
                      "text-xs font-mono px-1 rounded",
                      change.status === 'added' && "text-green-500 bg-green-500/10",
                      change.status === 'modified' && "text-yellow-500 bg-yellow-500/10",
                      change.status === 'deleted' && "text-red-500 bg-red-500/10"
                    )}>
                      {getStatusLabel(change.status)}
                    </span>
                    <button
                      onClick={() => onDiscardChanges(change.fileId)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-destructive transition-all"
                      title="Discard changes"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Commit history section */}
        <div>
          <button
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent/50 transition-colors"
          >
            {isHistoryExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Commits</span>
            <span className="ml-auto text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
              {currentBranch?.commits.length || 0}
            </span>
          </button>

          {isHistoryExpanded && currentBranch && (
            <div className="pb-2">
              {currentBranch.commits.length === 0 ? (
                <p className="px-6 py-2 text-sm text-muted-foreground">No commits yet</p>
              ) : (
                currentBranch.commits.slice(0, 20).map((commit) => (
                  <div
                    key={commit.id}
                    className="px-4 py-2 hover:bg-accent/50 transition-colors border-l-2 border-transparent hover:border-primary ml-2"
                  >
                    <div className="flex items-start gap-2">
                      <GitCommitIcon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{commit.message}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="font-mono">{commit.id.slice(0, 7)}</span>
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(commit.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-muted-foreground">
          <Download className="w-4 h-4" />
          Pull
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-muted-foreground">
          <Upload className="w-4 h-4" />
          Push
        </button>
      </div>
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}
