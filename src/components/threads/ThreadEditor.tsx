import { useRef, useState, useEffect } from 'react';
import {
  Bold, Italic, List, ListOrdered, Quote, Link2, Undo2, Redo2,
  Image, Video, Music, SmilePlus, Heading1, Heading2, Heading3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sanitizeRichText } from '@/lib/richText';

const EMOJI_LIST = [
  '😀', '😂', '🤣', '😊', '😎', '🥳', '😍', '🤩',
  '🔥', '💯', '🎉', '✨', '🚀', '⭐', '❤️', '👍',
  '👎', '🙏', '💪', '🤝', '🎯', '🧠', '👀', '💡',
  '📢', '💬', '🔔', '📌', '⚡', '🛠️', '📝', '🎨',
];

const EMOJI_COLS = 8;

interface ThreadEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
  className?: string;
  onUploadMedia?: (file: File) => Promise<string>;
}

export function ThreadEditor({
  value,
  onChange,
  placeholder = 'Write something...',
  minHeightClassName = 'min-h-[200px]',
  className,
  onUploadMedia,
}: ThreadEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || focused) return;
    const clean = sanitizeRichText(value);
    if (el.innerHTML !== clean) {
      el.innerHTML = clean;
    }
  }, [value, focused]);

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    emitChange();
    editorRef.current?.focus();
  };

  const emitChange = () => {
    const html = sanitizeRichText(editorRef.current?.innerHTML || '');
    onChange(html);
  };

  const handleMediaUpload = async (accept: string) => {
    if (!onUploadMedia) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await onUploadMedia(file);
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        if (isVideo) {
          exec('insertHTML', `<video src="${url}" controls class="max-w-full rounded"></video>`);
        } else if (isAudio) {
          exec('insertHTML', `<audio src="${url}" controls class="w-full"></audio>`);
        } else {
          exec('insertHTML', `<img src="${url}" alt="${file.name}" class="max-w-full rounded" />`);
        }
      } catch {
        // handled by caller
      }
    };
    input.click();
  };

  const insertEmoji = (emoji: string) => {
    exec('insertText', emoji);
    setShowEmoji(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !onUploadMedia) return;

    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        try {
          const url = await onUploadMedia(file);
          const isVideo = file.type.startsWith('video/');
          const isAudio = file.type.startsWith('audio/');
          if (isVideo) {
            exec('insertHTML', `<video src="${url}" controls class="max-w-full rounded"></video>`);
          } else if (isAudio) {
            exec('insertHTML', `<audio src="${url}" controls class="w-full"></audio>`);
          } else {
            exec('insertHTML', `<img src="${url}" alt="Pasted image" class="max-w-full rounded" />`);
          }
        } catch {
          // upload failed, paste falls through naturally
        }
        return;
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0 || !onUploadMedia) return;

    e.preventDefault();
    for (const file of Array.from(files)) {
      try {
        const url = await onUploadMedia(file);
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        if (isVideo) {
          exec('insertHTML', `<video src="${url}" controls class="max-w-full rounded"></video>`);
        } else if (isAudio) {
          exec('insertHTML', `<audio src="${url}" controls class="w-full"></audio>`);
        } else {
          exec('insertHTML', `<img src="${url}" alt="${file.name}" class="max-w-full rounded" />`);
        }
      } catch {
        // handled by caller
      }
    }
  };

  return (
    <div className={cn('rounded-lg border border-border bg-background', className)}>
      <div className="flex flex-wrap gap-0.5 border-b border-border px-2 py-1.5">
        <ToolbarButton icon={Bold} label="Bold" onClick={() => exec('bold')} />
        <ToolbarButton icon={Italic} label="Italic" onClick={() => exec('italic')} />
        <span className="w-px h-5 bg-border mx-1 self-center" />
        <ToolbarButton icon={Heading1} label="Heading 1" onClick={() => exec('formatBlock', 'h1')} />
        <ToolbarButton icon={Heading2} label="Heading 2" onClick={() => exec('formatBlock', 'h2')} />
        <ToolbarButton icon={Heading3} label="Heading 3" onClick={() => exec('formatBlock', 'h3')} />
        <span className="w-px h-5 bg-border mx-1 self-center" />
        <ToolbarButton icon={List} label="Bullet list" onClick={() => exec('insertUnorderedList')} />
        <ToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => exec('insertOrderedList')} />
        <ToolbarButton icon={Quote} label="Quote" onClick={() => exec('formatBlock', 'blockquote')} />
        <span className="w-px h-5 bg-border mx-1 self-center" />
        <ToolbarButton icon={Link2} label="Link" onClick={() => {
          const url = window.prompt('Enter a URL:');
          if (url) exec('createLink', url);
        }} />
        <ToolbarButton icon={Image} label="Image" onClick={() => handleMediaUpload('image/*')} />
        <ToolbarButton icon={Video} label="Video" onClick={() => handleMediaUpload('video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg')} />
        <ToolbarButton icon={Music} label="Audio" onClick={() => handleMediaUpload('audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg')} />
        <span className="w-px h-5 bg-border mx-1 self-center" />
        <div className="relative">
          <ToolbarButton icon={SmilePlus} label="Emoji" onClick={() => setShowEmoji(!showEmoji)} />
          {showEmoji && (
            <div
              className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2"
              style={{ width: `${EMOJI_COLS * 36 + 16}px` }}
            >
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded text-lg cursor-pointer"
                    onClick={() => insertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="w-px h-5 bg-border mx-1 self-center" />
        <ToolbarButton icon={Undo2} label="Undo" onClick={() => exec('undo')} />
        <ToolbarButton icon={Redo2} label="Redo" onClick={() => exec('redo')} />
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
          onPaste={handlePaste}
          onDrop={handleDrop}
        />
      </div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
