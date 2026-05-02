import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Plus, ChevronUp, ChevronDown, Loader2, Sparkles, WifiOff, AlertTriangle, Pencil } from 'lucide-react';
import { TerminalLine } from '@/types/ide';
import { cn } from '@/lib/utils';
import { useCodeExecution } from '@/hooks/useCodeExecution';
import { useWebContainer } from '@/hooks/useWebContainer';
import { usePythonExecutorMode } from '@/hooks/usePythonExecutorMode';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { detectDeploymentPlatform } from '@/lib/platform';
import { XTerminal, ProjectFile } from './XTerminal';

const platform = detectDeploymentPlatform();
const genId = () => Math.random().toString(36).slice(2, 9);

interface ShellInstance {
  id: string;
  label: string;
}

interface TerminalProps {
  history: TerminalLine[];
  onCommand: (command: string, output: string[], isError: boolean) => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  stdinPrompt?: { prompts: string[]; code: string; language: string } | null;
  onStdinSubmit?: (stdinValue: string) => void;
  onNewShell?: () => void;
  projectFiles?: ProjectFile[];
  projectId?: string;
}

export const Terminal = ({
  history, onCommand, isMinimized, onToggleMinimize,
  stdinPrompt, onStdinSubmit, onNewShell,
  projectFiles, projectId,
}: TerminalProps) => {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 'console' or a shell instance id
  const [activePane, setActivePane] = useState<string>('shell-default');

  // Shell instances (each gets its own PTY session)
  const [shells, setShells] = useState<ShellInstance[]>([
    { id: 'shell-default', label: '1' },
  ]);

  // Inline tab renaming
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const startRename = (shell: ShellInstance, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(shell.id);
    setRenameValue(shell.label);
  };

  const commitRename = () => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    setShells(prev => prev.map(s =>
      s.id === renamingId ? { ...s, label: trimmed || s.label } : s
    ));
    setRenamingId(null);
  };

  const cancelRename = () => setRenamingId(null);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [stdinInputs, setStdinInputs] = useState<string[]>([]);
  const [currentStdinIndex, setCurrentStdinIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { executeShellCommand, executeCode, isExecuting } = useCodeExecution();
  const { status: webContainerStatus } = useWebContainer();
  const isOnline = useOnlineStatus();
  const pythonExecutorMode = usePythonExecutorMode();

  const isReplitShellActive = platform === 'replit' && activePane !== 'console';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    if (stdinPrompt) {
      setStdinInputs([]);
      setCurrentStdinIndex(0);
      setInput('');
      inputRef.current?.focus();
    }
  }, [stdinPrompt]);

  const addShell = () => {
    const id = `shell-${genId()}`;
    const label = String(shells.length + 1);
    setShells(prev => [...prev, { id, label }]);
    setActivePane(id);
  };

  const closeShell = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (shells.length <= 1) return; // keep at least one
    const idx = shells.findIndex(s => s.id === id);
    const next = shells[idx === 0 ? 1 : idx - 1];
    setShells(prev => prev.filter(s => s.id !== id));
    if (activePane === id) setActivePane(next.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExecuting) return;
    const value = input.trim();
    setInput('');

    if (stdinPrompt && onStdinSubmit) {
      const newInputs = [...stdinInputs, value];
      setStdinInputs(newInputs);
      onCommand(`> ${value}`, [], false);
      if (newInputs.length >= stdinPrompt.prompts.length) {
        onStdinSubmit(newInputs.join('\n'));
      } else {
        setCurrentStdinIndex(newInputs.length);
      }
      return;
    }
    if (!value) return;

    setCommandHistory(prev => [...prev, value]);
    setHistoryIndex(-1);

    if (value === 'clear') { onCommand(value, ['\x1Bc'], false); return; }

    let result;
    if (value.startsWith('js:')) {
      result = await executeCode(value.slice(3).trim(), 'javascript');
    } else if (value.startsWith('node -e ')) {
      result = await executeCode(value.slice(8).replace(/^["']|["']$/g, ''), 'javascript');
    } else {
      result = await executeShellCommand(value);
    }
    onCommand(value, result.error ? [result.error] : result.output, !!result.error);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const i = historyIndex + 1;
        setHistoryIndex(i);
        setInput(commandHistory[commandHistory.length - 1 - i]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const i = historyIndex - 1;
        setHistoryIndex(i);
        setInput(commandHistory[commandHistory.length - 1 - i]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const match = ['help','clear','ls','pwd','echo','node','npm','date','whoami','env','exit']
        .find(cmd => cmd.startsWith(input));
      if (match) setInput(match);
    }
  };

  const generateCommand = async () => {
    if (!aiPrompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-command', { body: { prompt: aiPrompt } });
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
      case 'error': return 'text-destructive';
      case 'info': return 'text-info';
      case 'input': return 'text-foreground';
      default: return 'text-terminal-text';
    }
  };

  return (
    <div className={cn(
      'flex flex-col bg-terminal transition-all duration-200',
      isMinimized ? 'h-9' : platform === 'replit' ? 'h-64' : 'h-48'
    )}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between h-9 px-2 bg-card border-t border-border shrink-0 overflow-x-auto">
        <div className="flex items-center gap-0.5 min-w-0 flex-1">

          {platform === 'replit' ? (
            <>
              {/* Numbered shell tabs */}
              {shells.map(shell => (
                <div
                  key={shell.id}
                  onClick={() => { if (renamingId !== shell.id) setActivePane(shell.id); }}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors shrink-0 group cursor-pointer',
                    activePane === shell.id
                      ? 'text-foreground bg-background'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <TerminalIcon className="w-3 h-3 shrink-0" />

                  {renamingId === shell.id ? (
                    /* Inline rename input */
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                        if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                        e.stopPropagation();
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-16 bg-transparent outline-none border-b border-primary text-foreground text-xs"
                      maxLength={20}
                    />
                  ) : (
                    <span
                      onDoubleClick={e => startRename(shell, e)}
                      title="Double-click to rename"
                    >
                      {shell.label}
                    </span>
                  )}

                  {/* Rename pencil — visible on hover when not already renaming */}
                  {renamingId !== shell.id && (
                    <span
                      role="button"
                      onClick={e => startRename(shell, e)}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity rounded"
                      title="Rename terminal"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </span>
                  )}

                  {shells.length > 1 && renamingId !== shell.id && (
                    <span
                      role="button"
                      onClick={(e) => closeShell(shell.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity rounded"
                      title="Close"
                    >
                      <X className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
              ))}

              {/* Add new shell */}
              <button
                onClick={addShell}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="New terminal"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* Separator */}
              <div className="w-px h-4 bg-border mx-1 shrink-0" />

              {/* Console tab */}
              <button
                onClick={() => setActivePane('console')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors shrink-0',
                  activePane === 'console'
                    ? 'text-foreground bg-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Console
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActivePane('shell-default')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  activePane !== 'console' ? 'text-foreground bg-background' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                Shell
              </button>
              <button
                onClick={() => setActivePane('console')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  activePane === 'console' ? 'text-foreground bg-background' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Console
              </button>
            </>
          )}
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-2 text-xs text-destructive">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </div>
          )}
          {isExecuting && (
            <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span>Running</span>
            </div>
          )}
          {webContainerStatus === 'booting' && (
            <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span>Booting...</span>
            </div>
          )}
          <button
            onClick={onToggleMinimize}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {!isReplitShellActive && (
            <button
              onClick={() => onCommand('clear', ['\x1Bc'], false)}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {!isMinimized && (
        <>
          {/* Shell panes (all mounted simultaneously so PTY sessions stay alive) */}
          {platform === 'replit' && (
            <div className={cn('relative flex-1 overflow-hidden bg-[#0d1117]', activePane === 'console' && 'hidden')}>
              {shells.map(shell => (
                <div
                  key={shell.id}
                  className="absolute inset-0"
                  style={{ visibility: activePane === shell.id ? 'visible' : 'hidden' }}
                >
                  <XTerminal
                    projectFiles={projectFiles}
                    projectId={projectId}
                    isActive={activePane === shell.id}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Console / non-Replit shell log view */}
          <div
            className={cn(
              'flex-1 overflow-auto ide-scrollbar p-3 font-mono text-sm',
              // Show when: console tab active, OR not on Replit
              (activePane !== 'console' && platform === 'replit') && 'hidden'
            )}
            ref={scrollRef}
            onClick={() => inputRef.current?.focus()}
          >
            {pythonExecutorMode === 'pyodide' && activePane !== 'console' && (
              <div className="mb-2 flex items-start gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-1.5 text-xs text-yellow-200 font-sans">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400" />
                <div className="leading-snug">
                  <span className="font-semibold">Pyodide (browser Python) is forced.</span>{' '}
                  These will fail: <code className="font-mono">pip</code>/<code className="font-mono">uv</code>,{' '}
                  <code className="font-mono">subprocess</code>, <code className="font-mono">socket</code>,{' '}
                  <code className="font-mono">requests</code>, DB drivers, GUI toolkits, and packages without a WASM build.
                  Switch to <span className="font-semibold">Auto</span> or <span className="font-semibold">Container</span> in Settings.
                </div>
              </div>
            )}
            {history.map((line) => (
              <div key={line.id} className={cn('leading-relaxed', getLineColor(line.type))}>
                {line.type === 'input' && <span className="text-primary mr-2">$</span>}
                <span className="whitespace-pre-wrap">{line.content}</span>
              </div>
            ))}

            {stdinPrompt && currentStdinIndex < stdinPrompt.prompts.length && (
              <div className="leading-relaxed text-yellow-400">
                <span>📝 {stdinPrompt.prompts[currentStdinIndex]}</span>
              </div>
            )}

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

              <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "p-1.5 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-primary",
                      aiPopoverOpen && "bg-accent text-primary"
                    )}
                    title="Generate command with AI"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Generate a command</p>
                    <p className="text-xs text-muted-foreground">Describe what you want to do in plain English</p>
                    <div className="flex gap-2">
                      <Input
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="e.g., list all .ts files"
                        className="flex-1 text-sm"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); generateCommand(); } }}
                        autoFocus
                      />
                      <Button size="sm" onClick={generateCommand} disabled={isGenerating || !aiPrompt.trim()}>
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
