import { useCallback, useEffect, useMemo, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { FileNode } from "@/types/ide";

interface DrawEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

export function DrawEditor({ file, onContentChange }: DrawEditorProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

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
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const data = JSON.stringify({ elements: [...elements], appState, files });
        onContentChange(file.id, data);
      }, 500);
    },
    [file.id, onContentChange],
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <div className="w-full h-full overflow-hidden">
      <Excalidraw
        key={file.id}
        initialData={initialData}
        onChange={onChange}
      />
    </div>
  );
}
