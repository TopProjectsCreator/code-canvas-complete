import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import ImageExt from '@tiptap/extension-image';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, List, ListOrdered, Code2, Quote, Link as LinkIcon, Table as TableIcon, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import TurndownService from 'turndown';
import { marked } from 'marked';

const lowlight = createLowlight(common);

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
});

function extractFrontmatter(source: string): { frontmatter: string; body: string } {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (match) {
    return {
      frontmatter: match[0],
      body: source.slice(match[0].length),
    };
  }
  return { frontmatter: '', body: source };
}

interface MarkdownComposerProps {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

export function MarkdownComposer({ content, onChange, placeholder = 'Write your markdown here…' }: MarkdownComposerProps) {
  const prevContentRef = useRef(content);
  const lastSyncedContentRef = useRef(content);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const parsed = extractFrontmatter(content);
  const frontmatterRef = useRef(parsed.frontmatter);
  const [hasFrontmatter, setHasFrontmatter] = useState(!!parsed.frontmatter);
  const [charCount, setCharCount] = useState(content.length);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const editorOptions = useMemo(() => ({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      UnderlineExt,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ImageExt,
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder }),
    ],
    content: marked.parse(parsed.body || content),
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      let md = turndownService.turndown(html);
      const fm = frontmatterRef.current;
      if (fm) {
        md = fm + md;
      }
      setCharCount(md.length);
      onChangeRef.current(md);
      lastSyncedContentRef.current = md;
    },
  }), []);

  const editor = useEditor(editorOptions);

  useEffect(() => {
    if (editor && content !== prevContentRef.current) {
      prevContentRef.current = content;
      const parsed = extractFrontmatter(content);
      frontmatterRef.current = parsed.frontmatter;
      setHasFrontmatter(!!parsed.frontmatter);
      const newBody = marked.parse(parsed.body || content);
      const currentHtml = editor.getHTML();
      if (newBody.trim() !== currentHtml.trim()) {
        editor.commands.setContent(newBody);
      }
    }
  }, [content, editor]);

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const files = event.clipboardData?.files;
    if (files && files.length > 0) {
      const imageFile = Array.from(files).find(f => f.type.startsWith('image/'));
      if (imageFile) {
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          editor?.chain().focus().setImage({ src: dataUrl }).run();
        };
        reader.readAsDataURL(imageFile);
      }
    }
  }, [editor]);

  const toggleMark = useCallback((mark: string) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (mark) {
      case 'bold': chain.toggleBold().run(); break;
      case 'italic': chain.toggleItalic().run(); break;
      case 'underline': chain.toggleUnderline().run(); break;
      case 'code': chain.toggleCode().run(); break;
      case 'strike': chain.toggleStrike().run(); break;
    }
  }, [editor]);

  const toggleBlock = useCallback((block: string) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (block) {
      case 'h1': chain.toggleHeading({ level: 1 }).run(); break;
      case 'h2': chain.toggleHeading({ level: 2 }).run(); break;
      case 'h3': chain.toggleHeading({ level: 3 }).run(); break;
      case 'bullet': chain.toggleBulletList().run(); break;
      case 'ordered': chain.toggleOrderedList().run(); break;
      case 'quote': chain.toggleBlockquote().run(); break;
      case 'codeBlock': chain.toggleCodeBlock().run(); break;
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Link URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const addTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const isActive = (type: string, attrs?: Record<string, string>) => editor.isActive(type, attrs);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/20 shrink-0 flex-wrap">
        <ToolbarButton onClick={() => toggleMark('bold')} active={isActive('bold')}><Bold className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => toggleMark('italic')} active={isActive('italic')}><Italic className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => toggleMark('underline')} active={isActive('underline')}><UnderlineIcon className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => toggleMark('code')} active={isActive('code')}><Code2 className="w-3.5 h-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => toggleBlock('h1')} active={isActive('heading', { level: '1' })}><Heading1 className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => toggleBlock('h2')} active={isActive('heading', { level: '2' })}><Heading2 className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => toggleBlock('h3')} active={isActive('heading', { level: '3' })}><Heading3 className="w-3.5 h-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => toggleBlock('bullet')} active={isActive('bulletList')}><List className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => toggleBlock('ordered')} active={isActive('orderedList')}><ListOrdered className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => toggleBlock('quote')} active={isActive('blockquote')}><Quote className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => toggleBlock('codeBlock')} active={isActive('codeBlock')}><Code2 className="w-3.5 h-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={addLink} active={isActive('link')}><LinkIcon className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={addImage} active={false}><ImageIcon className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={addTable} active={false}><TableIcon className="w-3.5 h-3.5" /></ToolbarButton>
        {hasFrontmatter && (
          <span className="text-xs text-muted-foreground ml-auto">Frontmatter preserved</span>
        )}
      </div>
      <div ref={editorContainerRef} className="flex-1 overflow-auto p-4" onPaste={handlePaste}>
        <div className="prose prose-sm dark:prose-invert max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/50 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0">
          <EditorContent editor={editor} />
        </div>
      </div>
      <div className="flex items-center justify-end px-2 py-1 border-t border-border bg-muted/20 shrink-0">
        <span className="text-xs text-muted-foreground">{charCount} chars</span>
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, active, children }: { onClick: () => void; active: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors',
        active && 'bg-muted text-foreground',
      )}
    >
      {children}
    </button>
  );
}
