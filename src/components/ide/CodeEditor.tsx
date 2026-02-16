import { useState, useEffect, useRef, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import { FindReplace } from './FindReplace';
import { FilePreview } from './FilePreview';

interface CodeEditorProps {
  file: FileNode | null;
  onContentChange: (fileId: string, content: string) => void;
}

// Helper to detect file types that should be previewed instead of edited
const getPreviewType = (fileName: string): 'image' | 'markdown' | 'svg' | 'video' | 'audio' | 'csv' | null => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'];
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv'];
  const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
  
  if (ext === 'svg') return 'svg';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'csv') return 'csv';
  if (imageExtensions.includes(ext || '')) return 'image';
  if (videoExtensions.includes(ext || '')) return 'video';
  if (audioExtensions.includes(ext || '')) return 'audio';
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
      
      // Comments
      if (remaining.startsWith('//') || remaining.startsWith('/*')) {
        tokens.push({ type: 'comment', value: remaining });
        break;
      }
      
      // HTML comments
      if (remaining.startsWith('<!--')) {
        tokens.push({ type: 'comment', value: remaining });
        break;
      }
      
      // Strings
      const stringMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
      if (stringMatch) {
        tokens.push({ type: 'string', value: stringMatch[0] });
        remaining = remaining.slice(stringMatch[0].length);
        matched = true;
        continue;
      }
      
      // HTML tags
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
      
      // CSS properties and selectors
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
      
      // Numbers
      const numMatch = remaining.match(/^-?\d+\.?\d*(px|em|rem|%|vh|vw|deg|s|ms)?/);
      if (numMatch) {
        tokens.push({ type: 'number', value: numMatch[0] });
        remaining = remaining.slice(numMatch[0].length);
        matched = true;
        continue;
      }
      
      // Keywords
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
      
      // Operators
      const opMatch = remaining.match(/^[=+\-*/<>!&|:;.,{}()\[\]]+/);
      if (opMatch) {
        tokens.push({ type: 'operator', value: opMatch[0] });
        remaining = remaining.slice(opMatch[0].length);
        matched = true;
        continue;
      }
      
      // Whitespace and other
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

// Save and restore cursor position in a contentEditable div
const saveCursorPosition = (el: HTMLElement): number => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
};

