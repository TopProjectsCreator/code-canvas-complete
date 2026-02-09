import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Plus, ChevronUp, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { TerminalLine } from '@/types/ide';
import { cn } from '@/lib/utils';
import { useCodeExecution } from '@/hooks/useCodeExecution';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

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
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
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

  const generateCommand = async () => {
    if (!aiPrompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-command', {
        body: { prompt: aiPrompt }
      });
      
      if (error) throw error;
      
      if (data?.command) {
        setInput(data.command);
        setAiPopoverOpen(false);
        setAiPrompt('');
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Failed to generate command:', err);
    } finally {
      setIsGenerating(false);
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
      'flex flex-col bg-terminal transition-all duration-200',
      isMinimized ? 'h-9' : 'h-48'
    )}>
      {/* Header - Replit style */}
      <div className="flex items-center justify-between h-9 px-2 bg-card border-t border-border">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setActiveTab('shell')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors",
              activeTab === 'shell' 
                ? 'text-foreground bg-background' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            Shell
          </button>
          <button 
            onClick={() => setActiveTab('console')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors",
              activeTab === 'console' 
                ? 'text-foreground bg-background' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Console
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          {isExecuting && (
            <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span>Running</span>
            </div>
          )}
          <button 
            onClick={onToggleMinimize}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={() => onCommand('clear', ['\x1Bc'], false)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Clear terminal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="w-3.5 h-3.5" />
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
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <span className="text-primary">$</span>
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
            
            {/* AI Command Generator */}
            <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    "hover:bg-accent text-muted-foreground hover:text-primary",
                    aiPopoverOpen && "bg-accent text-primary"
                  )}
                  title="Generate command with AI"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                align="end" 
                className="w-80 p-3"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="space-y-3">
                  <p className="text-sm font-medium">Generate a command</p>
                  <p className="text-xs text-muted-foreground">
                    Describe what you want to do in plain English
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g., list all .ts files"
                      className="flex-1 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          generateCommand();
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={generateCommand}
                      disabled={isGenerating || !aiPrompt.trim()}
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Go'
                      )}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </form>
        </div>
      )}
    </div>
  );
};
