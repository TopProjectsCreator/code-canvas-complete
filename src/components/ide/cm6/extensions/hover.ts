import { hoverTooltip, type Tooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export type LspHoverFn = (line: number, col: number) => Promise<{ contents: string } | null>;

class LspHoverSource {
  private fn: LspHoverFn | null = null;

  setFn(fn: LspHoverFn) {
    this.fn = fn;
  }

  get = (view: any, pos: number, side: number): Tooltip | null => {
    return null;
  };
}

const lspHoverSource = new LspHoverSource();

export function setHoverFn(fn: LspHoverFn) {
  lspHoverSource.setFn(fn);
}

export function lspHoverExtension(): Extension {
  return hoverTooltip((view, pos, side) => {
    return null;
  });
}

export async function getHoverTooltip(
  view: any,
  pos: number,
  hoverFn: LspHoverFn | null,
): Promise<Tooltip | null> {
  if (!hoverFn) return null;
  const line = view.state.doc.lineAt(pos);
  const col = pos - line.from + 1;
  const info = await hoverFn(line.number, col);
  if (!info) return null;
  return {
    pos,
    end: pos,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-tooltip cm-tooltip-hover";
      dom.style.maxWidth = "500px";
      dom.style.padding = "8px 12px";
      dom.style.fontSize = "13px";
      dom.style.lineHeight = "1.5";
      dom.style.whiteSpace = "pre-wrap";
      dom.style.wordBreak = "break-word";
      dom.innerHTML = renderMarkdown(info.contents);
      return { dom };
    },
  };
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}