const restoreCursorPosition = (el: HTMLElement, offset: number) => {
  const sel = window.getSelection();
  if (!sel) return;
  
  let currentOffset = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;
  
  while ((node = walker.nextNode() as Text | null)) {
    const nodeLen = node.textContent?.length || 0;
    if (currentOffset + nodeLen >= offset) {
      const range = document.createRange();
      range.setStart(node, offset - currentOffset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    currentOffset += nodeLen;
  }
  
  // If offset exceeds content, place at end
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
};

// Get line/col from character offset
const getLineCol = (text: string, offset: number): { line: number; col: number } => {
  const before = text.substring(0, offset);
  const lines = before.split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
};

export const CodeEditor = ({ file, onContentChange }: CodeEditorProps) => {
  const [content, setContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ line: 0, col: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [searchMatches, setSearchMatches] = useState<{ start: number; end: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const isComposingRef = useRef(false);
  const contentRef = useRef(content);
  const [markdownPreview, setMarkdownPreview] = useState(true); // toggle for previewable text files

  // Sync contentRef
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      
      if (modifier && e.key === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
      } else if (modifier && e.key === 'h') {
        e.preventDefault();
        setShowFindReplace(true);
      } else if (e.key === 'Escape' && showFindReplace) {
        setShowFindReplace(false);
        setSearchMatches([]);
        setCurrentMatchIndex(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFindReplace]);

  const handleHighlightChange = useCallback((matches: { start: number; end: number }[], currentIndex: number) => {
    setSearchMatches(matches);
    setCurrentMatchIndex(currentIndex);
    
    if (currentIndex >= 0 && matches[currentIndex] && editorRef.current) {
      const match = matches[currentIndex];
      const textBeforeMatch = content.substring(0, match.start);
      const lineNumber = textBeforeMatch.split('\n').length;
      const lineHeight = 24;
      editorRef.current.scrollTop = (lineNumber - 3) * lineHeight;
    }
  }, [content]);

  const handleReplace = useCallback((newContent: string) => {
    setContent(newContent);
    if (file) {
      onContentChange(file.id, newContent);
    }
  }, [file, onContentChange]);

  // Sync content from file prop
  useEffect(() => {
    if (file?.content !== undefined) {
      setContent(file.content);
    }
  }, [file?.id, file?.content]);

  // Handle input from contentEditable
  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    const el = editorRef.current;
    if (!el) return;
    
    // Read the plain text from the contentEditable div
    // innerText preserves line breaks from <div>/<br> elements
    const newContent = el.innerText;
    
    // Remove trailing newline that browsers sometimes add
    const cleaned = newContent.endsWith('\n') ? newContent.slice(0, -1) : newContent;
    
    setContent(cleaned);
    if (file) {
      onContentChange(file.id, cleaned);
    }
  }, [file, onContentChange]);

  // Handle keydown for Tab, Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  }, []);

  // Handle paste - normalize to plain text
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Track cursor position
  const handleSelectionChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const offset = saveCursorPosition(el);
    const pos = getLineCol(contentRef.current, offset);
    setCursorPosition(pos);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // After React re-renders the syntax-highlighted content, restore cursor
  const cursorOffsetRef = useRef<number | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (cursorOffsetRef.current !== null) {
      restoreCursorPosition(el, cursorOffsetRef.current);
      cursorOffsetRef.current = null;
    }
  });

  // Before re-render, save cursor
  const saveCursorBeforeRender = () => {
    const el = editorRef.current;
    if (el && document.activeElement === el) {
      cursorOffsetRef.current = saveCursorPosition(el);
    }
  };

  // Call save before every render that changes content
  // We use a ref to track prev content so we know when it actually changed
  const prevContentRef = useRef(content);
  if (content !== prevContentRef.current) {
    saveCursorBeforeRender();
    prevContentRef.current = content;
  }

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-editor text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">No file selected</p>
          <p className="text-sm">Select a file from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  // Check if this file should be previewed instead of edited
  const previewType = getPreviewType(file.name);
  // Binary types always show preview only (no editable source)
  const binaryPreviewTypes = ['image', 'video', 'audio'];
  const isTextPreviewable = previewType && !binaryPreviewTypes.includes(previewType);
  
  if (previewType && !isTextPreviewable) {
    return <FilePreview file={file} previewType={previewType} />;
  }
  if (isTextPreviewable && markdownPreview) {
    return (
      <div className="flex-1 flex flex-col bg-editor overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-1.5 bg-background border-b border-border">
          <button
            onClick={() => setMarkdownPreview(false)}
            className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Edit
          </button>
          <span className="text-xs font-medium text-foreground">Preview</span>
        </div>
        <FilePreview file={{ ...file, content }} previewType={previewType} />
      </div>
    );
  }

  const tokenizedLines = tokenize(content, file.language || 'text');

  // Build match highlighting
  const getMatchHighlight = (charIndex: number): 'current' | 'match' | null => {
    for (let i = 0; i < searchMatches.length; i++) {
      const match = searchMatches[i];
      if (charIndex >= match.start && charIndex < match.end) {
        return i === currentMatchIndex ? 'current' : 'match';
      }
    }
    return null;
  };

  const escapeHtml = (str: string): string => {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  const buildHighlightedHtml = (): string => {
    let charIndex = 0;
    
    return tokenizedLines.map((lineTokens, lineIndex) => {
      const tokensHtml = lineTokens.map((token) => {
        const tokenStart = charIndex;
        const chars = token.value.split('');
        let hasHighlight = false;
        
        // Check if any char in this token has a highlight
        for (let i = 0; i < chars.length; i++) {
          if (getMatchHighlight(tokenStart + i)) {
            hasHighlight = true;
            break;
          }
        }
        
        charIndex += token.value.length;
        
        if (!hasHighlight) {
          return `<span class="${getTokenClass(token.type)}">${escapeHtml(token.value)}</span>`;
        }
        
        // Render char by char for highlighted tokens
        const charHtml = chars.map((char, i) => {
          const highlight = getMatchHighlight(tokenStart + i);
          if (highlight) {
            const cls = highlight === 'current' ? 'bg-yellow-400 text-black' : 'bg-yellow-200/50 text-inherit';
            return `<span class="${cls}">${escapeHtml(char)}</span>`;
          }
          return escapeHtml(char);
        }).join('');
        
        return `<span class="${getTokenClass(token.type)}">${charHtml}</span>`;
      }).join('');
      
      charIndex++; // newline
      
      const lineContent = tokensHtml.length === 0 ? '<span>\n</span>' : tokensHtml;
      return `<div class="code-line"><span class="code-line-number">${lineIndex + 1}</span>${lineContent}</div>`;
    }).join('');
  };

  return (
    <div className="flex-1 flex flex-col bg-editor overflow-hidden">
      {isTextPreviewable && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-background border-b border-border">
          <span className="text-xs font-medium text-foreground">Edit</span>
          <button
            onClick={() => setMarkdownPreview(true)}
            className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Preview
          </button>
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
      
      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { 
            isComposingRef.current = false; 
            handleInput(); 
          }}
          className="absolute inset-0 font-mono text-sm leading-6 overflow-auto ide-scrollbar outline-none pt-[2px] caret-foreground"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          dangerouslySetInnerHTML={{ __html: buildHighlightedHtml() }}
        />
      </div>
      
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-background border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{file.language || 'Plain Text'}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
};
