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

export const CodeEditor = ({ file, onContentChange }: CodeEditorProps) => {
  const [content, setContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ line: 0, col: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [searchMatches, setSearchMatches] = useState<{ start: number; end: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

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
    
    // Scroll to current match
    if (currentIndex >= 0 && matches[currentIndex] && textareaRef.current) {
      const match = matches[currentIndex];
      const textBeforeMatch = content.substring(0, match.start);
      const lineNumber = textBeforeMatch.split('\n').length;
      const lineHeight = 24; // leading-6 = 1.5rem = 24px
      textareaRef.current.scrollTop = (lineNumber - 3) * lineHeight;
    }
  }, [content]);

  const handleReplace = useCallback((newContent: string) => {
    setContent(newContent);
    if (file) {
      onContentChange(file.id, newContent);
    }
  }, [file, onContentChange]);

  useEffect(() => {
    if (file?.content !== undefined) {
      setContent(file.content);
    }
  }, [file?.id, file?.content]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    if (file) {
      onContentChange(file.id, newContent);
    }
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const value = textarea.value;
    const selectionStart = textarea.selectionStart;
    
    const lines = value.substring(0, selectionStart).split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    
    setCursorPosition({ line, col });
  };

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
  if (previewType) {
    return <FilePreview file={file} previewType={previewType} />;
  }

  const tokenizedLines = tokenize(content, file.language || 'text');

  // Build a set of character positions that are part of matches for highlighting
  const getMatchHighlight = (charIndex: number): 'current' | 'match' | null => {
    for (let i = 0; i < searchMatches.length; i++) {
      const match = searchMatches[i];
      if (charIndex >= match.start && charIndex < match.end) {
        return i === currentMatchIndex ? 'current' : 'match';
      }
    }
    return null;
  };

  // Convert content to character-based rendering with match highlighting
  const renderHighlightedContent = () => {
    let charIndex = 0;
    
    return tokenizedLines.map((lineTokens, lineIndex) => {
      const lineStartIndex = charIndex;
      
      const renderedTokens = lineTokens.map((token, tokenIndex) => {
        const tokenChars = token.value.split('').map((char, i) => {
          const currentCharIndex = charIndex + i;
          const highlight = getMatchHighlight(currentCharIndex);
          
          if (highlight) {
            return (
              <span 
                key={`${tokenIndex}-${i}`}
                className={highlight === 'current' 
                  ? 'bg-yellow-400 text-black' 
                  : 'bg-yellow-200/50 text-inherit'}
              >
                {char}
              </span>
            );
          }
          return char;
        });
        
        charIndex += token.value.length;
        
        // If no highlights in this token, render normally
        const hasHighlight = tokenChars.some(c => typeof c !== 'string');
        if (!hasHighlight) {
          return (
            <span key={tokenIndex} className={getTokenClass(token.type)}>
              {token.value}
            </span>
          );
        }
        
        return (
          <span key={tokenIndex} className={getTokenClass(token.type)}>
            {tokenChars}
          </span>
        );
      });
      
      charIndex++; // Account for newline character
      
      return (
        <div key={lineIndex} className="code-line">
          <span className="code-line-number">{lineIndex + 1}</span>
          {renderedTokens.length === 0 ? <span>&nbsp;</span> : renderedTokens}
        </div>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-editor overflow-hidden">
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
        {/* Syntax highlighted display */}
        <div 
          ref={highlightRef}
          className="absolute inset-0 font-mono text-sm leading-6 pointer-events-none z-0 overflow-hidden pt-[2px] pl-12 pr-4"
        >
          {renderHighlightedContent()}
        </div>
        
        {/* Editable textarea overlay */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onSelect={handleSelect}
          onScroll={handleScroll}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="absolute inset-0 w-full h-full font-mono text-sm leading-6 bg-transparent text-transparent caret-foreground resize-none outline-none p-0 pl-12 pr-4 pt-[2px] z-10 overflow-auto ide-scrollbar"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
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
