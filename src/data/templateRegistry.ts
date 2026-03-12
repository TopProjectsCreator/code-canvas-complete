/**
 * Single source of truth for all IDE templates.
 * Every consumer (LanguagePicker, ProjectMenu, template-assistant edge function)
 * should derive its template list from this file.
 */

export type LanguageTemplate =
  | "blank"
  | "html"
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "cpp"
  | "c"
  | "go"
  | "rust"
  | "ruby"
  | "php"
  | "csharp"
  | "bash"
  | "lua"
  | "perl"
  | "r"
  | "haskell"
  | "nim"
  | "zig"
  | "lisp"
  | "d"
  | "groovy"
  | "pascal"
  | "react"
  | "nodejs"
  | "sqlite"
  | "arduino"
  | "scratch"
  | "word"
  | "powerpoint"
  | "excel"
  | "video"
  | "audio"
  | "rtf"
  | "cad";

export interface TemplateMeta {
  id: LanguageTemplate;
  /** Human-readable name shown in UI */
  name: string;
  /** Short description for the picker grid */
  description: string;
  /** One-line description for the AI assistant prompt (if different from description) */
  aiDescription?: string;
}

/**
 * Canonical list of every template. Order here = display order everywhere.
 * To add a new template: add the union member above, then append an entry here,
 * then add default files in defaultFiles.ts — everything else picks it up automatically.
 */
export const TEMPLATES: TemplateMeta[] = [
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start from scratch with an empty project",
    aiDescription: "Empty project, start from scratch",
  },
  {
    id: "html",
    name: "HTML/CSS/JS",
    description: "Build web pages with HTML, CSS, and JavaScript",
    aiDescription: "HTML/CSS/JS website",
  },
  {
    id: "javascript",
    name: "JavaScript",
    description: "Dynamic programming with JavaScript",
    aiDescription: "Plain JavaScript (Node.js)",
  },
  {
    id: "typescript",
    name: "TypeScript",
    description: "Type-safe JavaScript with TypeScript",
    aiDescription: "TypeScript with types",
  },
  {
    id: "python",
    name: "Python",
    description: "Versatile programming with Python",
    aiDescription: "Python scripting, AI, data science",
  },
  { id: "java", name: "Java", description: "Enterprise-grade Java development", aiDescription: "Java enterprise apps" },
  { id: "cpp", name: "C++", description: "High-performance C++ programming", aiDescription: "C++ high-performance" },
  { id: "c", name: "C", description: "Systems programming with C", aiDescription: "C systems/embedded" },
  { id: "go", name: "Go", description: "Simple and efficient Go programming", aiDescription: "Go backend development" },
  {
    id: "rust",
    name: "Rust",
    description: "Safe and fast systems programming",
    aiDescription: "Rust memory-safe systems",
  },
  { id: "ruby", name: "Ruby", description: "Elegant Ruby programming", aiDescription: "Ruby web development" },
  { id: "php", name: "PHP", description: "Web development with PHP", aiDescription: "PHP server-side scripting" },
  { id: "csharp", name: "C#", description: ".NET development with C#", aiDescription: "C# .NET and games" },
  { id: "bash", name: "Bash", description: "Shell scripting with Bash", aiDescription: "Bash shell scripting" },
  { id: "lua", name: "Lua", description: "Lightweight scripting with Lua", aiDescription: "Lua game scripting" },
  { id: "perl", name: "Perl", description: "Text processing with Perl", aiDescription: "Perl text processing" },
  { id: "r", name: "R", description: "Statistical computing with R", aiDescription: "R statistical computing" },
  {
    id: "haskell",
    name: "Haskell",
    description: "Functional programming with Haskell",
    aiDescription: "Haskell functional programming",
  },
  { id: "nim", name: "Nim", description: "Efficient compiled language", aiDescription: "Nim compiled language" },
  { id: "zig", name: "Zig", description: "Modern systems programming", aiDescription: "Zig modern systems language" },
  { id: "lisp", name: "Common Lisp", description: "Symbolic programming with Lisp", aiDescription: "Common Lisp" },
  { id: "d", name: "D", description: "Systems programming with D", aiDescription: "D systems programming" },
  { id: "groovy", name: "Groovy", description: "JVM scripting with Groovy", aiDescription: "Groovy JVM scripting" },
  {
    id: "pascal",
    name: "Pascal",
    description: "Structured programming with Pascal",
    aiDescription: "Pascal structured programming",
  },
  {
    id: "react",
    name: "React",
    description: "Build UIs with React components",
    aiDescription: "React components & UI",
  },
  {
    id: "nodejs",
    name: "Node.js",
    description: "Server-side JavaScript with Node.js",
    aiDescription: "Node.js server with Express",
  },
  { id: "sqlite", name: "SQLite", description: "Embedded database with SQLite", aiDescription: "SQL database queries" },
  {
    id: "arduino",
    name: "Arduino",
    description: "Embedded systems with Arduino boards",
    aiDescription: "Arduino embedded systems",
  },
  {
    id: "scratch",
    name: "Scratch Blocks",
    description: "Visual block programming with .sb3 import/export",
    aiDescription: "Scratch visual block programming",
  },
  {
    id: "word",
    name: "Word Document",
    description: "Create and edit Word documents (.docx)",
    aiDescription: "Word document editing",
  },
  {
    id: "powerpoint",
    name: "PowerPoint",
    description: "Create presentations (.pptx)",
    aiDescription: "PowerPoint presentations",
  },
  {
    id: "excel",
    name: "Excel Spreadsheet",
    description: "Create spreadsheets (.xlsx)",
    aiDescription: "Excel spreadsheets",
  },
  {
    id: "video",
    name: "Video Editor",
    description: "Edit and preview video files (.mp4/.webm/.ogg)",
    aiDescription: "Video editing and playback",
  },
  {
    id: "audio",
    name: "Audio Editor",
    description: "Edit and preview audio files (.mp3/.wav/.ogg)",
    aiDescription: "Audio editing and playback",
  },
  {
    id: "rtf",
    name: "Rich Text",
    description: "Create and edit rich text documents (.rtf)",
    aiDescription: "Rich text document editing",
  },
  {
    id: "cad",
    name: "3D CAD Viewer",
    description: "View and inspect 3D models (.stl/.obj)",
    aiDescription: "3D CAD model viewing (STL/OBJ)",
  },
];

/** All template IDs in display order */
export const TEMPLATE_IDS: LanguageTemplate[] = TEMPLATES.map((t) => t.id);

/** Quick lookup by id */
export const TEMPLATE_BY_ID: Record<LanguageTemplate, TemplateMeta> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
) as Record<LanguageTemplate, TemplateMeta>;

/**
 * Build the template list section for the AI assistant system prompt.
 * Format: "- id: aiDescription"
 */
export function buildTemplatePromptList(): string {
  return TEMPLATES.map((t) => `- ${t.id}: ${t.aiDescription ?? t.description}`).join("\n");
}
