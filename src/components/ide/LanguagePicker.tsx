import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Code2, 
  FileCode, 
  Terminal as TerminalIcon,
  Braces,
  Coffee,
  Cpu,
  Globe,
  Sparkles,
  Search,
  X,
  Bot,
  Send,
  Loader2,
  User,
  Paperclip,
  Image,
  FileVideo,
  FileAudio,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import { useAttachments } from '@/hooks/useAttachments';

export type LanguageTemplate = 
  | 'blank' | 'html' | 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'c' | 'go' | 'rust' 
  | 'ruby' | 'php' | 'csharp' | 'bash' | 'lua' | 'perl'
  | 'r' | 'haskell' | 'nim' | 'zig' | 'lisp' | 'd' | 'groovy' | 'pascal'
  | 'react' | 'nodejs' | 'flask' | 'django' | 'sqlite' | 'arduino' | 'scratch';

interface LanguageOption {
  id: LanguageTemplate;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

interface LanguagePickerProps {
  onSelect: (template: LanguageTemplate) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const TEMPLATE_IDS: LanguageTemplate[] = [
  'blank', 'html', 'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust',
  'ruby', 'php', 'csharp', 'bash', 'lua', 'perl', 'r', 'haskell', 'nim', 'zig', 'lisp',
  'd', 'groovy', 'pascal', 'react', 'nodejs', 'flask', 'django', 'sqlite', 'arduino', 'scratch'
];

const languages: LanguageOption[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    icon: <FileCode className="w-8 h-8" />,
    description: 'Start from scratch with an empty project',
    color: 'from-gray-400 to-gray-600',
  },
  {
    id: 'html',
    name: 'HTML/CSS/JS',
    icon: <Globe className="w-8 h-8" />,
    description: 'Build web pages with HTML, CSS, and JavaScript',
    color: 'from-orange-500 to-red-600',
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    icon: <Braces className="w-8 h-8" />,
    description: 'Dynamic programming with JavaScript',
    color: 'from-yellow-400 to-yellow-600',
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Type-safe JavaScript with TypeScript',
    color: 'from-blue-400 to-blue-600',
  },
  {
    id: 'python',
    name: 'Python',
    icon: <TerminalIcon className="w-8 h-8" />,
    description: 'Versatile programming with Python',
    color: 'from-green-500 to-blue-500',
  },
  {
    id: 'java',
    name: 'Java',
    icon: <Coffee className="w-8 h-8" />,
    description: 'Enterprise-grade Java development',
    color: 'from-red-500 to-orange-500',
  },
  {
    id: 'cpp',
    name: 'C++',
    icon: <Code2 className="w-8 h-8" />,
    description: 'High-performance C++ programming',
    color: 'from-blue-600 to-purple-600',
  },
  {
    id: 'c',
    name: 'C',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Systems programming with C',
    color: 'from-gray-500 to-blue-500',
  },
  {
    id: 'go',
    name: 'Go',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Simple and efficient Go programming',
    color: 'from-cyan-400 to-blue-500',
  },
  {
    id: 'rust',
    name: 'Rust',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Safe and fast systems programming',
    color: 'from-orange-600 to-red-700',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Elegant Ruby programming',
    color: 'from-red-500 to-pink-500',
  },
  {
    id: 'php',
    name: 'PHP',
    icon: <Globe className="w-8 h-8" />,
    description: 'Web development with PHP',
    color: 'from-indigo-400 to-purple-500',
  },
  {
    id: 'csharp',
    name: 'C#',
    icon: <Code2 className="w-8 h-8" />,
    description: '.NET development with C#',
    color: 'from-green-500 to-emerald-600',
  },
  {
    id: 'bash',
    name: 'Bash',
    icon: <TerminalIcon className="w-8 h-8" />,
    description: 'Shell scripting with Bash',
    color: 'from-gray-600 to-gray-800',
  },
  {
    id: 'lua',
    name: 'Lua',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Lightweight scripting with Lua',
    color: 'from-blue-700 to-indigo-800',
  },
  {
    id: 'perl',
    name: 'Perl',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Text processing with Perl',
    color: 'from-blue-400 to-cyan-500',
  },
  {
    id: 'r',
    name: 'R',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Statistical computing with R',
    color: 'from-blue-500 to-gray-500',
  },
  {
    id: 'haskell',
    name: 'Haskell',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Functional programming with Haskell',
    color: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'nim',
    name: 'Nim',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Efficient compiled language',
    color: 'from-yellow-500 to-amber-600',
  },
  {
    id: 'zig',
    name: 'Zig',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Modern systems programming',
    color: 'from-orange-500 to-yellow-500',
  },
  {
    id: 'lisp',
    name: 'Common Lisp',
    icon: <Braces className="w-8 h-8" />,
    description: 'Symbolic programming with Lisp',
    color: 'from-red-400 to-pink-600',
  },
  {
    id: 'd',
    name: 'D',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Systems programming with D',
    color: 'from-red-600 to-red-800',
  },
  {
    id: 'groovy',
    name: 'Groovy',
    icon: <Coffee className="w-8 h-8" />,
    description: 'JVM scripting with Groovy',
    color: 'from-blue-400 to-teal-500',
  },
  {
    id: 'pascal',
    name: 'Pascal',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Structured programming with Pascal',
    color: 'from-blue-300 to-blue-500',
  },
  {
    id: 'react',
    name: 'React',
    icon: <Globe className="w-8 h-8" />,
    description: 'Build UIs with React components',
    color: 'from-cyan-400 to-blue-500',
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    icon: <TerminalIcon className="w-8 h-8" />,
    description: 'Server-side JavaScript with Node.js',
    color: 'from-green-500 to-green-700',
  },
  {
    id: 'flask',
    name: 'Flask',
    icon: <Globe className="w-8 h-8" />,
    description: 'Python web framework',
    color: 'from-gray-400 to-gray-600',
  },
  {
    id: 'django',
    name: 'Django',
    icon: <Globe className="w-8 h-8" />,
    description: 'Full-featured Python web framework',
    color: 'from-green-600 to-emerald-700',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    icon: <Braces className="w-8 h-8" />,
    description: 'Embedded database with SQLite',
    color: 'from-blue-400 to-cyan-500',
  },
  {
    id: 'arduino',
    name: 'Arduino',
    icon: <Cpu className="w-8 h-8" />,
    description: 'Embedded systems with Arduino boards',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'scratch',
    name: 'Scratch Blocks',
    icon: <Bot className="w-8 h-8" />,
    description: 'Visual block programming with .sb3 import/export',
    color: 'from-orange-400 to-blue-500',
  },
];

// AI Template Assistant component
const TemplateAssistant = ({ onSelect }: { onSelect: (template: LanguageTemplate) => void }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    attachments, fileInputRef, addFiles, removeAttachment,
    clearAttachments, openFilePicker, buildContentParts, acceptString,
  } = useAttachments();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const extractTemplateId = (text: string): LanguageTemplate | null => {
    const match = text.match(/\[template:(\w+)\]/);
    if (match && TEMPLATE_IDS.includes(match[1] as LanguageTemplate)) {
      return match[1] as LanguageTemplate;
    }
    return null;
  };

