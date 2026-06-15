import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { tokenize, getTokenClass, escapeHtml } from "@/lib/syntax";
import { cn } from "@/lib/utils";

export interface TextEditorHandle {
  scrollToLine: (lineNumber: number) => void;
  focus: () => void;
  getTextarea: () => HTMLTextAreaElement | null;
}

interface TextEditorProps {
  content: string;
  language: string;
  searchMatches: { start: number; end: number }[];
  currentMatchIndex: number;
  activePresence: { userId: string; cursorLine?: number; cursorCol?: number; color: string; displayName: string }[];
  selectedLine: number | null;
  onChange: (value: string) => void;
  onCursorChange: (line: number, col: number) => void;
  externalTextareaRef?: React.RefObject<HTMLTextAreaElement>;
}

const LINE_HEIGHT = 24;

export const TextEditor = forwardRef<TextEditorHandle, TextEditorProps>(
  ({ content, language, searchMatches, currentMatchIndex, activePresence, selectedLine, onChange, onCursorChange, externalTextareaRef }, ref) => {
    const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = externalTextareaRef || internalTextareaRef;
    const preRef = useRef<HTMLPreElement>(null);
    const [highlightedHtml, setHighlightedHtml] = useState("");
    const highlightTimerRef = useRef<number | null>(null);
    const contentRef = useRef(content);
    const isUpdatingFromPropsRef = useRef(false);

    useImperativeHandle(ref, () => ({
      scrollToLine: (lineNumber: number) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const targetTop = (lineNumber - 3) * LINE_HEIGHT;
        ta.scrollTop = Math.max(0, targetTop);
      },
      focus: () => textareaRef.current?.focus(),
      getTextarea: () => textareaRef.current,
    }));

    const buildHighlightedHtml = useCallback(
      (text: string, lang: string, matches: { start: number; end: number }[], matchIdx: number) => {
        const tokenizedLines = tokenize(text, lang);
        const getMatchHighlight = (charIndex: number): "current" | "match" | null => {
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            if (charIndex >= match.start && charIndex < match.end)
              return i === matchIdx ? "current" : "match";
          }
          return null;
        };

        let charIndex = 0;
        return tokenizedLines
          .map((lineTokens, lineIndex) => {
            const tokensHtml = lineTokens
              .map((token) => {
                const tokenStart = charIndex;
                const chars = token.value.split("");
                const hasHighlight = chars.some((_, idx) => getMatchHighlight(tokenStart + idx));
                charIndex += token.value.length;

                if (!hasHighlight) {
                  return `<span class="${getTokenClass(token.type)}">${escapeHtml(token.value)}</span>`;
                }

                const highlighted = chars
                  .map((char, idx) => {
                    const highlight = getMatchHighlight(tokenStart + idx);
                    if (!highlight) return escapeHtml(char);
                    const cls =
                      highlight === "current"
                        ? "bg-yellow-400 text-black"
                        : "bg-yellow-200/50 text-inherit";
                    return `<span class="${cls}">${escapeHtml(char)}</span>`;
                  })
                  .join("");

                return `<span class="${getTokenClass(token.type)}">${highlighted}</span>`;
              })
              .join("");

            charIndex += 1;
            return `<div class="code-line" data-line="${lineIndex + 1}">${tokensHtml.length === 0 ? "\n" : tokensHtml}</div>`;
          })
          .join("");
      },
      [],
    );

    useEffect(() => {
      contentRef.current = content;
    }, [content]);

    useEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      if (isUpdatingFromPropsRef.current) return;
      if (ta.value !== content) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = content;
        ta.selectionStart = start;
        ta.selectionEnd = end;
      }
    }, [content]);

    useEffect(() => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedHtml(buildHighlightedHtml(content, language, searchMatches, currentMatchIndex));
      }, 50);
      return () => {
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      };
    }, [content, language, searchMatches, currentMatchIndex, buildHighlightedHtml]);

    useEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      if (!highlightedHtml) {
        setHighlightedHtml(buildHighlightedHtml(content, language, searchMatches, currentMatchIndex));
      }
    }, []);

    const syncScroll = useCallback(() => {
      const ta = textareaRef.current;
      const pre = preRef.current;
      if (ta && pre) {
        pre.scrollTop = ta.scrollTop;
        pre.scrollLeft = ta.scrollLeft;
      }
    }, []);

    const handleWheel = useCallback(
      (e: React.WheelEvent<HTMLDivElement>) => {
        const ta = textareaRef.current;
        if (!ta) return;

        e.preventDefault();
        ta.scrollTop += e.deltaY;
        ta.scrollLeft += e.deltaX;
        syncScroll();
      },
      [syncScroll],
    );

    const handleInput = useCallback(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const newValue = ta.value;
      contentRef.current = newValue;
      onChange(newValue);
    }, [onChange]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const ta = textareaRef.current;
          if (!ta) return;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          ta.setRangeText("  ", start, end, "end");
          handleInput();
        }
      },
      [handleInput],
    );

    const handleSelectionChange = useCallback(() => {
      const ta = textareaRef.current;
      if (!ta || document.activeElement !== ta) return;
      const pos = getCursorFromOffset(ta.value, ta.selectionStart);
      onCursorChange(pos.line, pos.col);
    }, [onCursorChange]);

    useEffect(() => {
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [handleSelectionChange]);

    const getCursorFromOffset = (text: string, offset: number) => {
      const before = text.substring(0, offset);
      const lines = before.split("\n");
      return { line: lines.length, col: lines[lines.length - 1].length + 1 };
    };

    return (
      <div className="relative flex-1 min-h-0 overflow-hidden" onWheel={handleWheel}>
        {selectedLine !== null && (
          <div
            className="pointer-events-none absolute inset-x-0 z-0"
            style={{ top: `${(selectedLine - 1) * LINE_HEIGHT}px` }}
          >
            <div className="h-6 bg-primary/5" />
          </div>
        )}

        <pre
          ref={preRef}
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none font-mono text-sm leading-6 whitespace-pre pl-[6px] pt-[2px] pr-4"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />

        <textarea
          ref={textareaRef}
          className={cn(
            "absolute inset-0 z-10 w-full h-full resize-none outline-none",
            "font-mono text-sm leading-6 whitespace-pre pl-[6px] pt-[2px] pr-4",
            "caret-foreground",
            "code-editor-textarea",
          )}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          defaultValue={content}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          onFocus={syncScroll}
        />

        <div className="pointer-events-none absolute inset-0 z-20 font-mono text-sm leading-6">
          {activePresence
            .filter((entry) => entry.cursorLine)
            .slice(0, 8)
            .map((entry) => {
              const line = entry.cursorLine || 1;
              const col = Math.max(1, entry.cursorCol || 1);
              const top = (line - 1) * LINE_HEIGHT + 2;
              const left = `calc(6px + ${col - 1}ch)`;
              return (
                <div
                  key={`caret-${entry.userId}`}
                  className="absolute transition-all duration-100 ease-out"
                  style={{ top: `${top}px`, left }}
                >
                  <div
                    className="h-6 w-[2px] rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <div
                    className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-sm rounded-bl-none px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white shadow-sm"
                    style={{ backgroundColor: entry.color }}
                  >
                    {entry.displayName}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  },
);

TextEditor.displayName = "TextEditor";
