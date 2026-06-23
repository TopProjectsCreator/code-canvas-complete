import type { Diagnostic } from "vscode-languageserver-protocol";

export { Diagnostic };

export interface LspServerCapabilities {
  completion?: boolean;
  hover?: boolean;
  definition?: boolean;
  references?: boolean;
  signatureHelp?: boolean;
  formatting?: boolean;
  codeAction?: boolean;
  diagnostics?: boolean;
}

export interface LspServerInfo {
  name: string;
  version?: string;
  language: string;
  fileExtensions: string[];
  capabilities: LspServerCapabilities;
}

export interface LspConfig {
  server: "typescript" | "python" | "css" | "html" | "json" | "replit";
  transport: "worker" | "replit" | "offline";
  languageId: string;
  fileExtensions: string[];
}

export interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export interface HoverInfo {
  contents: string;
  range?: { startLine: number; startCol: number; endLine: number; endCol: number };
}

export interface LocationInfo {
  uri: string;
  line: number;
  col: number;
}

export interface SignatureHelpInfo {
  label: string;
  documentation?: string;
  parameters: { label: string; documentation?: string }[];
  activeParameter?: number;
}

export interface TextEdit {
  range: { startLine: number; startCol: number; endLine: number; endCol: number };
  newText: string;
}

export interface CodeActionItem {
  title: string;
  kind?: string;
  diagnostics?: Diagnostic[];
  edit?: { changes: Record<string, TextEdit[]> };
  command?: { title: string; command: string; arguments?: unknown[] };
}

export type LspServerStatus = "disconnected" | "connecting" | "connected" | "error";

export interface LspDiagnosticContext {
  uri: string;
  diagnostics: Diagnostic[];
}

export interface LspEventMap {
  diagnostics: LspDiagnosticContext;
  status: LspServerStatus;
  error: string;
}
