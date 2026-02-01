import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  User, 
  Loader2, 
  FileCode, 
  Bug, 
  Lightbulb, 
  TestTube,
  Play,
  Zap,
  Code,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { FileNode, TerminalLine } from '@/types/ide';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  requiresFile: boolean;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile: FileNode | null;
  consoleOutput?: TerminalLine[];
  onInsertCode?: (code: string) => void;
  onRunTest?: (testCode: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const quickActions: QuickAction[] = [
  {
    id: 'explain',
    label: 'Explain',
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    prompt: 'Explain this code in simple terms. What does it do and how does it work?',
    requiresFile: true,
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: <Bug className="w-3.5 h-3.5" />,
    prompt: 'Find potential bugs, errors, or issues in this code. Suggest fixes.',
    requiresFile: true,
  },
  {
    id: 'improve',
    label: 'Improve',
    icon: <Zap className="w-3.5 h-3.5" />,
    prompt: 'Suggest improvements to make this code cleaner, more efficient, and follow best practices.',
    requiresFile: true,
  },
  {
    id: 'test',
    label: 'Write Tests',
    icon: <TestTube className="w-3.5 h-3.5" />,
    prompt: 'Write comprehensive unit tests for this code. Include edge cases and common scenarios.',
    requiresFile: true,
  },
];

export const AIChat = ({ 
  isOpen, 
  onClose, 
  currentFile, 
  consoleOutput,
  onInsertCode,
  onRunTest 
}: AIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm **Replit Agent** 🤖\n\nI can help you:\n- 📖 **Explain** your code\n- 🐛 **Debug** errors and issues\n- ⚡ **Improve** code quality\n- 🧪 **Write tests** for your functions\n\nOpen a file and use the quick actions below, or ask me anything!",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sendMessage = useCallback(async (messageContent?: string) => {
    const content = messageContent || input.trim();
    if (!content || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';

    try {
      // Include console output for debugging context
      const recentErrors = consoleOutput
        ?.filter(line => line.type === 'error')
        .slice(-5)
        .map(line => line.content)
        .join('\n');

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages.slice(1), userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentFile: currentFile
            ? {
                name: currentFile.name,
                language: currentFile.language,
                content: currentFile.content?.slice(0, 8000),
              }
            : null,
          consoleErrors: recentErrors || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const assistantId = generateId();
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantContent } : m
                )
              );
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, currentFile, consoleOutput]);

  const handleQuickAction = (action: QuickAction) => {
    if (action.requiresFile && !currentFile) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: '⚠️ Please open a file first to use this action.',
        },
      ]);
      return;
    }
    sendMessage(action.prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Replit Agent</h3>
            <p className="text-xs text-muted-foreground">AI Coding Assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Current file indicator */}
      {currentFile && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 text-xs">
            <FileCode className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">Context:</span>
            <span className="text-foreground font-medium truncate">{currentFile.name}</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading || (action.requiresFile && !currentFile)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                action.requiresFile && !currentFile
                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105'
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4 ide-scrollbar">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        const codeContent = String(children).replace(/\n$/, '');
                        
                        if (isInline) {
                          return (
                            <code className="bg-background/50 px-1 py-0.5 rounded text-xs" {...props}>
                              {children}
                            </code>
                          );
                        }
                        
                        return (
                          <div className="relative group my-2">
                            <pre className="bg-background/50 p-3 rounded-lg overflow-x-auto">
                              <code className="text-xs" {...props}>
                                {children}
                              </code>
                            </pre>
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => copyToClipboard(codeContent)}
                                className="p-1.5 rounded bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                                title="Copy code"
                              >
                                {copiedCode === codeContent ? (
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {onInsertCode && (
                                <button
                                  onClick={() => onInsertCode(codeContent)}
                                  className="p-1.5 rounded bg-background/80 hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-colors"
                                  title="Insert into editor"
                                >
                                  <Code className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      },
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    }}
                  >
                    {message.content || '...'}
                  </ReactMarkdown>
                </div>
              ) : (
                message.content
              )}
            </div>
            {message.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentFile ? `Ask about ${currentFile.name}...` : 'Ask me anything...'}
            className="flex-1 resize-none bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className={cn(
              'p-2.5 rounded-lg transition-colors',
              input.trim() && !isLoading
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Powered by Lovable AI • Press Enter to send
        </p>
      </div>
    </div>
  );
};
