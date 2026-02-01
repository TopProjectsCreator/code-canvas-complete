import { useState, useRef } from 'react';
import { 
  Files, 
  Search, 
  GitBranch, 
  Settings, 
  Package, 
  Plus,
  ChevronDown,
  Users,
  History,
  FilePlus,
  FolderPlus,
  Upload
} from 'lucide-react';
import { FileNode } from '@/types/ide';
import { FileTree } from './FileTree';
import { NewFileDialog } from './NewFileDialog';
import { cn } from '@/lib/utils';
import { getFileLanguage } from '@/data/defaultFiles';

interface SidebarProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  onCreateFile: (parentId: string | null, name: string, type: 'file' | 'folder') => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onUploadFiles: (files: { name: string; content: string; language: string }[]) => void;
  activeFileId: string | null;
}

type SidebarTab = 'files' | 'search' | 'git' | 'packages' | 'settings';

export const Sidebar = ({ 
  files, 
  onFileSelect, 
  onCreateFile, 
  onDeleteFile, 
  onRenameFile, 
  onUploadFiles,
  activeFileId 
}: SidebarProps) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const readFiles = Array.from(uploadedFiles).map((file) => {
      return new Promise<{ name: string; content: string; language: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve({
            name: file.name,
            content: content || '',
            language: getFileLanguage(file.name),
          });
        };
        reader.onerror = () => {
          resolve({
            name: file.name,
            content: '',
            language: getFileLanguage(file.name),
          });
        };
        reader.readAsText(file);
      });
    });

    Promise.all(readFiles).then((files) => {
      onUploadFiles(files);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const tabs = [
    { id: 'files' as const, icon: Files, label: 'Files' },
    { id: 'search' as const, icon: Search, label: 'Search' },
    { id: 'git' as const, icon: GitBranch, label: 'Version Control' },
    { id: 'packages' as const, icon: Package, label: 'Packages' },
    { id: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  const handleNewFile = (name: string, type: 'file' | 'folder') => {
    // Create at root level (first folder)
    const rootFolder = files[0];
    onCreateFile(rootFolder?.id || null, name, type);
  };

  return (
    <div className="flex h-full bg-sidebar">
      {/* Icon rail */}
      <div className="w-12 flex flex-col items-center py-2 border-r border-border bg-background">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-lg mb-1 transition-colors',
              activeTab === tab.id
                ? 'bg-accent text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            title={tab.label}
          >
            <tab.icon className="w-5 h-5" />
          </button>
        ))}
        
        <div className="flex-1" />
        
        <button
          className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Invite"
        >
          <Users className="w-5 h-5" />
        </button>
        <button
          className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="History"
        >
          <History className="w-5 h-5" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeTab === 'files' && (
          <>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Files
              </span>
              <div className="relative">
                <button 
                  onClick={() => setShowNewMenu(!showNewMenu)}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                
                {showNewMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px]">
                    <button
                      onClick={() => {
                        const rootFolder = files[0];
                        onCreateFile(rootFolder?.id || null, 'untitled.js', 'file');
                        setShowNewMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                    >
                      <FilePlus className="w-4 h-4" /> New File
                    </button>
                    <button
                      onClick={() => {
                        const rootFolder = files[0];
                        onCreateFile(rootFolder?.id || null, 'new-folder', 'folder');
                        setShowNewMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                    >
                      <FolderPlus className="w-4 h-4" /> New Folder
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setShowNewMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> Upload Files
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".js,.ts,.jsx,.tsx,.html,.css,.json,.md,.txt,.py,.go,.rs,.java,.cpp,.c,.h,.xml,.yaml,.yml,.toml,.env,.gitignore"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto ide-scrollbar">
              <FileTree
                files={files}
                onFileSelect={onFileSelect}
                onCreateFile={onCreateFile}
                onDeleteFile={onDeleteFile}
                onRenameFile={onRenameFile}
                activeFileId={activeFileId}
              />
            </div>
          </>
        )}

        {activeTab === 'search' && (
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search files..."
                className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Type to search across all files
            </p>
          </div>
        )}

        {activeTab === 'git' && (
          <div className="p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitBranch className="w-4 h-4" />
              <span>main</span>
              <ChevronDown className="w-3 h-3" />
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              No uncommitted changes
            </p>
          </div>
        )}

        {activeTab === 'packages' && (
          <div className="p-3">
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
              <Package className="w-4 h-4" />
              Add Package
            </button>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Manage your project dependencies
            </p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-3">
            <h3 className="text-sm font-medium mb-3">Repl Settings</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Auto-save</span>
                <input type="checkbox" defaultChecked className="accent-primary" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Word wrap</span>
                <input type="checkbox" defaultChecked className="accent-primary" />
              </label>
            </div>
          </div>
        )}
      </div>

      <NewFileDialog
        isOpen={showNewFileDialog}
        onClose={() => setShowNewFileDialog(false)}
        onSubmit={handleNewFile}
      />
    </div>
  );
};
