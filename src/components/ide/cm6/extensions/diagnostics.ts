import { linter, type Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";

export interface LspCm6Diagnostic {
  from: number;
  to: number;
  severity: "error" | "warning" | "info";
  message: string;
  source?: string;
}

const currentDiagnostics: LspCm6Diagnostic[] = [];

export function updateLspDiagnostics(diags: LspCm6Diagnostic[]) {
  currentDiagnostics.length = 0;
  currentDiagnostics.push(...diags);
}

export function lspDiagnosticsLinter(): Extension {
  return linter((_view) => {
    return currentDiagnostics.map((d) => ({
      from: d.from,
      to: d.to,
      severity: d.severity,
      message: d.message,
      source: d.source,
    } as Diagnostic));
  });
}

export function getCurrentDiagnostics(): LspCm6Diagnostic[] {
  return [...currentDiagnostics];
}
