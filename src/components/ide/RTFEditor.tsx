import { useState, useRef, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import {
  FileText, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Upload, Download, Type, Palette, Undo, Redo, Image,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Placeholder from '@tiptap/extension-placeholder';
import { Image as ImageExt } from '@tiptap/extension-image';

interface RTFEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

// Convert URL to base64 for embedding
async function urlToBase64(url: string): Promise<string> {
  try {
    if (url.startsWith('data:')) return url.split(',')[1] || '';
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

function rtfToHtml(rtf: string): string {
  if (!rtf.trim().startsWith('{\\rtf')) return `<p>${rtf.replace(/\n/g, '<br>')}</p>`;
  const colorTable: string[] = [];
  const ctMatch = rtf.match(/\{\\colortbl(.*?)\}/i);
  if (ctMatch) {
    const colors = ctMatch[1].match(/\\red(\d+)\\green(\d+)\\blue(\d+)/gi);
    if (colors) {
      for (const c of colors) {
        const m = c.match(/\\red(\d+)\\green(\d+)\\blue(\d+)/i);
        if (m) colorTable.push(`rgb(${m[1]},${m[2]},${m[3]})`);
      }
    }
  }

  let body = rtf;
  body = body.replace(/^\{\\rtf[^}]*\}/i, '');
  body = body.replace(/\{\\fonttbl[^}]*\}/gi, '');
  body = body.replace(/\{\\colortbl[^}]*\}/gi, '');
  body = body.replace(/\{\\stylesheet[^}]*\}/gi, '');
  body = body.replace(/\{\\info[^}]*\}/gi, '');
  body = body.replace(/\}+$/, '');

  let html = '';
  let bold = false, italic = false, underline = false, strike = false;
  let superScript = false, subScript = false;
  let currentColor = '', currentBg = '';
  let currentFontSize = 24;
  let align = 'left';
  let inTable = false;
  let currentRow: string[] = [];
  const tableRows: string[][] = [];
  let inList = false;

  const tokens = body.split(/(\\[a-z]+\d*\s?|\\[}{']|\\'[0-9a-f]{2}|\\`[a-z]|\n|\r|[{])/gi).filter(Boolean);
  let groupDepth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '{') { groupDepth++; continue; }
    if (t === '}') { groupDepth = Math.max(0, groupDepth - 1); continue; }
    if (t.startsWith('\\')) {
      const cmd = t;

      if (cmd === '\\par' || cmd === '\\par ') { html += '<br>'; continue; }
      if (cmd === '\\pard' || cmd === '\\pard ') {
        bold = false; italic = false; underline = false; strike = false;
        superScript = false; subScript = false; currentColor = ''; currentBg = '';
        currentFontSize = 24; align = 'left';
        continue;
      }
      if (cmd === '\\b' || cmd === '\\b ') { bold = true; continue; }
      if (cmd === '\\b0' || cmd === '\\b0 ') { bold = false; continue; }
      if (cmd === '\\i' || cmd === '\\i ') { italic = true; continue; }
      if (cmd === '\\i0' || cmd === '\\i0 ') { italic = false; continue; }
      if (cmd === '\\ul' || cmd === '\\ul ') { underline = true; continue; }
      if (cmd === '\\ulnone' || cmd === '\\ulnone ') { underline = false; continue; }
      if (cmd === '\\strike' || cmd === '\\strike ' || cmd === '\\st' || cmd === '\\st ') { strike = true; continue; }
      if (cmd === '\\strike0' || cmd === '\\strike0 ' || cmd === '\\st0' || cmd === '\\st0 ') { strike = false; continue; }
      if (cmd === '\\super' || cmd === '\\super ') { superScript = true; subScript = false; continue; }
      if (cmd === '\\nosupersub' || cmd === '\\nosupersub ') { superScript = false; subScript = false; continue; }
      if (cmd === '\\sub' || cmd === '\\sub ') { subScript = true; superScript = false; continue; }

      const fsMatch = cmd.match(/^\\fs(\d+)/);
      if (fsMatch) { currentFontSize = parseInt(fsMatch[1]); continue; }

      const cfMatch = cmd.match(/^\\cf(\d+)/);
      if (cfMatch) { currentColor = colorTable[parseInt(cfMatch[1]) - 1] || ''; continue; }
      const cbMatch = cmd.match(/^\\cb(\d+)/);
      if (cbMatch) { currentBg = colorTable[parseInt(cbMatch[1]) - 1] || ''; continue; }

      if (cmd === '\\ql' || cmd === '\\ql ') { align = 'left'; continue; }
      if (cmd === '\\qr' || cmd === '\\qr ') { align = 'right'; continue; }
      if (cmd === '\\qc' || cmd === '\\qc ') { align = 'center'; continue; }
      if (cmd === '\\qj' || cmd === '\\qj ') { align = 'justify'; continue; }

      if (cmd === '\\trowd' || cmd === '\\trowd ') { inTable = true; continue; }
      if (cmd === '\\row' || cmd === '\\row ') {
        if (currentRow.length > 0) { tableRows.push(currentRow); currentRow = []; }
        continue;
      }
      if (cmd === '\\cell' || cmd === '\\cell ') {
        currentRow.push('');
        continue;
      }
      if (cmd === '\\intbl' || cmd === '\\intbl ') { continue; }
      if (cmd === '\\cellx' || cmd.startsWith('\\cellx')) { continue; }
      if (cmd === '\\bullet' || cmd === '\\bullet ') { html += '\u2022'; continue; }
      if (cmd === '\\tab' || cmd === '\\tab ') { html += '&emsp;'; continue; }
      if (cmd === '\\line' || cmd === '\\line ') { html += '<br>'; continue; }
      if (cmd === '\\emdash' || cmd === '\\emdash ') { html += '\u2014'; continue; }
      if (cmd === '\\endash' || cmd === '\\endash ') { html += '\u2013'; continue; }
      if (cmd === '\\lquote' || cmd === '\\lquote ') { html += '\u2018'; continue; }
      if (cmd === '\\rquote' || cmd === '\\rquote ') { html += '\u2019'; continue; }
      if (cmd === '\\ldblquote' || cmd === '\\ldblquote ') { html += '\u201C'; continue; }
      if (cmd === '\\rdblquote' || cmd === '\\rdblquote ') { html += '\u201D'; continue; }

      const hexMatch = cmd.match(/^\\'([0-9a-f]{2})/i);
      if (hexMatch) {
        const charCode = parseInt(hexMatch[1], 16);
        const char = String.fromCharCode(charCode);
        html += char;
        continue;
      }

      continue;
    }

    if (!t.trim()) continue;

    const styles: string[] = [];
    if (currentColor) styles.push(`color:${currentColor}`);
    if (currentBg) styles.push(`background:${currentBg}`);
    if (currentFontSize !== 24) styles.push(`font-size:${Math.round(currentFontSize / 2)}px`);

    let text = t;
    if (strike) text = `<s>${text}</s>`;
    if (superScript) text = `<sup>${text}</sup>`;
    if (subScript) text = `<sub>${text}</sub>`;
    if (bold) text = `<strong>${text}</strong>`;
    if (italic) text = `<em>${text}</em>`;
    if (underline) text = `<u>${text}</u>`;
    if (styles.length > 0) text = `<span style="${styles.join(';')}">${text}</span>`;

    html += text;
  }

  const alignClass = align !== 'left' ? ` style="text-align:${align}"` : '';
  if (tableRows.length > 0) {
    let tableHtml = '<table><tr>';
    for (const row of tableRows) {
      for (const cell of row) {
        tableHtml += `<td>${cell}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table>';
    return tableHtml;
  }

  return `<p${alignClass}>${html}</p>` || '<p></p>';
}

function htmlToRtf(html: string): string {
  let rtf = '{\\rtf1\\ansi\\deff0 ';
  let text = html;

  text = text.replace(/style="[^"]*font-size\s*:\s*(\d+)px[^"]*"/gi, (_, px) => `\\fs${Math.round(parseInt(px) * 2)} `);

  text = text.replace(/<sup>(.*?)<\/sup>/gi, '{\\super $1\\nosupersub}');
  text = text.replace(/<sub>(.*?)<\/sub>/gi, '{\\sub $1\\nosupersub}');

  text = text.replace(/<s>(.*?)<\/s>/gi, '{\\strike $1\\strike0}');
  text = text.replace(/<strike>(.*?)<\/strike>/gi, '{\\strike $1\\strike0}');
  text = text.replace(/<del>(.*?)<\/del>/gi, '{\\strike $1\\strike0}');

  text = text.replace(/<p[^>]*style="[^"]*text-align\s*:\s*center[^"]*"[^>]*>/gi, '{\\pard\\qc ');
  text = text.replace(/<p[^>]*style="[^"]*text-align\s*:\s*right[^"]*"[^>]*>/gi, '{\\pard\\qr ');
  text = text.replace(/<p[^>]*style="[^"]*text-align\s*:\s*justify[^"]*"[^>]*>/gi, '{\\pard\\qj ');
  text = text.replace(/<p[^>]*>/gi, '{\\pard\\ql ');
  text = text.replace(/<\/p>/gi, '\\par}');

  text = text.replace(/<table[^>]*>/gi, '');
  text = text.replace(/<\/table>/gi, '');
  text = text.replace(/<tr[^>]*>/gi, '{\\trowd');
  text = text.replace(/<\/tr>/gi, '\\row}');
  text = text.replace(/<td[^>]*>/gi, '');
  text = text.replace(/<\/td>/gi, '\\cell ');

  text = text.replace(/<ul[^>]*>/gi, '');
  text = text.replace(/<\/ul>/gi, '');
  text = text.replace(/<ol[^>]*>/gi, '');
  text = text.replace(/<\/ol>/gi, '');
  text = text.replace(/<li[^>]*>/gi, '{\\pard\\li200\\bullet \\~');
  text = text.replace(/<\/li>/gi, '\\par}');

  // Enhanced image embedding with proper RTF syntax
  text = text.replace(/<img[^>]*src="data:image\/(png|jpeg|jpg);base64,([^"]*)"[^>]*>/gi, (_, type, base64) => {
    // RTF image embedding with picture info
    const hex = base64.match(/.{1,128}/g)?.join('\n') || '';
    const imageType = type === 'png' ? 'pngblip' : 'jpegblip';
    return `{\\*\\shppict{\\pict\\${imageType}\\picwgoal1000\\pichgoal1000\\picscalex100\\picscaley100 ${hex}}}`;
  });

  text = text.replace(/<strong>(.*?)<\/strong>/gi, '\\b $1\\b0 ');
  text = text.replace(/<b>(.*?)<\/b>/gi, '\\b $1\\b0 ');
  text = text.replace(/<em>(.*?)<\/em>/gi, '\\i $1\\i0 ');
  text = text.replace(/<i>(.*?)<\/i>/gi, '\\i $1\\i0 ');
  text = text.replace(/<u>(.*?)<\/u>/gi, '\\ul $1\\ulnone ');

  text = text.replace(/<br\s*\/?>/gi, '\\par ');
  text = text.replace(/<\/p>\s*<p>/gi, '\\par\\par ');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&emsp;/g, '\\tab ').replace(/&mdash;/g, '\\emdash ').replace(/&ndash;/g, '\\endash ');

  rtf += text + '}';
  return rtf;
}

