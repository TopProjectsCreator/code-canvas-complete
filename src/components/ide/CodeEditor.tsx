import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sparkles, Upload, Blocks } from "lucide-react";
import { FileNode } from "@/types/ide";
import { FindReplace } from "./FindReplace";
import { FilePreview } from "./FilePreview";
import { OfficeEditor } from "./OfficeEditor";
import { VideoEditor } from "./VideoEditor";
import { AudioEditor } from "./AudioEditor";
import { RTFEditor } from "./RTFEditor";
import { CadEditor } from "@/components/cad/CadEditor";
import { ZipEditor } from "./ZipEditor";
import { IpynbViewer } from "./IpynbViewer";
import { MarkdownComposer } from "./MarkdownComposer";
import { PDFEditor } from "./PDFEditor";
import { TexEditor } from "./TexEditor";
import { MermaidEditor } from "./MermaidEditor";
import { Badge } from "@/components/ui/badge";
import { AdvancedWorkbench } from "./AdvancedWorkbench";
import { EnvFileEditor } from "./EnvFileEditor";
import { DrawEditor } from "./DrawEditor";
import { FontEditor } from "./FontEditor";
import { SvgEditor } from "./svg-editor";
import { getPreviewType } from "@/lib/filePreviewTypes";
import { useCollaboration } from "@/hooks/useCollaboration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractScopeHeaders, generateUnitTestFile, getScopeForLine } from "@/lib/advancedWorkbench";
import { ScratchPanel } from "@/components/scratch/ScratchPanel";
import type { ScratchArchive } from "@/services/scratchSb3";
import { importSb3, exportSb3 } from "@/services/scratchSb3";
import { TextEditor, type TextEditorHandle } from "./TextEditor";
import { EditorGutter } from "./EditorGutter";
import { EditorMinimap } from "./EditorMinimap";
import { EditorStatusBar } from "./EditorStatusBar";
import { EditorComments } from "./EditorComments";

interface CodeEditorProps {
  file: FileNode | null;
  allFiles: FileNode[];
  currentFilePath?: string | null;
  onContentChange: (fileId: string, content: string) => void;
  onCreateOrUpdateFile: (name: string, content: string, language?: string) => void;
  collab?: ReturnType<typeof useCollaboration>;
}

function ScratchProjectView({ file, onContentChange }: { file: FileNode; onContentChange: (fileId: string, content: string) => void }) {
  const [archive, setArchive] = useState<ScratchArchive | null>(null);
  const [running, setRunning] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (hasLoaded || !file.content) return;
    const tryLoadFromContent = async () => {
      const c = file.content.trim();
      if (c.startsWith('{') || c.startsWith('project.json')) {
        setArchive({ projectJson: c.replace(/^project\.json\n/, ''), files: {}, fileNames: [] });
        setHasLoaded(true);
      } else if (c.startsWith('// Binary file:')) {
        setHasLoaded(true);
      } else if (c.length > 50) {
        try {
          const bytes = Uint8Array.from(atob(c), (ch) => ch.charCodeAt(0));
          const result = await importSb3(bytes.buffer);
          setArchive(result.archive);
        } catch {
          setHasLoaded(true);
        }
      } else {
        setHasLoaded(true);
      }
    };
    tryLoadFromContent();
  }, [file.content, hasLoaded]);

  const handleProjectJsonUpdate = useCallback((json: string) => {
    if (!archive) return;
    exportSb3(archive).then((bytes) => {
      const base64 = btoa(String.fromCharCode(...bytes));
      onContentChange(file.id, base64);
    });
  }, [archive, file.id, onContentChange]);

  if (file.content && (file.content.startsWith('// Binary file:') || !file.content.trim())) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-editor text-muted-foreground gap-4">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
          <Blocks className="w-8 h-8 text-orange-500" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-foreground mb-1">Scratch Project</p>
          <p className="text-sm">{file.name}</p>
          <p className="text-xs mt-2 text-muted-foreground/70">
            Binary Scratch project file
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          <label className="cursor-pointer inline-flex items-center gap-2 rounded bg-orange-500/10 border border-orange-500/30 px-4 py-2 text-xs font-medium text-orange-500 hover:bg-orange-500/20 transition-colors">
            <Upload className="w-4 h-4" />
            Import .sb3 file
            <input
              type="file"
              accept=".sb3,.sb2,.sb"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const result = await importSb3(await f.arrayBuffer());
                  setArchive(result.archive);
                  handleProjectJsonUpdate(result.archive.projectJson);
                } catch (err) {
                  console.error('Failed to import Scratch project:', err);
                }
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <ScratchPanel
      archive={archive}
      onArchiveChange={setArchive}
      onProjectJsonUpdate={handleProjectJsonUpdate}
      isRunning={running}
      onRun={() => setRunning(true)}
      onStop={() => setRunning(false)}
    />
  );
}

