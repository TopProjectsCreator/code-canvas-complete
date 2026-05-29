import { useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBuilder } from "./useBuilderStore";
import { getRegistryEntry } from "./registry";
import type { PropConfig } from "./types";

const TAILWIND_SUGGESTIONS = [
  "flex", "flex-col", "flex-row", "flex-wrap", "items-center", "items-start", "items-end",
  "justify-center", "justify-between", "justify-end", "gap-2", "gap-4", "gap-6",
  "p-2", "p-4", "p-6", "px-4", "py-2", "pt-0",
  "w-full", "w-auto", "max-w-md", "max-w-lg", "max-w-xl", "max-w-2xl",
  "h-full", "h-auto", "min-h-screen",
  "space-y-2", "space-y-4", "space-y-6", "space-x-2", "space-x-4",
  "text-sm", "text-lg", "text-xl", "text-2xl", "font-semibold", "font-bold",
  "rounded-md", "rounded-lg", "rounded-xl", "shadow", "shadow-sm", "shadow-lg",
  "border", "border-2", "border-t", "border-b",
  "bg-background", "bg-muted", "bg-card", "bg-primary/10",
  "relative", "absolute", "inset-0", "z-10",
  "overflow-hidden", "truncate", "whitespace-nowrap",
];

function PropEditor({ config, value, onChange }: { config: PropConfig; value: any; onChange: (val: any) => void }) {
  switch (config.type) {
    case "string":
      return (
        <Input
          value={value ?? config.defaultValue ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
          placeholder={config.label}
        />
      );

    case "boolean":
      return (
        <Switch
          checked={value ?? config.defaultValue ?? false}
          onCheckedChange={onChange}
        />
      );

    case "number":
      return (
        <Input
          type="number"
          value={value ?? config.defaultValue ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 text-xs"
        />
      );

    case "select":
      return (
        <Select value={value ?? config.defaultValue ?? ""} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {(config.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "class":
      return (
        <div className="space-y-1">
          <Textarea
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[48px] text-xs font-mono"
            placeholder="e.g. flex gap-4 p-4"
          />
          <div className="flex flex-wrap gap-1">
            {TAILWIND_SUGGESTIONS.slice(0, 6).map((cls) => (
              <button
                key={cls}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  const current = (value ?? "") as string;
                  const words = current.split(/\s+/).filter(Boolean);
                  if (!words.includes(cls)) {
                    onChange([...words, cls].join(" "));
                  }
                }}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
      );

    default:
      return (
        <Input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
      );
  }
}

export function PropertiesPanel() {
  const { state, dispatch } = useBuilder();

  const selectedNode = useMemo(() => {
    if (!state.selectedNodeId) return null;
    return findNodeById(state.rootNodes, state.selectedNodeId);
  }, [state.rootNodes, state.selectedNodeId]);

  const config = useMemo(
    () => (selectedNode ? getRegistryEntry(selectedNode.componentType) : null),
    [selectedNode],
  );

  const handlePropChange = useCallback(
    (name: string, value: any) => {
      if (!selectedNode) return;
      dispatch({
        type: "UPDATE_PROPS",
        nodeId: selectedNode.id,
        props: { [name]: value },
      });
    },
    [dispatch, selectedNode],
  );

  const groupedProps = useMemo(() => {
    if (!config) return [];
    const groups: { category: string; label: string; props: PropConfig[] }[] = [];
    const content = config.propsConfig.filter((p) => p.category === "content");
    const appearance = config.propsConfig.filter((p) => p.category === "appearance");
    const behavior = config.propsConfig.filter((p) => p.category === "behavior");
    if (content.length > 0) groups.push({ category: "content", label: "Content", props: content });
    if (appearance.length > 0) groups.push({ category: "appearance", label: "Appearance", props: appearance });
    if (behavior.length > 0) groups.push({ category: "behavior", label: "Behavior", props: behavior });
    return groups;
  }, [config]);

  if (!selectedNode || !config) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            Select a component to edit its properties
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{config.label}</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {groupedProps.map((group) => (
            <div key={group.category}>
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </h4>
              <div className="space-y-2.5">
                {group.props.map((prop) => {
                  const currentValue = selectedNode.props[prop.name] ?? prop.defaultValue;
                  return (
                    <div key={prop.name} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{prop.label}</Label>
                      <PropEditor
                        config={prop}
                        value={currentValue}
                        onChange={(val) => handlePropChange(prop.name, val)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function findNodeById(nodes: import("./types").UINode[], id: string): import("./types").UINode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children.length > 0) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}
