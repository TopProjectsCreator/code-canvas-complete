import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Plus, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { TerminalLine } from '@/types/ide';
import { cn } from '@/lib/utils';
import { useCodeExecution } from '@/hooks/useCodeExecution';

interface TerminalProps {
  history: TerminalLine[];
  onCommand: (command: string, output: string[], isError: boolean) => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const Terminal = ({ history, onCommand, isMinimized, onToggleMinimize }: TerminalProps) => {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<'shell' | 'console'>('shell');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { executeShellCommand, executeCode, isExecuting } = useCodeExecution();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;

    const command = input.trim();
    setInput('');
    setCommandHistory((prev) => [...prev, command]);
    setHistoryIndex(-1);

    // Check if it's a special local command
    if (command === 'clear') {
      onCommand(command, ['\x1Bc'], false);
      return;
    }

    // Check if it's a JavaScript expression (starts with js: or node -e)
    let result;
    if (command.startsWith('js:')) {
      const jsCode = command.slice(3).trim();
      result = await executeCode(jsCode, 'javascript');
    } else if (command.startsWith('node -e ')) {
      const jsCode = command.slice(8).replace(/^["']|["']$/g, '');
      result = await executeCode(jsCode, 'javascript');
    } else {
      result = await executeShellCommand(command);
    }

    const output = result.error 
      ? [result.error] 
      : result.output;
    
    onCommand(command, output, !!result.error);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion for common commands
      const commands = ['help', 'clear', 'ls', 'pwd', 'echo', 'node', 'npm', 'date', 'whoami', 'env', 'exit'];
      const match = commands.find(cmd => cmd.startsWith(input));
      if (match) setInput(match);
    }
  };

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'error':
        return 'text-destructive';
      case 'info':
        return 'text-info';
      case 'input':
        return 'text-foreground';
      default:
        return 'text-terminal-text';
    }
  };

  return (
    <div className={cn(
      'flex flex-col bg-terminal border-t border-border transition-all duration-200',
      isMinimized ? 'h-10' : 'h-48'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-background border-b border-border">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('shell')}
            className={cn(
              "flex items-center gap-2 px-2 py-1 text-sm rounded transition-colors",
              activeTab === 'shell' ? 'text-primary bg-accent' : 'hover:bg-accent text-muted-foreground'
            )}
          >
            <TerminalIcon className="w-4 h-4" />
            Shell
          </button>
          <button 
            onClick={() => setActiveTab('console')}
            className={cn(
              "flex items-center gap-2 px-2 py-1 text-sm rounded transition-colors",
              activeTab === 'console' ? 'text-primary bg-accent' : 'hover:bg-accent text-muted-foreground'
            )}
          >
            Console
          </button>
        </div>
        <div className="flex items-center gap-1">
          {isExecuting && (
            <Loader2 className="w-4 h-4 text-primary animate-spin mr-2" />
          )}
          <button 
            onClick={onToggleMinimize}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button className="p-1 rounded hover:bg-accent text-muted-foreground">
            <Plus className="w-4 h-4" />
          </button>
          <button className="p-1 rounded hover:bg-accent text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal content */}
      {!isMinimized && (
        <div 
          ref={scrollRef}
          className="flex-1 overflow-auto ide-scrollbar p-3 font-mono text-sm"
          onClick={() => inputRef.current?.focus()}
        >
          {history.map((line) => (
            <div key={line.id} className={cn('leading-relaxed', getLineColor(line.type))}>
              {line.type === 'input' && <span className="text-primary mr-2">$</span>}
              <span className="whitespace-pre-wrap">{line.content}</span>
            </div>
          ))}
          
          {/* Input line */}
          <form onSubmit={handleSubmit} className="flex items-center">
            <span className="text-primary mr-2">$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-foreground caret-primary"
              disabled={isExecuting}
              placeholder={isExecuting ? 'Executing...' : ''}
              autoFocus
            />
            {!isExecuting && <span className="w-2 h-5 bg-primary animate-cursor-blink" />}
          </form>
        </div>
      )}
    </div>
  );
};
