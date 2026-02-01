import { useState, useCallback, useEffect } from 'react';
import { FileNode, Tab, TerminalLine, GitState, GitCommit, GitChange } from '@/types/ide';
import { getTemplateFiles, findFileById, getFileLanguage } from '@/data/defaultFiles';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { EditorTabs } from './EditorTabs';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { Preview } from './Preview';
import { LanguagePicker, LanguageTemplate } from './LanguagePicker';
import { AIChat } from './AIChat';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { useCodeExecution } from '@/hooks/useCodeExecution';

const generateId = () => Math.random().toString(36).substring(2, 9);

// Initial Git state
const initialGitState: GitState = {
  branches: [],
  currentBranch: 'main',
  changes: [],
  isInitialized: false,
};

export const IDELayout = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<LanguageTemplate | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([
    { id: '1', type: 'info', content: '🚀 Welcome to Replit Shell! Type "help" for available commands.', timestamp: new Date() },
    { id: '2', type: 'output', content: 'Click Run to execute your code, or type commands below.', timestamp: new Date() },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [originalFileContents, setOriginalFileContents] = useState<Record<string, string>>({});
  const [gitState, setGitState] = useState<GitState>(initialGitState);
  const { executeCode, isExecuting } = useCodeExecution();

  const handleSelectTemplate = useCallback((template: LanguageTemplate) => {
    setSelectedTemplate(template);
    const templateFiles = getTemplateFiles(template);
    setFiles(templateFiles);
    
    // Store original file contents for Git tracking
    const originals: Record<string, string> = {};
    const collectContents = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'file' && node.content) {
          originals[node.id] = node.content;
        }
        if (node.children) collectContents(node.children);
      });
    };
    collectContents(templateFiles);
    setOriginalFileContents(originals);
  }, []);

  // Get the active file
  const activeTab = openTabs.find((tab) => tab.id === activeTabId);
  const activeFile = activeTab ? findFileById(files, activeTab.fileId) : null;
  
  // Prepare active file with updated content
  const activeFileWithContent = activeFile
    ? { ...activeFile, content: fileContents?.[activeFile.id] ?? activeFile.content }
    : null;

  // Track Git changes when files are modified
  useEffect(() => {
    if (!gitState.isInitialized) return;

    const changes: GitChange[] = [];
    
    // Check for modified files
    Object.entries(fileContents).forEach(([fileId, content]) => {
      const originalContent = originalFileContents[fileId];
      const file = findFileById(files, fileId);
      
      if (file && content !== (originalContent ?? file.content)) {
        changes.push({
          fileId,
          fileName: file.name,
          status: originalContent === undefined ? 'added' : 'modified',
          originalContent,
        });
      }
    });

    // Check for new files not in original
    const checkNewFiles = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'file' && !originalFileContents[node.id] && !changes.find(c => c.fileId === node.id)) {
          changes.push({
            fileId: node.id,
            fileName: node.name,
            status: 'added',
          });
        }
        if (node.children) checkNewFiles(node.children);
      });
    };
    checkNewFiles(files);

    setGitState(prev => ({ ...prev, changes }));
  }, [fileContents, files, originalFileContents, gitState.isInitialized]);

  // Git handlers
  const handleGitInitRepo = useCallback(() => {
    const initialCommit: GitCommit = {
      id: generateId(),
      message: 'Initial commit',
      timestamp: new Date(),
      author: 'You',
      files: [],
    };

    // Collect all current files for initial commit
    const fileNames: string[] = [];
    const collectFiles = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'file') fileNames.push(node.name);
        if (node.children) collectFiles(node.children);
      });
    };
    collectFiles(files);
    initialCommit.files = fileNames;

    // Store current contents as original
    const originals: Record<string, string> = {};
    const collectContents = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'file') {
          originals[node.id] = fileContents[node.id] ?? node.content ?? '';
        }
        if (node.children) collectContents(node.children);
      });
    };
    collectContents(files);
    setOriginalFileContents(originals);

    setGitState({
      isInitialized: true,
      currentBranch: 'main',
      branches: [{ name: 'main', isActive: true, commits: [initialCommit] }],
      changes: [],
    });

    setTerminalHistory(prev => [...prev, {
      id: generateId(),
      type: 'info',
      content: '📦 Initialized Git repository with initial commit',
      timestamp: new Date(),
    }]);
  }, [files, fileContents]);

  const handleGitCommit = useCallback((message: string) => {
    if (gitState.changes.length === 0) return;

    const commit: GitCommit = {
      id: generateId(),
      message,
      timestamp: new Date(),
      author: 'You',
      files: gitState.changes.map(c => c.fileName),
    };

    // Update original contents to current
    const newOriginals = { ...originalFileContents };
    gitState.changes.forEach(change => {
      if (change.status !== 'deleted') {
        const file = findFileById(files, change.fileId);
        if (file) {
          newOriginals[change.fileId] = fileContents[change.fileId] ?? file.content ?? '';
        }
      }
    });
    setOriginalFileContents(newOriginals);

    setGitState(prev => ({
      ...prev,
      changes: [],
      branches: prev.branches.map(branch =>
        branch.name === prev.currentBranch
          ? { ...branch, commits: [commit, ...branch.commits] }
          : branch
      ),
    }));

    setTerminalHistory(prev => [...prev, {
      id: generateId(),
      type: 'info',
      content: `✓ Committed: "${message}" (${gitState.changes.length} file${gitState.changes.length !== 1 ? 's' : ''})`,
      timestamp: new Date(),
    }]);
  }, [gitState.changes, files, fileContents, originalFileContents]);

  const handleGitStageFile = useCallback((fileId: string) => {
    // In this simplified implementation, all changes are automatically staged
  }, []);

  const handleGitUnstageFile = useCallback((fileId: string) => {
    // In this simplified implementation, we can't unstage
  }, []);

  const handleGitDiscardChanges = useCallback((fileId: string) => {
    const originalContent = originalFileContents[fileId];
    const file = findFileById(files, fileId);
    
    if (file) {
      setFileContents(prev => ({
        ...prev,
        [fileId]: originalContent ?? file.content ?? '',
      }));
    }
  }, [files, originalFileContents]);

  const handleGitCreateBranch = useCallback((name: string) => {
    const currentBranch = gitState.branches.find(b => b.name === gitState.currentBranch);
    
    setGitState(prev => ({
      ...prev,
      currentBranch: name,
      branches: [
        ...prev.branches.map(b => ({ ...b, isActive: false })),
        { name, isActive: true, commits: currentBranch?.commits || [] },
      ],
    }));

    setTerminalHistory(prev => [...prev, {
      id: generateId(),
      type: 'info',
      content: `🌿 Created and switched to branch: ${name}`,
      timestamp: new Date(),
    }]);
  }, [gitState.branches, gitState.currentBranch]);

  const handleGitSwitchBranch = useCallback((name: string) => {
    setGitState(prev => ({
      ...prev,
      currentBranch: name,
      branches: prev.branches.map(b => ({ ...b, isActive: b.name === name })),
    }));

    setTerminalHistory(prev => [...prev, {
      id: generateId(),
      type: 'info',
      content: `🔀 Switched to branch: ${name}`,
      timestamp: new Date(),
    }]);
  }, []);
  // Get content for preview
  const getFileContent = (fileName: string): string => {
    const findFile = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.name === fileName && node.type === 'file') return node;
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const file = findFile(files);
    if (!file) return '';
    return fileContents[file.id] ?? file.content ?? '';
  };

  const htmlContent = getFileContent('index.html');
  const cssContent = getFileContent('style.css');
  const jsContent = getFileContent('script.js');

  const handleFileSelect = useCallback((file: FileNode) => {
    if (file.type === 'folder') return;

    // Check if tab already exists
    const existingTab = openTabs.find((tab) => tab.fileId === file.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // Create new tab
    const newTab: Tab = {
      id: generateId(),
      name: file.name,
      fileId: file.id,
      isModified: false,
    };

    setOpenTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [openTabs]);

  const handleCreateFile = useCallback((parentId: string | null, name: string, type: 'file' | 'folder') => {
    const newFile: FileNode = {
      id: generateId(),
      name,
      type,
      ...(type === 'file' && {
        content: type === 'file' ? getDefaultContent(name) : undefined,
        language: getFileLanguage(name),
      }),
      ...(type === 'folder' && { children: [] }),
    };

    setFiles((prev) => {
      const addToParent = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === parentId && node.type === 'folder') {
            return {
              ...node,
              children: [...(node.children || []), newFile],
            };
          }
          if (node.children) {
            return { ...node, children: addToParent(node.children) };
          }
          return node;
        });
      };

      if (!parentId) {
        // Add to root level
        const root = prev[0];
        if (root && root.type === 'folder') {
          return [{
            ...root,
            children: [...(root.children || []), newFile],
          }];
        }
        return [...prev, newFile];
      }

      return addToParent(prev);
    });

    // If it's a file, open it in a new tab
    if (type === 'file') {
      const newTab: Tab = {
        id: generateId(),
        name: newFile.name,
        fileId: newFile.id,
        isModified: false,
      };
      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
  }, []);

  const handleDeleteFile = useCallback((fileId: string) => {
    setFiles((prev) => {
      const removeFile = (nodes: FileNode[]): FileNode[] => {
        return nodes
          .filter((node) => node.id !== fileId)
          .map((node) => ({
            ...node,
            children: node.children ? removeFile(node.children) : undefined,
          }));
      };
      return removeFile(prev);
    });

    // Close any open tabs for this file
    setOpenTabs((prev) => prev.filter((tab) => tab.fileId !== fileId));
    
    // Clear active tab if it was the deleted file
    if (activeTab?.fileId === fileId) {
      setActiveTabId(null);
    }
  }, [activeTab]);

  const handleRenameFile = useCallback((fileId: string, newName: string) => {
    setFiles((prev) => {
      const renameInTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === fileId) {
            return { 
              ...node, 
              name: newName,
              language: node.type === 'file' ? getFileLanguage(newName) : undefined,
            };
          }
          if (node.children) {
            return { ...node, children: renameInTree(node.children) };
          }
          return node;
        });
      };
      return renameInTree(prev);
    });

    // Update tab name if file is open
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.fileId === fileId ? { ...tab, name: newName } : tab
      )
    );
  }, []);

  const handleUploadFiles = useCallback((uploadedFiles: { name: string; content: string; language: string }[]) => {
    const rootFolder = files[0];
    const parentId = rootFolder?.id || null;

    uploadedFiles.forEach((file) => {
      const newFile: FileNode = {
        id: generateId(),
        name: file.name,
        type: 'file',
        content: file.content,
        language: file.language,
      };

      setFiles((prev) => {
        const addToParent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.id === parentId && node.type === 'folder') {
              return {
                ...node,
                children: [...(node.children || []), newFile],
              };
            }
            if (node.children) {
              return { ...node, children: addToParent(node.children) };
            }
            return node;
          });
        };

        if (!parentId) {
          const root = prev[0];
          if (root && root.type === 'folder') {
            return [{
              ...root,
              children: [...(root.children || []), newFile],
            }];
          }
          return [...prev, newFile];
        }

        return addToParent(prev);
      });

      // Open the file in a new tab
      const newTab: Tab = {
        id: generateId(),
        name: file.name,
        fileId: newFile.id,
        isModified: false,
      };
      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    });
  }, [files]);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const handleTabClose = useCallback((tabId: string) => {
    setOpenTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.id !== tabId);
      
      // If closing active tab, activate another
      if (activeTabId === tabId && newTabs.length > 0) {
        const closedIndex = prev.findIndex((tab) => tab.id === tabId);
        const newActiveIndex = Math.min(closedIndex, newTabs.length - 1);
        setActiveTabId(newTabs[newActiveIndex].id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  const handleContentChange = useCallback((fileId: string, content: string) => {
    setFileContents((prev) => ({ ...prev, [fileId]: content }));
    
    // Mark tab as modified
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.fileId === fileId ? { ...tab, isModified: true } : tab
      )
    );
  }, []);

  const handleCommand = useCallback((command: string, output: string[], isError: boolean) => {
    // Check for clear command
    if (output.length === 1 && output[0] === '\x1Bc') {
      setTerminalHistory([]);
      return;
    }

    const inputLine: TerminalLine = {
      id: generateId(),
      type: 'input',
      content: command,
      timestamp: new Date(),
    };

    const outputLines: TerminalLine[] = output.map(line => ({
      id: generateId(),
      type: isError ? 'error' : 'output',
      content: line,
      timestamp: new Date(),
    }));

    // Handle special commands locally
    if (command === 'run' || command === 'npm start') {
      setIsRunning(true);
      outputLines.push({
        id: generateId(),
        type: 'info',
        content: '🚀 Starting development server...',
        timestamp: new Date(),
      });
      outputLines.push({
        id: generateId(),
        type: 'output',
        content: 'Server started at https://my-repl.replit.app',
        timestamp: new Date(),
      });
    }

    setTerminalHistory((prev) => [...prev, inputLine, ...outputLines]);
  }, []);

  const handleRun = useCallback(async () => {
    // Get the main file to run based on the template or active file
    let fileToRun = activeFileWithContent;
    
    // If no active file, try to find the main file for the template
    if (!fileToRun) {
      const mainFiles = ['main.py', 'Main.java', 'main.cpp', 'main.c', 'main.go', 'main.rs', 'index.js', 'index.ts', 'script.js'];
      for (const mainFile of mainFiles) {
        const findMain = (nodes: FileNode[]): FileNode | null => {
          for (const node of nodes) {
            if (node.name === mainFile && node.type === 'file') return node;
            if (node.children) {
              const found = findMain(node.children);
              if (found) return found;
            }
          }
          return null;
        };
        const found = findMain(files);
        if (found) {
          fileToRun = { ...found, content: fileContents[found.id] ?? found.content };
          break;
        }
      }
    }

    if (!fileToRun || !fileToRun.content) {
      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: 'error',
          content: 'No file to run. Open a file or create one first.',
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setIsRunning(true);
    setIsTerminalMinimized(false);
    
    // Add running message
    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: 'info',
        content: `🚀 Running ${fileToRun!.name}...`,
        timestamp: new Date(),
      },
    ]);

    // Execute the code
    const language = fileToRun.language || getFileLanguage(fileToRun.name);
    const result = await executeCode(fileToRun.content, language);

    // Add output to terminal
    if (result.error) {
      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: 'error',
          content: result.error!,
          timestamp: new Date(),
        },
      ]);
    } else if (result.output.length > 0) {
      const outputLines: TerminalLine[] = result.output.map((line) => ({
        id: generateId(),
        type: 'output' as const,
        content: line,
        timestamp: new Date(),
      }));
      setTerminalHistory((prev) => [...prev, ...outputLines]);
    }

    // Add completion message
    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: 'info',
        content: `✅ Finished running ${fileToRun!.name}`,
        timestamp: new Date(),
      },
    ]);

    setIsRunning(false);
  }, [activeFileWithContent, files, fileContents, executeCode]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: 'info',
        content: '⏹ Stopped.',
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Show language picker if no template selected
  if (!selectedTemplate) {
    return <LanguagePicker onSelect={handleSelectTemplate} />;
  }
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header
        projectName="my-repl"
        isRunning={isRunning}
        onRun={handleRun}
        onStop={handleStop}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleAIChat={() => setIsAIChatOpen(!isAIChatOpen)}
        isAIChatOpen={isAIChatOpen}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            'transition-all duration-200 border-r border-border overflow-hidden',
            isSidebarOpen ? 'w-64' : 'w-0'
          )}
        >
          <Sidebar
            files={files}
            onFileSelect={handleFileSelect}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            onUploadFiles={handleUploadFiles}
            activeFileId={activeTab?.fileId || null}
            gitState={gitState}
            onGitCommit={handleGitCommit}
            onGitStageFile={handleGitStageFile}
            onGitUnstageFile={handleGitUnstageFile}
            onGitDiscardChanges={handleGitDiscardChanges}
            onGitCreateBranch={handleGitCreateBranch}
            onGitSwitchBranch={handleGitSwitchBranch}
            onGitInitRepo={handleGitInitRepo}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Editor panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                <EditorTabs
                  tabs={openTabs}
                  activeTabId={activeTabId}
                  onTabClick={handleTabClick}
                  onTabClose={handleTabClose}
                />
                <div className="flex-1 flex flex-col overflow-hidden">
                  <CodeEditor
                    file={activeFileWithContent}
                    onContentChange={handleContentChange}
                  />
                  <Terminal
                    history={terminalHistory}
                    onCommand={handleCommand}
                    isMinimized={isTerminalMinimized}
                    onToggleMinimize={() => setIsTerminalMinimized(!isTerminalMinimized)}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-border" />

            {/* Preview panel */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <Preview
                htmlContent={htmlContent}
                cssContent={cssContent}
                jsContent={jsContent}
                isRunning={isRunning}
              />
            </ResizablePanel>
          </ResizablePanelGroup>

          {/* AI Chat Sidebar */}
          <AIChat
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
            currentFile={activeFileWithContent}
            consoleOutput={terminalHistory}
            onInsertCode={(code) => {
              if (activeFile) {
                const currentContent = fileContents[activeFile.id] ?? activeFile.content ?? '';
                handleContentChange(activeFile.id, currentContent + '\n\n' + code);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Helper to get default content for new files
function getDefaultContent(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'html':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
</head>
<body>
  
</body>
</html>`;
    case 'css':
      return `/* ${filename} */\n`;
    case 'js':
    case 'ts':
      return `// ${filename}\n`;
    case 'json':
      return `{\n  \n}`;
    case 'md':
      return `# ${filename.replace(/\.md$/, '')}\n`;
    default:
      return '';
  }
}
