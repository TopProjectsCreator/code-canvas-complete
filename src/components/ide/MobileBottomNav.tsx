import { Code2, FileText, Monitor, Terminal, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobilePanel = 'editor' | 'preview' | 'terminal' | 'ai';

interface MobileBottomNavProps {
  activePanel: MobilePanel;
  onPanelChange: (panel: MobilePanel) => void;
  showPreview?: boolean;
  showTerminal?: boolean;
}

export const MobileBottomNav = ({ 
  activePanel, 
  onPanelChange,
  showPreview = true,
  showTerminal = true,
}: MobileBottomNavProps) => {
  const tabs = [
    { id: 'editor' as const, icon: Code2, label: 'Editor' },
    ...(showPreview ? [{ id: 'preview' as const, icon: Monitor, label: 'Preview' }] : []),
    ...(showTerminal ? [{ id: 'terminal' as const, icon: Terminal, label: 'Terminal' }] : []),
    { id: 'ai' as const, icon: Sparkles, label: 'AI' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onPanelChange(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
              activePanel === tab.id
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
