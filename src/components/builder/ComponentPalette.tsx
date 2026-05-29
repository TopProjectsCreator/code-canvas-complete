import { useState, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Search, Square, CreditCard, LayoutPanelTop, GripHorizontal, TextCursorInput, Type, ListChecks, ToggleLeft, SlidersHorizontal, Heading, Milestone, AlertTriangle, SeparatorHorizontal, TextSelect, AlignStartVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { getAllRegistryEntries, CATEGORIES } from "./registry";
import type { BuilderComponentConfig } from "./types";

const iconMap: Record<string, React.ComponentType<any>> = {
  Square, CreditCard, LayoutPanelTop, GripHorizontal, TextCursorInput,
  Type, ListChecks, ToggleLeft, SlidersHorizontal, Heading, Milestone,
  AlertTriangle, SeparatorHorizontal, TextSelect, AlignStartVertical,
};

function PaletteItem({ config }: { config: BuilderComponentConfig }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${config.type}`,
    data: { from: "palette", type: config.type },
  });

  const Icon = iconMap[config.icon];

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md cursor-grab active:cursor-grabbing",
        "hover:bg-accent hover:text-accent-foreground",
        "border border-transparent hover:border-border",
        "transition-colors text-sm",
        isDragging && "opacity-50",
      )}
    >
      <span className="text-muted-foreground shrink-0 w-4 h-4">
        {Icon ? <Icon size={16} /> : <Square size={16} />}
      </span>
      <span>{config.label}</span>
    </div>
  );
}

export function ComponentPalette() {
  const [search, setSearch] = useState("");

  const components = getAllRegistryEntries();

  const filtered = useMemo(() => {
    if (!search.trim()) return components;
    const q = search.toLowerCase();
    return components.filter((c) => c.label.toLowerCase().includes(q) || c.type.toLowerCase().includes(q));
  }, [search, components]);

  const allCategories = useMemo(() => {
    const cats = [...CATEGORIES];
    const extraCategories = new Set(components.map((c) => c.category));
    for (const key of extraCategories) {
      if (!cats.find((ct) => ct.key === key)) {
        cats.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1) });
      }
    }
    return cats;
  }, [components]);

  const grouped = useMemo(() => {
    const map: Record<string, BuilderComponentConfig[]> = {};
    for (const cat of allCategories) {
      map[cat.key] = filtered.filter((c) => c.category === cat.key);
    }
    return map;
  }, [filtered, allCategories]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 pb-2">
        <h3 className="text-sm font-semibold text-foreground mb-2">Components</h3>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 px-2 pb-3">
        {allCategories.map((cat) => {
          const items = grouped[cat.key];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat.key} className="mb-3">
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 px-1">
                {cat.label}
              </h4>
              <div className="space-y-0.5">
                {items.map((c) => (
                  <PaletteItem key={c.type} config={c} />
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No components found</p>
        )}
      </ScrollArea>
    </div>
  );
}