export const RTFEditor = ({ file, onContentChange }: RTFEditorProps) => {
  const content = file.content || '';
  const isRtf = content.trim().startsWith('{\\rtf');
  const initialHtml = isRtf ? rtfToHtml(content) : content;
  const [dragOver, setDragOver] = useState(false);
  const [fontSize, setFontSize] = useState('16');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExt,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily,
      ImageExt.configure({ inline: true }),
      Placeholder.configure({ placeholder: 'Start typing…' }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-3xl mx-auto min-h-[300px] p-8 bg-card border border-border rounded-lg shadow-sm text-foreground text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const rtf = htmlToRtf(html);
      onContentChange(file.id, rtf);
    },
  });

  const execTipTap = useCallback((fn: () => void) => {
    fn();
    editor?.chain().focus().run();
  }, [editor]);

  const loadFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (editor) {
        const html = text.trim().startsWith('{\\rtf') ? rtfToHtml(text) : text;
        editor.commands.setContent(html);
      }
      onContentChange(file.id, text);
    };
    reader.readAsText(f);
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rtf,.txt,.html';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) loadFile(f);
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  };

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f && editor) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          editor.chain().focus().setImage({ src: dataUrl }).run();
        };
        reader.readAsDataURL(f);
      }
    };
    input.click();
  };

  const handleExport = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const rtf = htmlToRtf(html);
    const blob = new Blob([rtf], { type: 'application/rtf' });
    const link = document.createElement('a');
    link.download = file.name.endsWith('.rtf') ? file.name : `${file.name}.rtf`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!content.trim()) {
    return (
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground gap-4 transition-colors",
          dragOver && "bg-primary/10 ring-2 ring-primary ring-inset"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <FileText className={cn("w-16 h-16 opacity-50 transition-transform", dragOver && "scale-110 opacity-80")} />
        <div className="text-center">
          <p className="text-lg font-medium mb-1">RTF Editor</p>
          <p className="text-sm">{file.name}</p>
          <p className="text-xs mt-2 text-muted-foreground/70">
            {dragOver ? 'Drop .rtf file here' : 'Drag & drop or start typing'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleFileUpload}>
            <Upload className="w-4 h-4" /> Upload RTF
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => {
            editor?.commands.setContent('<p>Start typing here...</p>');
            const rtf = htmlToRtf('<p>Start typing here...</p>');
            onContentChange(file.id, rtf);
          }}>
            <FileText className="w-4 h-4" /> New Document
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/50 border-b border-border flex-wrap">
          <div className="flex items-center gap-1">
            <FileText className="w-4 h-4 text-primary mr-1" />
            <span className="text-sm font-medium text-foreground mr-3">{file.name}</span>
          </div>

          <div className="h-5 w-px bg-border mx-1" />

          <Select value={fontSize} onValueChange={(v) => {
            setFontSize(v);
            if (editor) {
              editor.chain().focus().setFontSize(`${v}px`).run();
            }
          }}>
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['12', '14', '16', '20', '24', '32'].map(s => (
                <SelectItem key={s} value={s}>{s}px</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-5 w-px bg-border mx-1" />

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleBold().run()}>
              <Bold className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Bold (Ctrl+B)</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <Italic className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Italic (Ctrl+I)</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
              <Underline className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Underline (Ctrl+U)</TooltipContent></Tooltip>

          <div className="h-5 w-px bg-border mx-1" />

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
              <AlignLeft className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Align Left</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
              <AlignCenter className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Align Center</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
              <AlignRight className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Align Right</TooltipContent></Tooltip>

          <div className="h-5 w-px bg-border mx-1" />

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
              <List className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Bullet List</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
              <ListOrdered className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Numbered List</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleImageUpload}>
              <Image className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Insert Image</TooltipContent></Tooltip>

          <div className="flex-1" />

          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </TooltipTrigger><TooltipContent>Export as RTF</TooltipContent></Tooltip>
        </div>

        <div className="flex-1 overflow-auto p-8 bg-background">
          <EditorContent editor={editor} />
        </div>
      </div>
    </TooltipProvider>
  );
};
