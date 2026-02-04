import { X } from 'lucide-react';
import { Tab } from '@/types/ide';
import { FileIcon } from './FileIcon';
import { cn } from '@/lib/utils';

interface EditorTabsProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export const EditorTabs = ({ tabs, activeTabId, onTabClick, onTabClose }: EditorTabsProps) => {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center h-9 bg-background border-b border-border overflow-x-auto ide-scrollbar">
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          className={cn(
            'group flex items-center gap-1.5 h-full px-3 cursor-pointer transition-colors min-w-0 relative',
            activeTabId === tab.id
              ? 'bg-editor text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
          onClick={() => onTabClick(tab.id)}
        >
          {/* Active indicator - Replit style top border */}
          {activeTabId === tab.id && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />
          )}
          
          <FileIcon name={tab.name} type="file" className="flex-shrink-0 w-4 h-4" />
          <span className="text-xs truncate max-w-[100px]">
            {tab.name}
          </span>
          {tab.isModified && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1"
          >
            <X className="w-3 h-3" />
          </button>
          
          {/* Separator between tabs */}
          {index < tabs.length - 1 && activeTabId !== tab.id && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
};
