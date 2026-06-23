import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

export type LspCompletionFn = (line: number, col: number) => Promise<any[]>;

class LspCompletionSource {
  private fn: LspCompletionFn | null = null;

  setFn(fn: LspCompletionFn) {
    this.fn = fn;
  }

  get = async (context: CompletionContext): Promise<CompletionResult | null> => {
    if (!this.fn) return null;
    const word = context.matchBefore(/\w[\w\d]*$/);
    if (!word && !context.explicit) return null;
    const pos = context.pos;
    const line = context.state.doc.lineAt(pos);
    const col = pos - line.from + 1;
    const items = await this.fn(line.number, col);
    if (!items || items.length === 0) return null;
    return {
      from: word ? word.from : pos,
      options: items.map((item: any) => ({
        label: item.label,
        type: completionKind(item.kind),
        detail: item.detail,
        info: item.documentation,
        apply: item.insertText ?? item.label,
      })),
    };
  };
}

function completionKind(kind?: number): string {
  switch (kind) {
    case 1: return "text";
    case 2: return "method";
    case 3: return "function";
    case 4: return "constructor";
    case 5: return "field";
    case 6: return "variable";
    case 7: return "class";
    case 8: return "interface";
    case 9: return "module";
    case 10: return "property";
    case 11: return "unit";
    case 12: return "value";
    case 13: return "enum";
    case 14: return "keyword";
    case 15: return "snippet";
    case 16: return "color";
    case 17: return "file";
    case 18: return "reference";
    case 19: return "folder";
    case 20: return "enumMember";
    case 21: return "constant";
    case 22: return "struct";
    case 23: return "event";
    case 24: return "operator";
    case 25: return "typeParameter";
    default: return "text";
  }
}

export const lspCompletionSource = new LspCompletionSource();

export function lspCompletionExtension(): Extension {
  return autocompletion({ override: [lspCompletionSource.get] });
}
