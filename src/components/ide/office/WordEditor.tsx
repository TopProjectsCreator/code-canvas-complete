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
import { useToast } from '@/hooks/use-toast';

interface WordEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

export const WordEditor = ({ file, onContentChange }: WordEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState<'home' | 'insert' | 'layout' | 'references' | 'review' | 'view'>('home');
  const [wordCount, setWordCount] = useState(0);
  const [pageMargin, setPageMargin] = useState(72);
  const [isLandscape, setIsLandscape] = useState(false);
  const [paperSize, setPaperSize] = useState<'letter' | 'a4'>('letter');
  const [columnCount, setColumnCount] = useState(1);
  const [trackChanges, setTrackChanges] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const initialHtmlRef = useRef('');
  // Track the file id we loaded so we only set innerHTML once per file
  const loadedFileIdRef = useRef<string | null>(null);
  // Track last saved ZIP bytes so save() doesn't read stale file.content
  const lastZipBytesRef = useRef<Uint8Array | null>(null);
  const { toast } = useToast();

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
        lastZipBytesRef.current = bytes;
        const zip = await JSZip.loadAsync(bytes);
        const xml = await zip.file('word/document.xml')?.async('string');
        if (!xml) throw new Error('Missing word/document.xml');
        const doc = parseXml(xml);
        const pNodes = Array.from(doc.getElementsByTagNameNS('*', 'p'));
        const paras = pNodes.map(p => {
          const tNodes = Array.from(p.getElementsByTagNameNS('*', 't'));
          return tNodes.map(t => t.textContent || '').join('');
        });
        const lines = paras.length ? paras : [''];
        initialHtmlRef.current = lines.map(p => `<p>${p || '<br>'}</p>`).join('');
        loadedFileIdRef.current = file.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open document');
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]); // Only reload when file ID changes

  // Set innerHTML only once after loading
  useEffect(() => {
    if (!loading && !error && editorRef.current && loadedFileIdRef.current === file.id) {
      editorRef.current.innerHTML = initialHtmlRef.current;
      updateWordCount();
    }
  }, [loading, error, file.id]);

  const updateWordCount = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    setWordCount(text.split(/\s+/).filter(Boolean).length);
  };

  const getEditorParagraphs = (): string[] => {
    if (!editorRef.current) return [''];
    const text = editorRef.current.innerText || '';
    return text.split('\n');
  };

  const save = useCallback(async () => {
    const paragraphs = getEditorParagraphs();
    const baseBytes = lastZipBytesRef.current || (await buildNewDocx());
    const zip = await JSZip.loadAsync(baseBytes);
    const content = paragraphs
      .map(line => `<w:p><w:r><w:t xml:space="preserve">${xmlEncode(line)}</w:t></w:r></w:p>`)
      .join('');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content || '<w:p><w:r><w:t></w:t></w:r></w:p>'}</w:body></w:document>`);
    const out = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
    lastZipBytesRef.current = out;
    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.wordprocessingml.document', out));
  }, [file.id, onContentChange]);


  // Auto-save on editor input (debounced)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEditorInput = () => {
    updateWordCount();
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      save();
    }, 500);
  };

  // --- execCommand helpers ---
  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  // --- Insert actions ---
  const insertTable = () => {
    const rows = 3, cols = 3;
    let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += `<td style="border:1px solid hsl(var(--border));padding:6px 8px;min-width:60px" contenteditable="true">&nbsp;</td>`;
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    exec('insertHTML', html);
  };

  const handleImageUpload = () => fileInputRef.current?.click();

  const onImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        exec('insertHTML', `<img src="${reader.result}" style="max-width:100%;border-radius:4px;margin:8px 0" />`);
      }
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      const sel = window.getSelection();
      const text = sel && sel.toString() ? sel.toString() : url;
      exec('insertHTML', `<a href="${url}" style="color:hsl(217,91%,60%);text-decoration:underline" target="_blank">${text}</a>`);
    }
  };

  const insertBookmark = () => {
    const name = prompt('Bookmark name:');
    if (name) {
      exec('insertHTML', `<span style="background:hsl(48,96%,89%);padding:0 4px;border-radius:2px;font-size:0.85em" data-bookmark="${name}">🔖 ${name}</span>`);
    }
  };

  const insertHeader = () => {
    exec('insertHTML', `<div style="border-bottom:1px solid hsl(var(--border));padding-bottom:8px;margin-bottom:12px;color:hsl(var(--muted-foreground));font-size:0.85em">Header — ${file.name}</div>`);
  };

  const insertFooter = () => {
    exec('insertHTML', `<div style="border-top:1px solid hsl(var(--border));padding-top:8px;margin-top:12px;color:hsl(var(--muted-foreground));font-size:0.85em">Footer — Page 1</div>`);
  };

  const insertPageNumber = () => {
    exec('insertHTML', `<span style="color:hsl(var(--muted-foreground));font-size:0.85em">— Page 1 —</span>`);
  };

  const insertVideo = () => {
    // Offer choice: URL or file upload
    const choice = prompt('Enter video URL (YouTube/Vimeo), or type "file" to upload an .mp4:');
    if (!choice) return;
    if (choice.toLowerCase().trim() === 'file') {
      videoInputRef.current?.click();
    } else {
      exec('insertHTML', `<div style="margin:8px 0;padding:12px;background:hsl(var(--muted));border-radius:6px;text-align:center"><span style="font-size:0.85em">🎬 Video: <a href="${choice}" target="_blank" style="color:hsl(217,91%,60%)">${choice}</a></span></div>`);
    }
  };

  const onVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        exec('insertHTML', `<div style="margin:8px 0"><video controls style="max-width:100%;border-radius:6px" src="${reader.result}"></video></div>`);
      }
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const insertHeading = (level: 1 | 2) => {
    const tag = `h${level}`;
    const size = level === 1 ? '1.5em' : '1.25em';
    exec('insertHTML', `<${tag} style="font-size:${size};font-weight:bold;margin:12px 0 4px">Heading ${level}</${tag}>`);
  };

  const insertHorizontalRule = () => {
    exec('insertHTML', '<hr style="border:none;border-top:1px solid hsl(var(--border));margin:12px 0" /><p><br></p>');
  };

  const insertQuote = () => {
    exec('insertHTML', '<blockquote style="border-left:3px solid hsl(var(--border));padding-left:12px;margin:8px 0;color:hsl(var(--muted-foreground));font-style:italic">Quote</blockquote><p><br></p>');
  };

  const insertCodeBlock = () => {
    exec('insertHTML', '<pre style="background:hsl(var(--muted));padding:12px;border-radius:6px;font-family:monospace;font-size:0.9em;margin:8px 0;overflow-x:auto">code</pre><p><br></p>');
  };

  const toggleMargins = () => setPageMargin(m => m === 72 ? 54 : 72);
  const toggleOrientation = () => setIsLandscape(v => !v);
  const togglePaperSize = () => setPaperSize(v => v === 'letter' ? 'a4' : 'letter');
  const toggleColumns = () => setColumnCount(c => c === 1 ? 2 : 1);

  const insertTableOfContents = () => {
    if (!editorRef.current) return;
    const headings = Array.from(editorRef.current.querySelectorAll('h1, h2'))
      .map((el, idx) => `${idx + 1}. ${(el.textContent || '').trim()}`)
      .filter(Boolean);
    const content = headings.length ? headings.join('<br/>') : 'No headings found';
    exec('insertHTML', `<div style="margin:8px 0;padding:10px;border:1px solid hsl(var(--border));border-radius:4px"><strong>Table of Contents</strong><div style="margin-top:6px">${content}</div></div><p><br></p>`);
  };

  const insertFootnote = () => exec('insertHTML', '<sup>[1]</sup><span style="font-size:0.85em;color:hsl(var(--muted-foreground))"> Footnote text</span>');
  const insertEndnote = () => exec('insertHTML', '<p style="font-size:0.85em;color:hsl(var(--muted-foreground));margin-top:12px">[Endnote] Add endnote here.</p>');
  const insertBibliography = () => exec('insertHTML', '<h3 style="margin-top:12px">Bibliography</h3><p>[1] Author, Title, Year.</p>');

  const runSpellingCheck = () => {
    const text = editorRef.current?.innerText || '';
    const repeated = (text.match(/\b(\w+)\s+\1\b/gi) || []).length;
    toast({ title: 'Spelling scan complete', description: repeated ? `Found ${repeated} repeated word(s).` : 'No repeated words detected.' });
  };

  const insertComment = () => {
    const comment = prompt('Comment text:')?.trim();
    if (!comment) return;
    exec('insertHTML', `<span style="background:hsl(48,96%,89%);padding:0 4px;border-radius:2px" data-comment="${comment}">💬 ${comment}</span>`);
  };

  const doFind = () => {
    const term = prompt('Find text:')?.trim();
    if (!term || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const idx = html.toLowerCase().indexOf(term.toLowerCase());
    if (idx < 0) return;
    const match = html.slice(idx, idx + term.length);
    editorRef.current.innerHTML = `${html.slice(0, idx)}<mark>${match}</mark>${html.slice(idx + term.length)}`;
  };

  const doReplace = () => {
    const findText = prompt('Find text:')?.trim();
    if (!findText || !editorRef.current) return;
    const replaceText = prompt('Replace with:') ?? '';
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    editorRef.current.innerHTML = editorRef.current.innerHTML.replace(regex, replaceText);
    handleEditorInput();
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
        <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg" className="hidden" onChange={onVideoFileChange} />
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
        <div className="bg-background border-b border-border flex items-center gap-1 px-3 py-1.5 min-h-[40px] flex-wrap">
          {activeTab === 'home' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('undo')}><Undo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('redo')}><Redo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-1 pr-2 border-r border-border">
                <Select defaultValue="calibri" onValueChange={(v) => exec('fontName', v)}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calibri">Calibri</SelectItem>
                    <SelectItem value="arial">Arial</SelectItem>
                    <SelectItem value="times">Times New Roman</SelectItem>
                    <SelectItem value="georgia">Georgia</SelectItem>
                    <SelectItem value="courier">Courier New</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="3" onValueChange={(v) => exec('fontSize', v)}>
                  <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[{l:'8',v:'1'},{l:'10',v:'2'},{l:'11',v:'3'},{l:'12',v:'3'},{l:'14',v:'4'},{l:'18',v:'5'},{l:'24',v:'6'},{l:'36',v:'7'}].map(s => (
                      <SelectItem key={s.l} value={s.v}>{s.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('bold')}><Bold className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Bold</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('italic')}><Italic className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Italic</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('underline')}><Underline className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Underline</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('strikeThrough')}><Strikethrough className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Strikethrough</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('justifyLeft')}><AlignLeft className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Left</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('justifyCenter')}><AlignCenter className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Center</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('justifyRight')}><AlignRight className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Align Right</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('justifyFull')}><AlignJustify className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Justify</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('insertUnorderedList')}><List className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Bullets</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('insertOrderedList')}><ListOrdered className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Numbering</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'insert' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertTable}><Table className="w-3.5 h-3.5" /> Table</Button></TooltipTrigger><TooltipContent>Insert 3×3 Table</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={handleImageUpload}><Image className="w-3.5 h-3.5" /> Picture</Button></TooltipTrigger><TooltipContent>Insert Picture</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertVideo}><Film className="w-3.5 h-3.5" /> Video</Button></TooltipTrigger><TooltipContent>Insert Video Link</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertLink}><Link className="w-3.5 h-3.5" /> Link</Button></TooltipTrigger><TooltipContent>Insert Hyperlink</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertBookmark}><Bookmark className="w-3.5 h-3.5" /> Bookmark</Button></TooltipTrigger><TooltipContent>Insert Bookmark</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => insertHeading(1)}><Heading1 className="w-3.5 h-3.5" /> H1</Button></TooltipTrigger><TooltipContent>Heading 1</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => insertHeading(2)}><Heading2 className="w-3.5 h-3.5" /> H2</Button></TooltipTrigger><TooltipContent>Heading 2</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertQuote}><Quote className="w-3.5 h-3.5" /> Quote</Button></TooltipTrigger><TooltipContent>Block Quote</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertCodeBlock}><Code className="w-3.5 h-3.5" /> Code</Button></TooltipTrigger><TooltipContent>Code Block</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertHorizontalRule}><SeparatorHorizontal className="w-3.5 h-3.5" /> Rule</Button></TooltipTrigger><TooltipContent>Horizontal Rule</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertHeader}><Heading1 className="w-3.5 h-3.5" /> Header</Button></TooltipTrigger><TooltipContent>Document Header</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertFooter}><SeparatorHorizontal className="w-3.5 h-3.5" /> Footer</Button></TooltipTrigger><TooltipContent>Document Footer</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertPageNumber}><Type className="w-3.5 h-3.5" /> Page #</Button></TooltipTrigger><TooltipContent>Page Number</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'layout' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={toggleMargins}><LayoutGrid className="w-3.5 h-3.5" /> Margins</Button></TooltipTrigger><TooltipContent>Page Margins</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={toggleOrientation}><FileImage className="w-3.5 h-3.5" /> Orientation</Button></TooltipTrigger><TooltipContent>Page Orientation</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={togglePaperSize}><Type className="w-3.5 h-3.5" /> Size</Button></TooltipTrigger><TooltipContent>Paper Size</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={toggleColumns}><Columns className="w-3.5 h-3.5" /> Columns</Button></TooltipTrigger><TooltipContent>Columns</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertHorizontalRule}><SeparatorHorizontal className="w-3.5 h-3.5" /> Breaks</Button></TooltipTrigger><TooltipContent>Page Breaks</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'references' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertTableOfContents}><BookOpen className="w-3.5 h-3.5" /> Table of Contents</Button></TooltipTrigger><TooltipContent>Table of Contents</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertFootnote}><Quote className="w-3.5 h-3.5" /> Footnote</Button></TooltipTrigger><TooltipContent>Insert Footnote</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertEndnote}><Code className="w-3.5 h-3.5" /> Endnote</Button></TooltipTrigger><TooltipContent>Insert Endnote</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertBibliography}><Bookmark className="w-3.5 h-3.5" /> Bibliography</Button></TooltipTrigger><TooltipContent>Bibliography</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'review' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={runSpellingCheck}><SpellCheck className="w-3.5 h-3.5" /> Spelling</Button></TooltipTrigger><TooltipContent>Spelling & Grammar</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertComment}><MessageSquare className="w-3.5 h-3.5" /> Comment</Button></TooltipTrigger><TooltipContent>New Comment</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setTrackChanges(v => !v)}><CheckSquare className="w-3.5 h-3.5" /> Track Changes</Button></TooltipTrigger><TooltipContent>Track Changes</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={doFind}><Search className="w-3.5 h-3.5" /> Find</Button></TooltipTrigger><TooltipContent>Find</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={doReplace}><Replace className="w-3.5 h-3.5" /> Replace</Button></TooltipTrigger><TooltipContent>Replace</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'view' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setZoom(120)}><Eye className="w-3.5 h-3.5" /> Reading</Button></TooltipTrigger><TooltipContent>Reading View</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setZoom(100)}><LayoutGrid className="w-3.5 h-3.5" /> Print Layout</Button></TooltipTrigger><TooltipContent>Print Layout</TooltipContent></Tooltip>
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
                width: Math.round((isLandscape ? 792 : 612) * (zoom / 100)),
                minHeight: Math.round((isLandscape ? 612 : 792) * (zoom / 100)),
                padding: `${Math.round(pageMargin * (zoom / 100))}px ${Math.round(pageMargin * (zoom / 100))}px`,
              }}
            >
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="outline-none min-h-[200px] text-sm leading-relaxed"
                style={{ fontSize: Math.round(11 * (zoom / 100)), columnCount, columnGap: columnCount > 1 ? '24px' : undefined, borderLeft: trackChanges ? '2px solid hsl(var(--primary))' : undefined, paddingLeft: trackChanges ? '8px' : undefined }}
                onInput={handleEditorInput}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-[#185abd] dark:bg-[#1b3a6b] text-white text-xs">
          <div className="flex items-center gap-4">
            <span>Page 1 of 1</span>
            <span>{wordCount} words</span>
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
