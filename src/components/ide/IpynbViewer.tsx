import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { tokenize, getTokenClass, escapeHtml } from "@/lib/syntax";
import { useNotebookKernel } from "@/hooks/useNotebookKernel";
import type { FileNode, NbOutput, NotebookCell } from "@/types/ide";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ChevronDown,
  ChevronRight,
  Search,
  Terminal,
  FileJson,
  FileText,
  X,
  Plus,
  Trash2,
  GripVertical,
  Play,
  Square,
  ArrowUp,
  ArrowDown,
  CopyPlus,
  RotateCcw,
  Edit3,
  Eye,
  Clock,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const MIME_PRIORITY = [
  "text/html",
  "image/png",
  "image/svg+xml",
  "image/jpeg",
  "text/markdown",
  "text/latex",
  "application/json",
  "text/plain",
];

const asText = (value?: string[] | string): string => {
  if (!value) return "";
  return Array.isArray(value) ? value.join("") : value;
};

const resolveData = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join("");
  return String(value);
};

const getBestMime = (data: Record<string, unknown>): { mime: string; content: string } | null => {
  for (const mime of MIME_PRIORITY) {
    if (data[mime] != null) return { mime, content: resolveData(data[mime]) };
  }
  return null;
};

const mimeLabel = (mime: string): string => {
  const labels: Record<string, string> = {
    "text/html": "HTML",
    "image/png": "PNG",
    "image/svg+xml": "SVG",
    "image/jpeg": "JPEG",
    "text/markdown": "Markdown",
    "text/latex": "LaTeX",
    "application/json": "JSON",
    "text/plain": "Text",
  };
  return labels[mime] || mime;
};

function buildHighlightedHtml(code: string, language: string): string {
  const tokenizedLines = tokenize(code, language);
  return tokenizedLines
    .map((lineTokens) => {
      const html = lineTokens
        .map((token) => `<span class="${getTokenClass(token.type)}">${escapeHtml(token.value)}</span>`)
        .join("");
      return html || "<br>";
    })
    .join("\n");
}

function getLanguageForNotebook(notebook: { metadata?: { language_info?: Record<string, unknown>; kernelspec?: Record<string, unknown> } }): string {
  const langInfo = notebook.metadata?.language_info;
  if (langInfo && typeof langInfo.name === "string") {
    const name = langInfo.name.toLowerCase();
    if (name === "python") return "python";
    if (name === "r" || name === "julia") return name;
    return name;
  }
  const kernelSpec = notebook.metadata?.kernelspec;
  if (kernelSpec && typeof kernelSpec.name === "string") {
    const name = String(kernelSpec.name).toLowerCase();
    if (name.startsWith("python")) return "python";
    if (name.startsWith("ir")) return "r";
    if (name.startsWith("julia")) return "julia";
  }
  return "python";
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(0);
  return `${m}m ${s}s`;
}

// Helper to infer variable type from assignment
function inferVariableType(valueStr: string): string {
  const trimmed = valueStr.trim();
  if (trimmed === 'True' || trimmed === 'False') return 'bool';
  if (trimmed === 'None') return 'none';
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return 'list';
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    if (trimmed.includes(':')) return 'dict';
    return 'set';
  }
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) return 'string';
  if (!isNaN(Number(trimmed))) return 'number';
  return 'other';
}

// Extract variables from code cell
function extractVariablesFromCell(source: string): Array<{ name: string; type: string }> {
  const vars: Array<{ name: string; type: string }> = [];
  const lines = source.split('\n');
  
  lines.forEach(line => {
    // Match simple assignment: name = value
    const match = line.match(/^\s*(\w+)\s*=\s*(.+)/);
    if (match) {
      const [_, name, valueStr] = match;
      const type = inferVariableType(valueStr);
      vars.push({ name, type });
    }
  });
  
  return vars;
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

const OutputRenderer = ({ output, defaultCollapsed }: { output: NbOutput; defaultCollapsed?: boolean }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);

  if (output.output_type === "stream") {
    const isStderr = output.name === "stderr";
    return (
      <div className={cn("mt-3 rounded-lg border p-3 font-mono text-xs leading-6", isStderr ? "border-red-500/20 bg-red-950/10" : "border-border/60 bg-muted/20")}>
        <div className="flex items-center justify-between">
          {isStderr && <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-1.5"><Terminal className="w-3 h-3" /> stderr</div>}
          {asText(output.text) && asText(output.text).length > 500 && (
            <button onClick={() => setCollapsed((p) => !p)} className="text-[10px] text-muted-foreground hover:text-foreground ml-auto">
              {collapsed ? "Show all" : "Collapse"}
            </button>
          )}
        </div>
        {!collapsed && <pre className="whitespace-pre-wrap text-foreground/80">{asText(output.text)}</pre>}
        {collapsed && <pre className="whitespace-pre-wrap text-foreground/80 truncate">{asText(output.text).slice(0, 500)}...</pre>}
      </div>
    );
  }

  if (output.output_type === "error") {
    const trace = output.traceback?.join("\n") || `${output.ename || "Error"}: ${output.evalue || ""}`;
    const isLong = trace.length > 500;
    return (
      <div className="mt-3 rounded-lg border border-red-500/20 bg-red-950/5 p-3 font-mono text-xs leading-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-1.5">
            <AlertTriangle className="w-3 h-3" /> {output.ename || "Error"}
          </div>
          {isLong && (
            <button onClick={() => setCollapsed((p) => !p)} className="text-[10px] text-muted-foreground hover:text-foreground">
              {collapsed ? "Show full traceback" : "Collapse"}
            </button>
          )}
        </div>
        <pre className="whitespace-pre-wrap text-red-300/80">{!isLong || !collapsed ? trace : trace.slice(0, 500) + "..."}</pre>
      </div>
    );
  }

  if (output.output_type === "execute_result" || output.output_type === "display_data") {
    if (!output.data) return null;
    const best = getBestMime(output.data);
    if (!best) return null;

    const { mime, content } = best;

    if (mime.startsWith("image/")) {
      return (
        <div className="mt-3 flex justify-center rounded-lg border border-border/60 bg-background p-3">
          {mime === "image/svg+xml" ? (
            <img src={`data:image/svg+xml;base64,${btoa(content)}`} className="max-w-full h-auto rounded" alt="Output SVG" />
          ) : (
            <img src={`data:${mime};base64,${content}`} className="max-w-full h-auto rounded" alt="Output image" />
          )}
        </div>
      );
    }

    if (mime === "text/html") {
      return (
        <div className="mt-3 rounded-lg border border-border/60 bg-background p-3 overflow-x-auto">
          <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">HTML output</div>
          <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      );
    }

    if (mime === "text/markdown") {
      return (
        <div className="mt-3 rounded-lg border border-border/60 bg-background p-3">
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        </div>
      );
    }

    if (mime === "application/json") {
      return (
        <div className="mt-3 rounded-lg border border-border/60 bg-background p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide"><FileJson className="w-3 h-3" /> JSON</div>
          <pre className="text-xs whitespace-pre-wrap leading-6 font-mono text-foreground/80">{(() => { try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; } })()}</pre>
        </div>
      );
    }

    return (
      <div className="mt-3">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
          <CheckCircle2 className="w-3 h-3" /> {mimeLabel(mime)} output
        </div>
        <pre className="text-xs whitespace-pre-wrap leading-6 rounded-lg border bg-background p-3 font-mono text-foreground/80">{content}</pre>
      </div>
    );
  }

  if (output.text) {
    return (
      <div className="mt-3 rounded-lg border border-border/60 bg-background p-3">
        <pre className="text-xs whitespace-pre-wrap leading-6 font-mono text-foreground/80">{asText(output.text)}</pre>
      </div>
    );
  }

  return null;
};

