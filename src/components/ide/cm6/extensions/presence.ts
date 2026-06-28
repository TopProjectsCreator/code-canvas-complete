import {
  StateField,
  StateEffect,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";

export interface PresenceEntry {
  userId: string;
  cursorLine?: number;
  cursorCol?: number;
  color: string;
  displayName: string;
}

const setPresence = StateEffect.define<PresenceEntry[]>();

const presenceField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setPresence)) {
        const decorations: any[] = [];
        const entries = effect.value as PresenceEntry[];
        for (const entry of entries) {
          if (!entry.cursorLine) continue;
          const line = entry.cursorLine;
          const col = Math.max(1, entry.cursorCol || 1);
          const pos = findPos(tr.state.doc, line, col);
          if (pos === undefined) continue;

          const caret = Decoration.widget({
            widget: new PresenceCaretWidget(entry.color, entry.displayName),
            side: 1,
          });
          decorations.push(caret.range(pos));
        }
        return Decoration.set(decorations);
      }
    }
    return deco.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function findPos(doc: any, line: number, col: number): number | undefined {
  if (line > doc.lines) return undefined;
  const lineStart = doc.line(line)?.from;
  if (lineStart === undefined) return undefined;
  return Math.min(lineStart + col - 1, doc.line(line).to);
}

class PresenceCaretWidget extends WidgetType {
  constructor(
    private color: string,
    private name: string,
  ) {
    super();
  }

  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "relative inline-block";
    wrapper.style.setProperty("--presence-color", this.color);

    const caret = document.createElement("div");
    caret.className = "h-6 w-[2px] rounded-sm";
    caret.style.backgroundColor = this.color;

    const label = document.createElement("div");
    label.className =
      "absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-sm rounded-bl-none px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white shadow-sm pointer-events-none";
    label.style.backgroundColor = this.color;
    label.textContent = this.name;

    wrapper.appendChild(caret);
    wrapper.appendChild(label);
    return wrapper;
  }

  ignoreEvent() {
    return true;
  }
}

export function updatePresenceDecorations(
  view: EditorView,
  entries: PresenceEntry[],
) {
  view.dispatch({ effects: setPresence.of(entries) });
}

export const presenceExtension: Extension = [presenceField];
