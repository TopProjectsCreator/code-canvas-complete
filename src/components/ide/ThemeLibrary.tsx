import { useState, useMemo } from 'react';
import { ArrowLeft, Search, Download, Palette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CustomTheme, CustomThemeColors } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ThemeLibraryProps {
  onImport: (theme: CustomTheme) => void;
  onBack: () => void;
  existingThemeNames: string[];
}

interface CommunityTheme {
  name: string;
  author: string;
  tags: string[];
  colors: CustomThemeColors;
}

const COMMUNITY_THEMES: CommunityTheme[] = [
  {
    name: 'Tokyo Night',
    author: 'enkia',
    tags: ['dark', 'blue', 'purple', 'popular'],
    colors: {
      background: '#1a1b26', foreground: '#c0caf5', primary: '#7aa2f7',
      card: '#1f2335', border: '#292e42', terminalBg: '#16161e', terminalText: '#9ece6a',
      syntaxKeyword: '#bb9af7', syntaxString: '#9ece6a', syntaxFunction: '#7aa2f7', syntaxComment: '#565f89',
    },
  },
  {
    name: 'Cyberpunk',
    author: 'community',
    tags: ['dark', 'neon', 'pink', 'futuristic'],
    colors: {
      background: '#0d0d1a', foreground: '#e0e0ff', primary: '#ff2a6d',
      card: '#12122a', border: '#1a1a3e', terminalBg: '#080810', terminalText: '#05d9e8',
      syntaxKeyword: '#ff2a6d', syntaxString: '#05d9e8', syntaxFunction: '#d1f7ff', syntaxComment: '#4a4a6a',
    },
  },
  {
    name: 'Rosé Pine',
    author: 'rose-pine',
    tags: ['dark', 'purple', 'warm', 'popular'],
    colors: {
      background: '#191724', foreground: '#e0def4', primary: '#c4a7e7',
      card: '#1f1d2e', border: '#26233a', terminalBg: '#14121f', terminalText: '#9ccfd8',
      syntaxKeyword: '#c4a7e7', syntaxString: '#f6c177', syntaxFunction: '#9ccfd8', syntaxComment: '#6e6a86',
    },
  },
  {
    name: 'Forest',
    author: 'community',
    tags: ['dark', 'green', 'nature', 'calm'],
    colors: {
      background: '#1a2214', foreground: '#c8d6b9', primary: '#7fba52',
      card: '#1f2a18', border: '#2a3620', terminalBg: '#141c10', terminalText: '#7fba52',
      syntaxKeyword: '#e0a526', syntaxString: '#7fba52', syntaxFunction: '#56b6c2', syntaxComment: '#5c6e4f',
    },
  },
  {
    name: 'Catppuccin Mocha',
    author: 'catppuccin',
    tags: ['dark', 'pastel', 'warm', 'popular'],
    colors: {
      background: '#1e1e2e', foreground: '#cdd6f4', primary: '#cba6f7',
      card: '#252540', border: '#313244', terminalBg: '#181825', terminalText: '#a6e3a1',
      syntaxKeyword: '#cba6f7', syntaxString: '#a6e3a1', syntaxFunction: '#89b4fa', syntaxComment: '#6c7086',
    },
  },
  {
    name: 'Gruvbox Dark',
    author: 'morhetz',
    tags: ['dark', 'retro', 'warm', 'orange'],
    colors: {
      background: '#282828', foreground: '#ebdbb2', primary: '#fe8019',
      card: '#3c3836', border: '#504945', terminalBg: '#1d2021', terminalText: '#b8bb26',
      syntaxKeyword: '#fb4934', syntaxString: '#b8bb26', syntaxFunction: '#fabd2f', syntaxComment: '#928374',
    },
  },
  {
    name: 'Synthwave 84',
    author: 'robb0wen',
    tags: ['dark', 'neon', 'retro', 'purple'],
    colors: {
      background: '#262335', foreground: '#ffffff', primary: '#ff7edb',
      card: '#2a2139', border: '#34294f', terminalBg: '#1e1a30', terminalText: '#72f1b8',
      syntaxKeyword: '#fede5d', syntaxString: '#ff8b39', syntaxFunction: '#36f9f6', syntaxComment: '#848bbd',
    },
  },
  {
    name: 'Ayu Dark',
    author: 'ayu-theme',
    tags: ['dark', 'orange', 'minimal', 'clean'],
    colors: {
      background: '#0a0e14', foreground: '#b3b1ad', primary: '#e6b450',
      card: '#0d1117', border: '#1d252c', terminalBg: '#080b10', terminalText: '#7fd962',
      syntaxKeyword: '#ff8f40', syntaxString: '#c2d94c', syntaxFunction: '#ffb454', syntaxComment: '#626a73',
    },
  },
  {
    name: 'Palenight',
    author: 'whizkydee',
    tags: ['dark', 'blue', 'material', 'popular'],
    colors: {
      background: '#292d3e', foreground: '#a6accd', primary: '#82aaff',
      card: '#2f3344', border: '#3a3f58', terminalBg: '#232738', terminalText: '#c3e88d',
      syntaxKeyword: '#c792ea', syntaxString: '#c3e88d', syntaxFunction: '#82aaff', syntaxComment: '#676e95',
    },
  },
  {
    name: 'Midnight Blue',
    author: 'community',
    tags: ['dark', 'blue', 'deep', 'calm'],
    colors: {
      background: '#0f1729', foreground: '#c8d3e6', primary: '#4fc1ff',
      card: '#142038', border: '#1e3050', terminalBg: '#0b1220', terminalText: '#43d08a',
      syntaxKeyword: '#c678dd', syntaxString: '#98c379', syntaxFunction: '#4fc1ff', syntaxComment: '#5c6e8a',
    },
  },
  {
    name: 'Sunset Glow',
    author: 'community',
    tags: ['dark', 'warm', 'orange', 'red'],
    colors: {
      background: '#1f1315', foreground: '#e8d5c4', primary: '#ff6e40',
      card: '#2a1a1c', border: '#3d2528', terminalBg: '#180f11', terminalText: '#ffd180',
      syntaxKeyword: '#ff5370', syntaxString: '#c3e88d', syntaxFunction: '#ffcb6b', syntaxComment: '#6b5050',
    },
  },
  {
    name: 'Arctic Ice',
    author: 'community',
    tags: ['dark', 'blue', 'cold', 'minimal'],
    colors: {
      background: '#151b27', foreground: '#d4dce8', primary: '#7ec8e3',
      card: '#1a2233', border: '#243044', terminalBg: '#101720', terminalText: '#88d498',
      syntaxKeyword: '#ae81ff', syntaxString: '#88d498', syntaxFunction: '#7ec8e3', syntaxComment: '#546178',
    },
  },
];

