import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Archive, FileText, Save, Loader2, Trash2, Pencil, Upload, Download } from 'lucide-react';
import { FileNode } from '@/types/ide';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FilePreview } from './FilePreview';
import { OfficeEditor } from './OfficeEditor';
import { bytesToBase64Async, decodeMaybeDataUrl } from '@/lib/binaryEncoding';
import { getPreviewType as sharedGetPreviewType, TEXT_EXTENSIONS } from '@/lib/filePreviewTypes';

interface ZipEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

type ZipPreviewType = 'text' | 'image' | 'markdown' | 'svg' | 'video' | 'audio' | 'csv' | 'office' | 'binary' | 'mermaid';

const extOf = (path: string) => path.split('.').pop()?.toLowerCase() || '';

const getPreviewType = (path: string): ZipPreviewType => {
  const ext = extOf(path);
  const shared = sharedGetPreviewType(path);
  if (shared === 'svg') return 'svg';
  if (shared === 'mermaid') return 'mermaid';
  if (shared === 'markdown') return 'markdown';
  if (shared === 'csv') return 'csv';
  if (shared === 'office') return 'office';
  if (shared === 'image') return 'image';
  if (shared === 'video') return 'video';
  if (shared === 'audio') return 'audio';
  if (TEXT_EXTENSIONS.has(ext) || !path.includes('.')) return 'text';
  return 'binary';
};

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: TreeNode[];
  size?: number;
}

const buildTree = (entries: EntryMeta[]) => {
  const root: TreeNode = { name: '', path: '', type: 'folder', children: [] };
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      let child = current.children.find(c => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: isFile ? entry.path : parts.slice(0, i + 1).join('/'),
          type: isFile ? 'file' : 'folder',
          children: [],
          ...(isFile ? { size: entry.size } : {})
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  return root.children;
};

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
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const downloadAll = async () => {
    if (!zip) return;
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'archive.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteEntry = async (path: string) => {
    if (!zip) return;
    zip.remove(path);
    const newEntries = entries.filter(e => e.path !== path);
    setEntries(newEntries);
    if (selectedPath === path) {
      setSelectedPath('');
      setSelectedContent('');
    }
    await saveZip(zip);
  };

  const renameEntry = async (oldPath: string, newPath: string) => {
    if (!zip || !newPath.trim()) return;
    const entry = zip.file(oldPath);
    if (!entry) return;
    const content = await entry.async('uint8array');
    zip.file(newPath, content);
    zip.remove(oldPath);
    const newEntries = entries.map(e =>
      e.path === oldPath ? { ...e, path: newPath } : e
    );
    setEntries(newEntries);
    if (selectedPath === oldPath) setSelectedPath(newPath);
    await saveZip(zip);
    setRenamingPath(null);
  };

  const addFileToZip = async () => {
    if (!zip) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      zip.file(file.name, bytes);
      const meta: EntryMeta[] = [];
      zip.forEach((path, entry) => {
        if (entry.dir) return;
        const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
        meta.push({ path, size });
      });
      meta.sort((a, b) => a.path.localeCompare(b.path));
      setEntries(meta);
      await saveZip(zip);
    };
    input.click();
  };

  const saveZip = async (z: JSZip) => {
    setSaving(true);
    setSaveProgress(0);
    try {
      const bytes = await z.generateAsync(
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

  const treeData = useMemo(() => buildTree(entries.filter((e) => e.path.toLowerCase().includes(filter.toLowerCase()))), [entries, filter]);

  const renderTree = (nodes: TreeNode[]): JSX.Element[] => {
    return nodes.map(node => (
      <div key={node.path}>
        {node.type === 'folder' ? (
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{node.name}/</div>
        ) : (
          <div className="group flex items-center">
            <button
              className={`flex-1 text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 flex items-center justify-between gap-2 ${selectedPath === node.path ? 'bg-muted' : ''}`}
              onClick={() => void openEntry(node.path)}
            >
              <span className="truncate">{node.name}</span>
              <span className="text-muted-foreground shrink-0">{node.size ? formatBytes(node.size) : ''}</span>
            </button>
            <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
              <button
                onClick={() => { setRenamingPath(node.path); setRenameValue(node.path); }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
                title="Rename"
              ><Pencil className="w-3 h-3" /></button>
              <button
                onClick={() => { if (confirm(`Delete ${node.path}?`)) void deleteEntry(node.path); }}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/20"
                title="Delete"
              ><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        )}
        {node.children.length > 0 && <div className="pl-4">{renderTree(node.children)}</div>}
      </div>
    ));
  };

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
            <div className="flex items-center gap-1">
              <button onClick={downloadAll} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60" title="Download All"><Download className="w-3.5 h-3.5" /></button>
              <button onClick={addFileToZip} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60" title="Add file"><Upload className="w-3.5 h-3.5" /></button>
              <span className="text-xs text-muted-foreground">{entries.length} files</span>
            </div>
          </div>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files…" className="h-8" />
        </div>
        <ScrollArea className="flex-1"><div className="p-2 space-y-1">{visibleEntries.map((entry) => (
          renamingPath === entry.path ? (
            <div key={entry.path} className="flex items-center gap-1 px-2 py-1">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-7 text-xs flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void renameEntry(entry.path, renameValue);
                  if (e.key === 'Escape') setRenamingPath(null);
                }}
                onBlur={() => setRenamingPath(null)}
              />
            </div>
          ) : (
          <div key={entry.path} className="group flex items-center">
            <button
              className={`flex-1 text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 flex items-center justify-between gap-2 ${selectedPath === entry.path ? 'bg-muted' : ''}`}
              onClick={() => void openEntry(entry.path)}
            >
              <span className="truncate">{entry.path}</span>
              <span className="text-muted-foreground shrink-0">{formatBytes(entry.size)}</span>
            </button>
            <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
              <button
                onClick={() => { setRenamingPath(entry.path); setRenameValue(entry.path); }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
                title="Rename"
              ><Pencil className="w-3 h-3" /></button>
              <button
                onClick={() => { if (confirm(`Delete ${entry.path}?`)) void deleteEntry(entry.path); }}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/20"
                title="Delete"
              ><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
          )
        ))}</div></ScrollArea>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-11 border-b border-border px-3 flex items-center justify-between text-sm gap-2">
          <div className="truncate flex items-center gap-2">
            {entryLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span className="truncate">{selectedPath || 'Select a file'}</span>
          </div>
          {(selectedPreviewType === 'text' || selectedPreviewType === 'markdown' || selectedPreviewType === 'svg' || selectedPreviewType === 'csv' || selectedPreviewType === 'mermaid') && (
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
        {selectedPath && !entryLoading && ['markdown', 'svg', 'csv', 'image', 'video', 'audio', 'mermaid'].includes(selectedPreviewType || '') ? (
          <FilePreview file={selectedFile} previewType={selectedPreviewType as 'markdown' | 'svg' | 'csv' | 'image' | 'video' | 'audio' | 'mermaid'} onContentChange={(_, c) => void updateAndSave(c)} />
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
