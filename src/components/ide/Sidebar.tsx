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
  Palette,
  Check,
  Zap,
  Pencil,
  Trash2,
  Share2,
  Download,
  BookOpen
} from 'lucide-react';
import { FileNode, GitState, Workflow } from '@/types/ide';
import { FileTree } from './FileTree';
import { NewFileDialog } from './NewFileDialog';
import { GitPanel } from './GitPanel';
import { PackagePanel } from './PackagePanel';
import { WorkflowsPanel } from './WorkflowsPanel';
import { HistoryPanel, HistoryEntry } from './HistoryPanel';
import { FileIcon } from './FileIcon';
import { ThemeCreator } from './ThemeCreator';
import { ThemeImportDialog, getThemeShareUrl } from './ThemeImportDialog';
import { ThemeLibrary } from './ThemeLibrary';
import { cn } from '@/lib/utils';
import { getFileLanguage } from '@/data/defaultFiles';
import { useTheme, themeInfo, IDETheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';

// Settings Panel Component
const SettingsPanel = () => {
  const { theme, setTheme, customThemes, addCustomTheme, deleteCustomTheme, updateCustomTheme } = useTheme();
  const themes = Object.keys(themeInfo) as IDETheme[];
  const [showCreator, setShowCreator] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingTheme, setEditingTheme] = useState<import('@/contexts/ThemeContext').CustomTheme | undefined>();
  const [shellExecutorMode, setShellExecutorMode] = useState<'webcontainer' | 'wandbox'>(() => {
    if (typeof window === 'undefined') return 'webcontainer';
    const saved = window.localStorage.getItem('ide.shellExecutorMode');
    return saved === 'wandbox' ? 'wandbox' : 'webcontainer';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ide.shellExecutorMode', shellExecutorMode);
    window.dispatchEvent(new Event('ide-shell-executor-mode-changed'));
  }, [shellExecutorMode]);

  const handleShareTheme = (ct: import('@/contexts/ThemeContext').CustomTheme) => {
    const url = getThemeShareUrl(ct);
    navigator.clipboard.writeText(url);
    toast.success('Theme share link copied to clipboard!');
  };

  if (showCreator) {
    return (
      <ThemeCreator
        existingTheme={editingTheme}
        onSave={(ct) => {
          if (editingTheme) {
            updateCustomTheme(ct);
          } else {
            addCustomTheme(ct);
          }
          setShowCreator(false);
          setEditingTheme(undefined);
        }}
        onBack={() => {
          setShowCreator(false);
          setEditingTheme(undefined);
        }}
      />
    );
  }

  if (showLibrary) {
    return (
      <ThemeLibrary
        onImport={(ct) => {
          addCustomTheme(ct);
        }}
        onBack={() => setShowLibrary(false)}
        existingThemeNames={customThemes.map((t) => t.name)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto ide-scrollbar">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-medium mb-3">Canvas Settings</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Auto-save</span>
            <input type="checkbox" defaultChecked className="accent-primary" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Word wrap</span>
            <input type="checkbox" defaultChecked className="accent-primary" />
          </label>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Shell executor</span>
              <select
                value={shellExecutorMode}
                onChange={(e) => setShellExecutorMode(e.target.value as 'webcontainer' | 'wandbox')}
                className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
              >
                <option value="webcontainer">WebContainer (browser Node.js)</option>
                <option value="wandbox">Wandbox API</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Use WebContainer for native Node.js shell commands in browser, or switch back to Wandbox routing.
            </p>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium">Theme</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowLibrary(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Browse community library"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Import shared theme"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setEditingTheme(undefined); setShowCreator(true); }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>
        </div>

        {/* Custom themes */}
        {customThemes.length > 0 && (
          <div className="mb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium px-2">Custom</span>
            <div className="space-y-1 mt-1">
              {customThemes.map((ct) => (
                <div
                  key={ct.id}
                  className={cn(
                    'w-full flex items-center justify-between p-2 rounded-md text-left transition-colors group',
                    theme === `custom-${ct.id}`
                      ? 'bg-primary/20 text-primary'
                      : 'hover:bg-accent'
                  )}
                >
                  <button
                    onClick={() => setTheme(`custom-${ct.id}`)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[ct.colors.background, ct.colors.primary, ct.colors.syntaxKeyword].map((c, i) => (
                          <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <div className="text-sm font-medium">{ct.name}</div>
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleShareTheme(ct)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="Copy share link"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        // Publish to community library (stored in localStorage for now)
                        const published = JSON.parse(localStorage.getItem('ide-published-themes') || '[]');
                        if (published.some((p: any) => p.name === ct.name)) {
                          toast.info(`"${ct.name}" is already in the community library`);
                          return;
                        }
                        published.push({ name: ct.name, author: 'you', tags: ['community'], colors: ct.colors });
                        localStorage.setItem('ide-published-themes', JSON.stringify(published));
                        toast.success(`"${ct.name}" published to community library!`);
                      }}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="Publish to community library"
                    >
                      <Upload className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => { setEditingTheme(ct); setShowCreator(true); }}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteCustomTheme(ct.id)}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {theme === `custom-${ct.id}` && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Built-in themes */}
        <div>
          {customThemes.length > 0 && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium px-2">Built-in</span>
          )}
          <div className="space-y-1 mt-1">
            {themes.map((themeKey) => (
              <button
                key={themeKey}
                onClick={() => setTheme(themeKey)}
                className={cn(
                  'w-full flex items-center justify-between p-2 rounded-md text-left transition-colors',
                  theme === themeKey
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-accent'
                )}
              >
                <div>
                  <div className="text-sm font-medium">{themeInfo[themeKey].name}</div>
                  <div className="text-xs text-muted-foreground">
                    {themeInfo[themeKey].description}
                  </div>
                </div>
                {theme === themeKey && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ThemeImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={(ct) => addCustomTheme(ct)}
      />
    </div>
  );
};

interface SearchResult {
  file: FileNode;
  matches: { line: number; text: string; matchStart: number; matchEnd: number }[];
}

interface SidebarProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  onCreateFile: (parentId: string | null, name: string, type: 'file' | 'folder') => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onUploadFiles: (files: { name: string; content: string; language: string }[]) => void;
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

type SidebarTab = 'files' | 'search' | 'git' | 'packages' | 'workflows' | 'settings' | 'history';

export const Sidebar = ({ 
  files, 
  onFileSelect, 
  onCreateFile, 
  onDeleteFile, 
  onRenameFile, 
  onUploadFiles,
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
  
  const isImageFile = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(ext);
  };

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
        // Read images as data URLs, text files as text
        if (isImageFile(file.name)) {
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

    const readFiles = Array.from(droppedFiles).map((file) => {
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
        if (isImageFile(file.name)) {
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
    { id: 'settings' as const, icon: Settings, label: 'Settings' },
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

        {activeTab === 'settings' && (
          <SettingsPanel />
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
    </div>
  );
};
