import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COMPONENT_LABELS } from './componentTemplates';
import { Search, GripVertical } from 'lucide-react';

// Component categories for organized browsing
const CATEGORIES: Record<string, string[]> = {
  'Basic': ['led', 'resistor', 'capacitor', 'inductor', 'diode', 'fuse'],
  'Switches': ['button', 'toggle_switch', 'dip_switch'],
  'Semiconductors': ['transistor_npn', 'mosfet', 'optocoupler', 'voltage_reg'],
  'Sensors': ['sensor_temp', 'sensor_light', 'potentiometer', 'current_sensor'],
  'Outputs': ['buzzer', 'piezo', 'rgb_led', 'motor', 'servo', 'seven_seg', 'lcd'],
  'ICs': ['ic', 'shift_register', 'relay', 'h_bridge'],
  'Connectors': ['barrel_jack', 'crystal'],
};

interface ComponentPaletteProps {
  onAddComponent: (type: string) => void;
}

export function ComponentPalette({ onAddComponent }: ComponentPaletteProps) {
  const [search, setSearch] = useState('');

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('component-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const allTypes = Object.values(CATEGORIES).flat();
  const filtered = search
    ? allTypes.filter(t =>
        COMPONENT_LABELS[t]?.toLowerCase().includes(search.toLowerCase()) ||
        t.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="flex flex-col gap-2 w-48 border border-border rounded-lg bg-muted/30 p-2">
      <div className="text-xs font-medium text-foreground px-1">Components</div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <Input
          placeholder="Search components..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs h-7 pl-7"
        />
      </div>
      <ScrollArea className="h-[340px]">
        <div className="space-y-2 pr-2">
          {filtered ? (
            <div className="space-y-0.5">
              {filtered.map(type => (
                <PaletteItem key={type} type={type} onAdd={onAddComponent} onDragStart={handleDragStart} />
              ))}
              {filtered.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">No matches</div>
              )}
            </div>
          ) : (
            Object.entries(CATEGORIES).map(([cat, types]) => (
              <div key={cat}>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">{cat}</div>
                <div className="space-y-0.5">
                  {types.map(type => (
                    <PaletteItem key={type} type={type} onAdd={onAddComponent} onDragStart={handleDragStart} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function PaletteItem({ type, onAdd, onDragStart }: {
  type: string;
  onAdd: (type: string) => void;
  onDragStart: (e: React.DragEvent, type: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, type)}
      onClick={() => onAdd(type)}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-grab hover:bg-accent hover:text-accent-foreground transition-colors active:cursor-grabbing"
      title={`Drag to canvas or click to add ${COMPONENT_LABELS[type]}`}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <span className="truncate">{COMPONENT_LABELS[type]}</span>
    </div>
  );
}
