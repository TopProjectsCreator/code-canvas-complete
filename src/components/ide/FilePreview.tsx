import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MediaGenerationPanel } from './MediaGenerationPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { FileNode } from '@/types/ide';
import {
  Video, Music, Table, Search, X, BarChart3, Pencil, FileJson,
  ArrowUp, ArrowDown, ArrowUpDown, Database, Code2, FileText,
  Workflow, ZoomIn, ZoomOut, Download, Image,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

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

const serializeCSV = (rows: string[][]): string => {
  return rows.map(row =>
    row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
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
  const [mermaidScale, setMermaidScale] = useState(1);
  const [sqliteTables, setSqliteTables] = useState<SqliteTableData[]>([]);
  const [sqliteError, setSqliteError] = useState<string | null>(null);
  const [sqliteLoading, setSqliteLoading] = useState(false);

  // Parse CSV data
  const csvData = useMemo(() => {
    if (previewType !== 'csv') return [];
    return parseCSV(content);
  }, [content, previewType]);

  const [csvSortCol, setCsvSortCol] = useState(-1);
  const [csvSortAsc, setCsvSortAsc] = useState(true);
  const [csvSearch, setCsvSearch] = useState('');
  const [csvEditMode, setCsvEditMode] = useState(false);
  const [csvEditedData, setCsvEditedData] = useState<string[][] | null>(null);
  const [csvColWidths, setCsvColWidths] = useState<number[]>([]);
  const [csvResizing, setCsvResizing] = useState<{ col: number; startX: number; startW: number } | null>(null);
  const [csvShowChart, setCsvShowChart] = useState(false);
  const [csvChartType, setCsvChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [sqliteQuery, setSqliteQuery] = useState('');
  const [sqliteQueryResult, setSqliteQueryResult] = useState<string[][] | null>(null);
  const [sqliteQueryError, setSqliteQueryError] = useState<string | null>(null);
  const [mermaidSource, setMermaidSource] = useState('');
  const [mermaidShowSource, setMermaidShowSource] = useState(false);
  const mermaidRenderRequestRef = useRef(0);

  const getMermaidRenderId = useCallback((source: string) => {
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = Math.imul(31, hash) + source.charCodeAt(index) | 0;
    }
    const safeFileId = file.id.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `mermaid-preview-${safeFileId}-${(hash >>> 0).toString(36)}`;
  }, [file.id]);

  useEffect(() => {
    if (!csvResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - csvResizing.startX;
      const newW = Math.max(60, csvResizing.startW + diff);
      setCsvColWidths(prev => {
        const next = [...prev];
        next[csvResizing.col] = newW;
        return next;
      });
    };
    const handleMouseUp = () => setCsvResizing(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [csvResizing]);

  const sortedFilteredRows = useMemo(() => {
    if (previewType !== 'csv') return { headers: [] as string[], rows: [] as string[][] };
    const sourceData = csvEditMode && csvEditedData ? csvEditedData : csvData;
    if (sourceData.length === 0) return { headers: [] as string[], rows: [] as string[][] };
    const headers = sourceData[0] || [];
    let rows = sourceData.slice(1);

    if (csvSearch) {
      const q = csvSearch.toLowerCase();
      rows = rows.filter(r => r.some(cell => cell.toLowerCase().includes(q)));
    }

    if (csvSortCol >= 0 && csvSortCol < headers.length) {
      const col = csvSortCol;
      rows = [...rows].sort((a, b) => {
        const va = (a[col] || '').toLowerCase();
        const vb = (b[col] || '').toLowerCase();
        const na = parseFloat(va), nb = parseFloat(vb);
        if (!isNaN(na) && !isNaN(nb)) return csvSortAsc ? na - nb : nb - na;
        return csvSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }

    return { headers, rows };
  }, [csvData, csvEditedData, csvSortCol, csvSortAsc, csvSearch, previewType, csvEditMode]);

  useEffect(() => {
    if (previewType !== 'mermaid') return;

    const requestId = mermaidRenderRequestRef.current + 1;
    mermaidRenderRequestRef.current = requestId;

    const renderMermaid = async () => {
      if (!content.trim()) {
        if (mermaidRenderRequestRef.current === requestId) {
          setMermaidSvg('');
          setMermaidError('No Mermaid diagram source found.');
          setMermaidLoading(false);
        }
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
          if (mermaidRenderRequestRef.current === requestId) {
            setMermaidSvg('');
            setMermaidError('Invalid Mermaid diagram syntax.');
          }
          return;
        }

        const result = await mermaid.render(getMermaidRenderId(content), content);
        if (mermaidRenderRequestRef.current === requestId) {
          setMermaidSvg(result.svg);
        }
      } catch (err) {
        if (mermaidRenderRequestRef.current === requestId) {
          setMermaidSvg('');
          setMermaidError(err instanceof Error ? err.message : 'Unable to render Mermaid diagram.');
        }
      } finally {
        if (mermaidRenderRequestRef.current === requestId) {
          setMermaidLoading(false);
        }
      }
    };

    const timeout = window.setTimeout(() => {
      void renderMermaid();
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [content, getMermaidRenderId, previewType]);

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

    const { headers, rows } = sortedFilteredRows;

    const toggleSort = (col: number) => {
      if (csvSortCol === col) {
        setCsvSortAsc(!csvSortAsc);
      } else {
        setCsvSortCol(col);
        setCsvSortAsc(true);
      }
    };

    const enterEditMode = () => {
      setCsvEditedData(csvData.map(r => [...r]));
      setCsvEditMode(true);
    };

    const saveEditMode = () => {
      if (csvEditedData) {
        onContentChange(file.id, serializeCSV(csvEditedData));
      }
      setCsvEditMode(false);
      setCsvEditedData(null);
    };

    const cancelEditMode = () => {
      setCsvEditMode(false);
      setCsvEditedData(null);
    };

    const csvToJson = () => {
      const jsonData = rows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h || `col${i}`] = row[i] || ''; });
        return obj;
      });
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.csv$/i, '.json');
      a.click();
      URL.revokeObjectURL(url);
    };

    const updateCell = (rowIdx: number, colIdx: number, value: string) => {
      if (!csvEditedData) return;
      const updated = csvEditedData.map(r => [...r]);
      updated[rowIdx + 1][colIdx] = value;
      setCsvEditedData(updated);
    };

    const startResize = (col: number, e: React.MouseEvent) => {
      e.preventDefault();
      setCsvResizing({ col, startX: e.clientX, startW: csvColWidths[col] || 150 });
    };

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-background border-b border-border">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={csvSearch}
              onChange={(e) => setCsvSearch(e.target.value)}
              placeholder="Filter rows…"
              className="h-8 pl-8 pr-8 text-xs"
            />
            {csvSearch && (
              <button
                onClick={() => setCsvSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {rows.length} / {csvData.length - 1} rows
          </span>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setCsvShowChart(!csvShowChart)} className="h-7 px-2 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> {csvShowChart ? 'Table' : 'Chart'}
            </button>
            {csvEditMode ? (
              <>
                <button onClick={saveEditMode} className="h-7 px-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90">Save</button>
                <button onClick={cancelEditMode} className="h-7 px-2 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={enterEditMode} className="h-7 px-2 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button onClick={csvToJson} className="h-7 px-2 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 flex items-center gap-1">
                  <FileJson className="w-3 h-3" /> JSON
                </button>
              </>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            {csvShowChart && headers.length >= 1 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Column: {headers[1] || 'col2'}</span>
                  <div className="flex gap-1">
                    {(['bar', 'line', 'pie'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setCsvChartType(t)}
                        className={cn("h-7 px-2 text-xs rounded", csvChartType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    {csvChartType === 'bar' ? (
                      <BarChart data={rows.map(r => ({ name: r[0] || `Row ${r[0]}`, value: parseFloat(r[1]) || 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" />
                      </BarChart>
                    ) : csvChartType === 'line' ? (
                      <LineChart data={rows.map(r => ({ name: r[0] || `Row ${r[0]}`, value: parseFloat(r[1]) || 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" />
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Pie data={rows.map(r => ({ name: r[0] || `Row ${r[0]}`, value: parseFloat(r[1]) || 0 }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                          {rows.map((_, i) => (
                            <Cell key={i} fill={`hsl(${i * 45}, 70%, 50%)`} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    {headers.map((header, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left font-semibold text-foreground border-b border-border whitespace-nowrap cursor-pointer select-none hover:bg-muted/70 transition-colors relative"
                        onClick={() => toggleSort(i)}
                        style={{ width: csvColWidths[i] || undefined }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {header || `Column ${i + 1}`}
                          {csvSortCol === i ? (
                            csvSortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </span>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30"
                          onMouseDown={(e) => startResize(i, e)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        {csvSearch ? 'No rows match filter' : 'No data'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-muted/30 transition-colors">
                        {headers.map((_, colIndex) => (
                          <td key={colIndex} className="px-4 py-2 text-muted-foreground border-b border-border/50 max-w-[300px]" style={{ width: csvColWidths[colIndex] || undefined }}>
                            {csvEditMode ? (
                              <input
                                value={row[colIndex] || ''}
                                onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                                className="w-full bg-transparent border border-transparent focus:border-primary/50 focus:bg-background rounded px-1 py-0.5 text-xs outline-none"
                                onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
                              />
                            ) : (
                              <span className="truncate block">{row[colIndex] || ''}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            )}
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
          <span>{csvEditMode ? 'Editing' : 'CSV Preview'}</span>
        </div>
      </div>
    );
  }

  if (previewType === 'sqlite') {
    const runSqliteQuery = () => {
      if (!sqliteQuery.trim()) return;
      setSqliteQueryError(null);
      setSqliteQueryResult(null);
      const loadAndQuery = async () => {
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
          const results = db.exec(sqliteQuery);
          db.close();
          if (results.length === 0) {
            setSqliteQueryResult([]);
          } else {
            setSqliteQueryResult(results.map(r => [r.columns.join(' | '), ...r.values.map(v => v.map(c => c == null ? '' : String(c)).join(' | '))]));
          }
        } catch (err) {
          setSqliteQueryError(err instanceof Error ? err.message : 'Query execution failed');
        }
      };
      void loadAndQuery();
    };

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="px-4 py-2 bg-background border-b border-border flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium">{file.name}</span>
          <div className="flex-1" />
          <input
            value={sqliteQuery}
            onChange={e => setSqliteQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runSqliteQuery(); }}
            placeholder="Enter SQL query…"
            className="h-7 px-2 text-xs bg-muted rounded border border-border outline-none focus:border-primary w-64"
          />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={runSqliteQuery}>Run</Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {sqliteQueryError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{sqliteQueryError}</div>
            )}
            {sqliteQueryResult && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 text-xs font-semibold">Query Result ({sqliteQueryResult.length} rows)</div>
                {sqliteQueryResult.length > 1 ? (
                  <pre className="p-3 text-xs font-mono overflow-x-auto">{sqliteQueryResult.slice(0, 101).join('\n')}</pre>
                ) : (
                  <p className="p-3 text-xs text-muted-foreground">Query executed successfully (0 rows returned).</p>
                )}
              </div>
            )}
            {!sqliteQueryResult && !sqliteQueryError && <><div className="flex items-center gap-2 text-foreground font-medium">
              <Database className="w-4 h-4" />
              Tables
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
            </>}
          </div>
        </ScrollArea>
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
    const downloadSvg = () => {
      if (!mermaidSvg) return;
      const blob = new Blob([mermaidSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.(mmd|mermaid)$/, '.svg');
      a.click();
      URL.revokeObjectURL(url);
    };

    const downloadPng = () => {
      if (!mermaidSvg) return;
      const img = new Image();
      const svgBlob = new Blob([mermaidSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const dlUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = dlUrl;
          a.download = file.name.replace(/\.(mmd|mermaid)$/, '.png');
          a.click();
          URL.revokeObjectURL(dlUrl);
        }, 'image/png');
        URL.revokeObjectURL(url);
      };
      img.src = url;
    };

    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        {mermaidShowSource ? (
          <div className="flex-1 flex min-w-0 overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col border-r border-border">
              <div className="px-4 py-1.5 bg-muted/30 text-xs text-muted-foreground font-medium">Source</div>
              <textarea
                className="flex-1 p-4 text-xs font-mono bg-background text-foreground outline-none resize-none border-0"
                value={content}
                readOnly
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="px-4 py-1.5 bg-muted/30 text-xs text-muted-foreground font-medium">Preview</div>
              <div className="flex-1 overflow-auto bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px]">
                <div className="min-h-full p-6 flex items-start justify-center"
                  style={{ transform: `scale(${mermaidScale})`, transformOrigin: 'top left' }}
                >
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
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px]">
            <div className="min-h-full p-6 flex items-start justify-center"
              style={{ transform: `scale(${mermaidScale})`, transformOrigin: 'top left' }}
            >
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
        )}
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4" />
            <span>{file.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {mermaidSvg && (
              <>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setMermaidScale((s) => Math.min(s + 0.25, 3))} title="Zoom in">
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setMermaidScale((s) => Math.max(s - 0.25, 0.25))} title="Zoom out">
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <span className="text-[10px] w-8 text-center">{Math.round(mermaidScale * 100)}%</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setMermaidScale(1)} title="Reset zoom">
                  <span className="text-[10px]">1:1</span>
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={downloadSvg} title="Download SVG">
                  <Download className="w-3 h-3" /> SVG
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={downloadPng} title="Download PNG">
                  <Download className="w-3 h-3" /> PNG
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs ml-1"
              onClick={() => setMermaidShowSource(v => !v)}
            >
              {mermaidShowSource ? 'Preview' : 'Split'}
            </Button>
            <span className="ml-2">Mermaid Preview</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
