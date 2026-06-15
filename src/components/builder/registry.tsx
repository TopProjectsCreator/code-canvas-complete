import type { BuilderComponentConfig } from "./types";

let customComponents: BuilderComponentConfig[] = [];

export function extendRegistry(components: BuilderComponentConfig[]) {
  customComponents = customComponents.concat(components);
}

export function getRegistryEntry(type: string): BuilderComponentConfig | undefined {
  const builtIn = registry.find((c) => c.type === type);
  if (builtIn) return builtIn;
  return customComponents.find((c) => c.type === type);
}

export function getAllRegistryEntries(): BuilderComponentConfig[] {
  return [...registry, ...customComponents];
}

export const CATEGORIES: { key: string; label: string }[] = [
  { key: "layout", label: "Layout" },
  { key: "form", label: "Form" },
  { key: "display", label: "Display" },
  { key: "feedback", label: "Feedback" },
];

export const registry: BuilderComponentConfig[] = [
  // ─── Layout ───
  {
    type: "html/div",
    label: "Container",
    icon: "Square",
    category: "layout",
    component: ({ className, children, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
    defaultProps: { className: "flex flex-col gap-4 p-4" },
    propsConfig: [
      { name: "className", label: "CSS classes", type: "class", defaultValue: "flex flex-col gap-4 p-4", category: "appearance" },
    ],
    allowedChildren: ["*"],
    isContainer: true,
    isVoid: false,
    importPath: "",
    importName: "",
  },
  {
    type: "ui/card",
    label: "Card",
    icon: "CreditCard",
    category: "layout",
    component: ({ className, children, ...props }: any) => (
      <div className={`rounded-xl border bg-card text-card-foreground shadow ${className ?? ""}`} {...props}>{children}</div>
    ),
    defaultProps: { className: "w-full" },
    propsConfig: [
      { name: "className", label: "CSS classes", type: "class", defaultValue: "w-full", category: "appearance" },
    ],
    allowedChildren: ["ui/card-header", "ui/card-content", "ui/card-footer"],
    isContainer: true,
    isVoid: false,
    importPath: "@/components/ui/card",
    importName: "Card",
  },
  {
    type: "ui/card-header",
    label: "Card Header",
    icon: "LayoutPanelTop",
    category: "layout",
    component: ({ className, children, ...props }: any) => (
      <div className={`flex flex-col space-y-1.5 p-6 ${className ?? ""}`} {...props}>{children}</div>
    ),
    defaultProps: {},
    propsConfig: [
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: ["ui/card-title"],
    isContainer: true,
    isVoid: false,
    importPath: "@/components/ui/card",
    importName: "CardHeader",
  },
  {
    type: "ui/card-content",
    label: "Card Content",
    icon: "Square",
    category: "layout",
    component: ({ className, children, ...props }: any) => (
      <div className={`p-6 pt-0 ${className ?? ""}`} {...props}>{children}</div>
    ),
    defaultProps: { className: "space-y-4" },
    propsConfig: [
      { name: "className", label: "CSS classes", type: "class", defaultValue: "space-y-4", category: "appearance" },
    ],
    allowedChildren: ["*"],
    isContainer: true,
    isVoid: false,
    importPath: "@/components/ui/card",
    importName: "CardContent",
  },
  {
    type: "ui/card-footer",
    label: "Card Footer",
    icon: "AlignStartVertical",
    category: "layout",
    component: ({ className, children, ...props }: any) => (
      <div className={`flex items-center p-6 pt-0 ${className ?? ""}`} {...props}>{children}</div>
    ),
    defaultProps: {},
    propsConfig: [
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: ["ui/button"],
    isContainer: true,
    isVoid: false,
    importPath: "@/components/ui/card",
    importName: "CardFooter",
  },

  // ─── Form ───
  {
    type: "ui/button",
    label: "Button",
    icon: "GripHorizontal",
    category: "form",
    component: ({ children, className, variant, size, ...props }: any) => (
      <button
        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 ${
          variant === "destructive" ? "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90" :
          variant === "outline" ? "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground" :
          variant === "secondary" ? "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80" :
          variant === "ghost" ? "hover:bg-accent hover:text-accent-foreground" :
          variant === "link" ? "text-primary underline-offset-4 hover:underline" :
          "bg-primary text-primary-foreground shadow hover:bg-primary/90"
        } ${
          size === "sm" ? "h-8 rounded-md px-3 text-xs" :
          size === "lg" ? "h-10 rounded-md px-8" :
          size === "icon" ? "h-9 w-9" :
          "h-9 px-4 py-2"
        } ${className ?? ""}`}
        {...props}
      >
        {children ?? "Button"}
      </button>
    ),
    defaultProps: { variant: "default", size: "default" },
    propsConfig: [
      { name: "children", label: "Label", type: "string", defaultValue: "Button", category: "content" },
      { name: "variant", label: "Variant", type: "select", options: [
        { label: "Default", value: "default" },
        { label: "Destructive", value: "destructive" },
        { label: "Outline", value: "outline" },
        { label: "Secondary", value: "secondary" },
        { label: "Ghost", value: "ghost" },
        { label: "Link", value: "link" },
      ], defaultValue: "default", category: "appearance" },
      { name: "size", label: "Size", type: "select", options: [
        { label: "Default", value: "default" },
        { label: "Small", value: "sm" },
        { label: "Large", value: "lg" },
        { label: "Icon", value: "icon" },
      ], defaultValue: "default", category: "appearance" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: false,
    textContent: "Button",
    importPath: "@/components/ui/button",
    importName: "Button",
  },
  {
    type: "ui/input",
    label: "Input",
    icon: "TextCursorInput",
    category: "form",
    component: ({ className, type, children: _ch, ...props }: any) => (
      <input
        type={type ?? "text"}
        className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
        {...props}
      />
    ),
    defaultProps: { placeholder: "Enter text...", type: "text" },
    propsConfig: [
      { name: "placeholder", label: "Placeholder", type: "string", defaultValue: "Enter text...", category: "content" },
      { name: "type", label: "Type", type: "select", options: [
        { label: "Text", value: "text" },
        { label: "Email", value: "email" },
        { label: "Password", value: "password" },
        { label: "Number", value: "number" },
        { label: "Search", value: "search" },
      ], defaultValue: "text", category: "behavior" },
      { name: "disabled", label: "Disabled", type: "boolean", defaultValue: false, category: "behavior" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: true,
    importPath: "@/components/ui/input",
    importName: "Input",
  },
  {
    type: "ui/textarea",
    label: "Textarea",
    icon: "TextSelect",
    category: "form",
    component: ({ className, ...props }: any) => (
      <textarea
        className={`flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
        {...props}
      />
    ),
    defaultProps: { placeholder: "Enter text...", rows: 4 },
    propsConfig: [
      { name: "placeholder", label: "Placeholder", type: "string", defaultValue: "Enter text...", category: "content" },
      { name: "rows", label: "Rows", type: "number", defaultValue: 4, category: "appearance" },
      { name: "disabled", label: "Disabled", type: "boolean", defaultValue: false, category: "behavior" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: true,
    importPath: "@/components/ui/textarea",
    importName: "Textarea",
  },
  {
    type: "ui/label",
    label: "Label",
    icon: "Type",
    category: "form",
    component: ({ className, children, ...props }: any) => (
      <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className ?? ""}`} {...props}>{children ?? "Label"}</label>
    ),
    defaultProps: {},
    propsConfig: [
      { name: "children", label: "Text", type: "string", defaultValue: "Label", category: "content" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: false,
    textContent: "Label",
    importPath: "@/components/ui/label",
    importName: "Label",
  },
  {
    type: "ui/checkbox",
    label: "Checkbox",
    icon: "ListChecks",
    category: "form",
    component: ({ className, checked, ...props }: any) => (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        <input type="checkbox" checked={checked} className="h-4 w-4 rounded border border-primary" readOnly {...props} />
      </div>
    ),
    defaultProps: { checked: false },
    propsConfig: [
      { name: "checked", label: "Checked", type: "boolean", defaultValue: false, category: "behavior" },
      { name: "disabled", label: "Disabled", type: "boolean", defaultValue: false, category: "behavior" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: true,
    importPath: "@/components/ui/checkbox",
    importName: "Checkbox",
  },
  {
    type: "ui/switch",
    label: "Switch",
    icon: "ToggleLeft",
    category: "form",
    component: ({ className, checked }: any) => (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        <div className={`h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-input"} flex items-center ${checked ? "justify-end" : "justify-start"} p-0.5`}>
          <div className="h-4 w-4 rounded-full bg-white shadow" />
        </div>
      </div>
    ),
    defaultProps: { checked: false },
    propsConfig: [
      { name: "checked", label: "Checked", type: "boolean", defaultValue: false, category: "behavior" },
      { name: "disabled", label: "Disabled", type: "boolean", defaultValue: false, category: "behavior" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: true,
    importPath: "@/components/ui/switch",
    importName: "Switch",
  },
  {
    type: "ui/slider",
    label: "Slider",
    icon: "SlidersHorizontal",
    category: "form",
    component: ({ className, defaultValue, max }: any) => (
      <div className={`relative flex w-full touch-none select-none items-center ${className ?? ""}`}>
        <div className="relative h-1.5 w-full rounded-full bg-primary/20">
          <div className="absolute h-full rounded-full bg-primary" style={{ width: `${((defaultValue?.[0] ?? 50) / (max ?? 100)) * 100}%` }} />
        </div>
      </div>
    ),
    defaultProps: { defaultValue: [50], max: 100, step: 1 },
    propsConfig: [
      { name: "defaultValue", label: "Default value", type: "number", defaultValue: 50, category: "behavior" },
      { name: "max", label: "Maximum", type: "number", defaultValue: 100, category: "behavior" },
      { name: "step", label: "Step size", type: "number", defaultValue: 1, category: "behavior" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: true,
    importPath: "@/components/ui/slider",
    importName: "Slider",
  },
  {
    type: "ui/select",
    label: "Select",
    icon: "ListChecks",
    category: "form",
    component: ({ className, placeholder, options, ...props }: any) => (
      <div className={`relative ${className ?? ""}`}>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        >
          <option value="" disabled>{placeholder ?? "Select an option"}</option>
          {(options ?? ["Option 1", "Option 2", "Option 3"]).map((opt: string, i: number) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    ),
    defaultProps: { placeholder: "Select an option" },
    propsConfig: [
      { name: "placeholder", label: "Placeholder", type: "string", defaultValue: "Select an option", category: "content" },
      { name: "disabled", label: "Disabled", type: "boolean", defaultValue: false, category: "behavior" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: false,
    textContent: "Select",
    importPath: "@/components/ui/select",
    importName: "Select",
  },

  // ─── Display ───
  {
    type: "ui/card-title",
    label: "Card Title",
    icon: "Heading",
    category: "display",
    component: ({ className, children, ...props }: any) => (
      <h3 className={`text-lg font-semibold leading-none tracking-tight ${className ?? ""}`} {...props}>{children ?? "Card Title"}</h3>
    ),
    defaultProps: {},
    propsConfig: [
      { name: "children", label: "Text", type: "string", defaultValue: "Card Title", category: "content" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: false,
    textContent: "Card Title",
    importPath: "@/components/ui/card",
    importName: "CardTitle",
  },
  {
    type: "ui/badge",
    label: "Badge",
    icon: "Milestone",
    category: "display",
    component: ({ className, variant, children, ...props }: any) => (
      <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
        variant === "secondary" ? "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80" :
        variant === "destructive" ? "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80" :
        variant === "outline" ? "text-foreground" :
        "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80"
      } ${className ?? ""}`} {...props}>{children ?? "Badge"}</span>
    ),
    defaultProps: { variant: "default" },
    propsConfig: [
      { name: "children", label: "Text", type: "string", defaultValue: "Badge", category: "content" },
      { name: "variant", label: "Variant", type: "select", options: [
        { label: "Default", value: "default" },
        { label: "Secondary", value: "secondary" },
        { label: "Destructive", value: "destructive" },
        { label: "Outline", value: "outline" },
      ], defaultValue: "default", category: "appearance" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: false,
    textContent: "Badge",
    importPath: "@/components/ui/badge",
    importName: "Badge",
  },
  {
    type: "ui/separator",
    label: "Separator",
    icon: "SeparatorHorizontal",
    category: "display",
    component: ({ className, ...props }: any) => (
      <div className={`shrink-0 bg-border h-[1px] w-full ${className ?? ""}`} {...props} />
    ),
    defaultProps: {},
    propsConfig: [
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: [],
    isContainer: false,
    isVoid: true,
    importPath: "@/components/ui/separator",
    importName: "Separator",
  },

  // ─── Feedback ───
  {
    type: "ui/alert",
    label: "Alert",
    icon: "AlertTriangle",
    category: "feedback",
    component: ({ className, variant, children, ...props }: any) => (
      <div className={`relative w-full rounded-lg border px-4 py-3 text-sm ${
        variant === "destructive" ? "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive" :
        "bg-background text-foreground"
      } ${className ?? ""}`} role="alert" {...props}>{children ?? "Alert content"}</div>
    ),
    defaultProps: { variant: "default" },
    propsConfig: [
      { name: "children", label: "Content", type: "string", defaultValue: "Alert content", category: "content" },
      { name: "variant", label: "Variant", type: "select", options: [
        { label: "Default", value: "default" },
        { label: "Destructive", value: "destructive" },
      ], defaultValue: "default", category: "appearance" },
      { name: "className", label: "CSS classes", type: "class", defaultValue: "", category: "appearance" },
    ],
    allowedChildren: ["*"],
    isContainer: true,
    isVoid: false,
    importPath: "@/components/ui/alert",
    importName: "Alert",
  },
];
