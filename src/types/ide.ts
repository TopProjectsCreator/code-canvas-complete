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

// Arduino types
export interface ArduinoBoard {
  id: string;
  name: string;
  cpu: string;
  flash: number; // KB
  ram: number; // KB
  pins: number;
  voltage: number; // volts
  serial: boolean;
  wifi: boolean;
  bluetooth: boolean;
}

export interface ArduinoPin {
  number: number;
  name: string;
  mode: 'digital' | 'analog' | 'pwm' | 'i2c' | 'spi' | 'uart';
  state: 'high' | 'low' | number; // 0-255 for PWM/analog
}

export interface ArduinoComponent {
  id: string;
  type: string; // 'led', 'resistor', 'button', 'sensor', 'servo', etc.
  label: string;
  pins: { [key: string]: number }; // e.g., { positive: 5, negative: 0 }
  properties: Record<string, any>;
  x: number;
  y: number;
}

export interface BreadboardCircuit {
  id: string;
  boardId: string;
  components: ArduinoComponent[];
  // legacy field, not currently used by visualizer; kept for backward compatibility
  connections?: Array<{
    from: { componentId: string; pin: string };
    to: { componentId: string | 'board'; pin: string | number };
  }>;
  /**
   * Wires drawn on the breadboard. Stored with screen coordinates so the layout
   * is preserved across loads. The visualizer keeps this in sync.
   */
  wires?: import('@/components/arduino/breadboard/types').Wire[];
  code: string;
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
