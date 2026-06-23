import type { LspConfig } from "./types";

type TransportType = "worker" | "replit" | "offline";

interface LspEntry {
  languageId: string;
  fileExtensions: string[];
  transport: TransportType;
  serverId: string;
}

const LSP_REGISTRY: Record<string, LspEntry> = {
  ".ts":    { languageId: "typescript", fileExtensions: [".ts", ".mts", ".cts"], transport: "worker", serverId: "typescript" },
  ".tsx":   { languageId: "typescriptreact", fileExtensions: [".tsx"], transport: "worker", serverId: "typescript" },
  ".js":    { languageId: "javascript", fileExtensions: [".js", ".mjs", ".cjs"], transport: "worker", serverId: "typescript" },
  ".jsx":   { languageId: "javascriptreact", fileExtensions: [".jsx"], transport: "worker", serverId: "typescript" },
  ".py":    { languageId: "python", fileExtensions: [".py"], transport: "replit", serverId: "pyright" },
  ".css":   { languageId: "css", fileExtensions: [".css", ".scss", ".less"], transport: "replit", serverId: "css" },
  ".html":  { languageId: "html", fileExtensions: [".html", ".htm"], transport: "replit", serverId: "html" },
  ".json":  { languageId: "json", fileExtensions: [".json", ".jsonc"], transport: "replit", serverId: "json" },
  ".md":    { languageId: "markdown", fileExtensions: [".md", ".mdx"], transport: "replit", serverId: "markdown" },
  ".xml":   { languageId: "xml", fileExtensions: [".xml", ".xsl", ".xslt"], transport: "replit", serverId: "xml" },
  ".sql":   { languageId: "sql", fileExtensions: [".sql"], transport: "replit", serverId: "sql" },
  ".yaml":  { languageId: "yaml", fileExtensions: [".yaml", ".yml"], transport: "replit", serverId: "yaml" },
  ".toml":  { languageId: "toml", fileExtensions: [".toml"], transport: "replit", serverId: "toml" },
  ".sh":    { languageId: "shell", fileExtensions: [".sh", ".bash"], transport: "replit", serverId: "bash" },
  ".svg":   { languageId: "xml", fileExtensions: [".svg"], transport: "replit", serverId: "xml" },
};

export function getLspConfig(fileName: string): LspConfig | null {
  const ext = "." + fileName.split(".").pop()?.toLowerCase();
  const entry = LSP_REGISTRY[ext];
  if (!entry) return null;

  const transportIsWorker = entry.transport === "worker" && entry.serverId === "typescript";
  return {
    server: entry.serverId as LspConfig["server"],
    transport: transportIsWorker ? "worker" : navigator.onLine ? "replit" : "offline",
    languageId: entry.languageId,
    fileExtensions: entry.fileExtensions,
  };
}

export function getLspConfigForLanguage(language: string): LspConfig | null {
  for (const entry of Object.values(LSP_REGISTRY)) {
    if (entry.languageId === language) {
      const transportIsWorker = entry.transport === "worker" && entry.serverId === "typescript";
      return {
        server: entry.serverId as LspConfig["server"],
        transport: transportIsWorker ? "worker" : navigator.onLine ? "replit" : "offline",
        languageId: entry.languageId,
        fileExtensions: entry.fileExtensions,
      };
    }
  }
  return null;
}

export function hasLspSupport(fileName: string): boolean {
  return getLspConfig(fileName) !== null;
}
