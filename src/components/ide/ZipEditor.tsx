import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Archive, FileText, Save } from 'lucide-react';
import { FileNode } from '@/types/ide';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FilePreview } from './FilePreview';
import { OfficeEditor } from './OfficeEditor';

interface ZipEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

type ZipPreviewType = 'text' | 'image' | 'markdown' | 'svg' | 'video' | 'audio' | 'csv' | 'office' | 'binary';

const textExtensions = new Set([
  'txt', 'md', 'markdown', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'scss', 'xml', 'yml', 'yaml', 'csv', 'env', 'gitignore', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'rs', 'go', 'php', 'rb', 'sh', 'sql',
]);

const decodeBase64 = (value: string): Uint8Array => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const encodeBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const decodeZipSource = (content: string): Uint8Array => decodeBase64(content.startsWith('data:') ? content.split(',', 2)[1] || '' : content);
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

export const ZipEditor = ({ file, onContentChange }: ZipEditorProps) => {
  const [zip, setZip] = useState<JSZip | null>(null);
  const [entries, setEntries] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [selectedContent, setSelectedContent] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedPreviewType = selectedPath ? getPreviewType(selectedPath) : null;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!file.content?.trim()) throw new Error('No ZIP data found. Upload a ZIP file to inspect it.');
        const loaded = await JSZip.loadAsync(decodeZipSource(file.content));
        if (!alive) return;
        const names = Object.keys(loaded.files).filter((name) => !loaded.files[name].dir).sort((a, b) => a.localeCompare(b));
        setZip(loaded);
        setEntries(names);
        if (names.length > 0) await openEntryInternal(loaded, names[0], alive);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load ZIP');
        setZip(null);
        setEntries([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    const openEntryInternal = async (loaded: JSZip, path: string, checkAlive: boolean) => {
      const preview = getPreviewType(path);
      setSelectedPath(path);
      if (preview === 'text' || preview === 'markdown' || preview === 'svg' || preview === 'csv') {
        const data = await loaded.file(path)?.async('string');
        if (!checkAlive) return;
        setSelectedContent(data || '');
        return;
      }
      const bytes = await loaded.file(path)?.async('uint8array');
      if (!checkAlive) return;
      setSelectedContent(bytes ? encodeBase64(bytes) : '');
    };

    void load();
    return () => {
      alive = false;
    };
  }, [file.id, file.content]);

  const visibleEntries = useMemo(() => entries.filter((name) => name.toLowerCase().includes(filter.toLowerCase())), [entries, filter]);

  const openEntry = async (path: string) => {
    if (!zip) return;
    const preview = getPreviewType(path);
    setSelectedPath(path);
    if (preview === 'text' || preview === 'markdown' || preview === 'svg' || preview === 'csv') {
      const data = await zip.file(path)?.async('string');
      setSelectedContent(data || '');
      return;
    }
    const bytes = await zip.file(path)?.async('uint8array');
    setSelectedContent(bytes ? encodeBase64(bytes) : '');
  };

  const updateAndSave = async (content: string) => {
    if (!zip || !selectedPath) return;
    setSaving(true);
    try {
      if (selectedPreviewType === 'text' || selectedPreviewType === 'markdown' || selectedPreviewType === 'svg' || selectedPreviewType === 'csv') {
        zip.file(selectedPath, content);
      } else {
        zip.file(selectedPath, decodeBase64(content));
      }
      setSelectedContent(content);
      const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      onContentChange(file.id, encodeBase64(bytes));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading ZIP archive…</div>;
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
          <div className="flex items-center gap-2 text-sm font-medium"><Archive className="w-4 h-4" /> ZIP Contents</div>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files…" className="h-8" />
        </div>
        <ScrollArea className="flex-1"><div className="p-2 space-y-1">{visibleEntries.map((name) => (
          <button key={name} className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 ${selectedPath === name ? 'bg-muted' : ''}`} onClick={() => void openEntry(name)}>{name}</button>
        ))}</div></ScrollArea>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-11 border-b border-border px-3 flex items-center justify-between text-sm">
          <div className="truncate">{selectedPath || 'Select a file'}</div>
          {(selectedPreviewType === 'text' || selectedPreviewType === 'markdown' || selectedPreviewType === 'svg' || selectedPreviewType === 'csv') && (
            <Button size="sm" onClick={() => void updateAndSave(selectedContent)} disabled={saving} className="gap-1">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save ZIP'}
            </Button>
          )}
        </div>
        {!selectedPath ? <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a file from the archive.</div> : null}
        {selectedPath && selectedPreviewType === 'text' ? (
          <Textarea value={selectedContent} onChange={(e) => setSelectedContent(e.target.value)} className="flex-1 rounded-none border-0 focus-visible:ring-0 font-mono text-xs resize-none" />
        ) : null}
        {selectedPath && ['markdown', 'svg', 'csv', 'image', 'video', 'audio'].includes(selectedPreviewType || '') ? (
          <FilePreview file={selectedFile} previewType={selectedPreviewType as 'markdown' | 'svg' | 'csv' | 'image' | 'video' | 'audio'} onContentChange={(_, c) => void updateAndSave(c)} />
        ) : null}
        {selectedPath && selectedPreviewType === 'office' ? (
          <OfficeEditor file={selectedFile} onContentChange={(_, c) => void updateAndSave(c)} />
        ) : null}
        {selectedPath && selectedPreviewType === 'binary' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2"><FileText className="w-8 h-8 opacity-50" /><p className="text-sm">No viewer available for this file type.</p></div>
        ) : null}
      </div>
    </div>
  );
};
