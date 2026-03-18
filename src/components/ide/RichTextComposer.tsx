import { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sanitizeRichText } from '@/lib/richText';

interface RichTextComposerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
  className?: string;
}

const TOOLBAR: Array<{ label: string; icon: typeof Bold; action: () => void }> = [
  { label: 'Bold', icon: Bold, action: () => document.execCommand('bold') },
  { label: 'Italic', icon: Italic, action: () => document.execCommand('italic') },
  { label: 'Bulleted list', icon: List, action: () => document.execCommand('insertUnorderedList') },
  { label: 'Numbered list', icon: ListOrdered, action: () => document.execCommand('insertOrderedList') },
  { label: 'Quote', icon: Quote, action: () => document.execCommand('formatBlock', false, 'blockquote') },
  {
    label: 'Link',
    icon: Link2,
    action: () => {
      const url = window.prompt('Enter a URL');
      if (url) document.execCommand('createLink', false, url);
    },
  },
  { label: 'Undo', icon: Undo2, action: () => document.execCommand('undo') },
  { label: 'Redo', icon: Redo2, action: () => document.execCommand('redo') },
];

export const RichTextComposer = ({
  value,
  onChange,
  placeholder = 'Write a comment…',
  minHeightClassName = 'min-h-[96px]',
  className,
}: RichTextComposerProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const sanitizedValue = useMemo(() => sanitizeRichText(value), [value]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || focused) return;
    if (el.innerHTML !== sanitizedValue) {
      el.innerHTML = sanitizedValue;
    }
  }, [focused, sanitizedValue]);

  const emitChange = () => {
    const html = sanitizeRichText(editorRef.current?.innerHTML || '');
    onChange(html);
  };

  return (
    <div className={cn('rounded-lg border border-border bg-background', className)}>
      <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
        {TOOLBAR.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.label}
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={tool.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                tool.action();
                emitChange();
                editorRef.current?.focus();
              }}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
      <div className="relative">
        {!sanitizeRichText(value) && !focused && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">{placeholder}</div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className={cn('px-3 py-3 text-sm outline-none prose prose-sm max-w-none dark:prose-invert', minHeightClassName)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            emitChange();
          }}
          onInput={emitChange}
        />
      </div>
    </div>
  );
};
