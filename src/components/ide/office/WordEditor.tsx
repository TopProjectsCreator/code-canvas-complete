import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExt from '@tiptap/extension-image';
import { FileNode } from '@/types/ide';
import {
  FileText, Save, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Type, Minus, Plus,
  Loader2, Table as TableIcon, Image, Link as LinkIcon, Columns,
  Heading1, Heading2, Quote, Code, SeparatorHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [activeTab, setActiveTab] = useState<'home' | 'insert'>('home');
  const [wordCount, setWordCount] = useState(0);
  const [paperSize, setPaperSize] = useState<'letter' | 'a4'>('letter');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track last saved ZIP bytes so save() doesn't read stale file.content
  const lastZipBytesRef = useRef<Uint8Array | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ImageExt,
      Placeholder.configure({ placeholder: 'Start typing…' }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-8 py-6',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.state.doc.textContent || '';
      setWordCount(text.split(/\s+/).filter(Boolean).length);
    },
  });

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
        
        // Enhanced parsing: extract formatting and alignment
        const pNodes = Array.from(doc.getElementsByTagNameNS('*', 'p'));
        const paras = pNodes.map(p => {
          let html = '';
          
          // Get alignment from w:pPr/w:jc
          const pPr = p.getElementsByTagNameNS('*', 'pPr')[0];
          let alignClass = '';
          if (pPr) {
            const jc = pPr.getElementsByTagNameNS('*', 'jc')[0];
            if (jc) {
              const val = jc.getAttribute('w:val');
              if (val === 'center') alignClass = ' style="text-align: center;"';
              else if (val === 'right') alignClass = ' style="text-align: right;"';
              else if (val === 'justify') alignClass = ' style="text-align: justify;"';
              else if (val === 'left') alignClass = ' style="text-align: left;"';
            }
          }
          
          html += `<p${alignClass}>`;
          
          // Extract runs (w:r) with their formatting
          const runs = p.getElementsByTagNameNS('*', 'r');
          runs.forEach(r => {
            let runHtml = '';
            
            // Check for bold (w:b), italic (w:i), underline (w:u) in w:rPr
            const rPr = r.getElementsByTagNameNS('*', 'rPr')[0];
            const isBold = rPr && rPr.getElementsByTagNameNS('*', 'b').length > 0;
            const isItalic = rPr && rPr.getElementsByTagNameNS('*', 'i').length > 0;
            const isUnderline = rPr && rPr.getElementsByTagNameNS('*', 'u').length > 0;
            
            // Get text content
            const tNodes = r.getElementsByTagNameNS('*', 't');
            const text = Array.from(tNodes).map(t => t.textContent || '').join('');
            
            if (text) {
              if (isBold) runHtml = `<strong>${text}</strong>`;
              else if (isItalic) runHtml = `<em>${text}</em>`;
              else if (isUnderline) runHtml = `<u>${text}</u>`;
              else runHtml = text;
              
              html += runHtml;
            }
          });
          
          html += '</p>';
          return html;
        });
        
        const content = paras.length ? paras.join('') : '<p></p>';
        if (editor) editor.commands.setContent(content);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open document');
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  const save = useCallback(async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const baseBytes = lastZipBytesRef.current || (await buildNewDocx());
    const zip = await JSZip.loadAsync(baseBytes);

    const htmlToDocxXml = (html: string): string => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const body = doc.body;
      let xml = '';
      
      body.childNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          let pXml = '<w:p>';
          
          // Preserve alignment from inline styles
          const align = el.style.textAlign;
          if (align) {
            pXml += `<w:pPr><w:jc w:val="${align}"/></w:pPr>`;
          }
          
          // Recursively traverse and build runs with formatting
          const traverse = (n: Node): string => {
            let content = '';
            n.childNodes.forEach((child) => {
              if (child.nodeType === Node.TEXT_NODE) {
                if (child.textContent) {
                  content += `<w:r><w:t xml:space="preserve">${xmlEncode(child.textContent)}</w:t></w:r>`;
                }
              } else if (child.nodeType === Node.ELEMENT_NODE) {
                const cEl = child as HTMLElement;
                const tag = cEl.tagName.toLowerCase();
                
                // Handle formatting elements
                if (tag === 'strong' || tag === 'b') {
                  const innerText = cEl.textContent || '';
                  content += `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEncode(innerText)}</w:t></w:r>`;
                } else if (tag === 'em' || tag === 'i') {
                  const innerText = cEl.textContent || '';
                  content += `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${xmlEncode(innerText)}</w:t></w:r>`;
                } else if (tag === 'u') {
                  const innerText = cEl.textContent || '';
                  content += `<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${xmlEncode(innerText)}</w:t></w:r>`;
                } else if (tag === 's' || tag === 'strike') {
                  const innerText = cEl.textContent || '';
                  content += `<w:r><w:rPr><w:strike/></w:rPr><w:t xml:space="preserve">${xmlEncode(innerText)}</w:t></w:r>`;
                } else {
                  // For other elements, recurse
                  content += traverse(child);
                }
              }
            });
            return content;
          };
          
          pXml += traverse(el);
          pXml += '</w:p>';
          xml += pXml;
        }
      });
      return xml;
    };

    const bodyXml = htmlToDocxXml(html);

    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
