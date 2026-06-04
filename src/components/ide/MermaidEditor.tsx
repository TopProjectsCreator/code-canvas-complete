import { useState, useEffect, useRef, useCallback } from "react";
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Code, Workflow } from "lucide-react";
import type { FileNode } from "@/types/ide";

interface MermaidEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

export function MermaidEditor({ file, onContentChange }: MermaidEditorProps) {
  const [content, setContent] = useState(file.content || "");
  const [renderedSvg, setRenderedSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const renderRequestRef = useRef(0);

  const getRenderId = useCallback((source: string) => {
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = Math.imul(31, hash) + source.charCodeAt(index) | 0;
    }
    const safeFileId = file.id.replace(/[^a-zA-Z0-9_-]/g, "-");
    return `mermaid-${safeFileId}-${(hash >>> 0).toString(36)}`;
  }, [file.id]);

  useEffect(() => {
    setContent(file.content || "");
  }, [file.id, file.content]);

  const renderDiagram = useCallback(async (source: string, requestId: number) => {
    if (!source.trim()) {
      if (renderRequestRef.current === requestId) {
        setRenderedSvg("");
        setError(null);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const mermaidModule = await import("mermaid");
      const mermaid = mermaidModule.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        deterministicIds: true,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        flowchart: { curve: "basis", htmlLabels: true },
        sequence: { useMaxWidth: true },
      });
      await mermaid.parse(source);
      const result = await mermaid.render(getRenderId(source), source);
      if (renderRequestRef.current === requestId) {
        setRenderedSvg(result.svg);
      }
    } catch (err) {
      if (renderRequestRef.current === requestId) {
        setRenderedSvg("");
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      }
    } finally {
      if (renderRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [getRenderId]);

  useEffect(() => {
    const requestId = renderRequestRef.current + 1;
    renderRequestRef.current = requestId;
    const timeout = window.setTimeout(() => {
      void renderDiagram(content, requestId);
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [content, renderDiagram]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setContent(next);
    onContentChange(file.id, next);
  }, [file.id, onContentChange]);

  return (
    <div className="flex flex-1 flex-col bg-editor">
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5 shrink-0">
        <Workflow className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-medium text-muted-foreground">Mermaid Editor</span>
      </div>
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="flex h-full min-w-0 flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5 shrink-0">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Source</span>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <textarea
                value={content}
                onChange={handleChange}
                className="min-h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-sm leading-6 outline-none"
                spellCheck={false}
                placeholder={`flowchart TD\n  A[Start] --> B{Is it working?}\n  B -->|Yes| C[Great!]\n  B -->|No| D[Debug]`}
              />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={55} minSize={25}>
          <div className="flex h-full min-w-0 flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5 shrink-0">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Preview</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex min-h-full items-start justify-center p-4">
                {loading && (
                  <div className="mt-8 text-sm text-muted-foreground animate-pulse">Rendering diagram…</div>
                )}
                {!loading && error && (
                  <div className="mt-8 w-full max-w-2xl rounded-lg border border-red-300 bg-red-50/10 p-4">
                    <p className="mb-1 text-xs font-semibold text-red-400">Unable to render diagram</p>
                    <pre className="whitespace-pre-wrap text-xs text-red-300 font-mono">{error}</pre>
                  </div>
                )}
                {!loading && !error && renderedSvg && (
                  <div
                    className="[&_svg]:max-w-none [&_svg]:h-auto [&_svg]:text-foreground"
                    dangerouslySetInnerHTML={{ __html: renderedSvg }}
                  />
                )}
                {!loading && !error && !renderedSvg && !content.trim() && (
                  <div className="mt-16 text-center">
                    <Workflow className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground italic">Enter Mermaid diagram source</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
