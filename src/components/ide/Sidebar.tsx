import { useState, useRef, useMemo, useEffect } from 'react';
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
  Upload,
  FileText,
  Zap,
} from 'lucide-react';
import { FileNode, GitState, Workflow } from '@/types/ide';
import { FileTree } from './FileTree';
import { NewFileDialog } from './NewFileDialog';
import { GitPanel } from './GitPanel';
import { PackagePanel } from './PackagePanel';
import { WorkflowsPanel } from './WorkflowsPanel';
import { HistoryPanel, HistoryEntry } from './HistoryPanel';
import { FileIcon } from './FileIcon';
import { SettingsDialog } from './SettingsDialog';
import { cn } from '@/lib/utils';
import { getFileLanguage } from '@/data/defaultFiles';


interface SearchResult {
  file: FileNode;
  matches: { line: number; text: string; matchStart: number; matchEnd: number }[];
}

interface SidebarProps {
  files: FileNode[];
  fileContents: Record<string, string>;
  onFileSelect: (file: FileNode) => void;
  onCreateFile: (parentId: string | null, name: string, type: 'file' | 'folder') => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onUploadFiles: (files: { name: string; content: string; language: string }[]) => void;
  onImportScratchProject?: (file: File) => void;
  activeFileId: string | null;
  currentLanguage: string;
  gitState: GitState;
  onGitCommit: (message: string) => void;
  onGitStageFile: (fileId: string) => void;
  onGitUnstageFile: (fileId: string) => void;
  onGitDiscardChanges: (fileId: string) => void;
  onGitCreateBranch: (name: string) => void;
  onGitSwitchBranch: (name: string) => void;
  onGitInitRepo: () => void;
  // Workflow props
  workflows: Workflow[];
  onRunWorkflow: (workflow: Workflow) => void;
  onCreateWorkflow: (workflow: Omit<Workflow, 'id'>) => void;
  onUpdateWorkflow: (id: string, workflow: Partial<Workflow>) => void;
  onDeleteWorkflow: (id: string) => void;
  currentlyRunningWorkflow: string | null;
  // History props
  historyEntries: HistoryEntry[];
  onRestoreEntry?: (entry: HistoryEntry) => void;
  // Invite/Share
  onInvite: () => void;
}

type SidebarTab = 'files' | 'search' | 'git' | 'packages' | 'workflows' | 'history';

