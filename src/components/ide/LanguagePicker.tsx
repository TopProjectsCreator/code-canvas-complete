import { useState } from 'react';
import { 
  Code2, 
  FileCode, 
  Terminal as TerminalIcon,
  Braces,
  Coffee,
  Cpu,
  Globe,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type LanguageTemplate = 'html' | 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'c' | 'go' | 'rust' | 'ruby' | 'php' | 'swift' | 'kotlin' | 'csharp' | 'bash';

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
  {
    id: 'html',
    name: 'HTML/CSS/JS',
    icon: <Globe className="w-8 h-8" />,
    description: 'Build a website with HTML, CSS, and JavaScript',
    color: 'from-orange-500 to-red-500',
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
  {
    id: 'python',
    name: 'Python',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Great for beginners, AI, and data science',
    color: 'from-green-500 to-blue-500',
  },
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
  {
    id: 'csharp',
    name: 'C#',
    icon: <Code2 className="w-8 h-8" />,
    description: 'Versatile language for .NET and games',
    color: 'from-purple-600 to-violet-700',
  },
  {
    id: 'bash',
    name: 'Bash',
    icon: <TerminalIcon className="w-8 h-8" />,
    description: 'Shell scripting for automation',
    color: 'from-green-600 to-emerald-700',
  },
];

export const LanguagePicker = ({ onSelect }: LanguagePickerProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Create a new Repl
          </h1>
          <p className="text-lg text-muted-foreground">
            Choose a language or template to get started
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {languages.map((lang) => (
            <button
              key={lang.id}
              onClick={() => onSelect(lang.id)}
              onMouseEnter={() => setHoveredId(lang.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                'relative p-6 rounded-xl border-2 border-border bg-card transition-all duration-200 text-left group',
                'hover:border-primary hover:shadow-lg hover:scale-[1.02]',
                hoveredId === lang.id && 'border-primary shadow-lg scale-[1.02]'
              )}
            >
              <div
                className={cn(
                  'w-14 h-14 rounded-lg bg-gradient-to-br flex items-center justify-center text-white mb-4',
                  lang.color
                )}
              >
                {lang.icon}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {lang.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {lang.description}
              </p>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Don't see what you need? More templates coming soon!
        </p>
      </div>
    </div>
  );
};
