import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FileNode } from '@/types/ide';
import { FindReplace } from './FindReplace';
import { FilePreview } from './FilePreview';
import { OfficeEditor } from './OfficeEditor';
import { VideoEditor } from './VideoEditor';
import { AudioEditor } from './AudioEditor';
import { RTFEditor } from './RTFEditor';
import { CADEditor } from './CADEditor';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RichTextComposer } from './RichTextComposer';
import { richTextToPlainText, sanitizeRichText } from '@/lib/richText';
import { useCollaboration } from '@/hooks/useCollaboration';

interface CodeEditorProps {
  file: FileNode | null;
  currentFilePath?: string | null;
  onContentChange: (fileId: string, content: string) => void;
  collab?: ReturnType<typeof useCollaboration>;
}

const getPreviewType = (fileName: string): 'image' | 'markdown' | 'svg' | 'video' | 'audio' | 'csv' | 'office' | 'cad' | 'rtf' | null => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'];
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv', 'ogg'];
  const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'm4a'];
  const cadExtensions = ['stl', 'obj'];

  if (ext === 'rtf') return 'rtf';
  if (ext === 'svg') return 'svg';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'csv') return 'csv';
  if (imageExtensions.includes(ext || '')) return 'image';
  if (videoExtensions.includes(ext || '')) return 'video';
  if (audioExtensions.includes(ext || '')) return 'audio';
  if (['docx', 'xlsx', 'pptx'].includes(ext || '')) return 'office';
  if (cadExtensions.includes(ext || '')) return 'cad';
  return null;
};

interface SyntaxToken {
  type: 'keyword' | 'string' | 'number' | 'function' | 'comment' | 'operator' | 'variable' | 'tag' | 'attribute' | 'property' | 'text';
  value: string;
}

const tokenize = (code: string, language: string): SyntaxToken[][] => {
  const lines = code.split('\n');
  const jsKeywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'default', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null', 'undefined'];
  const cssKeywords = ['@import', '@media', '@keyframes', '@font-face'];

  return lines.map((line) => {
    const tokens: SyntaxToken[] = [];
    let remaining = line;

    while (remaining.length > 0) {
      let matched = false;

      if (remaining.startsWith('//') || remaining.startsWith('/*') || remaining.startsWith('<!--')) {
        tokens.push({ type: 'comment', value: remaining });
        break;
      }

      const stringMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
      if (stringMatch) {
        tokens.push({ type: 'string', value: stringMatch[0] });
        remaining = remaining.slice(stringMatch[0].length);
        matched = true;
        continue;
      }

      if (language === 'html') {
        const tagMatch = remaining.match(/^<\/?[a-zA-Z][a-zA-Z0-9-]*|^>/);
        if (tagMatch) {
          tokens.push({ type: 'tag', value: tagMatch[0] });
          remaining = remaining.slice(tagMatch[0].length);
          matched = true;
          continue;
        }

        const attrMatch = remaining.match(/^[a-zA-Z-]+(?==)/);
        if (attrMatch) {
          tokens.push({ type: 'attribute', value: attrMatch[0] });
          remaining = remaining.slice(attrMatch[0].length);
          matched = true;
          continue;
        }
      }

      if (language === 'css') {
        const propMatch = remaining.match(/^[a-zA-Z-]+(?=\s*:)/);
        if (propMatch) {
          tokens.push({ type: 'property', value: propMatch[0] });
          remaining = remaining.slice(propMatch[0].length);
          matched = true;
          continue;
        }

        const selectorMatch = remaining.match(/^[.#]?[a-zA-Z_][a-zA-Z0-9_-]*(?=\s*[{,])/);
        if (selectorMatch) {
          tokens.push({ type: 'function', value: selectorMatch[0] });
          remaining = remaining.slice(selectorMatch[0].length);
          matched = true;
          continue;
        }
      }

      const numMatch = remaining.match(/^-?\d+\.?\d*(px|em|rem|%|vh|vw|deg|s|ms)?/);
      if (numMatch) {
        tokens.push({ type: 'number', value: numMatch[0] });
        remaining = remaining.slice(numMatch[0].length);
        matched = true;
        continue;
      }

      const wordMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
      if (wordMatch) {
        const word = wordMatch[0];
        const keywords = language === 'css' ? cssKeywords : jsKeywords;

        if (keywords.includes(word)) {
          tokens.push({ type: 'keyword', value: word });
        } else if (remaining.slice(word.length).match(/^\s*\(/)) {
          tokens.push({ type: 'function', value: word });
        } else {
          tokens.push({ type: 'variable', value: word });
        }
        remaining = remaining.slice(word.length);
        matched = true;
        continue;
      }

      const opMatch = remaining.match(/^[=+\-*/<>!&|:;.,{}()\[\]]+/);
      if (opMatch) {
        tokens.push({ type: 'operator', value: opMatch[0] });
        remaining = remaining.slice(opMatch[0].length);
        matched = true;
        continue;
      }

      if (!matched) {
        tokens.push({ type: 'text', value: remaining[0] });
        remaining = remaining.slice(1);
      }
    }

    return tokens;
  });
};

const getTokenClass = (type: SyntaxToken['type']): string => {
  const classMap: Record<SyntaxToken['type'], string> = {
    keyword: 'text-syntax-keyword',
    string: 'text-syntax-string',
    number: 'text-syntax-number',
    function: 'text-syntax-function',
    comment: 'text-syntax-comment italic',
    operator: 'text-syntax-operator',
    variable: 'text-syntax-variable',
    tag: 'text-syntax-keyword',
    attribute: 'text-syntax-function',
    property: 'text-syntax-variable',
    text: 'text-foreground',
  };
  return classMap[type];
};

const saveCursorPosition = (el: HTMLElement): number => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);

  let offset = 0;
  const lines = el.childNodes;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as HTMLElement;
    if (line.contains(range.startContainer) || line === range.startContainer) {
      const lineRange = document.createRange();
      lineRange.selectNodeContents(line);
      lineRange.setEnd(range.startContainer, range.startOffset);
      offset += lineRange.toString().length;
      return offset;
    }
    offset += (line.textContent || '').length + 1;
  }

  return offset;
};

