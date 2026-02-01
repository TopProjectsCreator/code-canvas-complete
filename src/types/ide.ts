export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
}

export interface Tab {
  id: string;
  name: string;
  fileId: string;
  isModified: boolean;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info';
  content: string;
  timestamp: Date;
}

export interface ConsoleLog {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

export interface IDEState {
  files: FileNode[];
  openTabs: Tab[];
  activeTabId: string | null;
  terminalHistory: TerminalLine[];
  isRunning: boolean;
  consoleOutput: ConsoleLog[];
}
