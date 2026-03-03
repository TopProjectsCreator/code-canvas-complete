import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Plus, ChevronUp, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { TerminalLine } from '@/types/ide';
import { cn } from '@/lib/utils';
import { useCodeExecution } from '@/hooks/useCodeExecution';
import { useWebContainer } from '@/hooks/useWebContainer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface TerminalProps {
  history: TerminalLine[];
  onCommand: (command: string, output: string[], isError: boolean) => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  stdinPrompt?: { prompts: string[]; code: string; language: string } | null;
  onStdinSubmit?: (stdinValue: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const Terminal = ({ history, onCommand, isMinimized, onToggleMinimize, stdinPrompt, onStdinSubmit }: TerminalProps) => {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<'shell' | 'console'>('shell');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [stdinInputs, setStdinInputs] = useState<string[]>([]);
  const [currentStdinIndex, setCurrentStdinIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { executeShellCommand, executeCode, isExecuting } = useCodeExecution();
  const { status: webContainerStatus } = useWebContainer();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Reset stdin state when a new prompt arrives
  useEffect(() => {
    if (stdinPrompt) {
      setStdinInputs([]);
      setCurrentStdinIndex(0);
      setInput('');
      inputRef.current?.focus();
    }
  }, [stdinPrompt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExecuting) return;

    const value = input.trim();
    setInput('');

    // Handle stdin input mode
    if (stdinPrompt && onStdinSubmit) {
      const newInputs = [...stdinInputs, value];
      setStdinInputs(newInputs);
      
      // Show the entered value in terminal
      onCommand(`> ${value}`, [], false);

      if (newInputs.length >= stdinPrompt.prompts.length) {
        // All inputs collected, submit
        const stdinValue = newInputs.join('\n');
        onStdinSubmit(stdinValue);
      } else {
        setCurrentStdinIndex(newInputs.length);
      }
      return;
    }

    if (!value) return;

    const command = value;
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
          {webContainerStatus === 'booting' && (
            <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span>Booting shell...</span>
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
          
          {/* Stdin prompt display */}
          {stdinPrompt && currentStdinIndex < stdinPrompt.prompts.length && (
            <div className="leading-relaxed text-yellow-400">
              <span>📝 {stdinPrompt.prompts[currentStdinIndex]}</span>
            </div>
          )}
          
          {/* Input line */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <span className="text-primary">{stdinPrompt ? '>' : '$'}</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-foreground caret-primary"
              disabled={isExecuting}
              placeholder={stdinPrompt ? 'Type your input and press Enter...' : (isExecuting ? 'Executing...' : '')}
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
