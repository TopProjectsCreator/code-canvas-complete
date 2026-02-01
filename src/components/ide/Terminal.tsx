import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { TerminalLine } from '@/types/ide';
import { cn } from '@/lib/utils';

interface TerminalProps {
  history: TerminalLine[];
  onCommand: (command: string) => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

export const Terminal = ({ history, onCommand, isMinimized, onToggleMinimize }: TerminalProps) => {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onCommand(input.trim());
      setCommandHistory((prev) => [...prev, input.trim()]);
      setInput('');
      setHistoryIndex(-1);
    }
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
          <button className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-accent text-primary">
            <TerminalIcon className="w-4 h-4" />
            Shell
          </button>
          <button className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-accent text-muted-foreground">
            Console
          </button>
        </div>
        <div className="flex items-center gap-1">
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
              autoFocus
            />
            <span className="w-2 h-5 bg-primary animate-cursor-blink" />
          </form>
        </div>
      )}
    </div>
  );
};
