import { useState, useRef } from 'react';
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, Trash2, Edit2, Download } from 'lucide-react';
import { FileNode } from '@/types/ide';
import { FileIcon } from './FileIcon';
import { cn } from '@/lib/utils';

const BINARY_EXTENSIONS = ['pptx', 'docx', 'xlsx', 'pdf', 'zip', 'stl', 'obj', 'glb', 'gltf'];
const MIME_MAP: Record<string, string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  zip: 'application/zip',
};

const downloadFile = (node: FileNode, currentContent?: string) => {
  const content = currentContent ?? node.content ?? '';
  const ext = node.name.split('.').pop()?.toLowerCase() || '';
  const isBinary = BINARY_EXTENSIONS.includes(ext);

  let blob: Blob;
  if (isBinary && content) {
    // Decode base64 / data-url to binary
    const base64 = content.startsWith('data:') ? content.split(',')[1] || '' : content;
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: MIME_MAP[ext] || 'application/octet-stream' });
    } catch {
      blob = new Blob([content], { type: 'text/plain' });
    }
  } else {
    blob = new Blob([content], { type: 'text/plain' });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = node.name;
  a.click();
  URL.revokeObjectURL(url);
};

interface FileTreeProps {
  files: FileNode[];
  fileContents?: Record<string, string>;
  onFileSelect: (file: FileNode) => void;
  onCreateFile: (parentId: string | null, name: string, type: 'file' | 'folder') => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  activeFileId: string | null;
  level?: number;
}

interface FileItemProps {
  node: FileNode;
  fileContents?: Record<string, string>;
  onFileSelect: (file: FileNode) => void;
  onCreateFile: (parentId: string | null, name: string, type: 'file' | 'folder') => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  activeFileId: string | null;
  level: number;
}

const FileItem = ({ 
  node,
  fileContents,
  onFileSelect, 
  onCreateFile, 
  onDeleteFile, 
  onRenameFile, 
  activeFileId, 
  level 
}: FileItemProps) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (isRenaming) return;
    if (node.type === 'folder') {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(node);
    }
  };

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== node.name) {
      onRenameFile(node.id, renameValue.trim());
    }
    setIsRenaming(false);
    setShowMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteFile(node.id);
    setShowMenu(false);
  };

  const handleAddToFolder = (e: React.MouseEvent, type: 'file' | 'folder') => {
    e.stopPropagation();
    const name = type === 'file' ? 'untitled.js' : 'new-folder';
    onCreateFile(node.id, name, type);
    setIsOpen(true);
    setShowMenu(false);
  };

  const isActive = node.id === activeFileId;
  const isRoot = level === 0 && node.type === 'folder';

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors rounded-sm group relative',
          isActive 
            ? 'bg-primary/20 text-primary' 
            : 'hover:bg-accent text-sidebar-foreground',
        )}
        style={{ paddingLeft: `${level * 12 + (node.type === 'file' ? 24 : 8)}px` }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!showMenu) setShowMenu(false);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(true);
        }}
      >
        {node.type === 'folder' && (
          <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        )}
        <FileIcon name={node.name} type={node.type} isOpen={isOpen} />
        
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setRenameValue(node.name);
                setIsRenaming(false);
              }
            }}
            className="flex-1 text-sm bg-input border border-primary rounded px-1 outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm truncate">{node.name}</span>
        )}
        
        {isHovered && !isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* Context menu */}
        {showMenu && (
          <div 
            className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            {node.type === 'folder' && (
              <>
                <button
                  onClick={(e) => handleAddToFolder(e, 'file')}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                >
                  <Plus className="w-3 h-3" /> New File
                </button>
                <button
                  onClick={(e) => handleAddToFolder(e, 'folder')}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                >
                  <Plus className="w-3 h-3" /> New Folder
                </button>
                <div className="border-t border-border my-1" />
              </>
            )}
            {node.type === 'file' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(node, fileContents?.[node.id]);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
              >
                <Download className="w-3 h-3" /> Download
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
                setShowMenu(false);
              }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
            >
              <Edit2 className="w-3 h-3" /> Rename
            </button>
            {!isRoot && (
              <button
                onClick={handleDelete}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent text-destructive flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
      
      {node.type === 'folder' && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileItem
              key={child.id}
              node={child}
              fileContents={fileContents}
              onFileSelect={onFileSelect}
              onCreateFile={onCreateFile}
              onDeleteFile={onDeleteFile}
              onRenameFile={onRenameFile}
              activeFileId={activeFileId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({ 
  files,
  fileContents,
  onFileSelect, 
  onCreateFile, 
  onDeleteFile, 
  onRenameFile, 
  activeFileId, 
  level = 0 
}: FileTreeProps) => {
  return (
    <div className="py-1">
      {files.map((node) => (
        <FileItem
          key={node.id}
          node={node}
          fileContents={fileContents}
          onFileSelect={onFileSelect}
          onCreateFile={onCreateFile}
          onDeleteFile={onDeleteFile}
          onRenameFile={onRenameFile}
          activeFileId={activeFileId}
          level={level}
        />
      ))}
    </div>
  );
};
