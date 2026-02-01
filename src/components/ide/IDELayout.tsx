import { useState, useCallback } from 'react';
import { FileNode, Tab, TerminalLine } from '@/types/ide';
import { defaultFiles, findFileById } from '@/data/defaultFiles';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { EditorTabs } from './EditorTabs';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { Preview } from './Preview';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

const generateId = () => Math.random().toString(36).substring(2, 9);

export const IDELayout = () => {
  const [files, setFiles] = useState<FileNode[]>(defaultFiles);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([
    { id: '1', type: 'info', content: '🚀 Welcome to Replit Shell! Type "help" for available commands.', timestamp: new Date() },
    { id: '2', type: 'output', content: 'Try: echo "Hello World", node -e "console.log(1+1)", or js: Math.random()', timestamp: new Date() },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});

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
        </div>
      </div>
    </div>
  );
};
