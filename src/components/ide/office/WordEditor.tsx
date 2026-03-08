import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { FileNode } from '@/types/ide';
import {
  FileText, Save, Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Type, Minus, Plus,
  Loader2, Table, Image, Link, Columns,
  BookOpen, CheckSquare, MessageSquare, Eye, LayoutGrid,
  Heading1, Heading2, Quote, Code, SeparatorHorizontal,
  FileImage, Film, Bookmark, Search, Replace, SpellCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { decodeDataUrl, encodeDataUrl, parseXml, xmlEncode, buildNewDocx } from './officeUtils';
import { cn } from '@/lib/utils';

interface WordEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

export const WordEditor = ({ file, onContentChange }: WordEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState<'home' | 'insert' | 'layout' | 'references' | 'review' | 'view'>('home');
  const [images, setImages] = useState<Array<{ id: string; dataUrl: string }>>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let bytes = decodeDataUrl(file.content || '');
        if (!bytes) {
          bytes = await buildNewDocx();
          onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes));
        }
        const zip = await JSZip.loadAsync(bytes);
        const xml = await zip.file('word/document.xml')?.async('string');
        if (!xml) throw new Error('Missing word/document.xml');
        const doc = parseXml(xml);
        const pNodes = Array.from(doc.getElementsByTagNameNS('*', 'p'));
        const paras = pNodes.map(p => {
          const tNodes = Array.from(p.getElementsByTagNameNS('*', 't'));
          return tNodes.map(t => t.textContent || '').join('');
        });
        setParagraphs(paras.length ? paras : ['']);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open document');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [file.id, file.content, onContentChange]);

  const save = useCallback(async () => {
    const bytes = decodeDataUrl(file.content || '') || (await buildNewDocx());
    const zip = await JSZip.loadAsync(bytes);
    const content = paragraphs
      .map(line => `<w:p><w:r><w:t xml:space="preserve">${xmlEncode(line)}</w:t></w:r></w:p>`)
      .join('');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content || '<w:p><w:r><w:t></w:t></w:r></w:p>'}</w:body></w:document>`);
    const out = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.wordprocessingml.document', out));
  }, [file, paragraphs, onContentChange]);

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    setParagraphs(text.split('\n'));
  };

  const handleImageUpload = () => fileInputRef.current?.click();

  const onImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const id = `img-${Date.now()}`;
        setImages(prev => [...prev, { id, dataUrl: reader.result as string }]);
        // Insert image placeholder into editor
        if (editorRef.current) {
          const img = document.createElement('img');
          img.src = reader.result as string;
          img.style.maxWidth = '100%';
          img.style.borderRadius = '4px';
          img.style.margin = '8px 0';
          img.setAttribute('data-img-id', id);
          editorRef.current.appendChild(img);
          handleEditorInput();
        }
      }
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Opening document…</span>
      </div>
    );
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-destructive">{error}</div>;
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-[#f3f3f3] dark:bg-[#1e1e1e] overflow-hidden">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageFileChange} />
        {/* Title bar */}
        <div className="bg-[#185abd] dark:bg-[#1b3a6b] text-white">
          <div className="flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <span className="text-sm font-semibold">{file.name}</span>
            </div>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-7" onClick={save}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>

          {/* Ribbon tabs */}
          <div className="flex items-center gap-1 px-2 text-xs bg-[#185abd]/80 dark:bg-[#1b3a6b]/80">
            {(['home', 'insert', 'layout', 'references', 'review', 'view'] as const).map(tab => (
              <span
                key={tab}
                className={cn(
                  "px-3 py-1 rounded-t cursor-pointer capitalize",
                  activeTab === tab ? "bg-white/20 font-medium" : "hover:bg-white/10"
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'references' ? 'References' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Ribbon content */}
        <div className="bg-background border-b border-border flex items-center gap-1 px-3 py-1.5 min-h-[40px]">
          {activeTab === 'home' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Undo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Redo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-1 pr-2 border-r border-border">
                <Select defaultValue="calibri">
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calibri">Calibri</SelectItem>
                    <SelectItem value="arial">Arial</SelectItem>
                    <SelectItem value="times">Times New Roman</SelectItem>
                    <SelectItem value="georgia">Georgia</SelectItem>
                    <SelectItem value="courier">Courier New</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="11">
                  <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map(s => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Bold className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Bold</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Italic className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Italic</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Underline className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Underline</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Strikethrough className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Strikethrough</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><AlignLeft className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Left</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><AlignCenter className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Center</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><AlignRight className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Right</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><AlignJustify className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Justify</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><List className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Bullets</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><ListOrdered className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Numbering</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'insert' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Table className="w-3.5 h-3.5" /> Table</Button></TooltipTrigger><TooltipContent>Insert Table</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Image className="w-3.5 h-3.5" /> Picture</Button></TooltipTrigger><TooltipContent>Insert Picture</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Film className="w-3.5 h-3.5" /> Video</Button></TooltipTrigger><TooltipContent>Insert Video</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Link className="w-3.5 h-3.5" /> Link</Button></TooltipTrigger><TooltipContent>Insert Link</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Bookmark className="w-3.5 h-3.5" /> Bookmark</Button></TooltipTrigger><TooltipContent>Bookmark</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Heading1 className="w-3.5 h-3.5" /> Header</Button></TooltipTrigger><TooltipContent>Header</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><SeparatorHorizontal className="w-3.5 h-3.5" /> Footer</Button></TooltipTrigger><TooltipContent>Footer</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Type className="w-3.5 h-3.5" /> Page #</Button></TooltipTrigger><TooltipContent>Page Number</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'layout' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><LayoutGrid className="w-3.5 h-3.5" /> Margins</Button></TooltipTrigger><TooltipContent>Page Margins</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><FileImage className="w-3.5 h-3.5" /> Orientation</Button></TooltipTrigger><TooltipContent>Page Orientation</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Type className="w-3.5 h-3.5" /> Size</Button></TooltipTrigger><TooltipContent>Paper Size</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Columns className="w-3.5 h-3.5" /> Columns</Button></TooltipTrigger><TooltipContent>Columns</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><SeparatorHorizontal className="w-3.5 h-3.5" /> Breaks</Button></TooltipTrigger><TooltipContent>Page Breaks</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'references' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><BookOpen className="w-3.5 h-3.5" /> Table of Contents</Button></TooltipTrigger><TooltipContent>Table of Contents</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Quote className="w-3.5 h-3.5" /> Footnote</Button></TooltipTrigger><TooltipContent>Insert Footnote</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Code className="w-3.5 h-3.5" /> Endnote</Button></TooltipTrigger><TooltipContent>Insert Endnote</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Bookmark className="w-3.5 h-3.5" /> Bibliography</Button></TooltipTrigger><TooltipContent>Bibliography</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'review' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><SpellCheck className="w-3.5 h-3.5" /> Spelling</Button></TooltipTrigger><TooltipContent>Spelling & Grammar</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><MessageSquare className="w-3.5 h-3.5" /> Comment</Button></TooltipTrigger><TooltipContent>New Comment</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><CheckSquare className="w-3.5 h-3.5" /> Track Changes</Button></TooltipTrigger><TooltipContent>Track Changes</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Search className="w-3.5 h-3.5" /> Find</Button></TooltipTrigger><TooltipContent>Find</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Replace className="w-3.5 h-3.5" /> Replace</Button></TooltipTrigger><TooltipContent>Replace</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'view' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><Eye className="w-3.5 h-3.5" /> Reading</Button></TooltipTrigger><TooltipContent>Reading View</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"><LayoutGrid className="w-3.5 h-3.5" /> Print Layout</Button></TooltipTrigger><TooltipContent>Print Layout</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Zoom:</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setZoom(z => Math.max(50, z - 10))}><Minus className="w-3 h-3" /></Button>
                <span className="text-xs w-8 text-center">{zoom}%</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setZoom(z => Math.min(200, z + 10))}><Plus className="w-3 h-3" /></Button>
              </div>
            </>
          )}
        </div>

        {/* Ruler (decorative) */}
        <div className="h-6 bg-background border-b border-border flex items-center px-12">
          <div className="flex-1 h-px bg-muted-foreground/20 relative">
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="absolute top-0 -translate-y-2" style={{ left: `${i * 16.66}%` }}>
                <div className="w-px h-2 bg-muted-foreground/40" />
                <span className="text-[8px] text-muted-foreground/50 -translate-x-1/2 block">{i}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Document canvas */}
        <ScrollArea className="flex-1 bg-[#e8e8e8] dark:bg-[#1a1a1a]">
          <div className="flex justify-center py-8">
            <div
              className="bg-white dark:bg-[#2d2d2d] shadow-lg rounded-sm"
              style={{
                width: Math.round(612 * (zoom / 100)),
                minHeight: Math.round(792 * (zoom / 100)),
                padding: `${Math.round(72 * (zoom / 100))}px ${Math.round(72 * (zoom / 100))}px`,
              }}
            >
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="outline-none min-h-[200px] text-sm leading-relaxed"
                style={{ fontSize: Math.round(11 * (zoom / 100)) }}
                onInput={handleEditorInput}
                dangerouslySetInnerHTML={{
                  __html: paragraphs.map(p => `<p>${p || '<br>'}</p>`).join('')
                }}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-[#185abd] dark:bg-[#1b3a6b] text-white text-xs">
          <div className="flex items-center gap-4">
            <span>Page 1 of 1</span>
            <span>{paragraphs.reduce((sum, p) => sum + (p.split(/\s+/).filter(Boolean).length), 0)} words</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-5 w-5 text-white hover:bg-white/20" onClick={() => setZoom(z => Math.max(50, z - 10))}>
              <Minus className="w-3 h-3" />
            </Button>
            <span>{zoom}%</span>
            <Button size="icon" variant="ghost" className="h-5 w-5 text-white hover:bg-white/20" onClick={() => setZoom(z => Math.min(200, z + 10))}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
