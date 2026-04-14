import { useState, useMemo, useRef } from 'react';
import { icons, LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Paintbrush } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LucideIconPickerProps {
  value: string;
  onChange: (value: string) => void;
  onUploadIcon?: (file: File) => void;
  color?: string;
  onColorChange?: (color: string) => void;
}

const iconEntries = Object.entries(icons) as [string, LucideIcon][];

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#ffffff',
];

export const LucideIconPicker = ({ value, onChange, onUploadIcon, color, onColorChange }: LucideIconPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showColors, setShowColors] = useState(false);
  const [customColor, setCustomColor] = useState(color || '');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return iconEntries.slice(0, 200);
    const q = search.toLowerCase();
    return iconEntries.filter(([name]) => name.toLowerCase().includes(q)).slice(0, 200);
  }, [search]);

  const isUrl = value.startsWith('http') || value.startsWith('data:');
  const SelectedIcon = !isUrl && value ? (icons as Record<string, LucideIcon>)[value] : null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadIcon) {
      onUploadIcon(file);
      setOpen(false);
    }
  };

  const iconStyle = color ? { color } : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center justify-center w-12 h-12 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30',
          value && 'border-solid border-primary/30'
        )}
      >
        {isUrl ? (
          <img src={value} alt="icon" className="w-6 h-6 object-contain" />
        ) : SelectedIcon ? (
          <SelectedIcon className="w-6 h-6" style={iconStyle || { color: 'hsl(var(--foreground))' }} />
        ) : (
          <Upload className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Choose an Icon</DialogTitle>
            <DialogDescription>Pick a Lucide icon, set a color, or upload a custom image.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search icons..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1"
                autoFocus
              />
              {onColorChange && (
                <Button
                  variant={showColors ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowColors(!showColors)}
                  className="gap-1 shrink-0"
                >
                  <Paintbrush className="w-3 h-3" />
                  Color
                </Button>
              )}
              {onUploadIcon && (
                <>
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1 shrink-0">
                    <Upload className="w-3 h-3" /> Upload
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </>
              )}
            </div>

            {showColors && onColorChange && (
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { onColorChange(c); setCustomColor(c); }}
                    className={cn(
                      'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                      color === c ? 'border-primary scale-110' : 'border-border'
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <input
                  type="color"
                  value={customColor || '#3b82f6'}
                  onChange={e => { setCustomColor(e.target.value); onColorChange(e.target.value); }}
                  className="w-6 h-6 rounded cursor-pointer border border-border"
                  title="Custom color"
                />
                {color && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { onColorChange(''); setCustomColor(''); }}>
                    Reset
                  </Button>
                )}
              </div>
            )}

            <ScrollArea className="h-[350px]">
              <div className="grid grid-cols-8 gap-1 p-1">
                {filtered.map(([name, Icon]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => { onChange(name); setOpen(false); }}
                    className={cn(
                      'flex flex-col items-center justify-center p-2 rounded-md hover:bg-accent/50 transition-colors group',
                      value === name && 'bg-primary/10 ring-1 ring-primary'
                    )}
                    title={name}
                  >
                    <Icon className="w-5 h-5" style={color ? { color } : { color: 'hsl(var(--foreground))' }} />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-8 text-center text-sm text-muted-foreground py-8">No icons match "{search}"</p>
                )}
              </div>
            </ScrollArea>

            {value && !isUrl && (
              <p className="text-xs text-muted-foreground text-center">
                Selected: <span className="font-medium text-foreground">{value}</span>
                {color && <> · Color: <span className="inline-block w-3 h-3 rounded-full align-middle ml-1" style={{ backgroundColor: color }} /></>}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
