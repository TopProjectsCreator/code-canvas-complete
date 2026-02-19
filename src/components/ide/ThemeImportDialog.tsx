import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Download, Palette, AlertCircle } from 'lucide-react';
import { CustomTheme, CustomThemeColors } from '@/contexts/ThemeContext';

interface ThemeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (theme: CustomTheme) => void;
  initialData?: string;
}

function decodeThemeData(raw: string): CustomTheme | null {
  try {
    // Try as URL with ?theme= param
    if (raw.includes('?theme=')) {
      const url = new URL(raw);
      raw = url.searchParams.get('theme') || '';
    }
    // Try base64
    let json: string;
    try {
      json = atob(raw.trim());
    } catch {
      json = raw.trim();
    }
    const parsed = JSON.parse(json);
    if (!parsed.name || !parsed.colors) return null;
    // Validate required color keys
    const requiredKeys: (keyof CustomThemeColors)[] = [
      'background', 'foreground', 'primary', 'card', 'border',
      'terminalBg', 'terminalText', 'syntaxKeyword', 'syntaxString',
      'syntaxFunction', 'syntaxComment',
    ];
    for (const key of requiredKeys) {
      if (typeof parsed.colors[key] !== 'string') return null;
    }
    return {
      id: parsed.id || Math.random().toString(36).substring(2, 9),
      name: parsed.name,
      colors: parsed.colors,
    };
  } catch {
    return null;
  }
}

export function encodeThemeData(theme: CustomTheme): string {
  return btoa(JSON.stringify({ name: theme.name, colors: theme.colors }));
}

export function getThemeShareUrl(theme: CustomTheme): string {
  const encoded = encodeThemeData(theme);
  return `${window.location.origin}${window.location.pathname}?theme=${encoded}`;
}

export const ThemeImportDialog = ({ open, onOpenChange, onImport, initialData }: ThemeImportDialogProps) => {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<CustomTheme | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setInput(initialData);
      const theme = decodeThemeData(initialData);
      if (theme) {
        setParsed(theme);
        setError('');
      } else {
        setParsed(null);
        setError('Invalid theme data');
      }
    }
  }, [initialData]);

  useEffect(() => {
    if (!open) {
      setInput('');
      setParsed(null);
      setError('');
    }
  }, [open]);

  const handleInputChange = (val: string) => {
    setInput(val);
    if (!val.trim()) {
      setParsed(null);
      setError('');
      return;
    }
    const theme = decodeThemeData(val);
    if (theme) {
      setParsed(theme);
      setError('');
    } else {
      setParsed(null);
      setError('Invalid theme data. Paste a share URL or JSON.');
    }
  };

  const handleImport = () => {
    if (parsed) {
      // Generate a new unique id to avoid collisions
      onImport({ ...parsed, id: Math.random().toString(36).substring(2, 9) });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Import Theme
          </DialogTitle>
          <DialogDescription>Paste a theme share URL or JSON data to import a custom theme.</DialogDescription>
        </DialogHeader>

        <Textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={'Paste share URL or JSON...\n\nExample: {"name":"My Theme","colors":{...}}'}
          className="min-h-[100px] font-mono text-xs"
        />

        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        {parsed && (
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{parsed.name}</span>
            </div>
            <div className="flex gap-1">
              {Object.values(parsed.colors).slice(0, 8).map((color, i) => (
                <div key={i} className="w-6 h-6 rounded-sm border border-border" style={{ backgroundColor: color }} />
              ))}
            </div>
            {/* Mini preview */}
            <div className="rounded-md overflow-hidden border border-border text-[10px] font-mono">
              <div className="p-2" style={{ backgroundColor: parsed.colors.background, color: parsed.colors.foreground }}>
                <span style={{ color: parsed.colors.syntaxKeyword }}>const</span>{' '}
                <span>hello</span>{' '}
                <span style={{ color: parsed.colors.primary }}>=</span>{' '}
                <span style={{ color: parsed.colors.syntaxString }}>"world"</span>;
              </div>
              <div className="px-2 py-1" style={{ backgroundColor: parsed.colors.terminalBg, color: parsed.colors.terminalText }}>
                $ ready
              </div>
            </div>
          </div>
        )}

        <Button onClick={handleImport} disabled={!parsed} className="w-full gap-2" size="sm">
          <Download className="w-3.5 h-3.5" />
          Import Theme
        </Button>
      </DialogContent>
    </Dialog>
  );
};
