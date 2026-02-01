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

// Git types
export interface GitCommit {
  id: string;
  message: string;
  timestamp: Date;
  author: string;
  files: string[];
}

export interface GitBranch {
  name: string;
  isActive: boolean;
  commits: GitCommit[];
}

export interface GitChange {
  fileId: string;
  fileName: string;
  status: 'added' | 'modified' | 'deleted';
  originalContent?: string;
}

export interface GitState {
  branches: GitBranch[];
  currentBranch: string;
  changes: GitChange[];
  isInitialized: boolean;
}

// Workflow types
export interface Workflow {
  id: string;
  name: string;
  type: 'run' | 'build' | 'test' | 'deploy' | 'custom';
  command: string;
  description?: string;
  trigger?: 'manual' | 'on-save' | 'on-commit';
  lastRun?: Date;
  lastStatus?: 'success' | 'failed' | 'running';
  isDefault?: boolean;
}

export interface IDEState {
  files: FileNode[];
  openTabs: Tab[];
  activeTabId: string | null;
  terminalHistory: TerminalLine[];
  isRunning: boolean;
  consoleOutput: ConsoleLog[];
  git: GitState;
  workflows: Workflow[];
}
