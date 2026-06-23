import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
  useMemo,
} from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars } from "@codemirror/view";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, foldGutter, foldKeymap } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";
import { getLanguageExtension } from "./cm6/languageSupport";
import { cm6Theme } from "./cm6/theme";
import { presenceExtension, updatePresenceDecorations, type PresenceEntry } from "./cm6/extensions/presence";

export interface Cm6EditorHandle {
  scrollToLine: (lineNumber: number) => void;
  focus: () => void;
  getEditorView: () => EditorView | null;
}

interface Cm6EditorProps {
  content: string;
  language: string;
  fileName: string;
  searchMatches: { start: number; end: number }[];
  currentMatchIndex: number;
  activePresence: PresenceEntry[];
  selectedLine: number | null;
  onChange: (value: string) => void;
  onCursorChange: (line: number, col: number) => void;
  extensions?: Extension[];
}

const LINE_HEIGHT = 24;
const languageCompartment = new Compartment();
const customExtensionsCompartment = new Compartment();

const baseExtensions: Extension[] = [
  lineNumbers(),
  highlightActiveLine(),
  highlightSpecialChars(),
  foldGutter(),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  highlightSelectionMatches(),
  ...cm6Theme,
  presenceExtension,
  oneDark,
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...lintKeymap,
    ...completionKeymap,
    indentWithTab,
  ]),
];

export const Cm6Editor = forwardRef<Cm6EditorHandle, Cm6EditorProps>(
  (
    {
      content,
      language,
      fileName,
      searchMatches: _searchMatches,
      currentMatchIndex: _currentMatchIndex,
      activePresence,
      selectedLine: _selectedLine,
      onChange,
      onCursorChange,
      extensions: customExtensions,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onCursorChangeRef = useRef(onCursorChange);
    const [isReady, setIsReady] = useState(false);

    onChangeRef.current = onChange;
    onCursorChangeRef.current = onCursorChange;

    const languageExtensions = useMemo(
      () => getLanguageExtension(fileName, language),
      [fileName, language],
    );

    useEffect(() => {
      if (!containerRef.current || viewRef.current) return;

      const state = EditorState.create({
        doc: content,
        extensions: [
          ...baseExtensions,
          languageCompartment.of(languageExtensions),
          customExtensionsCompartment.of(customExtensions ?? []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
            const sel = update.state.selection.main;
            if (sel.from !== sel.to) return;
            const line = update.state.doc.lineAt(sel.from);
            const col = sel.from - line.from + 1;
            onCursorChangeRef.current(line.number, col);
          }),
          EditorView.domEventHandlers({
            focus: () => {
              const sel = viewRef.current?.state.selection.main;
              if (sel && sel.from === sel.to) {
                const line = viewRef.current!.state.doc.lineAt(sel.from);
                onCursorChangeRef.current(line.number, sel.from - line.from + 1);
              }
              return false;
            },
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;
      setIsReady(true);

      return () => {
        view.destroy();
        viewRef.current = null;
        setIsReady(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: languageCompartment.reconfigure(languageExtensions),
      });
    }, [languageExtensions]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: customExtensionsCompartment.reconfigure(customExtensions ?? []),
      });
    }, [customExtensions]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const currentDoc = view.state.doc.toString();
      if (currentDoc !== content) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: content },
        });
      }
    }, [content]);

    useEffect(() => {
      if (!isReady) return;
      updatePresenceDecorations(viewRef.current!, activePresence);
    }, [activePresence, isReady]);

    useImperativeHandle(ref, () => ({
      scrollToLine: (lineNumber: number) => {
        const view = viewRef.current;
        if (!view) return;
        const line = view.state.doc.line(Math.max(1, Math.min(lineNumber, view.state.doc.lines)));
        view.dispatch({
          effects: EditorView.scrollIntoView(line.from, { y: "center" }),
        });
      },
      focus: () => viewRef.current?.focus(),
      getEditorView: () => viewRef.current,
    }));

    const handleWheel = useCallback((e: React.WheelEvent) => {
      const view = viewRef.current;
      if (!view) return;
      e.preventDefault();
      const cmScroller = containerRef.current?.querySelector(".cm-scroller");
      if (cmScroller) {
        cmScroller.scrollTop += e.deltaY;
        cmScroller.scrollLeft += e.deltaX;
      }
    }, []);

    return (
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden"
        onWheel={handleWheel}
        style={{ lineHeight: `${LINE_HEIGHT}px` }}
      />
    );
  },
);

Cm6Editor.displayName = "Cm6Editor";
