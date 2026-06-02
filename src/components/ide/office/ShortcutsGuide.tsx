import { useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SHORTCUTS: { category: string; keys: string; desc: string }[] = [
  { category: 'General', keys: 'Ctrl+S', desc: 'Save' },
  { category: 'General', keys: 'Ctrl+Z', desc: 'Undo' },
  { category: 'General', keys: 'Ctrl+Y / Ctrl+Shift+Z', desc: 'Redo' },
  { category: 'Word', keys: 'Ctrl+B', desc: 'Bold' },
  { category: 'Word', keys: 'Ctrl+I', desc: 'Italic' },
  { category: 'Word', keys: 'Ctrl+U', desc: 'Underline' },
  { category: 'Word', keys: 'Ctrl+F', desc: 'Find' },
  { category: 'Word', keys: 'Ctrl+H', desc: 'Find & Replace' },
  { category: 'Excel', keys: 'Arrow keys', desc: 'Navigate cells' },
  { category: 'Excel', keys: 'F2 / Enter', desc: 'Edit cell' },
  { category: 'Excel', keys: 'Delete / Backspace', desc: 'Clear cell' },
  { category: 'Excel', keys: 'Tab', desc: 'Next column' },
  { category: 'Excel', keys: 'Shift+Tab', desc: 'Previous column' },
  { category: 'Excel', keys: 'Ctrl+C', desc: 'Copy cells' },
  { category: 'Excel', keys: 'Ctrl+V', desc: 'Paste cells' },
  { category: 'PowerPoint', keys: 'Ctrl+Enter', desc: 'New slide' },
  { category: 'PowerPoint', keys: 'F5', desc: 'Start slideshow' },
  { category: 'PowerPoint', keys: 'Esc', desc: 'Exit slideshow' },
  { category: 'PowerPoint', keys: '\u2190 / \u2192', desc: 'Previous / Next slide' },
];

export function ShortcutsGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 w-7" onClick={() => setOpen(true)} title="Keyboard Shortcuts">
        <Keyboard className="w-3.5 h-3.5" />
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setOpen(false)}><X className="w-3 h-3" /></Button>
            </div>
            <div className="p-4 space-y-3">
              {['General', 'Word', 'Excel', 'PowerPoint'].map(cat => {
                const items = SHORTCUTS.filter(s => s.category === cat);
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-medium text-muted-foreground mb-1">{cat}</h3>
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5 text-xs">
                        <span className="text-muted-foreground">{item.desc}</span>
                        <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">{item.keys}</kbd>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
