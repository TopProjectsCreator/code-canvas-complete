import { useEffect, useState } from 'react';
import { FileNode } from '@/types/ide';
import { Image, FileText, Code2, Video, Music, Table, Database, Workflow } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMemo } from 'react';
import { MediaGenerationPanel } from './MediaGenerationPanel';

interface FilePreviewProps {
  file: FileNode;
  previewType: 'image' | 'markdown' | 'svg' | 'video' | 'audio' | 'csv' | 'sqlite' | 'mermaid';
  onContentChange: (fileId: string, content: string) => void;
}

interface SqliteTableData {
  name: string;
  columns: string[];
  rows: string[][];
}

// Parse CSV content into rows and columns
const parseCSV = (content: string): string[][] => {
  const lines = content.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
};

// Separate component to handle image loading state
const ImagePreview = ({ file, content, onContentChange }: { file: FileNode; content: string; onContentChange: (fileId: string, content: string) => void }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  const isPlaceholder = /^\/\/ Binary file:/.test(content.trim());

  if (!content.trim() || isPlaceholder) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-editor text-muted-foreground gap-4">
        <Image className="w-16 h-16 opacity-50" />
        <div className="text-center">
          <p className="text-lg font-medium mb-1">Image Preview</p>
          <p className="text-sm">{file.name}</p>
          <p className="text-xs mt-2 text-muted-foreground/70">
            {isPlaceholder ? 'Binary file was not imported — image data is missing' : 'No image data available'}
          </p>
          <p className="text-xs mt-1 text-muted-foreground/50">Use "Upload Files" in the file tree to import images</p>
        </div>
        <MediaGenerationPanel mode="image" onGenerated={(value) => onContentChange(file.id, value)} />
      </div>
    );
  }

  const isDataUrl = content.startsWith('data:');
  const isUrl = content.startsWith('http://') || content.startsWith('https://');
  const ext = file.name.split('.').pop()?.toLowerCase();
  const imageSrc = isDataUrl || isUrl ? content : `data:image/${ext};base64,${content}`;

  return (
    <div className="flex-1 flex flex-col bg-editor overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        {status === 'error' ? (
          <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Image className="w-16 h-16 opacity-50" />
            <div className="text-center">
              <p className="text-lg font-medium mb-1">Image Preview</p>
              <p className="text-sm">{file.name}</p>
              <p className="text-xs mt-2 text-muted-foreground/70">Cannot render image preview</p>
            </div>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={file.name}
            className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg border border-border"
            style={{ display: status === 'loaded' ? 'block' : 'none' }}
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
          />
        )}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Image className="w-12 h-12 opacity-50 animate-pulse" />
            <p className="text-sm">Loading image…</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4" />
          <span>{file.name}</span>
        </div>
        <span>Image Preview</span>
      </div>
    </div>
  );
};

