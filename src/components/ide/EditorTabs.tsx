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
    <div className="flex items-center bg-background border-b border-border overflow-x-auto ide-scrollbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            'group flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer transition-colors min-w-0',
            activeTabId === tab.id
              ? 'bg-editor text-foreground'
              : 'bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
          onClick={() => onTabClick(tab.id)}
        >
          <FileIcon name={tab.name} type="file" className="flex-shrink-0" />
          <span className="text-sm truncate max-w-[120px]">
            {tab.name}
            {tab.isModified && <span className="text-primary ml-1">●</span>}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};
