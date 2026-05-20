import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileNode } from "@/types/ide";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Code2 } from "lucide-react";

type NotebookCell = {
  cell_type?: "markdown" | "code" | "raw";
  source?: string[] | string;
  execution_count?: number | null;
  outputs?: Array<{
    output_type?: string;
    text?: string[] | string;
    data?: Record<string, string[] | string>;
    ename?: string;
    evalue?: string;
    traceback?: string[];
  }>;
};

type NotebookDoc = {
  nbformat?: number;
  nbformat_minor?: number;
  metadata?: Record<string, unknown>;
  cells?: NotebookCell[];
};

const asText = (value?: string[] | string): string => {
  if (!value) return "";
  return Array.isArray(value) ? value.join("") : value;
};

const renderOutputText = (cell: NotebookCell): string => {
  if (!cell.outputs?.length) return "";
  return cell.outputs
    .map((output) => {
      if (output.output_type === "error") {
        const trace = output.traceback?.join("\n") || `${output.ename || "Error"}: ${output.evalue || ""}`;
        return trace;
      }

      if (output.text) return asText(output.text);

      const data = output.data || {};
      if (data["text/plain"]) return asText(data["text/plain"]);
      if (data["text/markdown"]) return asText(data["text/markdown"]);

      return "";
    })
    .filter(Boolean)
    .join("\n\n");
};

export function IpynbViewer({ file }: { file: FileNode }) {
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
  const kernelName = typeof notebook.metadata?.kernelspec === "object" && notebook.metadata?.kernelspec && "name" in notebook.metadata.kernelspec
    ? String((notebook.metadata.kernelspec as Record<string, unknown>).name)
    : "unknown";

  return (
    <div className="h-full w-full bg-background">
      <div className="border-b border-border/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Code2 className="w-4 h-4" />
          <span>Jupyter Notebook Viewer</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">nbformat {notebook.nbformat ?? "?"}.{notebook.nbformat_minor ?? "?"}</Badge>
          <Badge variant="outline">kernel: {kernelName}</Badge>
          <Badge variant="outline">{notebook.cells.length} cells</Badge>
        </div>
      </div>

      <ScrollArea className="h-[calc(100%-57px)]">
        <div className="p-6 max-w-5xl mx-auto space-y-5">
          {notebook.cells.map((cell, index) => {
            const source = asText(cell.source);
            const outputText = renderOutputText(cell);
            const isMarkdown = cell.cell_type === "markdown";
            const isCode = cell.cell_type === "code";

            return (
              <section key={`${cell.cell_type || "cell"}-${index}`} className="rounded-xl border border-border/60 overflow-hidden shadow-sm bg-card">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {cell.cell_type || "cell"} cell #{index + 1}
                  </div>
                  {isCode && <Badge variant="secondary">In [{cell.execution_count ?? " "}]</Badge>}
                </div>

                <div className="p-4">
                  {isMarkdown ? (
                    <article className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
                    </article>
                  ) : (
                    <pre className={cn("text-xs md:text-sm whitespace-pre-wrap leading-6 rounded-lg p-4 border", isCode ? "bg-black text-green-200 border-emerald-500/20" : "bg-muted/40")}>{source || "(empty)"}</pre>
                  )}

                  {outputText && (
                    <div className="mt-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Output</div>
                      <pre className="text-xs md:text-sm whitespace-pre-wrap leading-6 rounded-lg p-4 border bg-background">{outputText}</pre>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
