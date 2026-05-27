import { useState, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileNode } from "@/types/ide";
import { cn } from "@/lib/utils";
import { tokenize, getTokenClass, escapeHtml } from "@/lib/syntax";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Copy,
  ChevronDown,
  ChevronRight,
  Search,
  Maximize2,
  Minimize2,
  Terminal,
  ImageIcon,
  FileJson,
  X,
} from "lucide-react";

type NbOutput = {
  output_type?: string;
  text?: string[] | string;
  data?: Record<string, unknown>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  name?: string;
  execution_count?: number | null;
};

type NotebookCell = {
  cell_type?: "markdown" | "code" | "raw";
  source?: string[] | string;
  execution_count?: number | null;
  outputs?: NbOutput[];
};

type NotebookDoc = {
  nbformat?: number;
  nbformat_minor?: number;
  metadata?: {
    kernelspec?: Record<string, unknown>;
    language_info?: Record<string, unknown>;
  };
  cells?: NotebookCell[];
};

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

function getLanguageForNotebook(notebook: NotebookDoc): string {
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

function extractCellText(cell: NotebookCell): string {
  const source = asText(cell.source).toLowerCase();
  const outputs = (cell.outputs || [])
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
  return `${source} ${outputs}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

const OutputRenderer = ({ output }: { output: NbOutput }) => {
  if (output.output_type === "stream") {
    const isStderr = output.name === "stderr";
    return (
      <div className={cn("mt-3 rounded-lg border p-3 font-mono text-xs leading-6", isStderr ? "border-red-500/20 bg-red-950/10" : "border-border/60 bg-muted/20")}>
        {isStderr && <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-1.5"><Terminal className="w-3 h-3" /> stderr</div>}
        <pre className="whitespace-pre-wrap text-foreground/80">{asText(output.text)}</pre>
      </div>
    );
  }

  if (output.output_type === "error") {
    const trace = output.traceback?.join("\n") || `${output.ename || "Error"}: ${output.evalue || ""}`;
    return (
      <div className="mt-3 rounded-lg border border-red-500/20 bg-red-950/5 p-3 font-mono text-xs leading-6">
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-1.5"><AlertTriangle className="w-3 h-3" /> {output.ename || "Error"}</div>
        <pre className="whitespace-pre-wrap text-red-300/80">{trace}</pre>
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
  if (!outputs?.length) return null;
  return (
    <div className="mt-4 border-t border-border/30 pt-3">
      <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Outputs</div>
      <div className="space-y-2">
        {outputs.map((output, i) => (
          <OutputRenderer key={`${output.output_type || "output"}-${i}`} output={output} />
        ))}
      </div>
    </div>
  );
};

export function IpynbViewer({ file }: { file: FileNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [collapsedCells, setCollapsedCells] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const parsed = useMemo(() => {
    try {
      const notebook = JSON.parse(file.content || "{}") as NotebookDoc;
      if (!Array.isArray(notebook.cells)) {
        throw new Error("Notebook file is missing a valid cells array.");
      }
      return { notebook, error: null as string | null };
    } catch (error) {
      return { notebook: null as NotebookDoc | null, error: error instanceof Error ? error.message : "Unable to parse notebook." };
    }
  }, [file.content]);

  const language = useMemo(() => {
    if (!parsed.notebook) return "python";
    return getLanguageForNotebook(parsed.notebook);
  }, [parsed.notebook]);

  const kernelName = useMemo(() => {
    if (!parsed.notebook) return "unknown";
    const ks = parsed.notebook.metadata?.kernelspec;
    if (ks && typeof ks.display_name === "string") return String(ks.display_name);
    if (ks && typeof ks.name === "string") return String(ks.name);
    const li = parsed.notebook.metadata?.language_info;
    if (li && typeof li.name === "string") return String(li.name);
    return "unknown";
  }, [parsed.notebook]);

  const allCollapsed = useMemo(() => {
    if (!parsed.notebook) return false;
    return collapsedCells.size === parsed.notebook.cells.length;
  }, [collapsedCells, parsed.notebook]);

  const toggleCollapse = useCallback((index: number) => {
    setCollapsedCells((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleAllCollapsed = useCallback(() => {
    if (!parsed.notebook) return;
    if (allCollapsed) {
      setCollapsedCells(new Set());
    } else {
      setCollapsedCells(new Set(parsed.notebook.cells.map((_, i) => i)));
    }
  }, [allCollapsed, parsed.notebook]);

  const filteredCells = useMemo(() => {
    if (!parsed.notebook || !searchQuery) return parsed.notebook?.cells || [];
    const q = searchQuery.toLowerCase();
    return parsed.notebook.cells.filter((cell, _i) => {
      const text = extractCellText(cell);
      return text.includes(q);
    });
  }, [parsed.notebook, searchQuery]);

  const handleCopy = useCallback((source: string, index: number) => {
    copyToClipboard(source);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  if (parsed.error || !parsed.notebook) {
    return (
      <div className="h-full w-full p-8 flex items-center justify-center">
        <div className="max-w-xl w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          <div className="flex items-center gap-2 font-semibold mb-2"><AlertTriangle className="w-4 h-4" /> Notebook parsing failed</div>
          <pre className="text-xs whitespace-pre-wrap leading-6">{parsed.error}</pre>
        </div>
      </div>
    );
  }

  const { notebook } = parsed;

  return (
    <div className="h-full w-full bg-background flex flex-col">
      <div className="border-b border-border/60 px-4 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Code2 className="w-4 h-4" />
          <span>Jupyter Notebook Viewer</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setShowSearch((p) => !p)}
            title="Search cells"
          >
            <Search className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={toggleAllCollapsed}
            title={allCollapsed ? "Expand all" : "Collapse all"}
          >
            {allCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </Button>
          <Badge variant="secondary" className="text-[10px]">nbformat {notebook.nbformat ?? "?"}.{notebook.nbformat_minor ?? "?"}</Badge>
          <Badge variant="outline" className="text-[10px]">{kernelName}</Badge>
          <Badge variant="outline" className="text-[10px]">{notebook.cells.length} cells</Badge>
        </div>
      </div>

      {showSearch && (
        <div className="px-4 py-2 border-b border-border/60 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search cells..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-8 text-sm"
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
              {filteredCells.length} / {notebook.cells.length} cells match
            </p>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl mx-auto space-y-5">
          {filteredCells.length === 0 && searchQuery && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No cells match &ldquo;{searchQuery}&rdquo;</p>
              <button onClick={() => setSearchQuery("")} className="text-xs text-primary hover:underline mt-1">Clear search</button>
            </div>
          )}

          {filteredCells.map((cell, displayIndex) => {
            const realIndex = notebook.cells.indexOf(cell);
            const source = asText(cell.source);
            const isMarkdown = cell.cell_type === "markdown";
            const isCode = cell.cell_type === "code";
            const isRaw = cell.cell_type === "raw";
            const isCollapsed = collapsedCells.has(realIndex);

            let highlightedHtml = "";
            if (isCode && source) {
              highlightedHtml = buildHighlightedHtml(source, language);
            }

            return (
              <section
                key={`${cell.cell_type || "cell"}-${realIndex}`}
                className={cn(
                  "rounded-xl border overflow-hidden shadow-sm transition-opacity",
                  searchQuery ? "border-primary/30" : "border-border/60",
                  "bg-card"
                )}
              >
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCollapse(realIndex)}
                      className="p-0.5 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                      title={isCollapsed ? "Expand cell" : "Collapse cell"}
                    >
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {cell.cell_type || "cell"} #{displayIndex + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isCode && cell.execution_count != null && (
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        In [{cell.execution_count}]
                      </Badge>
                    )}
                    {isCode && source && (
                      <button
                        onClick={() => handleCopy(source, realIndex)}
                        className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                        title="Copy cell source"
                      >
                        {copiedIndex === realIndex ? (
                          <span className="text-[10px] font-medium text-emerald-500 px-0.5">Copied</span>
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className={cn("transition-all", isCollapsed && "hidden")}>
                  <div className="p-4">
                    {isMarkdown ? (
                      <article className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
                      </article>
                    ) : (
                      <pre className={cn(
                        "text-xs md:text-sm whitespace-pre-wrap leading-6 rounded-lg p-4 border overflow-x-auto",
                        isCode ? "bg-black border-emerald-500/20" : "bg-muted/40"
                      )}>
                        {isCode && source ? (
                          <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                        ) : (
                          <code className="text-foreground/70">{source || <span className="text-muted-foreground italic">(empty)</span>}</code>
                        )}
                      </pre>
                    )}

                    {isCode && cell.outputs && cell.outputs.length > 0 && (
                      <CellOutputs outputs={cell.outputs} />
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