export const FilePreview = ({ file, previewType, onContentChange }: FilePreviewProps) => {
  const content = file.content || '';
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [mermaidLoading, setMermaidLoading] = useState(false);
  const [sqliteTables, setSqliteTables] = useState<SqliteTableData[]>([]);
  const [sqliteError, setSqliteError] = useState<string | null>(null);
  const [sqliteLoading, setSqliteLoading] = useState(false);

  // Parse CSV data
  const csvData = useMemo(() => {
    if (previewType !== 'csv') return [];
    return parseCSV(content);
  }, [content, previewType]);

  useEffect(() => {
    const renderMermaid = async () => {
      if (previewType !== 'mermaid') return;
      if (!content.trim()) {
        setMermaidSvg('');
        setMermaidError('No Mermaid diagram source found.');
        return;
      }

      setMermaidLoading(true);
      setMermaidError(null);
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          deterministicIds: true,
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
          flowchart: {
            curve: 'basis',
            htmlLabels: true,
            useMaxWidth: false,
          },
        });

        const valid = await mermaid.parse(content);
        if (!valid) {
          setMermaidSvg('');
          setMermaidError('Invalid Mermaid diagram syntax.');
          return;
        }

        const id = `mermaid-preview-${file.id}-${Date.now()}`;
        const result = await mermaid.render(id, content);
        setMermaidSvg(result.svg);
      } catch (err) {
        setMermaidSvg('');
        setMermaidError(err instanceof Error ? err.message : 'Unable to render Mermaid diagram.');
      } finally {
        setMermaidLoading(false);
      }
    };

    void renderMermaid();
  }, [content, file.id, previewType]);

  useEffect(() => {
    const loadSqlite = async () => {
      if (previewType !== 'sqlite') return;
      if (!content.trim()) {
        setSqliteTables([]);
        setSqliteError('No database data available.');
        return;
      }

      setSqliteLoading(true);
      setSqliteError(null);
      try {
        const SQL = await import('sql.js');
        const initSqlJs = SQL.default;
        const wasmUrl = new URL('sql.js/dist/sql-wasm.wasm', import.meta.url).toString();
        const sqlite = await initSqlJs({ locateFile: () => wasmUrl });

        let bytes: Uint8Array;
        if (content.startsWith('data:')) {
          const b64 = content.includes(',') ? content.split(',')[1] : content;
          const bin = atob(b64);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else {
          const bin = atob(content);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        }

        const db = new sqlite.Database(bytes);
        const tableResults = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        const tableNames = (tableResults[0]?.values || []).map((r) => String(r[0]));
        const collected: SqliteTableData[] = [];

        for (const tableName of tableNames) {
          const safeTable = tableName.replace(/"/g, '""');
          const rowsResult = db.exec(`SELECT * FROM "${safeTable}" LIMIT 100`);
          const first = rowsResult[0];
          collected.push({
            name: tableName,
            columns: first?.columns || [],
            rows: (first?.values || []).map((row) => row.map((v) => (v == null ? '' : String(v)))),
          });
        }

        db.close();
        setSqliteTables(collected);
      } catch (err) {
        setSqliteTables([]);
        setSqliteError(err instanceof Error ? err.message : 'Unable to open SQLite database.');
      } finally {
        setSqliteLoading(false);
      }
    };

    void loadSqlite();
  }, [content, previewType]);

  if (previewType === 'image') {
    return <ImagePreview file={file} content={content} onContentChange={onContentChange} />;
  }

  if (previewType === 'video') {
    const isDataUrl = content.startsWith('data:');
    const isUrl = content.startsWith('http://') || content.startsWith('https://');
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      ogv: 'video/ogg',
    };
    const videoSrc = (isDataUrl || isUrl) ? content : `data:${mimeTypes[ext || 'mp4'] || 'video/mp4'};base64,${content}`;

    if (!content.trim()) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-editor text-muted-foreground gap-4">
          <Video className="w-16 h-16 opacity-50" />
          <div className="text-center">
            <p className="text-lg font-medium mb-1">Video Preview</p>
            <p className="text-sm">{file.name}</p>
            <p className="text-xs mt-2 text-muted-foreground/70">No video data available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <video 
            src={videoSrc}
            controls
            className="max-w-full max-h-[70vh] rounded-lg shadow-lg border border-border"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>Video Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'audio') {
    const isDataUrl = content.startsWith('data:');
    const isUrl = content.startsWith('http://') || content.startsWith('https://');
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      aac: 'audio/aac',
      m4a: 'audio/mp4',
    };
    const audioSrc = isDataUrl ? content : `data:${mimeTypes[ext || 'mp3'] || 'audio/mpeg'};base64,${content}`;

    if (!content.trim()) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-editor text-muted-foreground gap-4">
          <Music className="w-16 h-16 opacity-50" />
          <div className="text-center">
            <p className="text-lg font-medium mb-1">Audio Preview</p>
            <p className="text-sm">{file.name}</p>
            <p className="text-xs mt-2 text-muted-foreground/70">No audio data available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-border">
            <Music className="w-16 h-16 text-primary" />
          </div>
          <p className="text-lg font-medium text-foreground">{file.name}</p>
          <audio 
            src={audioSrc}
            controls
            className="w-full max-w-md"
          >
            Your browser does not support the audio tag.
          </audio>
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>Audio Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'csv') {
    if (!content.trim() || csvData.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-editor text-muted-foreground gap-4">
          <Table className="w-16 h-16 opacity-50" />
          <div className="text-center">
            <p className="text-lg font-medium mb-1">CSV Preview</p>
            <p className="text-sm">{file.name}</p>
            <p className="text-xs mt-2 text-muted-foreground/70">No data available</p>
          </div>
        </div>
      );
    }

    const headers = csvData[0] || [];
    const rows = csvData.slice(1);

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    {headers.map((header, i) => (
                      <th key={i} className="px-4 py-3 text-left font-semibold text-foreground border-b border-border whitespace-nowrap">
                        {header || `Column ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-muted/30 transition-colors">
                      {headers.map((_, colIndex) => (
                        <td key={colIndex} className="px-4 py-2 text-muted-foreground border-b border-border/50">
                          {row[colIndex] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {rows.length} rows × {headers.length} columns
            </p>
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>CSV Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'sqlite') {
    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Database className="w-4 h-4" />
              SQLite Viewer: {file.name}
            </div>
            {sqliteLoading && <p className="text-sm text-muted-foreground">Loading database…</p>}
            {sqliteError && !sqliteLoading && <p className="text-sm text-destructive">{sqliteError}</p>}
            {!sqliteLoading && !sqliteError && sqliteTables.length === 0 && (
              <p className="text-sm text-muted-foreground">No user tables found in this database.</p>
            )}
            {!sqliteLoading && !sqliteError && sqliteTables.map((table) => (
              <div key={table.name} className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 text-sm font-semibold">{table.name} ({table.rows.length} rows shown)</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/20">
                      {table.columns.map((col) => (
                        <th key={col} className="px-3 py-2 text-left border-b border-border">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        {table.columns.map((_, i) => (
                          <td key={i} className="px-3 py-2 border-b border-border/50 text-muted-foreground">{row[i] || ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>SQLite Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'svg') {
    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
          {/* Render SVG in a sandboxed iframe so embedded <script> or event handlers cannot execute in the IDE origin. */}
          <iframe
            title={`SVG preview: ${file.name}`}
            sandbox=""
            className="max-w-full max-h-[70vh] w-full h-[70vh] bg-transparent border-0"
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;}svg{max-width:100%;max-height:100%;}</style></head><body>${content}</body></html>`}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>SVG Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'markdown') {
    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-6 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-medium text-foreground mt-4 mb-2">{children}</h3>,
                p: ({ children }) => <p className="text-muted-foreground mb-4 leading-relaxed">{children}</p>,
                a: ({ href, children }) => <a href={href} className="text-primary hover:underline">{children}</a>,
                code: ({ className, children }) => {
                  const isInline = !className;
                  if (isInline) {
                    return <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">{children}</code>;
                  }
                  return (
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
                      <code className="text-sm font-mono text-foreground">{children}</code>
                    </pre>
                  );
                },
                ul: ({ children }) => <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside text-muted-foreground mb-4 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">{children}</blockquote>,
                hr: () => <hr className="border-border my-6" />,
                table: ({ children }) => <table className="w-full border-collapse my-4">{children}</table>,
                th: ({ children }) => <th className="border border-border px-4 py-2 bg-muted text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-border px-4 py-2">{children}</td>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>Markdown Preview</span>
        </div>
      </div>
    );
  }

  if (previewType === 'mermaid') {
    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="flex-1 overflow-auto bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px]">
          <div className="min-h-full p-6 flex items-start justify-center">
            {mermaidLoading && (
              <div className="text-sm text-muted-foreground">Rendering Mermaid diagram…</div>
            )}
            {!mermaidLoading && mermaidError && (
              <div className="max-w-2xl w-full rounded-lg border border-destructive/40 bg-destructive/10 text-destructive p-4">
                <p className="font-semibold mb-1">Unable to render Mermaid diagram</p>
                <p className="text-sm whitespace-pre-wrap">{mermaidError}</p>
              </div>
            )}
            {!mermaidLoading && !mermaidError && mermaidSvg && (
              <div className="rounded-xl border border-border bg-background shadow-2xl p-4 max-w-full overflow-auto">
                <div className="[&_svg]:max-w-none [&_svg]:h-auto [&_svg]:text-foreground" dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <span>Mermaid Preview</span>
        </div>
      </div>
    );
  }

  return null;
};
