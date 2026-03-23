import { useState, useMemo, useRef } from 'react';
import { icons, LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LucideIconPickerProps {
  value: string;
  onChange: (value: string) => void;
  onUploadIcon?: (file: File) => void;
}

const iconEntries = Object.entries(icons) as [string, LucideIcon][];

export const LucideIconPicker = ({ value, onChange, onUploadIcon }: LucideIconPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
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
          <SelectedIcon className="w-6 h-6 text-foreground" />
        ) : (
          <Upload className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Choose an Icon</DialogTitle>
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
              {onUploadIcon && (
                <>
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1 shrink-0">
                    <Upload className="w-3 h-3" /> Upload
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </>
              )}
            </div>

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
                    <Icon className="w-5 h-5 text-foreground" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-8 text-center text-sm text-muted-foreground py-8">No icons match "{search}"</p>
                )}
              </div>
            </ScrollArea>

            {value && !isUrl && (
              <p className="text-xs text-muted-foreground text-center">Selected: <span className="font-medium text-foreground">{value}</span></p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