const ALL_TAGS = [...new Set(COMMUNITY_THEMES.flatMap((t) => t.tags))];

export const ThemeLibrary = ({ onImport, onBack, existingThemeNames }: ThemeLibraryProps) => {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = COMMUNITY_THEMES;
    if (activeTag) {
      list = list.filter((t) => t.tags.includes(activeTag));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.author.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
      );
    }
    return list;
  }, [search, activeTag]);

  const handleImport = (ct: CommunityTheme) => {
    if (existingThemeNames.includes(ct.name)) {
      toast.info(`"${ct.name}" is already in your themes`);
      return;
    }
    const theme: CustomTheme = {
      id: Math.random().toString(36).substring(2, 9),
      name: ct.name,
      colors: { ...ct.colors },
    };
    onImport(theme);
    toast.success(`"${ct.name}" added to your themes`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <button onClick={onBack} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-medium">Theme Library</h3>
      </div>

      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search themes..."
            className="h-8 text-sm pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors capitalize',
                activeTag === tag
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-muted-foreground hover:text-foreground'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto ide-scrollbar p-3 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No themes match your search</div>
        )}
        {filtered.map((ct) => {
          const alreadyAdded = existingThemeNames.includes(ct.name);
          return (
            <div
              key={ct.name}
              className="rounded-md border border-border overflow-hidden hover:border-primary/40 transition-colors group"
            >
              {/* Preview */}
              <div className="text-[10px] font-mono">
                <div className="p-2" style={{ backgroundColor: ct.colors.background, color: ct.colors.foreground }}>
                  <div>
                    <span style={{ color: ct.colors.syntaxKeyword }}>import</span>{' '}
                    <span style={{ color: ct.colors.syntaxFunction }}>React</span>{' '}
                    <span style={{ color: ct.colors.syntaxKeyword }}>from</span>{' '}
                    <span style={{ color: ct.colors.syntaxString }}>'react'</span>;
                  </div>
                  <div style={{ color: ct.colors.syntaxComment }}>{'// ' + ct.name}</div>
                </div>
                <div className="px-2 py-1" style={{ backgroundColor: ct.colors.terminalBg, color: ct.colors.terminalText }}>
                  $ npm start
                </div>
              </div>
              {/* Info */}
              <div className="p-2 flex items-center justify-between bg-card">
                <div>
                  <div className="text-xs font-medium">{ct.name}</div>
                  <div className="text-[10px] text-muted-foreground">by {ct.author}</div>
                </div>
                <Button
                  size="sm"
                  variant={alreadyAdded ? 'outline' : 'default'}
                  className="h-6 text-[10px] gap-1 px-2"
                  onClick={() => handleImport(ct)}
                  disabled={alreadyAdded}
                >
                  {alreadyAdded ? (
                    'Added'
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