const CellOutputs = ({ outputs }: { outputs: NbOutput[] }) => {
  const [collapsed, setCollapsed] = useState(false);
  if (!outputs?.length) return null;
  return (
    <div className="mt-4 border-t border-border/30 pt-3">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCollapsed((p) => !p)}
          className="text-xs font-medium text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <CheckCircle2 className="w-3.5 h-3.5" /> Outputs ({outputs.length})
        </button>
      </div>
      {!collapsed && <div className="space-y-2">
        {outputs.map((output, i) => (
          <OutputRenderer key={`${output.output_type || "output"}-${i}`} output={output} />
        ))}
      </div>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Cell ID generation
// ---------------------------------------------------------------------------

let cellIdCounter = 0;
function generateCellId(): string {
  cellIdCounter += 1;
  return `cell_${Date.now()}_${cellIdCounter}`;
}

// ---------------------------------------------------------------------------
// Notebook parse / serialize
// ---------------------------------------------------------------------------

function parseCells(content: string): NotebookCell[] {
  try {
    const doc = JSON.parse(content || "{}") as {
      cells?: Array<{
        cell_type?: string;
        source?: string[] | string;
        execution_count?: number | null;
        outputs?: NbOutput[];
      }>;
    };
    if (!Array.isArray(doc.cells)) return [];
    return doc.cells.map((c) => ({
      id: generateCellId(),
      cell_type: (c.cell_type === "markdown" || c.cell_type === "code" || c.cell_type === "raw" ? c.cell_type : "code") as "markdown" | "code" | "raw",
      source: asText(c.source),
      execution_count: c.execution_count ?? null,
      outputs: c.outputs || [],
    }));
  } catch {
    return [];
  }
}

function parseMetadata(content: string): Record<string, unknown> {
  try {
    const doc = JSON.parse(content || "{}");
    return doc.metadata || {};
  } catch {
    return {};
  }
}

function serializeNotebook(
  cells: NotebookCell[],
  metadata: Record<string, unknown>,
): string {
  const doc = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata,
    cells: cells.map((c) => ({
      cell_type: c.cell_type,
      source: c.source.split(/(?<=\n)/),
      execution_count: c.execution_count ?? null,
      outputs: c.outputs || [],
    })),
  };
  return JSON.stringify(doc, null, 2);
}

// ---------------------------------------------------------------------------
// Sortable Cell Wrapper
// ---------------------------------------------------------------------------

function SortableCell({
  cell,
  index,
  totalCells,
  isRunning,
  isSelected,
  language,
  executionTime,
  collapsed,
  onCollapsedChange,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddBelow,
  onMoveUp,
  onMoveDown,
  onRun,
  onRunAndAdvance,
  onRunAndInsert,
  onClearOutputs,
  onChangeType,
  onSelect,
}: {
  cell: NotebookCell;
  index: number;
  totalCells: number;
  isRunning: boolean;
  isSelected: boolean;
  language: string;
  executionTime: number | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onUpdate: (id: string, updates: Partial<NotebookCell>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddBelow: (id: string, type: "code" | "markdown" | "raw") => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onRun: (cell: NotebookCell) => void;
  onRunAndAdvance: (cell: NotebookCell) => void;
  onRunAndInsert: (cell: NotebookCell) => void;
  onClearOutputs: (id: string) => void;
  onChangeType: (id: string, type: "markdown" | "code" | "raw") => void;
  onSelect: (id: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(cell.source);
  const [markdownPreview, setMarkdownPreview] = useState(cell.cell_type === "markdown");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCode = cell.cell_type === "code";
  const isMarkdown = cell.cell_type === "markdown";
  const isRaw = cell.cell_type === "raw";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cell.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Sync editContent when cell.source changes externally
  useEffect(() => {
    setEditContent(cell.source);
  }, [cell.source]);

  const saveEdit = useCallback(() => {
    if (editContent !== cell.source) {
      onUpdate(cell.id, { source: editContent });
    }
    setEditing(false);
  }, [editContent, cell.source, cell.id, onUpdate]);

  const enterEditMode = useCallback(() => {
    setEditContent(cell.source);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [cell.source]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (isCode) onRun(cell);
        else saveEdit();
        return;
      }
      if ((e.shiftKey || e.altKey) && e.key === "Enter") {
        if (isCode) {
          e.preventDefault();
          if (e.shiftKey && !e.altKey) onRunAndAdvance(cell);
          else if (e.altKey) onRunAndInsert(cell);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setEditContent(cell.source);
        setEditing(false);
        return;
      }
      e.stopPropagation();
    },
    [isCode, cell, onRun, onRunAndAdvance, onRunAndInsert, saveEdit],
  );

  const mdHandleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        saveEdit();
        setMarkdownPreview(true);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setEditContent(cell.source);
        setEditing(false);
        setMarkdownPreview(true);
        return;
      }
      e.stopPropagation();
    },
    [cell.source, saveEdit],
  );

  const highlightedHtml = useMemo(() => {
    if (isCode && cell.source) {
      return buildHighlightedHtml(cell.source, language);
    }
    return "";
  }, [isCode, cell.source, language]);

  const handleCellClick = useCallback(() => {
    onSelect(cell.id);
  }, [cell.id, onSelect]);

  return (
    <section
      ref={setNodeRef}
      style={style}
      onClick={handleCellClick}
      className={cn(
        "rounded-xl border overflow-hidden shadow-sm transition-all bg-card cursor-pointer",
        isDragging && "shadow-lg",
        isRunning && "border-primary/50 ring-1 ring-primary/20",
        isSelected && "ring-2 ring-primary/50 border-primary/40",
        !isSelected && !isRunning && "border-border/60 hover:border-border/80",
      )}
    >
      {/* Cell header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1.5 border-b border-border/50",
          isSelected ? "bg-primary/5" : "bg-muted/30",
        )}
      >
        <div className="flex items-center gap-1 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
            title="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCollapsedChange(!collapsed); }}
            className="p-0.5 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground shrink-0"
            title={collapsed ? "Expand cell" : "Collapse cell"}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground ml-1">
            {cell.cell_type}
          </span>
          {isCode && cell.execution_count != null && (
            <Badge variant="secondary" className="text-[10px] font-mono ml-1.5">
              In [{cell.execution_count}]
            </Badge>
          )}
          {executionTime != null && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1.5">
              <Clock className="w-3 h-3" /> {formatTime(executionTime)}
            </span>
          )}
          {isRunning && (
            <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30 animate-pulse ml-1.5">
              running...
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Cell type toggle / edit toggle */}
          {isCode && !editing && (
            <button
              onClick={() => enterEditMode()}
              className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              title="Edit cell"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}
          {isCode && editing && (
            <button
              onClick={() => { setEditing(false); setEditContent(cell.source); }}
              className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              title="Stop editing"
            >
              <Eye className="w-3 h-3" />
            </button>
          )}
          {isMarkdown && (
            <button
              onClick={() => { setMarkdownPreview((p) => !p); if (markdownPreview) enterEditMode(); }}
              className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              title={markdownPreview ? "Edit markdown" : "Preview markdown"}
            >
              {markdownPreview ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          )}
          {isRaw && (
            <button
              onClick={() => onChangeType(cell.id, "code")}
              className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              title="Convert to code"
            >
              <Code2 className="w-3 h-3" />
            </button>
          )}

          {/* Run button (code only) */}
          {isCode && (
            <>
              <button
                onClick={() => onRun(cell)}
                disabled={isRunning}
                className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
                title="Run cell (Ctrl+Enter)"
              >
                {isRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </>
          )}

          {/* Move up / down */}
          <button
            onClick={() => onMoveUp(cell.id)}
            disabled={index === 0}
            className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Move up"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            onClick={() => onMoveDown(cell.id)}
            disabled={index === totalCells - 1}
            className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Move down"
          >
            <ArrowDown className="w-3 h-3" />
          </button>

          {/* Duplicate */}
          <button
            onClick={() => onDuplicate(cell.id)}
            className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
            title="Duplicate cell"
          >
            <CopyPlus className="w-3 h-3" />
          </button>

          {/* Clear outputs */}
          {isCode && cell.outputs && cell.outputs.length > 0 && (
            <button
              onClick={() => onClearOutputs(cell.id)}
              className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              title="Clear outputs"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => onDelete(cell.id)}
            className="p-1 rounded hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-400"
            title="Delete cell"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Cell body */}
      <div className={cn("transition-all", collapsed && "hidden")}>
        <div className="p-4" onClick={(e) => e.stopPropagation()}>
          {/* Markdown: render or edit */}
          {isMarkdown && markdownPreview && (
            <article
              className="prose prose-sm dark:prose-invert max-w-none cursor-text"
              onClick={() => { enterEditMode(); setMarkdownPreview(false); }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{cell.source || "*empty*"}</ReactMarkdown>
            </article>
          )}

          {isMarkdown && !markdownPreview && (
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={() => { saveEdit(); setMarkdownPreview(true); }}
              onKeyDown={mdHandleKeyDown}
              className="w-full min-h-[80px] bg-black/30 border border-border/60 rounded-lg p-3 text-sm font-mono text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="Enter markdown..."
            />
          )}

          {/* Code: view mode (syntax highlighted) or edit mode (textarea) */}
          {isCode && !editing && (
            <div
              className="w-full min-h-[40px] bg-black border border-emerald-500/20 rounded-lg p-3 text-xs md:text-sm font-mono leading-6 overflow-x-auto cursor-text"
              onDoubleClick={() => enterEditMode()}
              onClick={() => enterEditMode()}
            >
              {cell.source ? (
                <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
              ) : (
                <span className="text-muted-foreground italic text-xs">Click to add code...</span>
              )}
            </div>
          )}

          {isCode && editing && (
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="w-full min-h-[60px] bg-black border border-emerald-500/20 rounded-lg p-3 text-xs md:text-sm font-mono text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500/40 leading-6"
              placeholder="Enter code..."
              spellCheck={false}
            />
          )}

          {/* Raw: view or edit */}
          {isRaw && !editing && (
            <div
              className="w-full min-h-[40px] bg-muted/40 border border-border/60 rounded-lg p-3 text-xs md:text-sm font-mono leading-6 overflow-x-auto cursor-text"
              onDoubleClick={() => enterEditMode()}
              onClick={() => enterEditMode()}
            >
              {cell.source || <span className="text-muted-foreground italic text-xs">Click to add content...</span>}
            </div>
          )}

          {isRaw && editing && (
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="w-full min-h-[60px] bg-muted/40 border border-border/60 rounded-lg p-3 text-xs md:text-sm font-mono text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary/40 leading-6"
              placeholder="Enter raw content..."
            />
          )}

          {/* Outputs (code cells only) */}
          {isCode && cell.outputs && cell.outputs.length > 0 && (
            <CellOutputs outputs={cell.outputs} />
          )}
        </div>

        {/* Add cell below button */}
        <div className="flex justify-center border-t border-border/30 py-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-3 py-0.5 rounded hover:bg-muted/40"
              >
                <Plus className="w-3 h-3" /> Add cell below
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[140px]">
              <DropdownMenuItem className="text-xs gap-2" onClick={() => onAddBelow(cell.id, "code")}>
                <Terminal className="w-3.5 h-3.5" /> Code
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs gap-2" onClick={() => onAddBelow(cell.id, "markdown")}>
                <FileText className="w-3.5 h-3.5" /> Markdown
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs gap-2" onClick={() => onAddBelow(cell.id, "raw")}>
                <Code2 className="w-3.5 h-3.5" /> Raw
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Variables Sidebar
// ---------------------------------------------------------------------------

const VariablesSidebar = ({ variables }: { variables: Array<{ name: string; type: string }> }) => {
  const typeColors: Record<string, string> = {
    'string': 'bg-blue-500/10 text-blue-600',
    'number': 'bg-green-500/10 text-green-600',
    'list': 'bg-purple-500/10 text-purple-600',
    'dict': 'bg-orange-500/10 text-orange-600',
    'set': 'bg-pink-500/10 text-pink-600',
    'bool': 'bg-yellow-500/10 text-yellow-600',
    'none': 'bg-gray-500/10 text-gray-600',
    'other': 'bg-slate-500/10 text-slate-600',
  };

  return (
    <div className="border-l border-border/60 bg-muted/5 w-48 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-border/60 shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variables</h3>
      </div>
      
      {variables.length === 0 ? (
        <div className="p-3 text-center text-xs text-muted-foreground">
          No variables detected
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {variables.map((v, i) => (
              <div
                key={i}
                className="p-2 rounded border border-border/30 bg-background/50 hover:bg-background/80 transition-colors"
              >
                <div className="text-xs font-mono font-semibold text-foreground truncate">
                  {v.name}
                </div>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono",
                      typeColors[v.type] || typeColors.other
                    )}
                  >
                    {v.type}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IpynbViewer({ file, onContentChange }: { file: FileNode; onContentChange?: (fileId: string, content: string) => void }) {
  const [cells, setCells] = useState<NotebookCell[]>(() => parseCells(file.content));
  const [metadata, setMetadata] = useState<Record<string, unknown>>(() => parseMetadata(file.content));
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [variables, setVariables] = useState<Array<{ name: string; type: string }>>([]);
  
  // Track collapsed state per cell
  const [collapsedCells, setCollapsedCells] = useState<Set<string>>(new Set());

  // For kernel integration
  const initRef = useRef<string | null>(null);
  const cellsRef = useRef<NotebookCell[]>(cells);
  const notebookRef = useRef<HTMLDivElement>(null);
  
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJsonContent, setRawJsonContent] = useState("");
  const [showRawPaste, setShowRawPaste] = useState(false);
  const [executionTimes, setExecutionTimes] = useState<Record<string, number>>({});
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set());
  const [isExecuting, setIsExecuting] = useState(false);

  // useNotebookKernel hook - mock implementation if not available
  const { kernel, runCell } = useNotebookKernel(file.id);

  // Update variables whenever cells change
  useEffect(() => {
    const allVars: Record<string, string> = {};
    cells.forEach(cell => {
      if (cell.cell_type === 'code') {
        const cellVars = extractVariablesFromCell(cell.source);
        cellVars.forEach(v => {
          allVars[v.name] = v.type;
        });
      }
    });
    setVariables(Object.entries(allVars).map(([name, type]) => ({ name, type })));
  }, [cells]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Re-parse when file changes
  useEffect(() => {
    if (file.content !== initRef.current) {
      initRef.current = file.content;
      setCells(parseCells(file.content));
      setMetadata(parseMetadata(file.content));
      setSelectedCellId(null);
      setExecutionTimes({});
      setShowRawJson(false);
      setCollapsedCells(new Set());
    }
  }, [file.content, file.id]);

  // Update cellsRef
  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  const saveNotebook = useCallback(
    (updatedCells?: NotebookCell[], updatedMetadata?: Record<string, unknown>) => {
      const c = updatedCells ?? cells;
      const m = updatedMetadata ?? metadata;
      const json = serializeNotebook(c, m);
      onContentChange?.(file.id, json);
    },
    [cells, metadata, file.id, onContentChange],
  );

  const language = useMemo(() => {
    return getLanguageForNotebook({ metadata });
  }, [metadata]);

  const kernelName = useMemo(() => {
    const ks = metadata?.kernelspec;
    if (ks && typeof ks.display_name === "string") return String(ks.display_name);
    if (ks && typeof ks.name === "string") return String(ks.name);
    const li = metadata?.language_info;
    if (li && typeof li.name === "string") return String(li.name);
    return "unknown";
  }, [metadata]);

  const currentKernel = useMemo(() => {
    const ks = metadata?.kernelspec as Record<string, unknown> | undefined;
    return ks && typeof ks.name === "string" ? ks.name : "";
  }, [metadata]);

  const KERNEL_OPTIONS: Array<{ label: string; kernel: string; language: string }> = useMemo(() => [
    { label: "Python 3", kernel: "python3", language: "python" },
    { label: "Python 2", kernel: "python2", language: "python" },
    { label: "R", kernel: "ir", language: "R" },
    { label: "Julia", kernel: "julia-1.9", language: "julia" },
    { label: "Node.js", kernel: "nodejs", language: "javascript" },
    { label: "Ruby", kernel: "iruby", language: "ruby" },
  ], []);

  const handleKernelChange = useCallback((label: string, kernel: string, language: string) => {
    const newMeta = {
      ...metadata,
      kernelspec: { display_name: label, language, name: kernel },
      language_info: { name: language, version: "" },
    };
    setMetadata(newMeta);
    saveNotebook(cells, newMeta);
  }, [metadata, cells, saveNotebook]);

  // Find cell index by id (safer than indexOf with object references)
  const findCellIndex = useCallback((id: string) => {
    return cells.findIndex((c) => c.id === id);
  }, [cells]);

  // Insert cell at a given index
  const insertCellAt = useCallback((index: number, cell: NotebookCell) => {
    setCells((prev) => {
      const newCells = [...prev];
      newCells.splice(index, 0, cell);
      saveNotebook(newCells);
      return newCells;
    });
  }, [saveNotebook]);

  // Cell operations
  const handleUpdate = useCallback(
    (id: string, updates: Partial<NotebookCell>) => {
      setCells((prev) => {
        const newCells = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
        saveNotebook(newCells);
        return newCells;
      });
    },
    [saveNotebook],
  );

  const handleAddCell = useCallback(
    (index: number, type: "markdown" | "code" | "raw" = "code") => {
      const newCell: NotebookCell = {
        id: generateCellId(),
        cell_type: type,
        source: "",
        execution_count: null,
        outputs: [],
      };
      insertCellAt(index + 1, newCell);
    },
    [insertCellAt],
  );

  const handleAddBelow = useCallback(
    (id: string, type: "code" | "markdown" | "raw" = "code") => {
      const idx = findCellIndex(id);
      if (idx < 0) return;
      handleAddCell(idx, type);
    },
    [findCellIndex, handleAddCell],
  );

  const handleDelete = useCallback(
    (id: string) => {
      setCells((prev) => {
        const newCells = prev.filter((c) => c.id !== id);
        saveNotebook(newCells);
        return newCells;
      });
      if (selectedCellId === id) setSelectedCellId(null);
    },
    [saveNotebook, selectedCellId],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      setCells((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        if (idx < 0) return prev;
        const source = prev[idx];
        const dup: NotebookCell = {
          id: generateCellId(),
          cell_type: source.cell_type,
          source: source.source,
          execution_count: null,
          outputs: [],
        };
        const newCells = [...prev];
        newCells.splice(idx + 1, 0, dup);
        saveNotebook(newCells);
        return newCells;
      });
    },
    [saveNotebook],
  );

  const handleMove = useCallback(
    (id: string, direction: "up" | "down") => {
      setCells((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        if (idx < 0) return prev;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;
        const newCells = [...prev];
        [newCells[idx], newCells[targetIdx]] = [newCells[targetIdx], newCells[idx]];
        saveNotebook(newCells);
        return newCells;
      });
    },
    [saveNotebook],
  );

  const handleChangeType = useCallback(
    (id: string, type: "markdown" | "code" | "raw") => {
      setCells((prev) => {
        const newCells = prev.map((c) =>
          c.id === id ? { ...c, cell_type: type } : c,
        );
        saveNotebook(newCells);
        return newCells;
      });
    },
    [saveNotebook],
  );

  const handleClearOutputs = useCallback(
    (id: string) => {
      setCells((prev) => {
        const newCells = prev.map((c) =>
          c.id === id ? { ...c, outputs: [], execution_count: null } : c,
        );
        saveNotebook(newCells);
        return newCells;
      });
    },
    [saveNotebook],
  );

  const handleRun = useCallback(
    async (cell: NotebookCell) => {
      if (!cell.source.trim()) return;
      setRunningCells((prev) => new Set(prev).add(cell.id));
      const startTime = performance.now();
      try {
        const { outputs, executionCount } = await runCell(cell.source, language);
        const elapsed = performance.now() - startTime;
        setExecutionTimes((prev) => ({ ...prev, [cell.id]: elapsed }));
        setCells((prev) => {
          const newCells = prev.map((c) =>
            c.id === cell.id ? { ...c, outputs, execution_count: executionCount } : c,
          );
          saveNotebook(newCells);
          return newCells;
        });
      } finally {
        setRunningCells((prev) => {
          const next = new Set(prev);
          next.delete(cell.id);
          return next;
        });
      }
    },
    [runCell, language, saveNotebook],
  );

  const handleRunAndAdvance = useCallback(
    async (cell: NotebookCell) => {
      await handleRun(cell);
      const idx = findCellIndex(cell.id);
      const cur = cellsRef.current;
      if (idx >= 0 && idx < cur.length - 1) {
        setSelectedCellId(cur[idx + 1].id);
      } else if (idx >= 0) {
        const newCell: NotebookCell = {
          id: generateCellId(),
          cell_type: "code",
          source: "",
          execution_count: null,
          outputs: [],
        };
        insertCellAt(cur.length, newCell);
        setSelectedCellId(newCell.id);
      }
    },
    [handleRun, findCellIndex, insertCellAt],
  );

  const handleRunAndInsert = useCallback(
    async (cell: NotebookCell) => {
      await handleRun(cell);
      const idx = findCellIndex(cell.id);
      if (idx >= 0) {
        const newCell: NotebookCell = {
          id: generateCellId(),
          cell_type: "code",
          source: "",
          execution_count: null,
          outputs: [],
        };
        insertCellAt(idx + 1, newCell);
        setSelectedCellId(newCell.id);
      }
    },
    [handleRun, findCellIndex, insertCellAt],
  );

  const handleRunAll = useCallback(async () => {
    setIsExecuting(true);
    try {
      for (const cell of cells) {
        if (cell.cell_type === "code" && cell.source.trim()) {
          await handleRun(cell);
        }
      }
    } finally {
      setIsExecuting(false);
    }
  }, [cells, handleRun]);

  const handleClearAllOutputs = useCallback(() => {
    setCells((prev) => {
      const newCells = prev.map((c) => ({ ...c, outputs: [], execution_count: null }));
      saveNotebook(newCells);
      return newCells;
    });
  }, [saveNotebook]);

  const handleRestartKernel = useCallback(() => {
    kernel.restartKernel();
    setExecutionTimes({});
  }, [kernel]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setCells((prev) => {
        const oldIdx = prev.findIndex((c) => c.id === active.id);
        const newIdx = prev.findIndex((c) => c.id === over.id);
        if (oldIdx < 0 || newIdx < 0) return prev;
        const newCells = [...prev];
        const [moved] = newCells.splice(oldIdx, 1);
        newCells.splice(newIdx, 0, moved);
        saveNotebook(newCells);
        return newCells;
      });
    },
    [saveNotebook],
  );

  // Search
  const filteredCells = useMemo(() => {
    if (!searchQuery) return cells;
    const q = searchQuery.toLowerCase();
    return cells.filter((cell) => {
      const source = cell.source.toLowerCase();
      const outputsText = (cell.outputs || [])
        .map((o) => {
          if (o.text) return asText(o.text);
          if (o.data) {
            for (const val of Object.values(o.data)) {
              if (typeof val === "string" || Array.isArray(val)) return resolveData(val);
            }
          }
          if (o.ename) return `${o.ename}: ${o.evalue || ""}`;
          return "";
        })
        .join(" ")
        .toLowerCase();
      return source.includes(q) || outputsText.includes(q);
    });
  }, [cells, searchQuery]);

  // Keyboard shortcuts at the notebook level
  useEffect(() => {
    const el = notebookRef.current;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      if (!selectedCellId) return;
      // Don't intercept when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const idx = cells.findIndex((c) => c.id === selectedCellId);
      if (idx < 0) return;
      const cell = cells[idx];

      switch (e.key) {
        case "Enter":
          if (e.shiftKey) {
            e.preventDefault();
            handleRunAndAdvance(cell);
          } else if (e.altKey) {
            e.preventDefault();
            handleRunAndInsert(cell);
          }
          break;
        case "a":
        case "A":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleAddCell(idx - 1, "code");
          }
          break;
        case "b":
        case "B":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleAddCell(idx, "code");
          }
          break;
        case "d":
        case "D":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleDelete(selectedCellId);
          }
          break;
        case "m":
        case "M":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            if (cell.cell_type !== "markdown") handleChangeType(selectedCellId, "markdown");
          }
          break;
        case "y":
        case "Y":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            if (cell.cell_type !== "code") handleChangeType(selectedCellId, "code");
          }
          break;
        case "ArrowUp":
          if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            if (idx > 0) setSelectedCellId(cells[idx - 1].id);
          }
          break;
        case "ArrowDown":
          if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            if (idx < cells.length - 1) setSelectedCellId(cells[idx + 1].id);
          }
          break;
      }
    };

    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [selectedCellId, cells, handleRunAndAdvance, handleRunAndInsert, handleAddCell, handleDelete, handleChangeType]);

  // Focus the notebook container so keyboard shortcuts work
  useEffect(() => {
    if (selectedCellId && notebookRef.current) {
      notebookRef.current.focus();
    }
  }, [selectedCellId]);

  // Error state
  if (!file.content) {
    return (
      <div className="h-full w-full p-8 flex items-center justify-center">
        <div className="max-w-xl w-full rounded-xl border border-border/60 bg-muted/10 p-6 text-center">
          <Code2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Notebook file is empty. Add content to get started.</p>
        </div>
      </div>
    );
  }

  const exportIpynb = () => {
    const json = serializeNotebook(cells, metadata);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.ipynb$/i, '.ipynb');
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPy = () => {
    const lines: string[] = [];
    for (const cell of cells) {
      if (cell.cell_type === 'markdown') {
        lines.push('# %% [markdown]');
        lines.push(`# ${cell.source.replace(/\n/g, '\n# ')}`);
        lines.push('');
      } else {
        lines.push('# %%');
        lines.push(cell.source);
        lines.push('');
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.ipynb$/i, '.py');
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHtml = () => {
    const renderedCells = cells.map((cell, i) => {
      if (cell.cell_type === 'markdown') {
        return `<div class="cell markdown">${cell.source}</div>`;
      }
      const outputs = (cell.outputs || []).map((o) => {
        const text = o.text ? (Array.isArray(o.text) ? o.text.join('') : o.text) : '';
        return `<pre class="output">${escapeHtml(text)}</pre>`;
      }).join('');
      return `<div class="cell code"><pre class="code">${escapeHtml(cell.source)}</pre>${outputs}</div>`;
    });
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escapeHtml(file.name)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:2rem;background:#fff;color:#1a1a1a}
.cell{margin:1rem 0;padding:1rem;border-radius:8px;border:1px solid #e5e7eb}
.code{background:#f3f4f6;padding:1rem;overflow-x:auto;border-radius:4px;font-family:monospace}
.output{background:#f9fafb;padding:0.75rem;margin-top:0.5rem;border-left:3px solid #3b82f6;font-family:monospace;white-space:pre-wrap}
.markdown{background:#fff}
h1,h2,h3{color:#111}
</style>
</head>
<body>${renderedCells.join('\n')}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.ipynb$/i, '.html');
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full bg-background flex flex-col outline-none">
      <div
        ref={notebookRef}
        tabIndex={0}
        className="flex-1 flex flex-col outline-none overflow-hidden"
      >
        {/* Top toolbar */}
        <div className="border-b border-border/60 px-4 py-2 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Code2 className="w-4 h-4" />
            <span>Jupyter Notebook Editor</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Run all */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleRunAll}
              disabled={isExecuting}
            >
              <Play className="w-3 h-3" /> Run all
            </Button>
            {/* Clear all outputs */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleClearAllOutputs}
            >
              <RotateCcw className="w-3 h-3" /> Clear all
            </Button>
            {/* Restart kernel */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleRestartKernel}
            >
              <Square className="w-3 h-3" /> Restart kernel
            </Button>
            {/* Add cell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add cell
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[140px]">
                <DropdownMenuItem className="text-xs gap-2" onClick={() => handleAddCell(cells.length - 1, "code")}>
                  <Terminal className="w-3.5 h-3.5" /> Code
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={() => handleAddCell(cells.length - 1, "markdown")}>
                  <FileText className="w-3.5 h-3.5" /> Markdown
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={() => handleAddCell(cells.length - 1, "raw")}>
                  <Code2 className="w-3.5 h-3.5" /> Raw
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Search */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowSearch((p) => !p)}
              title="Search cells (Ctrl+Shift+F)"
            >
              <Search className="w-3.5 h-3.5" />
            </Button>
            {/* Raw JSON toggle */}
            <Button
              variant={showRawJson ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                if (showRawJson) {
                  setShowRawJson(false);
                } else {
                  setRawJsonContent(serializeNotebook(cells, metadata));
                  setShowRawJson(true);
                }
              }}
              title="Edit notebook as raw JSON"
            >
              <FileJson className="w-3.5 h-3.5" /> {showRawJson ? "Visual" : "Raw JSON"}
            </Button>
            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  <Download className="w-3 h-3" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[120px]">
                <DropdownMenuItem className="text-xs gap-2" onClick={exportIpynb}>
                  <FileJson className="w-3.5 h-3.5" /> .ipynb
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={exportPy}>
                  <Terminal className="w-3.5 h-3.5" /> .py
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={exportHtml}>
                  <FileText className="w-3.5 h-3.5" /> HTML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-secondary/80 transition-colors">{kernelName}</Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[160px]">
                {KERNEL_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.kernel}
                    className="text-xs gap-2"
                    onClick={() => handleKernelChange(opt.label, opt.kernel, opt.language)}
                  >
                    {currentKernel === opt.kernel
                      ? <CheckCircle2 className="w-3 h-3 text-primary" />
                      : <div className="w-3 h-3" />}
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Badge variant="outline" className="text-[10px]">{cells.length} cells</Badge>

            {/* Kernel status */}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                kernel.status === "running" && "text-yellow-500 border-yellow-500/30",
                kernel.status === "error" && "text-red-500 border-red-500/30",
                kernel.status === "ready" && "text-emerald-500 border-emerald-500/30",
              )}
            >
              {kernel.status === "idle" && "Kernel idle"}
              {kernel.status === "running" && "Running..."}
              {kernel.status === "ready" && "Ready"}
              {kernel.status === "error" && "Error"}
            </Badge>
          </div>
        </div>

        {/* Help bar for selected cell */}
        {selectedCellId && (
          <div className="px-4 py-1 border-b border-border/30 bg-muted/10 shrink-0">
            <p className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono">Shift+Enter</kbd> run &amp; advance{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono">Alt+Enter</kbd> run &amp; insert{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono">A</kbd> insert above{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono">B</kbd> insert below{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono">D</kbd> delete{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono">M</kbd> markdown{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono">Y</kbd> code{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono">↑↓</kbd> navigate
            </p>
          </div>
        )}

        {/* Search bar */}
        {showSearch && (
          <div className="px-4 py-2 border-b border-border/60 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search cells..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8 text-sm"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {filteredCells.length} / {cells.length} cells match
              </p>
            )}
          </div>
        )}

        {/* Main content: Raw JSON editor or notebook viewer with sidebar */}
        {showRawJson ? (
          <div className="flex-1 flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-sm font-medium flex items-center gap-2">
                <FileJson className="w-4 h-4" /> Raw Notebook JSON
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowRawJson(false)}
                >
                  <X className="w-3 h-3" /> Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(rawJsonContent);
                      if (!parsed.cells || !Array.isArray(parsed.cells)) {
                        throw new Error("Missing 'cells' array");
                      }
                      const newCells = parseCells(rawJsonContent);
                      const newMeta = parseMetadata(rawJsonContent);
                      setCells(newCells);
                      setMetadata(newMeta);
                      saveNotebook(newCells, newMeta);
                      setShowRawJson(false);
                      setShowRawPaste(false);
                      setRawJsonContent("");
                    } catch (err) {
                      alert("Invalid JSON: " + (err instanceof Error ? err.message : String(err)));
                    }
                  }}
                >
                  <CheckCircle2 className="w-3 h-3" /> Apply
                </Button>
              </div>
            </div>
            <textarea
              value={rawJsonContent}
              onChange={(e) => setRawJsonContent(e.target.value)}
              className="flex-1 w-full bg-muted/20 border border-border/60 rounded-lg p-4 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 leading-5"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Notebook area */}
            <ScrollArea className="flex-1">
              <div className="p-6 max-w-5xl mx-auto space-y-4">
                {cells.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Code2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm mb-2">Empty notebook</p>
                    <div className="flex items-center justify-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add cell
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="min-w-[140px]">
                          <DropdownMenuItem
                            className="text-xs gap-2"
                            onClick={() => {
                              const newCell: NotebookCell = {
                                id: generateCellId(),
                                cell_type: "code",
                                source: "",
                                execution_count: null,
                                outputs: [],
                              };
                              setCells([newCell]);
                              saveNotebook([newCell]);
                              setSelectedCellId(newCell.id);
                            }}
                          >
                            <Terminal className="w-3.5 h-3.5" /> Code
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs gap-2"
                            onClick={() => {
                              const newCell: NotebookCell = {
                                id: generateCellId(),
                                cell_type: "markdown",
                                source: "",
                                execution_count: null,
                                outputs: [],
                              };
                              setCells([newCell]);
                              saveNotebook([newCell]);
                              setSelectedCellId(newCell.id);
                            }}
                          >
                            <FileText className="w-3.5 h-3.5" /> Markdown
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs gap-2"
                            onClick={() => {
                              const newCell: NotebookCell = {
                                id: generateCellId(),
                                cell_type: "raw",
                                source: "",
                                execution_count: null,
                                outputs: [],
                              };
                              setCells([newCell]);
                              saveNotebook([newCell]);
                              setSelectedCellId(newCell.id);
                            }}
                          >
                            <Code2 className="w-3.5 h-3.5" /> Raw
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {!showRawPaste && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => {
                            setRawJsonContent("");
                            setShowRawPaste(true);
                          }}
                        >
                          <FileJson className="w-3 h-3" /> Raw
                        </Button>
                      )}
                    </div>
                    {showRawPaste && (
                      <div className="mt-4 max-w-xl mx-auto space-y-2">
                        <textarea
                          value={rawJsonContent}
                          onChange={(e) => setRawJsonContent(e.target.value)}
                          className="w-full min-h-[120px] bg-background border border-border/60 rounded-lg p-3 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary/40 leading-5"
                          placeholder='Paste raw notebook JSON (e.g. {"nbformat":4,"cells":[...]})'
                        />
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              try {
                                const parsed = JSON.parse(rawJsonContent);
                                if (!parsed.cells || !Array.isArray(parsed.cells)) {
                                  throw new Error("Missing 'cells' array");
                                }
                                const newCells = parseCells(rawJsonContent);
                                const newMeta = parseMetadata(rawJsonContent);
                                setCells(newCells);
                                setMetadata(newMeta);
                                saveNotebook(newCells, newMeta);
                                setShowRawPaste(false);
                              } catch (err) {
                                alert("Invalid JSON: " + (err instanceof Error ? err.message : String(err)));
                              }
                            }}
                            disabled={!rawJsonContent.trim()}
                          >
                            <CheckCircle2 className="w-3 h-3" /> Load
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setShowRawPaste(false)}
                          >
                            <X className="w-3 h-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {filteredCells.length === 0 && searchQuery && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No cells match &ldquo;{searchQuery}&rdquo;</p>
                    <button onClick={() => setSearchQuery("")} className="text-xs text-primary hover:underline mt-1">Clear search</button>
                  </div>
                )}

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={cells.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {filteredCells.length > 0 && (
                      <div className="space-y-3">
                        {filteredCells.map((cell) => {
                          const realIndex = cells.findIndex((c) => c.id === cell.id);
                          return (
                            <div key={cell.id}>
                              {/* Add cell above (first cell) */}
                              {realIndex === 0 && (
                                <div className="flex justify-center mb-3">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-3 py-0.5 rounded hover:bg-muted/40">
                                        <Plus className="w-3 h-3" /> Add cell
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" className="min-w-[140px]">
                                      <DropdownMenuItem className="text-xs gap-2" onClick={() => handleAddCell(-1, "code")}>
                                        <Terminal className="w-3.5 h-3.5" /> Code
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-xs gap-2" onClick={() => handleAddCell(-1, "markdown")}>
                                        <FileText className="w-3.5 h-3.5" /> Markdown
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-xs gap-2" onClick={() => handleAddCell(-1, "raw")}>
                                        <Code2 className="w-3.5 h-3.5" /> Raw
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}

                              <SortableCell
                                cell={cell}
                                index={realIndex}
                                totalCells={cells.length}
                                isRunning={runningCells.has(cell.id)}
                                isSelected={selectedCellId === cell.id}
                                language={language}
                                executionTime={executionTimes[cell.id] ?? null}
                                collapsed={collapsedCells.has(cell.id)}
                                onCollapsedChange={(collapsed) => {
                                  const newSet = new Set(collapsedCells);
                                  if (collapsed) {
                                    newSet.add(cell.id);
                                  } else {
                                    newSet.delete(cell.id);
                                  }
                                  setCollapsedCells(newSet);
                                }}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                                onDuplicate={handleDuplicate}
                                onAddBelow={handleAddBelow}
                                onMoveUp={(id) => handleMove(id, "up")}
                                onMoveDown={(id) => handleMove(id, "down")}
                                onRun={handleRun}
                                onRunAndAdvance={handleRunAndAdvance}
                                onRunAndInsert={handleRunAndInsert}
                                onClearOutputs={handleClearOutputs}
                                onChangeType={handleChangeType}
                                onSelect={setSelectedCellId}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SortableContext>
                </DndContext>
              </div>
            </ScrollArea>

            {/* Variables Sidebar */}
            <VariablesSidebar variables={variables} />
          </div>
        )}
      </div>
    </div>
  );
}
