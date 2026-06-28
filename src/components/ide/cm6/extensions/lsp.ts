import { autocompletion, type CompletionResult, type CompletionContext } from "@codemirror/autocomplete";
// diagnostics imported lazily
import { hoverTooltip, type Tooltip, EditorView } from "@codemirror/view";
import { type Extension } from "@codemirror/state";
import { type Diagnostic as LspDiagnostic } from "vscode-languageserver-protocol";
import { lspDiagnosticsLinter } from "./diagnostics";

export interface LspFeatureCallbacks {
  getCompletions: (line: number, col: number) => Promise<any[]>;
  getHover: (line: number, col: number) => Promise<{ contents: string } | null>;
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

function hoverContents(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

export function createLspExtensions(callbacks: LspFeatureCallbacks): Extension[] {
  const extensions: Extension[] = [];

  extensions.push(
    autocompletion({
      override: [
        async (context: CompletionContext): Promise<CompletionResult | null> => {
          const word = context.matchBefore(/\w[\w\d]*$/);
          if (!word && !context.explicit) return null;
          const pos = context.pos;
          const line = context.state.doc.lineAt(pos);
          const col = pos - line.from + 1;
          const items = await callbacks.getCompletions(line.number, col);
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
        },
      ],
    }),
  );

  extensions.push(lspDiagnosticsLinter());

  extensions.push(
    hoverTooltip(
      async (view: EditorView, pos: number): Promise<Tooltip | null> => {
        const line = view.state.doc.lineAt(pos);
        const col = pos - line.from + 1;
        const info = await callbacks.getHover(line.number, col);
        if (!info) return null;
        return {
          pos,
          end: pos,
          above: true,
          create() {
            const dom = document.createElement("div");
            dom.className = "cm-tooltip-hover";
            dom.style.cssText = "max-width:500px;padding:8px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;";
            dom.innerHTML = hoverContents(info.contents);
            return { dom };
          },
        };
      },
      { hoverTime: 300 },
    ),
  );

  return extensions;
}

function lineColToOffset(view: EditorView, line: number, col: number): number {
  if (line < 1 || line > view.state.doc.lines) return 0;
  const lineStart = view.state.doc.line(line).from;
  return lineStart + Math.max(0, col - 1);
}

export function convertLspDiagnostics(diags: LspDiagnostic[], view: EditorView): LspCm6Diagnostic[] {
  return diags.map((d) => ({
    from: lineColToOffset(view, d.range.start.line + 1, d.range.start.character + 1),
    to: lineColToOffset(view, d.range.end.line + 1, d.range.end.character + 1),
    severity: d.severity === 1 ? "error" as const : d.severity === 2 ? "warning" as const : "info" as const,
    message: typeof d.message === "string" ? d.message : (d.message as any)?.value ?? "",
    source: d.source ?? "lsp",
  }));
}

type LspCm6Diagnostic = import("./diagnostics").LspCm6Diagnostic;
export { updateLspDiagnostics } from "./diagnostics";