const restoreCursorPosition = (el: HTMLElement, offset: number) => {
  const sel = window.getSelection();
  if (!sel) return;

  let currentOffset = 0;
  const lines = el.childNodes;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as HTMLElement;
    const lineText = line.textContent || '';
    const lineLen = lineText.length;

    if (currentOffset + lineLen >= offset) {
      const targetOffset = offset - currentOffset;
      if (lineLen === 0) {
        const range = document.createRange();
        const br = line.querySelector('br');
        if (br) range.setStartBefore(br);
        else range.selectNodeContents(line);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }

      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      let nodeOffset = 0;
      while ((node = walker.nextNode() as Text | null)) {
        const nodeLen = node.textContent?.length || 0;
        if (nodeOffset + nodeLen >= targetOffset) {
          const range = document.createRange();
          range.setStart(node, targetOffset - nodeOffset);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        nodeOffset += nodeLen;
      }

      const range = document.createRange();
      range.selectNodeContents(line);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }

    currentOffset += lineLen + 1;
  }

  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
};

const getLineCol = (text: string, offset: number): { line: number; col: number } => {
  const before = text.substring(0, offset);
  const lines = before.split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
};

const escapeHtml = (str: string): string => str
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const CodeEditor = ({ file, currentFilePath, onContentChange, collab }: CodeEditorProps) => {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ line: 0, col: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [searchMatches, setSearchMatches] = useState<{ start: number; end: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [markdownPreview, setMarkdownPreview] = useState(true);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState(false);
  const [postingReplyId, setPostingReplyId] = useState<string | null>(null);
  const isComposingRef = useRef(false);
  const contentRef = useRef(content);
  const cursorOffsetRef = useRef<number | null>(null);
  const prevContentRef = useRef(content);

  const fileComments = useMemo(
    () => collab?.comments.filter((comment) => comment.file_path === currentFilePath) || [],
    [collab?.comments, currentFilePath],
  );
  const rootComments = useMemo(
    () => fileComments.filter((comment) => !comment.parent_id),
    [fileComments],
  );
  const commentsByLine = useMemo(() => {
    const map = new Map<number, typeof rootComments>();
    rootComments.forEach((comment) => {
      const comments = map.get(comment.line_number) || [];
      comments.push(comment);
      map.set(comment.line_number, comments);
    });
    return map;
  }, [rootComments]);
  const selectedLineThreads = useMemo(() => commentsByLine.get(selectedLine || -1) || [], [commentsByLine, selectedLine]);
  const activePresence = useMemo(
    () => collab?.presence.filter((entry) => entry.currentFile === currentFilePath) || [],
    [collab?.presence, currentFilePath],
  );

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (modifier && (event.key === 'f' || event.key === 'h')) {
        event.preventDefault();
        setShowFindReplace(true);
      } else if (event.key === 'Escape' && showFindReplace) {
        setShowFindReplace(false);
        setSearchMatches([]);
        setCurrentMatchIndex(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFindReplace]);

  const handleHighlightChange = useCallback((matches: { start: number; end: number }[], index: number) => {
    setSearchMatches(matches);
    setCurrentMatchIndex(index);

    if (index >= 0 && matches[index] && editorRef.current) {
      const lineNumber = content.substring(0, matches[index].start).split('\n').length;
      editorRef.current.scrollTop = (lineNumber - 3) * 24;
    }
  }, [content]);

  const handleReplace = useCallback((nextContent: string) => {
    setContent(nextContent);
    if (file) onContentChange(file.id, nextContent);
  }, [file, onContentChange]);

  useEffect(() => {
    if (file?.content !== undefined) setContent(file.content);
  }, [file?.id, file?.content]);

  useEffect(() => {
    if (!fileComments.length && selectedLine !== null) return;
    if (selectedLine !== null) return;
    const firstLine = fileComments[0]?.line_number ?? null;
    setSelectedLine(firstLine);
  }, [fileComments, selectedLine]);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    const el = editorRef.current;
    if (!el) return;

    const lines: string[] = [];
    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        lines.push((child as HTMLElement).textContent || '');
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || '';
        if (text.length > 0) text.split('\n').forEach((line) => lines.push(line));
      }
    });

    const nextContent = lines.join('\n');
    setContent(nextContent);
    if (file) onContentChange(file.id, nextContent);
  }, [file, onContentChange]);

  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  }, []);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  }, []);

  const syncPresenceFromSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const offset = saveCursorPosition(el);
    const position = getLineCol(contentRef.current, offset);
    setCursorPosition(position);
    if (currentFilePath) {
      void collab?.updatePresence({ currentFile: currentFilePath, cursorLine: position.line, cursorCol: position.col });
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const anchor = selection.anchorNode;
    if (!anchor || !el.contains(anchor)) return;

    const lineNode = (anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement)?.closest('.code-line');
    const lineAttr = lineNode?.getAttribute('data-line');
    if (lineAttr) setSelectedLine(Number(lineAttr));
  }, [collab, currentFilePath]);

  useEffect(() => {
    document.addEventListener('selectionchange', syncPresenceFromSelection);
    return () => document.removeEventListener('selectionchange', syncPresenceFromSelection);
  }, [syncPresenceFromSelection]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (cursorOffsetRef.current !== null) {
      restoreCursorPosition(el, cursorOffsetRef.current);
      cursorOffsetRef.current = null;
    }
  });

  if (content !== prevContentRef.current) {
    const el = editorRef.current;
    if (el && document.activeElement === el) cursorOffsetRef.current = saveCursorPosition(el);
    prevContentRef.current = content;
  }

  const postComment = useCallback(async () => {
    if (!collab || !currentFilePath || selectedLine === null || !sanitizeRichText(newComment)) {
      if (!collab || !currentFilePath || selectedLine === null) {
        toast({ title: 'Cannot post comment', description: 'Please save the project and sign in first.', variant: 'destructive' });
      }
      return;
    }
    setPostingComment(true);
    const ok = await collab.addComment(currentFilePath, selectedLine, sanitizeRichText(newComment));
    setPostingComment(false);
    if (ok) {
      setNewComment('');
    } else {
      toast({ title: 'Comment failed', description: 'Please save the project and sign in to leave comments.', variant: 'destructive' });
    }
  }, [collab, currentFilePath, newComment, selectedLine, toast]);

  const postReply = useCallback(async (commentId: string) => {
    if (!collab || !currentFilePath || selectedLine === null) {
      toast({ title: 'Cannot post reply', description: 'Please save the project and sign in first.', variant: 'destructive' });
      return;
    }
    const draft = sanitizeRichText(replyDrafts[commentId] || '');
    if (!draft) return;
    setPostingReplyId(commentId);
    const ok = await collab.addComment(currentFilePath, selectedLine, draft, commentId);
    setPostingReplyId(null);
    if (ok) {
      setReplyDrafts((prev) => ({ ...prev, [commentId]: '' }));
    } else {
      toast({ title: 'Reply failed', description: 'Please save the project and sign in to reply.', variant: 'destructive' });
    }
  }, [collab, currentFilePath, replyDrafts, selectedLine, toast]);

  if (!file) {
    return (
      <div className="flex flex-1 items-center justify-center bg-editor text-muted-foreground">
        <div className="text-center">
          <p className="mb-2 text-lg">No file selected</p>
          <p className="text-sm">Select a file from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  const previewType = getPreviewType(file.name);
  const binaryPreviewTypes = ['image', 'video', 'audio', 'cad', 'rtf'];
  const isTextPreviewable = previewType && !binaryPreviewTypes.includes(previewType);

  if (previewType === 'office') return <OfficeEditor file={file} onContentChange={onContentChange} />;
  if (previewType === 'video') return <VideoEditor file={file} onContentChange={onContentChange} />;
  if (previewType === 'audio') return <AudioEditor file={file} onContentChange={onContentChange} />;
  if (previewType === 'rtf') return <RTFEditor file={file} onContentChange={onContentChange} />;
  if (previewType === 'cad') return <CADEditor file={file} onContentChange={onContentChange} />;
  if (previewType && !isTextPreviewable) return <FilePreview file={file} previewType={previewType as 'image' | 'csv' | 'markdown' | 'svg'} />;

  if (isTextPreviewable && markdownPreview) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-editor">
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
          <button onClick={() => setMarkdownPreview(false)} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">Edit</button>
          <span className="text-xs font-medium text-foreground">Preview</span>
        </div>
        <FilePreview file={{ ...file, content }} previewType={previewType} />
      </div>
    );
  }

  const tokenizedLines = tokenize(content, file.language || 'text');
  const getMatchHighlight = (charIndex: number): 'current' | 'match' | null => {
    for (let i = 0; i < searchMatches.length; i += 1) {
      const match = searchMatches[i];
      if (charIndex >= match.start && charIndex < match.end) return i === currentMatchIndex ? 'current' : 'match';
    }
    return null;
  };

  const buildHighlightedHtml = () => {
    let charIndex = 0;
    return tokenizedLines.map((lineTokens, lineIndex) => {
      const tokensHtml = lineTokens.map((token) => {
        const tokenStart = charIndex;
        const chars = token.value.split('');
        const hasHighlight = chars.some((_, index) => getMatchHighlight(tokenStart + index));
        charIndex += token.value.length;

        if (!hasHighlight) {
          return `<span class="${getTokenClass(token.type)}">${escapeHtml(token.value)}</span>`;
        }

        const highlighted = chars.map((char, index) => {
          const highlight = getMatchHighlight(tokenStart + index);
          if (!highlight) return escapeHtml(char);
          const cls = highlight === 'current' ? 'bg-yellow-400 text-black' : 'bg-yellow-200/50 text-inherit';
          return `<span class="${cls}">${escapeHtml(char)}</span>`;
        }).join('');

        return `<span class="${getTokenClass(token.type)}">${highlighted}</span>`;
      }).join('');

      charIndex += 1;
      return `<div class="code-line" data-line="${lineIndex + 1}">${tokensHtml.length === 0 ? '<br>' : tokensHtml}</div>`;
    }).join('');
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-editor">
      {isTextPreviewable && (
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
          <span className="text-xs font-medium text-foreground">Edit</span>
          <button onClick={() => setMarkdownPreview(true)} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">Preview</button>
        </div>
      )}

      <FindReplace
        content={content}
        isOpen={showFindReplace}
        onClose={() => {
          setShowFindReplace(false);
          setSearchMatches([]);
          setCurrentMatchIndex(-1);
        }}
        onReplace={handleReplace}
        onHighlightChange={handleHighlightChange}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 overflow-auto ide-scrollbar">
          <div className="flex min-h-full min-w-full">
            <div className="sticky left-0 z-10 bg-editor pt-[2px] font-mono text-sm leading-6 text-muted-foreground">
              {content.split('\n').map((_, index) => {
                const lineNumber = index + 1;
                const lineComments = commentsByLine.get(lineNumber) || [];
                const selected = selectedLine === lineNumber;
                const peers = activePresence.filter((entry) => entry.cursorLine === lineNumber);
                return (
                  <button
                    key={lineNumber}
                    type="button"
                    onClick={() => setSelectedLine(lineNumber)}
                    className={cn(
                      'flex min-w-[3.5rem] items-center justify-end gap-1 pr-2 text-right text-xs leading-6 transition-colors',
                      selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40',
                    )}
                  >
                    {lineComments.length > 0 && <MessageSquare className="h-3 w-3 text-primary" />}
                    {peers.length > 0 && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                    <span>{lineNumber}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-0 flex-1">
              {selectedLine !== null && (
                <div className="pointer-events-none absolute inset-x-0 z-0" style={{ top: `${(selectedLine - 1) * 24 + 2}px` }}>
                  <div className="h-6 bg-primary/5" />
                </div>
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleEditorKeyDown}
                onPaste={handlePaste}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { isComposingRef.current = false; handleInput(); }}
                className="relative z-10 min-w-0 flex-1 pl-[6px] pt-[2px] font-mono text-sm leading-6 caret-foreground outline-none"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                dangerouslySetInnerHTML={{ __html: buildHighlightedHtml() }}
              />
            </div>
          </div>
        </div>

        {collab && currentFilePath && selectedLine !== null && (
          <aside className="flex w-[360px] shrink-0 flex-col border-l border-border bg-background/95">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Line {selectedLine}</p>
                  <p className="text-xs text-muted-foreground">Highlight a line, click comment, and keep the thread where the code lives.</p>
                </div>
                <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> Word-style</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activePresence.slice(0, 4).map((entry) => (
                  <Badge key={entry.userId} variant="outline" className="gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    {entry.displayName}
                    {entry.cursorLine ? ` · Ln ${entry.cursorLine}` : ''}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-auto px-4 py-4">
              {selectedLineThreads.map((comment) => {
                const replies = fileComments.filter((entry) => entry.parent_id === comment.id);
                return (
                  <div key={comment.id} className="rounded-xl border border-border bg-card/70 p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Avatar className="mt-0.5 h-8 w-8">
                        <AvatarImage src={comment.profile?.avatar_url || undefined} />
                        <AvatarFallback>{(comment.profile?.display_name || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{comment.profile?.display_name || 'User'}</p>
                            <p className="text-[11px] text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</p>
                          </div>
                          {!comment.resolved ? (
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => collab.resolveComment(comment.id, true)}>
                              Resolve
                            </Button>
                          ) : (
                            <Badge variant="outline">Resolved</Badge>
                          )}
                        </div>
                        <div className="prose prose-sm mt-2 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeRichText(comment.content) }} />
                      </div>
                    </div>

                    {replies.length > 0 && (
                      <div className="mt-3 space-y-2 border-l border-border pl-4">
                        {replies.map((reply) => (
                          <div key={reply.id} className="rounded-lg bg-muted/40 p-2.5">
                            <div className="mb-1 flex items-center gap-2 text-xs">
                              <span className="font-semibold">{reply.profile?.display_name || 'User'}</span>
                              <span className="text-muted-foreground">{new Date(reply.created_at).toLocaleString()}</span>
                            </div>
                            <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeRichText(reply.content) }} />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 space-y-2">
                      <RichTextComposer
                        value={replyDrafts[comment.id] || ''}
                        onChange={(value) => setReplyDrafts((prev) => ({ ...prev, [comment.id]: value }))}
                        placeholder="Add a follow-up…"
                        minHeightClassName="min-h-[84px]"
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          disabled={!richTextToPlainText(replyDrafts[comment.id] || '') || postingReplyId === comment.id}
                          onClick={() => postReply(comment.id)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {postingReplyId === comment.id ? 'Posting…' : 'Reply'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedLineThreads.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                  No comments on this line yet. Add one to start an inline review thread.
                </div>
              )}
            </div>

            <div className="border-t border-border px-4 py-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Comment on line {selectedLine}</p>
                <Badge variant="outline">{currentFilePath}</Badge>
              </div>
              <RichTextComposer value={newComment} onChange={setNewComment} placeholder="Mention changes, leave suggestions, or ask for follow-ups…" />
              <div className="mt-3 flex justify-end">
                <Button type="button" className="gap-2" onClick={postComment} disabled={!richTextToPlainText(newComment) || postingComment}>
                  <MessageSquare className="h-4 w-4" />
                  {postingComment ? 'Posting…' : 'Comment'}
                </Button>
              </div>
            </div>
          </aside>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border bg-background px-4 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{file.language || 'Plain Text'}</span>
          <span>UTF-8</span>
          {selectedLine !== null && <span>Comment lane: Ln {selectedLine}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
};
