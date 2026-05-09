import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Archive, FileText, Save, Loader2 } from 'lucide-react';
import { FileNode } from '@/types/ide';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FilePreview } from './FilePreview';
import { OfficeEditor } from './OfficeEditor';
import { bytesToBase64Async, decodeMaybeDataUrl } from '@/lib/binaryEncoding';

interface ZipEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

type ZipPreviewType = 'text' | 'image' | 'markdown' | 'svg' | 'video' | 'audio' | 'csv' | 'office' | 'binary';

const textExtensions = new Set([
  'txt', 'md', 'markdown', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'scss', 'xml', 'yml', 'yaml', 'csv', 'env', 'gitignore', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'rs', 'go', 'php', 'rb', 'sh', 'sql',
]);

const extOf = (path: string) => path.split('.').pop()?.toLowerCase() || '';

const getPreviewType = (path: string): ZipPreviewType => {
  const ext = extOf(path);
  if (ext === 'svg') return 'svg';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'csv') return 'csv';
  if (['docx', 'xlsx', 'pptx'].includes(ext)) return 'office';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv', 'ogg'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
  if (textExtensions.has(ext) || !path.includes('.')) return 'text';
  return 'binary';
};

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

interface EntryMeta {
  path: string;
  size: number;
}

export const ZipEditor = ({ file, onContentChange }: ZipEditorProps) => {
  const [zip, setZip] = useState<JSZip | null>(null);
  const [entries, setEntries] = useState<EntryMeta[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [selectedContent, setSelectedContent] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [entryLoading, setEntryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const selectedPreviewType = selectedPath ? getPreviewType(selectedPath) : null;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setLoadProgress(0);
      try {
        if (!file.content?.trim()) throw new Error('No ZIP data found. Upload a ZIP file to inspect it.');
        const bytes = decodeMaybeDataUrl(file.content);
        // JSZip already streams entry decompression on demand via async()
        const loaded = await JSZip.loadAsync(bytes, { checkCRC32: false });
        if (!alive) return;
        const meta: EntryMeta[] = [];
        loaded.forEach((path, entry) => {
          if (entry.dir) return;
          // _data?.uncompressedSize is internal but reliable
          const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
          meta.push({ path, size });
        });
        meta.sort((a, b) => a.path.localeCompare(b.path));
        setLoadProgress(1);
        setZip(loaded);
        setEntries(meta);
        if (meta.length > 0) await openEntryInternal(loaded, meta[0].path, () => alive);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load ZIP');
        setZip(null);
        setEntries([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [file.id, file.content]);

  const openEntryInternal = async (loaded: JSZip, path: string, isAlive: () => boolean) => {
    const preview = getPreviewType(path);
    setSelectedPath(path);
    setEntryLoading(true);
    setSelectedContent('');
    try {
      const entry = loaded.file(path);
      if (!entry) return;
      if (preview === 'text' || preview === 'markdown' || preview === 'svg' || preview === 'csv') {
        const data = await entry.async('string');
        if (!isAlive()) return;
        setSelectedContent(data);
        return;
      }
      const bytes = await entry.async('uint8array');
      if (!isAlive()) return;
      const b64 = await bytesToBase64Async(bytes);
      if (!isAlive()) return;
      setSelectedContent(b64);
    } finally {
      if (isAlive()) setEntryLoading(false);
    }
  };

  const visibleEntries = useMemo(
    () => entries.filter((e) => e.path.toLowerCase().includes(filter.toLowerCase())),
    [entries, filter],
  );

  const openEntry = async (path: string) => {
    if (!zip) return;
    await openEntryInternal(zip, path, () => true);
  };

  const updateAndSave = async (content: string) => {
    if (!zip || !selectedPath) return;
    setSaving(true);
    setSaveProgress(0);
    try {
      if (selectedPreviewType === 'text' || selectedPreviewType === 'markdown' || selectedPreviewType === 'svg' || selectedPreviewType === 'csv') {
        zip.file(selectedPath, content);
      } else {
        zip.file(selectedPath, decodeMaybeDataUrl(content));
      }
      setSelectedContent(content);
      const bytes = await zip.generateAsync(
        { type: 'uint8array', compression: 'DEFLATE', streamFiles: true },
        (meta) => setSaveProgress(meta.percent / 100),
      );
      const b64 = await bytesToBase64Async(bytes, setSaveProgress);
      onContentChange(file.id, `data:application/zip;base64,${b64}`);
    } finally {
      setSaving(false);
      setSaveProgress(0);
    }
  };

  if (loading) return (
    <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading ZIP archive…
      {loadProgress > 0 && loadProgress < 1 ? <span>({Math.round(loadProgress * 100)}%)</span> : null}
    </div>
  );
  if (error) return <div className="p-4 text-sm text-destructive">{error}</div>;

  const selectedFile: FileNode = {
    id: `zip:${selectedPath}`,
    name: selectedPath.split('/').pop() || selectedPath,
    type: 'file',
    content: selectedContent,
  };

  return (
    <div className="h-full flex bg-editor">
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2"><Archive className="w-4 h-4" /> ZIP Contents</span>
            <span className="text-xs text-muted-foreground">{entries.length} files</span>
          </div>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files…" className="h-8" />
        </div>
        <ScrollArea className="flex-1"><div className="p-2 space-y-1">{visibleEntries.map((entry) => (
          <button
            key={entry.path}
            className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 flex items-center justify-between gap-2 ${selectedPath === entry.path ? 'bg-muted' : ''}`}
            onClick={() => void openEntry(entry.path)}
          >
            <span className="truncate">{entry.path}</span>
            <span className="text-muted-foreground shrink-0">{formatBytes(entry.size)}</span>
          </button>
        ))}</div></ScrollArea>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-11 border-b border-border px-3 flex items-center justify-between text-sm gap-2">
          <div className="truncate flex items-center gap-2">
            {entryLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span className="truncate">{selectedPath || 'Select a file'}</span>
          </div>
          {(selectedPreviewType === 'text' || selectedPreviewType === 'markdown' || selectedPreviewType === 'svg' || selectedPreviewType === 'csv') && (
            <Button size="sm" onClick={() => void updateAndSave(selectedContent)} disabled={saving} className="gap-1">
              <Save className="w-3.5 h-3.5" />
              {saving ? `Saving… ${Math.round(saveProgress * 100)}%` : 'Save ZIP'}
            </Button>
          )}
        </div>
        {!selectedPath ? <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a file from the archive.</div> : null}
        {selectedPath && entryLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Extracting entry…
          </div>
        ) : null}
        {selectedPath && !entryLoading && selectedPreviewType === 'text' ? (
          <Textarea value={selectedContent} onChange={(e) => setSelectedContent(e.target.value)} className="flex-1 rounded-none border-0 focus-visible:ring-0 font-mono text-xs resize-none" />
        ) : null}
        {selectedPath && !entryLoading && ['markdown', 'svg', 'csv', 'image', 'video', 'audio'].includes(selectedPreviewType || '') ? (
          <FilePreview file={selectedFile} previewType={selectedPreviewType as 'markdown' | 'svg' | 'csv' | 'image' | 'video' | 'audio'} onContentChange={(_, c) => void updateAndSave(c)} />
        ) : null}
        {selectedPath && !entryLoading && selectedPreviewType === 'office' ? (
          <OfficeEditor file={selectedFile} onContentChange={(_, c) => void updateAndSave(c)} />
        ) : null}
        {selectedPath && !entryLoading && selectedPreviewType === 'binary' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2"><FileText className="w-8 h-8 opacity-50" /><p className="text-sm">No viewer available for this file type.</p></div>
        ) : null}
      </div>
    </div>
  );
};
