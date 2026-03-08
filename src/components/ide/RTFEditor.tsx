import { useState, useRef, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import {
  FileText, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Upload, Download, Type, Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface RTFEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

/**
 * Basic RTF-to-HTML converter for display.
 * Handles common RTF control words: \b, \i, \ul, \par, \pard, plain text groups.
 */
function rtfToHtml(rtf: string): string {
  if (!rtf.trim().startsWith('{\\rtf')) {
    // Not valid RTF, return as plain text
    return `<p>${rtf.replace(/\n/g, '<br>')}</p>`;
  }

  let html = '';
  let bold = false, italic = false, underline = false;

  // Strip RTF header/footer braces
  let body = rtf.replace(/^\{\\rtf[^}]*\}?\s*/i, '');
  // Remove font tables, color tables, etc.
  body = body.replace(/\{\\fonttbl[^}]*\}/gi, '');
  body = body.replace(/\{\\colortbl[^}]*\}/gi, '');
  body = body.replace(/\{\\stylesheet[^}]*\}/gi, '');
  body = body.replace(/\{\\info[^}]*\}/gi, '');
  // Remove remaining groups we don't handle
  body = body.replace(/\{[^{}]*\}/g, '');
  // Remove trailing }
  body = body.replace(/\}$/g, '');

  const tokens = body.split(/(\\[a-z]+\d*\s?|\\[{}]|\n|\r)/gi).filter(Boolean);

  for (const token of tokens) {
    if (token === '\\par' || token === '\\par ') {
      html += '<br>';
    } else if (token === '\\pard' || token === '\\pard ') {
      bold = false; italic = false; underline = false;
    } else if (token === '\\b' || token === '\\b ') {
      bold = true;
    } else if (token === '\\b0' || token === '\\b0 ') {
      bold = false;
    } else if (token === '\\i' || token === '\\i ') {
      italic = true;
    } else if (token === '\\i0' || token === '\\i0 ') {
      italic = false;
    } else if (token === '\\ul' || token === '\\ul ') {
      underline = true;
    } else if (token === '\\ulnone' || token === '\\ulnone ') {
      underline = false;
    } else if (token.startsWith('\\')) {
      // Skip other control words
    } else if (token === '\n' || token === '\r') {
      // Skip raw newlines
    } else {
      let text = token;
      if (bold) text = `<strong>${text}</strong>`;
      if (italic) text = `<em>${text}</em>`;
      if (underline) text = `<u>${text}</u>`;
      html += text;
    }
  }

  return html || '<p></p>';
}

/**
 * Convert HTML back to basic RTF
 */
function htmlToRtf(html: string): string {
  let rtf = '{\\rtf1\\ansi\\deff0 ';
  
  // Simple conversion
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\\par ');
  text = text.replace(/<\/p>\s*<p>/gi, '\\par\\par ');
  text = text.replace(/<p>/gi, '');
  text = text.replace(/<\/p>/gi, '\\par ');
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '\\b $1\\b0 ');
  text = text.replace(/<b>(.*?)<\/b>/gi, '\\b $1\\b0 ');
  text = text.replace(/<em>(.*?)<\/em>/gi, '\\i $1\\i0 ');
  text = text.replace(/<i>(.*?)<\/i>/gi, '\\i $1\\i0 ');
  text = text.replace(/<u>(.*?)<\/u>/gi, '\\ul $1\\ulnone ');
  text = text.replace(/<[^>]+>/g, ''); // Strip remaining HTML
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

  rtf += text + '}';
  return rtf;
}

export const RTFEditor = ({ file, onContentChange }: RTFEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fontSize, setFontSize] = useState('16');

  const content = file.content || '';
  const htmlContent = rtfToHtml(content);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    saveContent();
  };

  const saveContent = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const rtf = htmlToRtf(html);
    onContentChange(file.id, rtf);
  }, [file.id, onContentChange]);

  const loadFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => onContentChange(file.id, reader.result as string);
    reader.readAsText(f);
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rtf,.txt';
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

  const handleExport = () => {
    const blob = new Blob([content || htmlToRtf(editorRef.current?.innerHTML || '')], { type: 'application/rtf' });
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
            onContentChange(file.id, '{\\rtf1\\ansi\\deff0 Start typing here...}');
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
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/50 border-b border-border flex-wrap">
          <div className="flex items-center gap-1">
            <FileText className="w-4 h-4 text-primary mr-1" />
            <span className="text-sm font-medium text-foreground mr-3">{file.name}</span>
          </div>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Font size */}
          <Select value={fontSize} onValueChange={(v) => { setFontSize(v); execCommand('fontSize', v === '12' ? '2' : v === '14' ? '3' : v === '16' ? '4' : v === '20' ? '5' : v === '24' ? '6' : '4'); }}>
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

          {/* Formatting */}
          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => execCommand('bold')}>
              <Bold className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Bold (Ctrl+B)</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => execCommand('italic')}>
              <Italic className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Italic (Ctrl+I)</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => execCommand('underline')}>
              <Underline className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Underline (Ctrl+U)</TooltipContent></Tooltip>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Alignment */}
          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => execCommand('justifyLeft')}>
              <AlignLeft className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Align Left</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => execCommand('justifyCenter')}>
              <AlignCenter className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Align Center</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => execCommand('justifyRight')}>
              <AlignRight className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Align Right</TooltipContent></Tooltip>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Lists */}
          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => execCommand('insertUnorderedList')}>
              <List className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Bullet List</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => execCommand('insertOrderedList')}>
              <ListOrdered className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger><TooltipContent>Numbered List</TooltipContent></Tooltip>

          <div className="flex-1" />

          {/* Export */}
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </TooltipTrigger><TooltipContent>Export as RTF</TooltipContent></Tooltip>
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-auto p-8 bg-background">
          <div
            ref={editorRef}
            contentEditable
            className="max-w-3xl mx-auto min-h-[500px] p-8 bg-card border border-border rounded-lg shadow-sm text-foreground text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20"
            style={{ fontSize: `${fontSize}px` }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            onInput={saveContent}
            onBlur={saveContent}
          />
        </div>
      </div>
    </TooltipProvider>
  );
};
