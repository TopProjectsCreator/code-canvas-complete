import { useState } from 'react';
import { ArrowLeft, Save, Trash2, Paintbrush } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CustomTheme, CustomThemeColors } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeCreatorProps {
  existingTheme?: CustomTheme;
  onSave: (theme: CustomTheme) => void;
  onBack: () => void;
}

const defaultColors: CustomThemeColors = {
  background: '#1a1b26',
  foreground: '#c0caf5',
  primary: '#7aa2f7',
  card: '#1f2335',
  border: '#292e42',
  terminalBg: '#16161e',
  terminalText: '#9ece6a',
  syntaxKeyword: '#bb9af7',
  syntaxString: '#9ece6a',
  syntaxFunction: '#7aa2f7',
  syntaxComment: '#565f89',
};

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

const ColorField = ({ label, value, onChange }: ColorFieldProps) => (
  <div className="flex items-center gap-2">
    <label
      className="relative w-8 h-8 rounded-md border border-border cursor-pointer overflow-hidden shrink-0"
      style={{ backgroundColor: value }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
    <div className="flex-1 min-w-0">
      <span className="text-xs text-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">{value}</span>
    </div>
  </div>
);

const presets: { name: string; colors: CustomThemeColors }[] = [
  {
    name: 'Tokyo Night',
    colors: {
      background: '#1a1b26', foreground: '#c0caf5', primary: '#7aa2f7',
      card: '#1f2335', border: '#292e42', terminalBg: '#16161e', terminalText: '#9ece6a',
      syntaxKeyword: '#bb9af7', syntaxString: '#9ece6a', syntaxFunction: '#7aa2f7', syntaxComment: '#565f89',
    },
  },
  {
    name: 'Cyberpunk',
    colors: {
      background: '#0d0d1a', foreground: '#e0e0ff', primary: '#ff2a6d',
      card: '#12122a', border: '#1a1a3e', terminalBg: '#080810', terminalText: '#05d9e8',
      syntaxKeyword: '#ff2a6d', syntaxString: '#05d9e8', syntaxFunction: '#d1f7ff', syntaxComment: '#4a4a6a',
    },
  },
  {
    name: 'Forest',
    colors: {
      background: '#1a2214', foreground: '#c8d6b9', primary: '#7fba52',
      card: '#1f2a18', border: '#2a3620', terminalBg: '#141c10', terminalText: '#7fba52',
      syntaxKeyword: '#e0a526', syntaxString: '#7fba52', syntaxFunction: '#56b6c2', syntaxComment: '#5c6e4f',
    },
  },
  {
    name: 'Rosé Pine',
    colors: {
      background: '#191724', foreground: '#e0def4', primary: '#c4a7e7',
      card: '#1f1d2e', border: '#26233a', terminalBg: '#14121f', terminalText: '#9ccfd8',
      syntaxKeyword: '#c4a7e7', syntaxString: '#f6c177', syntaxFunction: '#9ccfd8', syntaxComment: '#6e6a86',
    },
  },
];

export const ThemeCreator = ({ existingTheme, onSave, onBack }: ThemeCreatorProps) => {
  const [name, setName] = useState(existingTheme?.name || '');
  const [colors, setColors] = useState<CustomThemeColors>(existingTheme?.colors || defaultColors);

  const updateColor = (key: keyof CustomThemeColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: existingTheme?.id || Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      colors,
    });
  };

  const applyPreset = (preset: typeof presets[0]) => {
    setColors(preset.colors);
    if (!name.trim()) setName(preset.name);
  };

  return (
    <div className="flex flex-col h-full overflow-auto ide-scrollbar">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <button onClick={onBack} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-medium">{existingTheme ? 'Edit Theme' : 'Create Theme'}</h3>
      </div>

      <div className="p-3 space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Theme name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Theme"
            className="h-8 text-sm"
            maxLength={30}
          />
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground font-medium">Start from a preset</span>
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="flex items-center gap-2 p-2 rounded-md border border-border hover:border-primary/50 hover:bg-accent/30 transition-colors text-left"
              >
                <div className="flex gap-0.5">
                  {[preset.colors.background, preset.colors.primary, preset.colors.syntaxKeyword, preset.colors.syntaxString].map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-[10px] font-medium truncate">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Core Colors */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Core</span>
          <div className="space-y-2.5">
            <ColorField label="Background" value={colors.background} onChange={(v) => updateColor('background', v)} />
            <ColorField label="Foreground" value={colors.foreground} onChange={(v) => updateColor('foreground', v)} />
            <ColorField label="Primary / Accent" value={colors.primary} onChange={(v) => updateColor('primary', v)} />
            <ColorField label="Card / Panel" value={colors.card} onChange={(v) => updateColor('card', v)} />
            <ColorField label="Border" value={colors.border} onChange={(v) => updateColor('border', v)} />
          </div>
        </div>

        {/* Terminal */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Terminal</span>
          <div className="space-y-2.5">
            <ColorField label="Background" value={colors.terminalBg} onChange={(v) => updateColor('terminalBg', v)} />
            <ColorField label="Text" value={colors.terminalText} onChange={(v) => updateColor('terminalText', v)} />
          </div>
        </div>

        {/* Syntax */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Syntax</span>
          <div className="space-y-2.5">
            <ColorField label="Keywords" value={colors.syntaxKeyword} onChange={(v) => updateColor('syntaxKeyword', v)} />
            <ColorField label="Strings" value={colors.syntaxString} onChange={(v) => updateColor('syntaxString', v)} />
            <ColorField label="Functions" value={colors.syntaxFunction} onChange={(v) => updateColor('syntaxFunction', v)} />
            <ColorField label="Comments" value={colors.syntaxComment} onChange={(v) => updateColor('syntaxComment', v)} />
          </div>
        </div>

        {/* Preview swatch */}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Preview</span>
          <div className="rounded-md overflow-hidden border border-border text-xs font-mono">
            <div className="p-3" style={{ backgroundColor: colors.background, color: colors.foreground }}>
              <div><span style={{ color: colors.syntaxKeyword }}>const</span> <span style={{ color: colors.foreground }}>app</span> <span style={{ color: colors.primary }}>=</span> <span style={{ color: colors.syntaxFunction }}>createApp</span>();</div>
              <div><span style={{ color: colors.syntaxComment }}>{'// Start the server'}</span></div>
              <div><span style={{ color: colors.syntaxKeyword }}>const</span> port <span style={{ color: colors.primary }}>=</span> <span style={{ color: colors.syntaxString }}>"3000"</span>;</div>
            </div>
            <div className="px-3 py-2" style={{ backgroundColor: colors.terminalBg, color: colors.terminalText }}>
              $ npm start
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={!name.trim()} className="w-full gap-2" size="sm">
          <Save className="w-3.5 h-3.5" />
          {existingTheme ? 'Update Theme' : 'Create Theme'}
        </Button>
      </div>
    </div>
  );
};
