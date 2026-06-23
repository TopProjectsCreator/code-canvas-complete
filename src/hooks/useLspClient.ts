import { useEffect, useRef, useState, useCallback } from "react";
import { LspClient, type LspEventHandler } from "@/services/lsp/client";
import { getLspConfig, hasLspSupport } from "@/services/lsp/registry";
import type { LspServerStatus, Diagnostic, CompletionItem, HoverInfo, LocationInfo, SignatureHelpInfo, TextEdit, CodeActionItem } from "@/services/lsp/types";
import { updateDiagnosticContext, clearDiagnosticContext } from "@/services/lsp/aiBridge";

export interface LspState {
  connected: boolean;
  status: LspServerStatus;
  errorCount: number;
  warningCount: number;
  diagnostics: Diagnostic[];
  supported: boolean;
}

export function useLspClient(fileName: string | null, content: string) {
  const clientRef = useRef<LspClient | null>(null);
  const [state, setState] = useState<LspState>({
    connected: false,
    status: "disconnected",
    errorCount: 0,
    warningCount: 0,
    diagnostics: [],
    supported: false,
  });
  const diagnosticsRef = useRef<Diagnostic[]>([]);

  const supported = fileName ? hasLspSupport(fileName) : false;

  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    if (!fileName || !supported) {
      clientRef.current?.disconnect();
      clientRef.current = null;
      setState((s) => ({ ...s, connected: false, status: "disconnected", errorCount: 0, warningCount: 0, diagnostics: [], supported: false }));
      diagnosticsRef.current = [];
      return;
    }

    const config = getLspConfig(fileName);
    if (!config) return;

    const uri = `file:///${fileName}`;
    const client = new LspClient();
    clientRef.current = client;

    setState((s) => ({ ...s, supported: true }));

    const handler: LspEventHandler = {
      diagnostics: (ctx) => {
        diagnosticsRef.current = ctx.diagnostics;
        const errors = ctx.diagnostics.filter((d) => d.severity === 1).length;
        const warnings = ctx.diagnostics.filter((d) => d.severity === 2).length;
        updateDiagnosticContext(ctx);
        setState((s) => ({
          ...s,
          diagnostics: ctx.diagnostics,
          errorCount: errors,
          warningCount: warnings,
          connected: true,
        }));
      },
      status: (status) => {
        setState((s) => ({ ...s, status, connected: status === "connected" }));
      },
      error: () => {
        setState((s) => ({ ...s, status: "error", connected: false }));
      },
    };

    client.on("diagnostics", handler.diagnostics!);
    client.on("status", handler.status!);
    client.on("error", handler.error!);

    client.connect(config, uri).then(() => {
      const currentContent = contentRef.current;
      if (currentContent) {
        client.openDocument(uri, config.languageId, currentContent);
      }
    }).catch(() => {
      // LSP connection failed silently - editor works without it
    });

    return () => {
      if (client.openUri) clearDiagnosticContext(client.openUri);
      client.disconnect();
      clientRef.current = null;
      diagnosticsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName, supported]);

  const updateContent = useCallback((newContent: string) => {
    const client = clientRef.current;
    if (!client || !client.openUri) return;
    if (!client.connected) {
      // Buffer: the connection will openDocument with the latest content
      // when it completes. Store the latest so openDocument gets fresh data.
      return;
    }
    client.changeDocument(client.openUri, newContent);
  }, []);

  const getCompletions = useCallback(async (line: number, col: number): Promise<CompletionItem[]> => {
    const client = clientRef.current;
    if (!client || !client.openUri) return [];
    return client.getCompletions(client.openUri, line, col);
  }, []);

  const getHover = useCallback(async (line: number, col: number): Promise<HoverInfo | null> => {
    const client = clientRef.current;
    if (!client || !client.openUri) return null;
    return client.getHover(client.openUri, line, col);
  }, []);

  const getDefinition = useCallback(async (line: number, col: number): Promise<LocationInfo | null> => {
    const client = clientRef.current;
    if (!client || !client.openUri) return null;
    return client.getDefinition(client.openUri, line, col);
  }, []);

  const getReferences = useCallback(async (line: number, col: number): Promise<LocationInfo[]> => {
    const client = clientRef.current;
    if (!client || !client.openUri) return [];
    return client.getReferences(client.openUri, line, col);
  }, []);

  const getSignatureHelp = useCallback(async (line: number, col: number): Promise<SignatureHelpInfo | null> => {
    const client = clientRef.current;
    if (!client || !client.openUri) return null;
    return client.getSignatureHelp(client.openUri, line, col);
  }, []);

  const getFormatting = useCallback(async (): Promise<TextEdit[]> => {
    const client = clientRef.current;
    if (!client || !client.openUri) return [];
    return client.getFormatting(client.openUri);
  }, []);

  const getCodeActions = useCallback(async (line: number, col: number): Promise<CodeActionItem[]> => {
    const client = clientRef.current;
    if (!client || !client.openUri) return [];
    return client.getCodeActions(client.openUri, line, col, diagnosticsRef.current);
  }, []);

  return {
    ...state,
    updateContent,
    getCompletions,
    getHover,
    getDefinition,
    getReferences,
    getSignatureHelp,
    getFormatting,
    getCodeActions,
  };
}
