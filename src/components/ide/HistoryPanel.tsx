import { FileEdit, Terminal, GitCommit, Clock, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileIcon } from './FileIcon';

export interface HistoryEntry {
  id: string;
  type: 'file-edit' | 'file-create' | 'file-delete' | 'terminal-command' | 'git-commit' | 'template-change' | 'rename';
  label: string;
  detail?: string;
  timestamp: Date;
  snapshot?: {
    files: any[];
    fileContents: Record<string, string>;
  };
}

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onRestoreEntry?: (entry: HistoryEntry) => void;
}

const getIcon = (type: HistoryEntry['type']) => {
  switch (type) {
    case 'file-edit':
    case 'file-create':
    case 'file-delete':
      return <FileEdit className="w-3.5 h-3.5" />;
    case 'terminal-command':
      return <Terminal className="w-3.5 h-3.5" />;
    case 'git-commit':
      return <GitCommit className="w-3.5 h-3.5" />;
    default:
      return <Clock className="w-3.5 h-3.5" />;
  }
};

const getColor = (type: HistoryEntry['type']) => {
  switch (type) {
    case 'file-edit':
      return 'text-warning';
    case 'file-create':
      return 'text-success';
    case 'file-delete':
      return 'text-destructive';
    case 'terminal-command':
      return 'text-primary';
    case 'git-commit':
      return 'text-info';
    default:
      return 'text-muted-foreground';
  }
};

const formatTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
};

export const HistoryPanel = ({ entries, onRestoreEntry }: HistoryPanelProps) => {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <Clock className="w-8 h-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No history yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Actions like editing files, running commands, and git commits will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between h-9 px-3 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          History
        </span>
        <span className="text-xs text-muted-foreground">
          {entries.length} event{entries.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex-1 overflow-auto ide-scrollbar">
        <div className="py-1">
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className="group flex items-start gap-2.5 px-3 py-2 hover:bg-accent/50 transition-colors"
            >
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center pt-0.5">
                <div className={cn('shrink-0', getColor(entry.type))}>
                  {getIcon(entry.type)}
                </div>
                {i < entries.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-1 min-h-[12px]" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {entry.label}
                </p>
                {entry.detail && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                    {entry.detail}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {formatTime(entry.timestamp)}
                </p>
              </div>

              {/* Rollback button */}
              {onRestoreEntry && (
                <button
                  onClick={() => onRestoreEntry(entry)}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                  title="Restore to this point"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
