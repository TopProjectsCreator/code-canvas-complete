import { getRegistryEntry } from "./registry";
import type { UINode } from "./types";

export function generateCode(nodes: UINode[]): string {
  if (!nodes || nodes.length === 0) {
    return `export function MyComponent() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Drag components from the palette to get started */}
    </div>
  );
}
`;
  }

  const imports = collectImports(nodes);
  const jsx = generateJSX(nodes, 0);

  const importBlock = imports.length > 0
    ? imports.map((imp) => {
        if (imp.path === "") return null;
        return `import { ${imp.names.join(", ")} } from "${imp.path}";`;
      }).filter(Boolean).join("\n")
    : "";

  return `${importBlock}${importBlock ? "\n\n" : ""}export function MyComponent() {
  return (
${jsx}
  );
}
`;
}

interface ImportGroup {
  path: string;
  names: string[];
}

function collectImports(nodes: UINode[]): ImportGroup[] {
  const map = new Map<string, Set<string>>();

  function walk(list: UINode[]) {
    for (const node of list) {
      const config = getRegistryEntry(node.componentType);
      if (config && config.importPath) {
        if (!map.has(config.importPath)) {
          map.set(config.importPath, new Set());
        }
        map.get(config.importPath)!.add(config.importName);
      }
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  }

  walk(nodes);

  return Array.from(map.entries()).map(([path, names]) => ({
    path,
    names: Array.from(names),
  }));
}

function generateJSX(nodes: UINode[], depth: number): string {
  const indent = "  ".repeat(depth + 2);

  return nodes
    .map((node) => {
      const config = getRegistryEntry(node.componentType);
      const tagName = getTagName(node, config);
      const propsStr = formatProps(node.props, config);

      const hasChildren = node.children.length > 0;

      if (config?.isVoid && !hasChildren) {
        return `${indent}<${tagName}${propsStr} />`;
      }

      const innerContent = hasChildren
        ? `\n${generateJSX(node.children, depth + 1)}\n${indent}`
        : node.props.children || config?.textContent || "";

      return `${indent}<${tagName}${propsStr}>${innerContent}</${tagName}>`;
    })
    .join("\n");
}

function getTagName(node: UINode, config: any): string {
  if (node.componentType === "html/div") return "div";
  if (config) return config.importName;
  return "div";
}

function formatProps(props: Record<string, any>, _config: any): string {
  const skipProps = new Set(["children"]);
  const parts: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (skipProps.has(key)) continue;
    if (value === undefined || value === null) continue;

    if (key === "className" && value) {
      parts.push(`className="${String(value)}"`);
    } else if (typeof value === "boolean") {
      if (value) parts.push(key);
    } else if (typeof value === "number") {
      parts.push(`${key}={${value}}`);
    } else if (typeof value === "string") {
      if (key === "variant" || key === "size" || key === "type" || key === "placeholder") {
        parts.push(`${key}="${value}"`);
      } else {
        parts.push(`${key}={${JSON.stringify(value)}}`);
      }
    } else if (Array.isArray(value)) {
      parts.push(`${key}={${JSON.stringify(value)}}`);
    } else {
      parts.push(`${key}={${JSON.stringify(value)}}`);
    }
  }

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}
