import { useState } from 'react';
import { 
  Play, 
  Square, 
  ChevronDown, 
  Share2, 
  MoreHorizontal,
  Zap,
  Crown,
  Menu,
  Search,
  Bell,
  User,
  GitFork,
  Star,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  projectName: string;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onToggleSidebar: () => void;
  onToggleAIChat: () => void;
  isAIChatOpen: boolean;
}

export const Header = ({ projectName, isRunning, onRun, onStop, onToggleSidebar, onToggleAIChat, isAIChatOpen }: HeaderProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <header className="flex items-center justify-between px-3 py-2 bg-card border-b border-border">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground hidden sm:block">Replit</span>
        </div>

        {/* Project name */}
        <div className="flex items-center gap-1 ml-2">
          <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors">
            <span className="text-sm font-medium text-foreground">{projectName}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Center section - Run button */}
      <div className="flex items-center gap-2">
        <button
          onClick={isRunning ? onStop : onRun}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all',
            isRunning
              ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              : 'bg-success hover:bg-success/90 text-primary-foreground glow-primary'
          )}
          style={{
            boxShadow: !isRunning && isHovered 
              ? '0 0 30px hsl(140 70% 45% / 0.5)' 
              : !isRunning 
                ? '0 0 20px hsl(140 70% 45% / 0.3)' 
                : 'none'
          }}
        >
          {isRunning ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run</span>
            </>
          )}
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* AI Chat Toggle */}
        <button 
          onClick={onToggleAIChat}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors',
            isAIChatOpen 
              ? 'bg-violet-600 text-white' 
              : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500'
          )}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:inline">AI</span>
        </button>

        <button className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <GitFork className="w-4 h-4" />
          <span className="text-sm">Fork</span>
        </button>
        
        <button className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Star className="w-4 h-4" />
          <span className="text-sm">Star</span>
        </button>
        
        <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">
          <Share2 className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">Share</span>
        </button>

        <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

        <button className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
          <Search className="w-5 h-5" />
        </button>
        
        <button className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
          <Bell className="w-5 h-5" />
        </button>

        <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-accent transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        </button>
      </div>
    </header>
  );
};