xmlns:v="urn:schemas-microsoft-com:vml"
xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
xmlns:w10="urn:schemas-microsoft-com:office:word"
xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
mc:Ignorable="w14 wp14"><w:body>${bodyXml}</w:body></w:document>`);

    const out = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
    lastZipBytesRef.current = out;
    onContentChange(file.id, encodeDataUrl('application/vnd.openxmlformats-officedocument.wordprocessingml.document', out));
    toast({ title: 'Saved', description: 'Document saved successfully.' });
  }, [file.id, onContentChange, toast, editor]);

  useEffect(() => {
    if (loading || !editor) return;
    const timer = setTimeout(() => { save(); }, 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor?.state.doc.content]);

  const exec = (fn: () => void) => {
    fn();
    editor?.chain().focus().run();
  };

  const insertTable = () => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const insertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          editor.chain().focus().setImage({ src: reader.result }).run();
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const insertLink = () => {
    if (!editor) return;
    const url = window.prompt('Enter URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  const insertHorizontalRule = () => {
    if (!editor) return;
    editor.chain().focus().setHorizontalRule().run();
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
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {/* Title bar */}
        <div className="bg-[#1856a8] dark:bg-[#143d7a] text-white">
          <div className="flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <span className="text-sm font-semibold">{file.name}</span>
              <span className="text-[10px] text-white/60 ml-2">{wordCount} words</span>
            </div>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-7" onClick={() => { save(); }}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
          <div className="flex items-center gap-1 px-2 text-xs bg-[#1856a8]/80 dark:bg-[#143d7a]/80">
            {(['home', 'insert'] as const).map(tab => (
              <span
                key={tab}
                className={cn("px-3 py-1 rounded-t cursor-pointer capitalize", activeTab === tab ? "bg-white/20 font-medium" : "hover:bg-white/10")}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </span>
            ))}
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-5 w-5 text-white/60 hover:text-white" onClick={() => setZoom(z => Math.max(50, z - 10))}>
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-[10px] w-8 text-center">{zoom}%</span>
              <Button size="icon" variant="ghost" className="h-5 w-5 text-white/60 hover:text-white" onClick={() => setZoom(z => Math.min(200, z + 10))}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Ribbon */}
        <div className="flex items-center gap-1 px-3 py-1 border-b border-border bg-muted/10 flex-wrap min-h-9">
          {/* Common buttons across all tabs */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-border">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().undo())}>
                <Undo className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().redo())}>
                <Redo className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
          </div>

          {activeTab === 'home' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().toggleBold().run())}>
                    <Bold className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Bold (Ctrl+B)</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().toggleItalic().run())}>
                    <Italic className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Italic (Ctrl+I)</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().toggleUnderline().run())}>
                    <UnderlineIcon className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Underline (Ctrl+U)</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().toggleStrike().run())}>
                    <Strikethrough className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Strikethrough</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Select value={'p'} onValueChange={(v) => {
                  if (!editor) return;
                  if (v === 'p') editor.chain().focus().setParagraph().run();
                  else if (v === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                  else if (v === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                  else if (v === 'pre') editor.chain().focus().toggleCodeBlock().run();
                }}>
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue placeholder="Paragraph" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p" className="text-xs">Paragraph</SelectItem>
                    <SelectItem value="h1" className="text-xs">Heading 1</SelectItem>
                    <SelectItem value="h2" className="text-xs">Heading 2</SelectItem>
                    <SelectItem value="pre" className="text-xs">Code Block</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().setTextAlign('left').run())}>
                    <AlignLeft className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Align Left</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().setTextAlign('center').run())}>
                    <AlignCenter className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Center</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().setTextAlign('right').run())}>
                    <AlignRight className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Align Right</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().setTextAlign('justify').run())}>
                    <AlignJustify className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Justify</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().toggleBulletList().run())}>
                    <List className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Bullet List</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().toggleOrderedList().run())}>
                    <ListOrdered className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Numbered List</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().toggleBlockquote().run())}>
                    <Quote className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Quote</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec(() => editor?.chain().toggleCode().run())}>
                    <Code className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger><TooltipContent>Inline Code</TooltipContent></Tooltip>
              </div>
            </>
          )}

          {activeTab === 'insert' && (
            <>
              <div className="flex items-center gap-0.5 pr-2 border-r border-border">
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertTable}>
                    <TableIcon className="w-3.5 h-3.5" /> Table
                  </Button>
                </TooltipTrigger><TooltipContent>Insert Table</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertImage}>
                    <Image className="w-3.5 h-3.5" /> Image
                  </Button>
                </TooltipTrigger><TooltipContent>Insert Image</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertLink}>
                    <LinkIcon className="w-3.5 h-3.5" /> Link
                  </Button>
                </TooltipTrigger><TooltipContent>Insert Link</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={insertHorizontalRule}>
                    <SeparatorHorizontal className="w-3.5 h-3.5" /> HR
                  </Button>
                </TooltipTrigger><TooltipContent>Horizontal Rule</TooltipContent></Tooltip>
              </div>
            </>
          )}
        </div>

        {/* Document area */}
        <ScrollArea className="flex-1 bg-[#f5f5f0] dark:bg-[#1a1a1a]">
          <div className="flex justify-center py-8">
            <div
              className="bg-card shadow-xl rounded-sm"
              style={{
                width: paperSize === 'letter' ? '816px' : '794px',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              {editor && <EditorContent editor={editor} />}
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};