export const CodeEditor = ({
  file,
  allFiles,
  currentFilePath,
  onContentChange,
  onCreateOrUpdateFile,
  collab,
}: CodeEditorProps) => {
  const [content, setContent] = useState("");
  const [cursorPosition, setCursorPosition] = useState({ line: 0, col: 0 });
  const textEditorRef = useRef<TextEditorHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [searchMatches, setSearchMatches] = useState<{ start: number; end: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [markdownPreview, setMarkdownPreview] = useState(true);
  const [splitPreview, setSplitPreview] = useState(false);
  const [composerMode, setComposerMode] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [asideTab, setAsideTab] = useState<"assistant" | "comments">("assistant");
  const [foldedScopes, setFoldedScopes] = useState<string[]>([]);
  const [showStickyScope, setShowStickyScope] = useState(() => {
    const stored = localStorage.getItem('showStickyScope');
    return stored === 'true';
  });

  const fileComments = useMemo(
    () => collab?.comments.filter((comment) => comment.file_path === currentFilePath) || [],
    [collab?.comments, currentFilePath],
  );
  const rootComments = useMemo(() => fileComments.filter((comment) => !comment.parent_id), [fileComments]);
  const commentsByLine = useMemo(() => {
    const map = new Map<number, typeof rootComments>();
    rootComments.forEach((comment) => {
      const comments = map.get(comment.line_number) || [];
      comments.push(comment);
      map.set(comment.line_number, comments);
    });
    return map;
  }, [rootComments]);
  const selectedLineThreads = useMemo(
    () => commentsByLine.get(selectedLine || -1) || [],
    [commentsByLine, selectedLine],
  );
  const activePresence = useMemo(
    () => collab?.presence.filter((entry) => entry.currentFile === currentFilePath) || [],
    [collab?.presence, currentFilePath],
  );
  const scopes = useMemo(() => extractScopeHeaders(content), [content]);
  const currentScope = useMemo(
    () => getScopeForLine(content, selectedLine || cursorPosition.line || 1),
    [content, selectedLine, cursorPosition.line],
  );
  const foldedScopeSet = useMemo(() => new Set(foldedScopes), [foldedScopes]);

  useEffect(() => {
    const handler = () => setShowStickyScope(localStorage.getItem('showStickyScope') === 'true');
    window.addEventListener('ide-sticky-scope-changed', handler);
    return () => window.removeEventListener('ide-sticky-scope-changed', handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (modifier && (event.key === "f" || event.key === "h")) {
        event.preventDefault();
        setShowFindReplace(true);
      } else if (event.key === "Escape" && showFindReplace) {
        setShowFindReplace(false);
        setSearchMatches([]);
        setCurrentMatchIndex(-1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFindReplace]);

  const handleHighlightChange = useCallback(
    (matches: { start: number; end: number }[], index: number) => {
      setSearchMatches(matches);
      setCurrentMatchIndex(index);
      if (index >= 0 && matches[index]) {
        const lineNumber = content.substring(0, matches[index].start).split("\n").length;
        textEditorRef.current?.scrollToLine(lineNumber);
      }
    },
    [content],
  );

  const handleReplace = useCallback(
    (nextContent: string) => {
      setContent(nextContent);
      if (file) onContentChange(file.id, nextContent);
    },
    [file, onContentChange],
  );

  useEffect(() => {
    if (file?.content !== undefined) setContent(file.content);
  }, [file?.id, file?.content]);

  useEffect(() => {
    if (!fileComments.length && selectedLine !== null) return;
    if (selectedLine !== null) return;
    const firstLine = fileComments[0]?.line_number ?? null;
    setSelectedLine(firstLine);
  }, [fileComments, selectedLine]);

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      if (file) onContentChange(file.id, value);
    },
    [file, onContentChange],
  );

  const handleToggleFold = useCallback((scopeId: string) => {
    setFoldedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((entry) => entry !== scopeId) : [...prev, scopeId],
    );
  }, []);

  if (!file) {
    return (
      <div className="flex flex-1 items-center justify-center bg-editor text-muted-foreground">
        <div className="text-center">
          <p className="mb-2 text-lg">No file selected</p>
          <p className="text-sm">Select a file from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  const isEnvFile = file.name === ".env" || file.name.startsWith(".env.");
  const previewType = getPreviewType(file.name);
  const binaryPreviewTypes = ["image", "video", "audio", "cad", "rtf", "ipynb", "draw", "font", "svg"];
  const isTextPreviewable = previewType && !binaryPreviewTypes.includes(previewType);

  if (isEnvFile) return <EnvFileEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "draw") return <DrawEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "office") return <OfficeEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "pdf") return <PDFEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "tex") return <TexEditor file={file} onContentChange={onContentChange} allFiles={allFiles} />;
  if (previewType === "mermaid") return <MermaidEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "video") return <VideoEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "audio") return <AudioEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "rtf") return <RTFEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "cad") return <CadEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "ipynb") return <IpynbViewer file={file} onContentChange={onContentChange} />;
  if (previewType === "zip") return <ZipEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "font") return <FontEditor file={file} onContentChange={onContentChange} />;
  if (previewType === "svg") return <SvgEditor file={file} onContentChange={onContentChange} />;

  if (previewType === "scratch") {
    return <ScratchProjectView file={file} onContentChange={onContentChange} />;
  }

  if (previewType && !isTextPreviewable)
    return <FilePreview file={file} previewType={previewType as "image" | "csv" | "markdown" | "svg" | "sqlite" | "mermaid"} onContentChange={onContentChange} />;

  if (isTextPreviewable && composerMode && previewType === "markdown") {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-editor">
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
          <button
            onClick={() => setComposerMode(false)}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Edit
          </button>
          <span className="text-xs font-medium text-foreground">Compose</span>
          <button
            onClick={() => { setSplitPreview(true); setMarkdownPreview(true); setComposerMode(false); }}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Split
          </button>
          <button
            onClick={() => { setMarkdownPreview(true); setComposerMode(false); }}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Preview
          </button>
        </div>
        <MarkdownComposer content={content} onChange={(md) => onContentChange(file.id, md)} />
      </div>
    );
  }

  if (isTextPreviewable && markdownPreview && !splitPreview) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-editor">
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
          <button
            onClick={() => setMarkdownPreview(false)}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Edit
          </button>
          <button
            onClick={() => { setSplitPreview(true); setMarkdownPreview(true); }}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Split
          </button>
          <span className="text-xs font-medium text-foreground">Preview</span>
        </div>
        <FilePreview file={{ ...file, content }} previewType={previewType} onContentChange={onContentChange} />
      </div>
    );
  }

  if (isTextPreviewable && splitPreview) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-editor">
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
          <button
            onClick={() => { setSplitPreview(false); setMarkdownPreview(false); }}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Edit
          </button>
          {previewType === "markdown" && (
            <button
              onClick={() => { setSplitPreview(false); setMarkdownPreview(false); setComposerMode(true); }}
              className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Compose
            </button>
          )}
          <span className="text-xs font-medium text-foreground">Split</span>
          <button
            onClick={() => { setSplitPreview(false); setMarkdownPreview(true); }}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Preview
          </button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 overflow-hidden border-r border-border flex flex-col">
            <div className="flex-1 overflow-auto font-mono text-sm leading-6 whitespace-pre p-4">{content}</div>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <FilePreview file={{ ...file, content }} previewType={previewType} onContentChange={onContentChange} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-editor">
      {isTextPreviewable && (
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
          <span className="text-xs font-medium text-foreground">Edit</span>
          {previewType === "markdown" && (
            <button
              onClick={() => setComposerMode(true)}
              className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Compose
            </button>
          )}
          <button
            onClick={() => { setSplitPreview(true); setMarkdownPreview(true); }}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Split
          </button>
          <button
            onClick={() => setMarkdownPreview(true)}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Preview
          </button>
        </div>
      )}

      <FindReplace
        content={content}
        isOpen={showFindReplace}
        onClose={() => {
          setShowFindReplace(false);
          setSearchMatches([]);
          setCurrentMatchIndex(-1);
        }}
        onReplace={handleReplace}
        onHighlightChange={handleHighlightChange}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1">
          <EditorGutter
            content={content}
            selectedLine={selectedLine}
            commentsByLine={commentsByLine}
            activePresence={activePresence}
            scopes={scopes}
            foldedScopeSet={foldedScopeSet}
            onSelectLine={setSelectedLine}
            onToggleFold={handleToggleFold}
            textareaRef={textareaRef}
          />

          <TextEditor
            ref={textEditorRef}
            content={content}
            language={file.language || "text"}
            searchMatches={searchMatches}
            currentMatchIndex={currentMatchIndex}
            activePresence={activePresence}
            selectedLine={selectedLine}
            onChange={handleContentChange}
            onCursorChange={(line, col) => setCursorPosition({ line, col })}
            externalTextareaRef={textareaRef}
          />

          <EditorMinimap
            content={content}
            selectedLine={selectedLine}
            onSelectLine={setSelectedLine}
          />
        </div>

        {showWorkbench && (
          <aside className="flex w-[420px] shrink-0 flex-col border-l border-border bg-background/95">
            <Tabs
              value={asideTab}
              onValueChange={(value) => setAsideTab(value as "assistant" | "comments")}
              className="flex h-full flex-col"
            >
              <div className="border-b border-border px-3 py-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Developer dock</p>
                    <p className="text-xs text-muted-foreground">
                      AI copilot, reviews, collaboration, and tooling in one panel.
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Feature-rich
                  </Badge>
                </div>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="assistant">Workbench</TabsTrigger>
                  <TabsTrigger value="comments">Threads</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="assistant" className="mt-0 min-h-0 flex-1 overflow-hidden">
                <AdvancedWorkbench
                  file={{ ...file, content }}
                  allFiles={allFiles}
                  currentFilePath={currentFilePath}
                  selectedLine={selectedLine}
                  onContentChange={onContentChange}
                  onCreateOrUpdateFile={onCreateOrUpdateFile}
                  collab={collab}
                />
              </TabsContent>

              <TabsContent value="comments" className="mt-0 min-h-0 flex-1 overflow-hidden">
                <EditorComments
                  selectedLine={selectedLine}
                  currentFilePath={currentFilePath ?? null}
                  collab={collab}
                  fileComments={fileComments}
                  selectedLineThreads={selectedLineThreads}
                  activePresence={activePresence}
                />
              </TabsContent>
            </Tabs>
          </aside>
        )}
      </div>

      <EditorStatusBar
        language={file.language || "Plain Text"}
        cursorPosition={cursorPosition}
        selectedLine={selectedLine}
        currentScope={currentScope}
        fileName={file.name}
        content={content}
        showWorkbench={showWorkbench}
        onGenerateTest={() => {
          const generated = generateUnitTestFile(file.name, content);
          onCreateOrUpdateFile(generated.fileName, generated.content, "typescript");
        }}
        onToggleWorkbench={() => setShowWorkbench((prev) => !prev)}
      />
    </div>
  );
};
