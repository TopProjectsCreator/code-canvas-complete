import { useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import { useBuilder } from "./useBuilderStore";
import { getRegistryEntry } from "./registry";
import type { PropConfig } from "./types";
import type { UINode } from "./types";

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

function hasClass(className: string, cls: string): boolean {
  return className.split(/\s+/).includes(cls);
}

function removeConflicting(className: string, patterns: RegExp[]): string[] {
  return className.split(/\s+/).filter(Boolean).filter(w => !patterns.some(p => p.test(w)));
}

function applyStyle(current: string, newClass: string, removePatterns: RegExp[]): string {
  const filtered = removeConflicting(current, removePatterns);
  if (filtered.includes(newClass)) return filtered.join(" ");
  return [...filtered, newClass].join(" ");
}

function toggleStyle(current: string, cls: string): string {
  const words = current.split(/\s+/).filter(Boolean);
  if (words.includes(cls)) return words.filter(w => w !== cls).join(" ");
  return [...words, cls].join(" ");
}

function StylePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function StyleIconBtn({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      title={label}
      className={`p-1 rounded transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
    >
      <Icon size={14} />
    </button>
  );
}

function StyleRow({ label, children }: { label: string; children: any }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

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
            {TAILWIND_SUGGESTIONS.map((cls) => (
              <button
                key={cls}
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                  hasClass(value ?? "", cls)
                    ? "bg-primary/15 text-primary"
                    : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  const current = (value ?? "") as string;
                  const words = current.split(/\s+/).filter(Boolean);
                  if (words.includes(cls)) {
                    onChange(words.filter(w => w !== cls).join(" "));
                  } else {
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

  const currentClass = selectedNode.props.className ?? "";

  const updateClass = (newClass: string) => {
    handlePropChange("className", newClass);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{config.label}</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="border-b border-border">
          <div className="p-3 space-y-2.5">
            <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Quick Styles</h4>

            <StyleRow label="Padding">
              {[["p-0","0"],["p-1","1"],["p-2","2"],["p-3","3"],["p-4","4"],["p-6","6"],["p-8","8"],["p-10","10"]].map(([cls, label]) => (
                <StylePill key={cls} label={label} active={hasClass(currentClass, cls)} onClick={() => updateClass(applyStyle(currentClass, cls, [/^p(x|y|t|b|l|r)?-\d+$/]))} />
              ))}
            </StyleRow>

            <StyleRow label="Rounded">
              {[["rounded-none","none"],["rounded-sm","sm"],["rounded-md","md"],["rounded-lg","lg"],["rounded-xl","xl"],["rounded-2xl","2xl"],["rounded-full","full"]].map(([cls, label]) => (
                <StylePill key={cls} label={label} active={hasClass(currentClass, cls)} onClick={() => updateClass(applyStyle(currentClass, cls, [/^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$/]))} />
              ))}
            </StyleRow>

            <StyleRow label="Shadow">
              {[["shadow-none","none"],["shadow-sm","sm"],["shadow-md","md"],["shadow-lg","lg"],["shadow-xl","xl"],["shadow-2xl","2xl"]].map(([cls, label]) => (
                <StylePill key={cls} label={label} active={hasClass(currentClass, cls)} onClick={() => updateClass(applyStyle(currentClass, cls, [/^shadow(-(none|sm|md|lg|xl|2xl|inner))?$/]))} />
              ))}
            </StyleRow>

            <StyleRow label="Font Size">
              {[["text-xs","xs"],["text-sm","sm"],["text-base","base"],["text-lg","lg"],["text-xl","xl"],["text-2xl","2xl"]].map(([cls, label]) => (
                <StylePill key={cls} label={label} active={hasClass(currentClass, cls)} onClick={() => updateClass(applyStyle(currentClass, cls, [/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/]))} />
              ))}
            </StyleRow>

            <StyleRow label="Font Weight">
              {[["font-normal","normal"],["font-medium","medium"],["font-semibold","semibold"],["font-bold","bold"]].map(([cls, label]) => (
                <StylePill key={cls} label={label} active={hasClass(currentClass, cls)} onClick={() => updateClass(applyStyle(currentClass, cls, [/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/]))} />
              ))}
            </StyleRow>

            <StyleRow label="Text Align">
              <StyleIconBtn icon={AlignLeft} label="Left" active={hasClass(currentClass, "text-left")} onClick={() => updateClass(applyStyle(currentClass, "text-left", [/^text-(left|center|right|justify)$/]))} />
              <StyleIconBtn icon={AlignCenter} label="Center" active={hasClass(currentClass, "text-center")} onClick={() => updateClass(applyStyle(currentClass, "text-center", [/^text-(left|center|right|justify)$/]))} />
              <StyleIconBtn icon={AlignRight} label="Right" active={hasClass(currentClass, "text-right")} onClick={() => updateClass(applyStyle(currentClass, "text-right", [/^text-(left|center|right|justify)$/]))} />
              <StyleIconBtn icon={AlignJustify} label="Justify" active={hasClass(currentClass, "text-justify")} onClick={() => updateClass(applyStyle(currentClass, "text-justify", [/^text-(left|center|right|justify)$/]))} />
            </StyleRow>

            <StyleRow label="Border">
              {[["border-0","0"],["border","1"],["border-2","2"],["border-4","4"]].map(([cls, label]) => (
                <StylePill key={cls} label={label} active={hasClass(currentClass, cls)} onClick={() => updateClass(applyStyle(currentClass, cls, [/^border(-[0-9]+)?$/]))} />
              ))}
            </StyleRow>

            <StyleRow label="Width">
              {[["w-auto","auto"],["w-full","full"],["w-1/2","1/2"],["w-1/3","1/3"],["w-2/3","2/3"],["w-1/4","1/4"],["w-3/4","3/4"]].map(([cls, label]) => (
                <StylePill key={cls} label={label} active={hasClass(currentClass, cls)} onClick={() => updateClass(applyStyle(currentClass, cls, [/^w-(auto|full|\d+\/\d+)$/]))} />
              ))}
            </StyleRow>

            <StyleRow label="Flex">
              <StylePill label="flex" active={hasClass(currentClass, "flex")} onClick={() => updateClass(toggleStyle(currentClass, "flex"))} />
              <StylePill label="col" active={hasClass(currentClass, "flex-col")} onClick={() => updateClass(toggleStyle(currentClass, "flex-col"))} />
              <StylePill label="wrap" active={hasClass(currentClass, "flex-wrap")} onClick={() => updateClass(toggleStyle(currentClass, "flex-wrap"))} />
            </StyleRow>

            <StyleRow label="Align Items">
              {[["items-start","start"],["items-center","center"],["items-end","end"]].map(([cls, label]) => (
                <StylePill key={cls} label={label} active={hasClass(currentClass, cls)} onClick={() => updateClass(applyStyle(currentClass, cls, [/^items-(start|center|end|baseline|stretch)$/]))} />
              ))}
            </StyleRow>

            <StyleRow label="Justify">
              {[["justify-start","start"],["justify-center","center"],["justify-end","end"],["justify-between","between"]].map(([cls, label]) => (
                <StylePill key={cls} label={label} active={hasClass(currentClass, cls)} onClick={() => updateClass(applyStyle(currentClass, cls, [/^justify-(start|center|end|between|around|evenly)$/]))} />
              ))}
            </StyleRow>
          </div>
        </div>

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

function findNodeById(nodes: UINode[], id: string): UINode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children.length > 0) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}
