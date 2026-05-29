import { useBuilder } from "./useBuilderStore";

export function CodePreview() {
  const { getCode } = useBuilder();
  const code = getCode();

  const lines = code.split("\n");

  return (
    <div className="h-full w-full overflow-auto bg-[#1e1e2e] text-sm font-mono">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#313244] bg-[#181825] sticky top-0">
        <span className="text-xs text-[#6c7086] font-sans">Generated Code (TSX)</span>
        <button
          className="text-xs text-[#89b4fa] hover:text-[#b4d0fb] font-sans transition-colors"
          onClick={() => navigator.clipboard.writeText(code)}
        >
          Copy
        </button>
      </div>
      <div className="p-4">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-8 shrink-0 text-right text-[#585b70] select-none mr-4 text-xs leading-5">
              {i + 1}
            </span>
            <span className="whitespace-pre leading-5" style={{ color: getLineColor(line) }}>
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getLineColor(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("import ")) return "#89b4fa";
  if (trimmed.startsWith("export ")) return "#cba6f7";
  if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith(" *")) return "#6c7086";
  if (trimmed.startsWith("<") || trimmed.startsWith("</") || trimmed.startsWith("/>")) return "#cdd6f4";
  if (trimmed.includes("className=")) return "#f9e2af";
  if (trimmed.includes("={")) return "#fab387";
  if (trimmed.includes('="')) return "#a6e3a1";
  return "#cdd6f4";
}
