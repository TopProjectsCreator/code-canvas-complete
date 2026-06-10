import { useState, useCallback, useEffect, useRef } from 'react';
import { FileNode } from '@/types/ide';
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Code } from 'lucide-react';
import { TexSourceEditor } from './tex/TexSourceEditor';
import { TexPreview } from './tex/TexPreview';
import { TexToolbar } from './tex/TexToolbar';

interface TexEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
  allFiles?: FileNode[];
}

export const TexEditor = ({ file, onContentChange }: TexEditorProps) => {
  const [content, setContent] = useState(file.content || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedContent, setDebouncedContent] = useState(content);

  useEffect(() => {
    setContent(file.content || '');
    setDebouncedContent(file.content || '');
  }, [file.id, file.content]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange(file.id, newContent);

    // Debounce preview updates
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedContent(newContent);
    }, 300);
  }, [file.id, onContentChange]);

  const handleInsert = useCallback((text: string) => {
    handleContentChange(content + text);
  }, [content, handleContentChange]);

  return (
    <div className="flex flex-1 flex-col bg-editor">
      <TexToolbar onInsert={handleInsert} />
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Source</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <TexSourceEditor value={content} onChange={handleContentChange} />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={55} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Preview</span>
            </div>
            <ScrollArea className="flex-1">
              <TexPreview content={debouncedContent} />
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
