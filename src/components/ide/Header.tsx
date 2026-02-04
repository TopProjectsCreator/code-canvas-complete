import { useState } from 'react';
import { 
  Play, 
  Square, 
  ChevronDown, 
  Share2, 
  Zap,
  Menu,
  Search,
  Bell,
  GitFork,
  Star,
  Sparkles,
  Save,
  Loader2,
  Github
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from './UserMenu';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/hooks/useProjects';

interface HeaderProps {
  projectName: string;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onToggleSidebar: () => void;
  onToggleAIChat: () => void;
  isAIChatOpen: boolean;
  onOpenProjects: () => void;
  onSaveProject: () => void;
  hasUnsavedChanges?: boolean;
  currentProject: Project | null;
  onFork: () => void;
  onStar: () => void;
  onShare: () => void;
  onGitHubImport: () => void;
  isStarred: boolean;
  isForking: boolean;
  starsCount: number;
}

export const Header = ({ 
  projectName, 
  isRunning, 
  onRun, 
  onStop, 
  onToggleSidebar, 
  onToggleAIChat, 
  isAIChatOpen,
  onOpenProjects,
  onSaveProject,
  hasUnsavedChanges,
  currentProject,
  onFork,
  onStar,
  onShare,
  onGitHubImport,
  isStarred,
  isForking,
  starsCount
}: HeaderProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between h-12 px-3 bg-background border-b border-border">
      {/* Left section */}
      <div className="flex items-center gap-2">
        <button 
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Logo - Replit style */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-border" />

        {/* Project name - Replit style */}
        <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent transition-colors group">
          <span className="text-sm font-medium text-foreground">{projectName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </div>

      {/* Center section - Run button - Replit's prominent green button */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
        <button
          onClick={isRunning ? onStop : onRun}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'flex items-center gap-2 px-5 py-1.5 rounded-md font-semibold text-sm transition-all',
            isRunning
              ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              : 'bg-success hover:brightness-110 text-white'
          )}
          style={{
            boxShadow: !isRunning && isHovered 
              ? '0 0 20px hsl(142 71% 45% / 0.4)' 
              : !isRunning 
                ? '0 0 12px hsl(142 71% 45% / 0.25)' 
                : 'none'
          }}
        >
          {isRunning ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run</span>
            </>
          )}
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* AI Chat Toggle - Replit style */}
        <button 
          onClick={onToggleAIChat}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors',
            isAIChatOpen 
              ? 'bg-violet-500/20 text-violet-400' 
              : 'hover:bg-accent text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">AI</span>
        </button>

        {/* GitHub Import */}
        <button 
          onClick={onGitHubImport}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Import from GitHub"
        >
          <Github className="w-4 h-4" />
        </button>

        {user && (
          <button 
            onClick={onSaveProject}
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
              hasUnsavedChanges 
                ? "bg-warning/15 text-warning hover:bg-warning/25" 
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
          >
            <Save className="w-4 h-4" />
          </button>
        )}

        <button 
          onClick={onFork}
          disabled={isForking || !currentProject}
          className={cn(
            "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
            !currentProject 
              ? "opacity-50 cursor-not-allowed text-muted-foreground"
              : "hover:bg-accent text-muted-foreground hover:text-foreground"
          )}
        >
          {isForking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GitFork className="w-4 h-4" />
          )}
        </button>
        
        <button 
          onClick={onStar}
          disabled={!currentProject}
          className={cn(
            "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
            !currentProject 
              ? "opacity-50 cursor-not-allowed text-muted-foreground"
              : isStarred
                ? "text-warning"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
          )}
        >
          <Star className={cn("w-4 h-4", isStarred && "fill-current")} />
          {starsCount > 0 && <span>{starsCount}</span>}
        </button>

        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
        
        <button 
          onClick={onShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/90 hover:bg-primary text-primary-foreground text-sm font-medium transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Invite</span>
        </button>

        <UserMenu onOpenProjects={onOpenProjects} />
      </div>
    </header>
  );
};
