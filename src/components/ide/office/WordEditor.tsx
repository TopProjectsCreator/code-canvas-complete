import { useState, useEffect, useCallback, useRef } from 'react';
import { Packer } from 'docx';
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
  List, ListOrdered, Undo, Redo, Minus, Plus,
  Loader2, Table as TableIcon, Image, Link as LinkIcon,
  Quote, Code, SeparatorHorizontal,
  Sun, Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShortcutsGuide } from './ShortcutsGuide';
import { decodeDataUrl, encodeDataUrl } from './officeUtils';
import { htmlToDocx } from './htmlToDocx';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface WordEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

const HEADING_LEVELS = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'h5', label: 'Heading 5' },
  { value: 'h6', label: 'Heading 6' },
  { value: 'pre', label: 'Code Block' },
];

export const WordEditor = ({ file, onContentChange }: WordEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState<'home' | 'insert'>('home');
  const [wordCount, setWordCount] = useState(0);
  const [paperSize] = useState<'letter' | 'a4'>('letter');
  const [docTheme, setDocTheme] = useState<'light' | 'dark'>('light');
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      UnderlineExt,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ImageExt,
      Placeholder.configure({ placeholder: 'Start typing\u2026' }),
    ],
    editorProps: {
      attributes: {
        class: 'word-editor focus:outline-none min-h-[200px]',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.state.doc.textContent || '';
      setWordCount(text.split(/\s+/).filter(Boolean).length);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const bytes = decodeDataUrl(file.content || '');
        if (bytes && bytes.length > 0) {
          const slice = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          const mammoth = await import('mammoth/mammoth.browser');
          const result = await mammoth.convertToHtml({ arrayBuffer: slice, styleMap: ['u => u'] } as any);
          editor.commands.setContent(result.value || '<p></p>');
        } else {
          editor.commands.setContent('<p></p>');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open document');
      } finally {
        setLoading(false);
      }
    };
    load();
  // file.content intentionally excluded: re-loading on every save would reset edits
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, file.id]);

  const save = useCallback(async () => {
    if (!editor) return;
    try {
      const html = editor.getHTML();
      const doc = htmlToDocx(html);
      const buf = await Packer.toArrayBuffer(doc);
      const bytes = new Uint8Array(buf);
      onContentChange(
        file.id,
        encodeDataUrl('application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes),
      );
      toast({ title: 'Saved', description: 'Document saved successfully.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    }
  }, [file.id, onContentChange, toast, editor]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading || !editor) return;
    const handleContentChange = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => { save(); }, 2000);
    };
    editor.on('update', handleContentChange);
    return () => {
      editor.off('update', handleContentChange);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [loading, editor, save]);

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

  const handleHeadingChange = (v: string) => {
    if (!editor) return;
    if (v === 'p') editor.chain().focus().setParagraph().run();
    else if (v.match(/^h[1-6]$/)) {
      const level = parseInt(v[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
      editor.chain().focus().toggleHeading({ level }).run();
    } else if (v === 'pre') editor.chain().focus().toggleCodeBlock().run();
  };

  if (loading) {
    const fileSize = new Blob([file.content || '']).size;
    const showProgress = fileSize > 1024 * 1024;
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
        {showProgress && (
          <div className="w-64 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        )}
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Opening document{showProgress ? ` (${(fileSize / (1024 * 1024)).toFixed(1)} MB)` : ''}...</span>
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
            <ShortcutsGuide />
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
              <Button size="icon" variant="ghost" className="h-5 w-5 text-white/60 hover:text-white" onClick={() => setDocTheme(t => t === 'light' ? 'dark' : 'light')}>
                {docTheme === 'light' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
              </Button>
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
                <Select value={'p'} onValueChange={handleHeadingChange}>
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue placeholder="Paragraph" />
                  </SelectTrigger>
                  <SelectContent>
                    {HEADING_LEVELS.map(h => (
                      <SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>
                    ))}
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
        <ScrollArea className={`flex-1 ${docTheme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-[#f5f5f0]'}`}>
          <div className="flex justify-center py-8">
            <div
              className={`shadow-xl rounded-sm ${docTheme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white'}`}
              style={{
                width: paperSize === 'letter' ? '816px' : '794px',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <div className={docTheme === 'dark' ? 'word-editor-dark' : 'word-editor-light'} style={{ padding: '96px' }}>
                {editor && <EditorContent editor={editor} />}
                <style>{`
                  .word-editor-light .ProseMirror {
                    font-family: Calibri, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                    font-size: 11pt;
                    line-height: 1.15;
                    color: #000000;
                  }
                  .word-editor-light .ProseMirror p {
                    margin: 0;
                    padding: 0;
                    margin-bottom: 8pt;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror h1 {
                    font-size: 16pt;
                    font-weight: bold;
                    color: #1F3864;
                    margin: 12pt 0 6pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror h2 {
                    font-size: 14pt;
                    font-weight: bold;
                    color: #2E75B6;
                    margin: 10pt 0 5pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror h3 {
                    font-size: 12pt;
                    font-weight: bold;
                    margin: 8pt 0 4pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror h4 {
                    font-size: 11pt;
                    font-weight: bold;
                    font-style: italic;
                    margin: 7pt 0 3.5pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror h5 {
                    font-size: 10pt;
                    font-weight: bold;
                    margin: 6pt 0 3pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror h6 {
                    font-size: 9pt;
                    font-weight: bold;
                    margin: 6pt 0 3pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror ul,
                  .word-editor-light .ProseMirror ol {
                    padding-left: 24pt;
                    margin: 0 0 8pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror li {
                    line-height: 1.15;
                    margin-bottom: 2pt;
                  }
                  .word-editor-light .ProseMirror table {
                    border-collapse: collapse;
                    margin-bottom: 8pt;
                    width: 100%;
                  }
                  .word-editor-light .ProseMirror td,
                  .word-editor-light .ProseMirror th {
                    border: 1px solid #D9D9D9;
                    padding: 4pt 6pt;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror th {
                    background-color: #F2F2F2;
                    font-weight: bold;
                  }
                  .word-editor-light .ProseMirror blockquote {
                    margin: 0 0 8pt 0;
                    padding-left: 12pt;
                    border-left: 3px solid #D9D9D9;
                    color: #404040;
                  }
                  .word-editor-light .ProseMirror pre {
                    font-family: 'Courier New', monospace;
                    font-size: 9pt;
                    background-color: #F5F5F5;
                    padding: 8pt;
                    border: 1px solid #D9D9D9;
                    margin-bottom: 8pt;
                    line-height: 1.15;
                  }
                  .word-editor-light .ProseMirror code {
                    font-family: 'Courier New', monospace;
                    font-size: 9pt;
                    background-color: #F5F5F5;
                    padding: 1pt 2pt;
                  }
                  .word-editor-light .ProseMirror hr {
                    margin: 12pt 0;
                    border: none;
                    border-top: 1px solid #D9D9D9;
                  }
                  .word-editor-light .ProseMirror a {
                    color: #0563C1;
                    text-decoration: underline;
                  }
                  .word-editor-light .ProseMirror img {
                    max-width: 100%;
                    height: auto;
                  }

                  .word-editor-dark .ProseMirror {
                    font-family: Calibri, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                    font-size: 11pt;
                    line-height: 1.15;
                    color: #E0E0E0;
                  }
                  .word-editor-dark .ProseMirror p {
                    margin: 0;
                    padding: 0;
                    margin-bottom: 8pt;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror h1 {
                    font-size: 16pt;
                    font-weight: bold;
                    color: #8DB4E2;
                    margin: 12pt 0 6pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror h2 {
                    font-size: 14pt;
                    font-weight: bold;
                    color: #7FBF7F;
                    margin: 10pt 0 5pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror h3 {
                    font-size: 12pt;
                    font-weight: bold;
                    margin: 8pt 0 4pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror h4 {
                    font-size: 11pt;
                    font-weight: bold;
                    font-style: italic;
                    margin: 7pt 0 3.5pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror h5 {
                    font-size: 10pt;
                    font-weight: bold;
                    margin: 6pt 0 3pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror h6 {
                    font-size: 9pt;
                    font-weight: bold;
                    margin: 6pt 0 3pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror ul,
                  .word-editor-dark .ProseMirror ol {
                    padding-left: 24pt;
                    margin: 0 0 8pt 0;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror li {
                    line-height: 1.15;
                    margin-bottom: 2pt;
                  }
                  .word-editor-dark .ProseMirror table {
                    border-collapse: collapse;
                    margin-bottom: 8pt;
                    width: 100%;
                  }
                  .word-editor-dark .ProseMirror td,
                  .word-editor-dark .ProseMirror th {
                    border: 1px solid #404040;
                    padding: 4pt 6pt;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror th {
                    background-color: #2A2A2A;
                    font-weight: bold;
                  }
                  .word-editor-dark .ProseMirror blockquote {
                    margin: 0 0 8pt 0;
                    padding-left: 12pt;
                    border-left: 3px solid #404040;
                    color: #A0A0A0;
                  }
                  .word-editor-dark .ProseMirror pre {
                    font-family: 'Courier New', monospace;
                    font-size: 9pt;
                    background-color: #2A2A2A;
                    padding: 8pt;
                    border: 1px solid #404040;
                    margin-bottom: 8pt;
                    line-height: 1.15;
                  }
                  .word-editor-dark .ProseMirror code {
                    font-family: 'Courier New', monospace;
                    font-size: 9pt;
                    background-color: #2A2A2A;
                    padding: 1pt 2pt;
                  }
                  .word-editor-dark .ProseMirror hr {
                    margin: 12pt 0;
                    border: none;
                    border-top: 1px solid #404040;
                  }
                  .word-editor-dark .ProseMirror a {
                    color: #8DB4E2;
                    text-decoration: underline;
                  }
                  .word-editor-dark .ProseMirror img {
                    max-width: 100%;
                    height: auto;
                  }
                `}</style>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};
