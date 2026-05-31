import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw, exportToSvg, exportToBlob, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { FileNode } from "@/types/ide";
import { Button } from "@/components/ui/button";
import { Download, Maximize2, Minimize2, Layers } from "lucide-react";

interface DrawEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

export function DrawEditor({ file, onContentChange }: DrawEditorProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const excRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elements, setElements] = useState<any[]>([]);

  const initialData = useMemo(() => {
    if (file.content) {
      try {
        return JSON.parse(file.content);
      } catch {
        return { elements: [], appState: { viewBackgroundColor: "#ffffff" } };
      }
    }
    return { elements: [], appState: { viewBackgroundColor: "#ffffff" } };
  }, [file.id]);

  const onChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      setElements([...elements]);
      setIsDirty(true);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        if (!excRef.current) return;
        const sceneElements = excRef.current.getSceneElements();
        const data = serializeAsJSON(sceneElements, appState, files, "local");
        onContentChange(file.id, data);
        setIsDirty(false);
      }, 2000);
    },
    [file.id, onContentChange],
  );

  const handleExportSvg = async () => {
    if (!excRef.current) return;
    const { elements, appState, files } = excRef.current;
    const svg = await exportToSvg({ elements, appState, files });
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.draw$/i, '.svg');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = async () => {
    if (!excRef.current) return;
    const { elements, appState, files } = excRef.current;
    const blob = await exportToBlob({ elements, appState, files, mimeType: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.draw$/i, '.png');
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground mr-auto">Excalidraw</span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${isDirty ? "bg-amber-400" : "bg-green-500"}`} />
          {isDirty ? "Unsaved changes" : "Saved"}
        </span>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleExportSvg}>
          <Download className="w-3 h-3" /> SVG
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleExportPng}>
          <Download className="w-3 h-3" /> PNG
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <Excalidraw
          key={file.id}
          initialData={initialData}
          onChange={onChange}
          excalidrawAPI={(api: any) => { excRef.current = api; }}
        />
      </div>
      <div className="flex items-center gap-2 px-3 py-1 bg-background border-t border-border shrink-0">
        <Layers className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{elements.length}</span>
      </div>
    </div>
  );
}
