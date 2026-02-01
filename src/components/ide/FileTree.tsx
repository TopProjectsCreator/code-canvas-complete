import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, MoreHorizontal } from 'lucide-react';
import { FileNode } from '@/types/ide';
import { FileIcon } from './FileIcon';
import { cn } from '@/lib/utils';

interface FileTreeProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  activeFileId: string | null;
  level?: number;
}

interface FileItemProps {
  node: FileNode;
  onFileSelect: (file: FileNode) => void;
  activeFileId: string | null;
  level: number;
}

const FileItem = ({ node, onFileSelect, activeFileId, level }: FileItemProps) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (node.type === 'folder') {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(node);
    }
  };

  const isActive = node.id === activeFileId;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors rounded-sm group',
          isActive 
            ? 'bg-primary/20 text-primary' 
            : 'hover:bg-accent text-sidebar-foreground',
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {node.type === 'folder' && (
          <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        )}
        <FileIcon name={node.name} type={node.type} isOpen={isOpen} />
        <span className="flex-1 text-sm truncate">{node.name}</span>
        {isHovered && (
          <MoreHorizontal className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      {node.type === 'folder' && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileItem
              key={child.id}
              node={child}
              onFileSelect={onFileSelect}
              activeFileId={activeFileId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({ files, onFileSelect, activeFileId, level = 0 }: FileTreeProps) => {
  return (
    <div className="py-1">
      {files.map((node) => (
        <FileItem
          key={node.id}
          node={node}
          onFileSelect={onFileSelect}
          activeFileId={activeFileId}
          level={level}
        />
      ))}
    </div>
  );
};
