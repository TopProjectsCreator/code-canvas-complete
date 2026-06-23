import type { Diagnostic } from "vscode-languageserver-protocol";

export interface LspDiagnosticContext {
  uri: string;
  diagnostics: Diagnostic[];
}

let activeDiagnostics: LspDiagnosticContext[] = [];
let agentContextCallback: ((context: string) => void) | null = null;

export function setAgentContextCallback(callback: (context: string) => void) {
  agentContextCallback = callback;
}

export function updateDiagnosticContext(ctx: LspDiagnosticContext) {
  const existing = activeDiagnostics.findIndex((d) => d.uri === ctx.uri);
  if (existing >= 0) {
    activeDiagnostics[existing] = ctx;
  } else {
    activeDiagnostics.push(ctx);
  }

  if (agentContextCallback) {
    agentContextCallback(formatDiagnosticsForAgent());
  }
}

export function clearDiagnosticContext(uri?: string) {
  if (uri) {
    activeDiagnostics = activeDiagnostics.filter((d) => d.uri !== uri);
  } else {
    activeDiagnostics = [];
  }
}

export function getDiagnosticContext(): LspDiagnosticContext[] {
  return activeDiagnostics;
}

export function formatDiagnosticsForAgent(): string {
  const parts: string[] = [];
  for (const ctx of activeDiagnostics) {
    const errors = ctx.diagnostics.filter((d) => d.severity === 1);
    const warnings = ctx.diagnostics.filter((d) => d.severity === 2);

    if (errors.length === 0 && warnings.length === 0) continue;

    const fileName = ctx.uri.replace("file://", "");
    parts.push(`### ${fileName}`);

    if (errors.length > 0) {
      parts.push(`**${errors.length} error(s):**`);
      for (const err of errors.slice(0, 10)) {
        const line = err.range.start.line + 1;
        const col = err.range.start.character + 1;
        parts.push(`- Ln ${line}:${col} — ${err.message}`);
      }
      if (errors.length > 10) {
        parts.push(`- ... and ${errors.length - 10} more errors`);
      }
    }

    if (warnings.length > 0) {
      parts.push(`**${warnings.length} warning(s):**`);
      for (const warn of warnings.slice(0, 5)) {
        const line = warn.range.start.line + 1;
        const col = warn.range.start.character + 1;
        parts.push(`- Ln ${line}:${col} — ${warn.message}`);
      }
      if (warnings.length > 5) {
        parts.push(`- ... and ${warnings.length - 5} more warnings`);
      }
    }

    parts.push("");
  }

  if (parts.length === 0) return "";

  return [
    "## LSP Diagnostics",
    "",
    "The following code issues were detected by the language server:",
    "",
    ...parts,
  ].join("\n");
}