export const Sidebar = ({ 
  files,
  fileContents,
  onFileSelect, 
  onCreateFile, 
  onDeleteFile, 
  onRenameFile, 
  onUploadFiles,
  onImportScratchProject,
  activeFileId,
  currentLanguage,
  gitState,
  onGitCommit,
  onGitStageFile,
  onGitUnstageFile,
  onGitDiscardChanges,
  onGitCreateBranch,
  onGitSwitchBranch,
  onGitInitRepo,
  workflows,
  onRunWorkflow,
  onCreateWorkflow,
  onUpdateWorkflow,
  onDeleteWorkflow,
  currentlyRunningWorkflow,
  historyEntries,
  onRestoreEntry,
  onInvite,
}: SidebarProps) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileType, setNewFileType] = useState<'file' | 'folder'>('file');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Listen for global keyboard shortcut to focus search
  useEffect(() => {
    const handleFocusSearch = () => {
      setActiveTab('search');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    };
    window.addEventListener('ide-focus-search', handleFocusSearch);
    return () => window.removeEventListener('ide-focus-search', handleFocusSearch);
  }, []);

  // Flatten file tree to get all files
  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    const result: FileNode[] = [];
    const traverse = (items: FileNode[]) => {
      for (const item of items) {
        if (item.type === 'file') {
          result.push(item);
        }
        if (item.children) {
          traverse(item.children);
        }
      }
    };
    traverse(nodes);
    return result;
  };

  // Search results
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const allFiles = getAllFiles(files);
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      const matches: SearchResult['matches'] = [];
      
      // Search in filename
      const fileNameMatch = file.name.toLowerCase().includes(query);
      
      // Search in content
      if (file.content) {
        const lines = file.content.split('\n');
        lines.forEach((line, index) => {
          const lowerLine = line.toLowerCase();
          let searchStart = 0;
          let matchIndex = lowerLine.indexOf(query, searchStart);
          
          while (matchIndex !== -1) {
            matches.push({
              line: index + 1,
              text: line,
              matchStart: matchIndex,
              matchEnd: matchIndex + query.length,
            });
            searchStart = matchIndex + 1;
            matchIndex = lowerLine.indexOf(query, searchStart);
          }
        });
      }

      if (fileNameMatch || matches.length > 0) {
        results.push({ file, matches });
      }
    }

    return results;
  }, [searchQuery, files]);

  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg'];
  const officeExtensions = ['docx', 'xlsx', 'pptx'];
  
  const isImageFile = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(ext);
  };

  const isOfficeFile = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return officeExtensions.includes(ext);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const scratchFiles = Array.from(uploadedFiles).filter((file) => file.name.toLowerCase().endsWith('.sb3'));
    scratchFiles.forEach((file) => onImportScratchProject?.(file));

    const readFiles = Array.from(uploadedFiles)
      .filter((file) => !file.name.toLowerCase().endsWith('.sb3'))
      .map((file) => {
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
        // Read binary media/office files as data URLs, text files as plain text
        if (isImageFile(file.name) || isOfficeFile(file.name)) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
      if (activeTab !== 'files') setActiveTab('files');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    Array.from(droppedFiles)
      .filter((file) => file.name.toLowerCase().endsWith('.sb3'))
      .forEach((file) => onImportScratchProject?.(file));

    const readFiles = Array.from(droppedFiles)
      .filter((file) => !file.name.toLowerCase().endsWith('.sb3'))
      .map((file) => {
      return new Promise<{ name: string; content: string; language: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          resolve({
            name: file.name,
            content: (ev.target?.result as string) || '',
            language: getFileLanguage(file.name),
          });
        };
        reader.onerror = () => {
          resolve({ name: file.name, content: '', language: getFileLanguage(file.name) });
        };
        if (isImageFile(file.name) || isOfficeFile(file.name)) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    });

    Promise.all(readFiles).then((files) => {
      onUploadFiles(files);
    });
  };


  const tabs = [
    { id: 'files' as const, icon: Files, label: 'Files' },
    { id: 'search' as const, icon: Search, label: 'Search' },
    { id: 'git' as const, icon: GitBranch, label: 'Version Control' },
    { id: 'packages' as const, icon: Package, label: 'Packages' },
    { id: 'workflows' as const, icon: Zap, label: 'Workflows' },
  ];

  const handleNewFile = (name: string, type: 'file' | 'folder') => {
    // Create at root level (first folder)
    const rootFolder = files[0];
    onCreateFile(rootFolder?.id || null, name, type);
  };

  return (
    <div 
      className="flex h-full bg-sidebar relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">Drop files here</span>
          </div>
        </div>
      )}
      {/* Icon rail - Replit style narrow sidebar */}
      <div className="w-11 flex flex-col items-center py-1.5 border-r border-border bg-background">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-md mb-0.5 transition-colors relative',
              activeTab === tab.id
                ? 'text-foreground bg-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
            title={tab.label}
          >
            {activeTab === tab.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
            )}
            <tab.icon className="w-[18px] h-[18px]" />
          </button>
        ))}
        
        <div className="flex-1" />
        
        <button
          onClick={onInvite}
          className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Invite"
        >
          <Users className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors relative',
            activeTab === 'history' && 'text-foreground bg-accent'
          )}
          title="History"
        >
          {activeTab === 'history' && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
          )}
          <History className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Settings"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeTab === 'files' && (
          <>
            <div className="flex items-center justify-between h-9 px-3 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
                        setNewFileType('file');
                        setShowNewFileDialog(true);
                        setShowNewMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
                    >
                      <FilePlus className="w-3.5 h-3.5" /> New File
                    </button>
                    <button
                      onClick={() => {
                        setNewFileType('folder');
                        setShowNewFileDialog(true);
                        setShowNewMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> New Folder
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setShowNewMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload Files
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".js,.ts,.jsx,.tsx,.html,.css,.json,.md,.txt,.py,.go,.rs,.java,.cpp,.c,.h,.xml,.yaml,.yml,.toml,.env,.gitignore,.png,.jpg,.jpeg,.gif,.webp,.ico,.bmp,.svg"
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
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search in files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-input border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  ref={searchInputRef}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto ide-scrollbar">
              {searchQuery.trim() === '' ? (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  Type to search across all files
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  No results found for "{searchQuery}"
                </p>
              ) : (
                <div className="py-1">
                  {searchResults.map((result) => (
                    <div key={result.file.id} className="border-b border-border last:border-b-0">
                      <button
                        onClick={() => onFileSelect(result.file)}
                        className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                      >
                        <FileIcon name={result.file.name} type="file" />
                        <span className="text-sm font-medium truncate">{result.file.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
                        </span>
                      </button>
                      {result.matches.slice(0, 5).map((match, idx) => (
                        <button
                          key={idx}
                          onClick={() => onFileSelect(result.file)}
                          className="w-full px-3 py-1 text-left hover:bg-accent/50 flex items-start gap-2 pl-8"
                        >
                          <span className="text-xs text-muted-foreground w-8 shrink-0 text-right">
                            {match.line}
                          </span>
                          <span className="text-xs font-mono truncate">
                            {match.text.slice(0, match.matchStart)}
                            <span className="bg-yellow-500/30 text-yellow-200">
                              {match.text.slice(match.matchStart, match.matchEnd)}
                            </span>
                            {match.text.slice(match.matchEnd)}
                          </span>
                        </button>
                      ))}
                      {result.matches.length > 5 && (
                        <p className="text-xs text-muted-foreground px-3 py-1 pl-8">
                          ... and {result.matches.length - 5} more matches
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'git' && (
          <GitPanel
            gitState={gitState}
            onCommit={onGitCommit}
            onStageFile={onGitStageFile}
            onUnstageFile={onGitUnstageFile}
            onDiscardChanges={onGitDiscardChanges}
            onCreateBranch={onGitCreateBranch}
            onSwitchBranch={onGitSwitchBranch}
            onInitRepo={onGitInitRepo}
          />
        )}

        {activeTab === 'packages' && (
          <PackagePanel files={files} currentLanguage={currentLanguage} />
        )}

        {activeTab === 'workflows' && (
          <WorkflowsPanel
            workflows={workflows}
            onRunWorkflow={onRunWorkflow}
            onCreateWorkflow={onCreateWorkflow}
            onUpdateWorkflow={onUpdateWorkflow}
            onDeleteWorkflow={onDeleteWorkflow}
            currentlyRunning={currentlyRunningWorkflow}
          />
        )}

        

        {activeTab === 'history' && (
          <HistoryPanel entries={historyEntries} onRestoreEntry={onRestoreEntry} />
        )}
      </div>

      <NewFileDialog
        isOpen={showNewFileDialog}
        onClose={() => setShowNewFileDialog(false)}
        onSubmit={handleNewFile}
        defaultType={newFileType}
      />

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};
