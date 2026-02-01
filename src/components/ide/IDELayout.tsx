import { useState, useCallback } from 'react';
import { FileNode, Tab, TerminalLine } from '@/types/ide';
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

const generateId = () => Math.random().toString(36).substring(2, 9);

export const IDELayout = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<LanguageTemplate | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([
    { id: '1', type: 'info', content: '🚀 Welcome to Replit Shell! Type "help" for available commands.', timestamp: new Date() },
    { id: '2', type: 'output', content: 'Try: echo "Hello World", node -e "console.log(1+1)", or js: Math.random()', timestamp: new Date() },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});

  const handleSelectTemplate = useCallback((template: LanguageTemplate) => {
    setSelectedTemplate(template);
    setFiles(getTemplateFiles(template));
  }, []);

  // Get the active file
  const activeTab = openTabs.find((tab) => tab.id === activeTabId);
  const activeFile = activeTab ? findFileById(files, activeTab.fileId) : null;

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

  const handleRun = useCallback(() => {
    setIsRunning(true);
    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: 'info',
        content: '🚀 Running your Repl...',
        timestamp: new Date(),
      },
      {
        id: generateId(),
        type: 'output',
        content: 'Server started at https://my-repl.replit.app',
        timestamp: new Date(),
      },
    ]);
  }, []);

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

  // Prepare active file with updated content
  const activeFileWithContent = activeFile
    ? { ...activeFile, content: fileContents[activeFile.id] ?? activeFile.content }
    : null;

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
