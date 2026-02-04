import { useState, useMemo } from 'react';
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
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export type LanguageTemplate = 
  | 'html' | 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'c' | 'go' | 'rust' 
  | 'ruby' | 'php' | 'swift' | 'kotlin' | 'csharp' | 'bash' | 'lua' | 'perl' | 'scala' 
  | 'r' | 'haskell' | 'elixir' 
  // New templates
  | 'react' | 'nodejs' | 'flask' | 'django' | 'sqlite' | 'clojure' | 'dart' | 'julia' 
  | 'nim' | 'zig' | 'fortran' | 'cobol' | 'fsharp' | 'ocaml' | 'erlang' | 'crystal'
  | 'assembly' | 'lisp' | 'prolog' | 'racket';

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

const languages: LanguageOption[] = [
  // Popular Web Templates
  {
    id: 'html',
    name: 'HTML/CSS/JS',
    icon: <Globe className="w-8 h-8" />,
    description: 'Build a website with HTML, CSS, and JavaScript',
    color: 'from-orange-500 to-red-500',
  },
  {
    id: 'react',
    name: 'React',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Build UIs with React components',
    color: 'from-cyan-400 to-blue-500',
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    icon: <Braces className="w-8 h-8" />,
    description: 'Server-side JavaScript with Express',
    color: 'from-green-500 to-green-700',
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    icon: <Braces className="w-8 h-8" />,
    description: 'Run JavaScript with Node.js',
    color: 'from-yellow-400 to-yellow-600',
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    icon: <FileCode className="w-8 h-8" />,
    description: 'JavaScript with types for better development',
    color: 'from-blue-500 to-blue-700',
  },
  // Python Ecosystem
  {
    id: 'python',
    name: 'Python',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Great for beginners, AI, and data science',
    color: 'from-green-500 to-blue-500',
  },
  {
    id: 'flask',
    name: 'Flask',
    icon: <Globe className="w-8 h-8" />,
    description: 'Lightweight Python web framework',
    color: 'from-gray-600 to-gray-800',
  },
  {
    id: 'django',
    name: 'Django',
    icon: <Globe className="w-8 h-8" />,
    description: 'Full-featured Python web framework',
    color: 'from-green-700 to-green-900',
  },
  // Systems Languages
  {
    id: 'java',
    name: 'Java',
    icon: <Coffee className="w-8 h-8" />,
    description: 'Object-oriented programming for enterprise apps',
    color: 'from-red-600 to-orange-500',
  },
  {
    id: 'cpp',
    name: 'C++',
    icon: <Cpu className="w-8 h-8" />,
    description: 'High-performance systems programming',
    color: 'from-blue-600 to-purple-600',
  },
  {
    id: 'c',
    name: 'C',
    icon: <TerminalIcon className="w-8 h-8" />,
    description: 'Low-level systems and embedded programming',
    color: 'from-gray-500 to-gray-700',
  },
  {
    id: 'go',
    name: 'Go',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Simple, fast, and reliable backend development',
    color: 'from-cyan-400 to-cyan-600',
  },
  {
    id: 'rust',
    name: 'Rust',
    icon: <Cpu className="w-8 h-8" />,
    description: 'Memory-safe systems programming',
    color: 'from-orange-600 to-red-700',
  },
  {
    id: 'zig',
    name: 'Zig',
    icon: <Cpu className="w-8 h-8" />,
    description: 'Modern systems programming language',
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'nim',
    name: 'Nim',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Efficient and expressive compiled language',
    color: 'from-yellow-500 to-amber-600',
  },
  // Scripting & Web
  {
    id: 'ruby',
    name: 'Ruby',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Elegant and productive web development',
    color: 'from-red-500 to-pink-600',
  },
  {
    id: 'php',
    name: 'PHP',
    icon: <Globe className="w-8 h-8" />,
    description: 'Popular server-side scripting language',
    color: 'from-indigo-500 to-purple-600',
  },
  {
    id: 'dart',
    name: 'Dart',
    icon: <Braces className="w-8 h-8" />,
    description: 'Client-optimized language for Flutter',
    color: 'from-blue-400 to-cyan-500',
  },
  // Mobile & Apple
  {
    id: 'swift',
    name: 'Swift',
    icon: <Braces className="w-8 h-8" />,
    description: 'Modern language for Apple platforms',
    color: 'from-orange-500 to-pink-500',
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    icon: <Coffee className="w-8 h-8" />,
    description: 'Modern JVM language for Android development',
    color: 'from-purple-500 to-blue-600',
  },
  // .NET Ecosystem
  {
    id: 'csharp',
    name: 'C#',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Versatile language for .NET and games',
    color: 'from-purple-600 to-violet-700',
  },
  {
    id: 'fsharp',
    name: 'F#',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Functional-first .NET language',
    color: 'from-blue-600 to-cyan-600',
  },
  // Data & Scientific
  {
    id: 'sqlite',
    name: 'SQLite',
    icon: <Cpu className="w-8 h-8" />,
    description: 'Embedded SQL database queries',
    color: 'from-sky-500 to-blue-600',
  },
  {
    id: 'r',
    name: 'R',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Statistical computing and data analysis',
    color: 'from-blue-500 to-gray-600',
  },
  {
    id: 'julia',
    name: 'Julia',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'High-performance scientific computing',
    color: 'from-purple-500 to-green-500',
  },
  {
    id: 'fortran',
    name: 'Fortran',
    icon: <Cpu className="w-8 h-8" />,
    description: 'Numeric and scientific computing',
    color: 'from-purple-700 to-indigo-800',
  },
  // Functional Languages
  {
    id: 'haskell',
    name: 'Haskell',
    icon: <Braces className="w-8 h-8" />,
    description: 'Pure functional programming',
    color: 'from-purple-700 to-purple-900',
  },
  {
    id: 'elixir',
    name: 'Elixir',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Scalable and fault-tolerant applications',
    color: 'from-purple-500 to-pink-600',
  },
  {
    id: 'erlang',
    name: 'Erlang',
    icon: <Cpu className="w-8 h-8" />,
    description: 'Concurrent and distributed systems',
    color: 'from-red-600 to-pink-700',
  },
  {
    id: 'ocaml',
    name: 'OCaml',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Powerful functional programming',
    color: 'from-orange-500 to-yellow-600',
  },
  {
    id: 'clojure',
    name: 'Clojure',
    icon: <Braces className="w-8 h-8" />,
    description: 'Lisp for the JVM with immutability',
    color: 'from-green-600 to-teal-600',
  },
  {
    id: 'lisp',
    name: 'Common Lisp',
    icon: <Braces className="w-8 h-8" />,
    description: 'The original programmable programming language',
    color: 'from-gray-600 to-gray-800',
  },
  {
    id: 'racket',
    name: 'Racket',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Language-oriented programming',
    color: 'from-red-500 to-blue-600',
  },
  // Logic & Scripting
  {
    id: 'prolog',
    name: 'Prolog',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Logic programming for AI',
    color: 'from-orange-600 to-red-600',
  },
  {
    id: 'scala',
    name: 'Scala',
    icon: <Braces className="w-8 h-8" />,
    description: 'Functional and object-oriented JVM language',
    color: 'from-red-600 to-red-800',
  },
  {
    id: 'lua',
    name: 'Lua',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Lightweight scripting for games and embedded',
    color: 'from-blue-800 to-indigo-900',
  },
  {
    id: 'perl',
    name: 'Perl',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Text processing and system administration',
    color: 'from-sky-600 to-blue-700',
  },
  {
    id: 'crystal',
    name: 'Crystal',
    icon: <Sparkles className="w-8 h-8" />,
    description: 'Ruby-like syntax with C performance',
    color: 'from-gray-400 to-gray-600',
  },
  // Shell & Low-level
  {
    id: 'bash',
    name: 'Bash',
    icon: <TerminalIcon className="w-8 h-8" />,
    description: 'Shell scripting for automation',
    color: 'from-green-600 to-emerald-700',
  },
  {
    id: 'assembly',
    name: 'Assembly',
    icon: <Cpu className="w-8 h-8" />,
    description: 'Low-level hardware programming',
    color: 'from-gray-700 to-gray-900',
  },
  {
    id: 'cobol',
    name: 'COBOL',
    icon: <TerminalIcon className="w-8 h-8" />,
    description: 'Legacy business applications',
    color: 'from-blue-800 to-blue-950',
  },
];

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
            Create a Repl
          </h1>
          <p className="text-muted-foreground">
            Choose a template to get started
          </p>
        </div>

        {/* Search bar - Replit style */}
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
    </div>
  );
};