  const cleanContent = (text: string): string => {
    return text.replace(/\[template:\w+\]/g, '').trim();
  };

  const send = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);

    // Build multimodal content for the API
    const multimodalContent = buildContentParts(input.trim(), attachments);
    const apiMessage = { role: 'user' as const, content: multimodalContent };

    setInput('');
    clearAttachments();
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/template-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: [...allMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })), apiMessage] }),
        }
      );

      if (!resp.ok || !resp.body) {
        throw new Error('Failed to get response');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { /* partial JSON, skip */ }
        }
      }
    } catch (err) {
      console.error('Template assistant error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that. Try picking a template from the grid!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-medium">Not sure? Ask AI</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[480px] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Template Assistant</h3>
            <p className="text-[10px] text-muted-foreground">Tell me what you want to build</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3 ide-scrollbar">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <Sparkles className="w-8 h-8 mx-auto text-primary/50" />
            <div>
              <p className="text-sm text-muted-foreground">Describe what you want to build</p>
              <p className="text-xs text-muted-foreground/70 mt-1">e.g. "I want to build a REST API" or "I'm a beginner learning to code"</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className={cn(
              'max-w-[80%] rounded-lg px-3 py-2 text-sm',
              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
            )}>
              {msg.role === 'assistant' ? (
                <div>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{cleanContent(msg.content)}</ReactMarkdown>
                  </div>
                  {/* Template suggestion button */}
                  {(() => {
                    const templateId = extractTemplateId(msg.content);
                    if (!templateId) return null;
                    const lang = languages.find(l => l.id === templateId);
                    return (
                      <button
                        onClick={() => onSelect(templateId)}
                        className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-colors"
                      >
                        <div className={cn('w-6 h-6 rounded bg-gradient-to-br flex items-center justify-center text-white', lang?.color || 'from-gray-400 to-gray-600')}>
                          <div className="scale-50">{lang?.icon}</div>
                        </div>
                        <span className="text-xs font-medium text-primary">
                          Use {lang?.name || templateId}
                        </span>
                        <Sparkles className="w-3 h-3 text-primary ml-auto" />
                      </button>
                    );
                  })()}
                </div>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {attachments.map(att => (
              <div key={att.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/50 border border-border text-[10px]">
                {att.type === 'image' ? <Image className="w-2.5 h-2.5 text-primary" /> :
                 att.type === 'video' ? <FileVideo className="w-2.5 h-2.5 text-primary" /> :
                 att.type === 'audio' ? <FileAudio className="w-2.5 h-2.5 text-primary" /> :
                 <FileText className="w-2.5 h-2.5 text-primary" />}
                <span className="max-w-[80px] truncate text-foreground">{att.name}</span>
                <button onClick={() => removeAttachment(att.id)} className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptString}
          className="hidden"
          onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = ''; } }}
        />

        <div className="flex gap-2">
          <button
            onClick={openFilePicker}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="What do you want to build?"
            className="flex-1 text-sm"
            disabled={isLoading}
          />
          <button
            onClick={send}
            disabled={(!input.trim() && attachments.length === 0) || isLoading}
            className={cn(
              'p-2.5 rounded-lg transition-colors',
              (input.trim() || attachments.length > 0) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const LanguagePicker = ({ onSelect }: LanguagePickerProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) return languages;
    const query = searchQuery.toLowerCase();
    return languages.filter(
      lang =>
        lang.name.toLowerCase().includes(query) ||
        lang.description.toLowerCase().includes(query) ||
        lang.id.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Create a Canvas
          </h1>
          <p className="text-muted-foreground">
            Choose a template to get started
          </p>
        </div>

        {/* Search bar */}
        <div className="relative max-w-lg mx-auto mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-11 text-sm bg-card border-border rounded-lg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {filteredLanguages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No templates found for "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredLanguages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => onSelect(lang.id)}
                onMouseEnter={() => setHoveredId(lang.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  'relative p-4 rounded-lg border border-border bg-card transition-all duration-150 text-left group',
                  'hover:border-primary/50 hover:bg-accent/30',
                  hoveredId === lang.id && 'border-primary/50 bg-accent/30'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white mb-3',
                    lang.color
                  )}
                >
                  <div className="scale-75">
                    {lang.icon}
                  </div>
                </div>
                <h3 className="text-sm font-medium text-foreground mb-0.5">
                  {lang.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {lang.description}
                </p>
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          {filteredLanguages.length} template{filteredLanguages.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* AI Template Assistant */}
      <TemplateAssistant onSelect={onSelect} />
    </div>
  );
};
