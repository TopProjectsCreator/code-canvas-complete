import type {
  Diagnostic,
  CompletionItem,
  HoverInfo,
  LocationInfo,
  SignatureHelpInfo,
  TextEdit,
  CodeActionItem,
  LspServerStatus,
  LspDiagnosticContext,
} from "./types";
import { TextDocumentManager } from "./documents";
import {
  TypeScriptWorkerTransport,
  ReplitTransport,
  OfflineWasmTransport,
  type LspTransport,
  type LspMessage,
} from "./transport";
import type { LspConfig } from "./types";

export type LspEventHandler = {
  diagnostics: (ctx: LspDiagnosticContext) => void;
  status: (status: LspServerStatus) => void;
  error: (error: string) => void;
};

export class LspClient {
  private transport: LspTransport | null = null;
  private documentManager = new TextDocumentManager();
  private eventHandlers: Partial<LspEventHandler> = {};
  private currentUri: string | null = null;
  private capabilities: Record<string, boolean> = {};
  private _connected = false;
  private pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private requestId = 1;

  get connected() {
    return this._connected;
  }

  get status(): LspServerStatus {
    return this.transport?.status ?? "disconnected";
  }

  get openUri(): string | null {
    return this.currentUri;
  }

  on<K extends keyof LspEventHandler>(event: K, handler: LspEventHandler[K]) {
    this.eventHandlers[event] = handler as any;
  }

  off<K extends keyof LspEventHandler>(event: K) {
    delete this.eventHandlers[event];
  }

  async connect(config: LspConfig, uri: string): Promise<void> {
    void config;
    this.currentUri = uri;

    this.transport?.disconnect();
    this.transport = this.createTransport(config);

    this.transport.onStatusChange((status) => {
      this._connected = status === "connected";
      this.eventHandlers.status?.(status);
    });

    this.transport.onError((error) => {
      this.eventHandlers.error?.(error);
    });

    this.transport.onMessage((msg) => {
      if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
        const pending = this.pendingRequests.get(msg.id)!;
        this.pendingRequests.delete(msg.id);
        if (msg.error) pending.reject(new Error(msg.error.message));
        else pending.resolve(msg.result);
        return;
      }
      this.handleMessage(msg);
    });

    await this.transport.connect();
    await this.initialize();
  }

  disconnect() {
    if (this.currentUri) {
      this.sendNotification("textDocument/didClose", {
        textDocument: { uri: this.currentUri },
      });
      this.documentManager.closeDocument(this.currentUri);
    }
    this.transport?.disconnect();
    this.transport = null;
    this.currentUri = null;
    this.capabilities = {};
    this._connected = false;
  }

  openDocument(uri: string, languageId: string, text: string) {
    const doc = this.documentManager.openDocument(uri, languageId, text);
    this.currentUri = uri;
    this.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: doc.uri,
        languageId: doc.languageId,
        version: doc.version,
        text: doc.text,
      },
    });
  }

  changeDocument(uri: string, text: string) {
    const doc = this.documentManager.changeDocument(uri, text);
    if (doc) {
      this.sendNotification("textDocument/didChange", {
        textDocument: { uri: doc.uri, version: doc.version },
        contentChanges: [{ text: doc.text }],
      });
    }
  }

  closeDocument(uri: string) {
    if (this.documentManager.isOpen(uri)) {
      this.sendNotification("textDocument/didClose", {
        textDocument: { uri },
      });
      this.documentManager.closeDocument(uri);
    }
  }

  async getCompletions(uri: string, line: number, col: number): Promise<CompletionItem[]> {
    if (!this.capabilities.completion) return [];
    const result = await this.sendRequest("textDocument/completion", {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
      context: { triggerKind: 1 },
    });
    if (!result) return [];
    const items = (result as any).items ?? result ?? [];
    return Array.isArray(items) ? items.map(normalizeCompletionItem) : [];
  }

  async getHover(uri: string, line: number, col: number): Promise<HoverInfo | null> {
    if (!this.capabilities.hover) return null;
    const result = await this.sendRequest("textDocument/hover", {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
    });
    if (!result) return null;
    const hover = result as any;
    return {
      contents: typeof hover.contents === "string" ? hover.contents : hover.contents?.value ?? "",
      range: hover.range
        ? {
            startLine: hover.range.start.line + 1,
            startCol: hover.range.start.character + 1,
            endLine: hover.range.end.line + 1,
            endCol: hover.range.end.character + 1,
          }
        : undefined,
    };
  }

  async getDefinition(uri: string, line: number, col: number): Promise<LocationInfo | null> {
    if (!this.capabilities.definition) return null;
    const result = await this.sendRequest("textDocument/definition", {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
    });
    if (!result) return null;
    const loc = Array.isArray(result) ? (result as any[])[0] : (result as any);
    if (!loc) return null;
    return {
      uri: loc.uri,
      line: loc.range.start.line + 1,
      col: loc.range.start.character + 1,
    };
  }

  async getReferences(uri: string, line: number, col: number): Promise<LocationInfo[]> {
    if (!this.capabilities.references) return [];
    const result = await this.sendRequest("textDocument/references", {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
      context: { includeDeclaration: true },
    });
    if (!result) return [];
    const locs = result as any[];
    return locs.map((loc) => ({
      uri: loc.uri,
      line: loc.range.start.line + 1,
      col: loc.range.start.character + 1,
    }));
  }

  async getSignatureHelp(uri: string, line: number, col: number): Promise<SignatureHelpInfo | null> {
    if (!this.capabilities.signatureHelp) return null;
    const result = await this.sendRequest("textDocument/signatureHelp", {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
    });
    if (!result) return null;
    const sig = result as any;
    return {
      label: sig.signatures?.[0]?.label ?? "",
      documentation: sig.signatures?.[0]?.documentation,
      parameters: sig.signatures?.[0]?.parameters?.map((p: any) => ({
        label: typeof p.label === "string" ? p.label : p.label?.[0] ?? "",
        documentation: p.documentation,
      })) ?? [],
      activeParameter: sig.activeParameter ?? sig.signatures?.[0]?.activeParameter ?? 0,
    };
  }

  async getFormatting(uri: string): Promise<TextEdit[]> {
    if (!this.capabilities.formatting) return [];
    const result = await this.sendRequest("textDocument/formatting", {
      textDocument: { uri },
      options: { tabSize: 2, insertSpaces: true },
    });
    if (!result) return [];
    return (result as any[]).map(normalizeTextEdit);
  }

  async getCodeActions(uri: string, line: number, col: number, diagnostics: Diagnostic[]): Promise<CodeActionItem[]> {
    if (!this.capabilities.codeAction) return [];
    const result = await this.sendRequest("textDocument/codeAction", {
      textDocument: { uri },
      range: {
        start: { line: line - 1, character: col - 1 },
        end: { line: line - 1, character: col },
      },
      context: {
        diagnostics: diagnostics.map((d) => ({
          range: d.range,
          message: d.message,
          severity: d.severity,
          source: d.source,
        })),
      },
    });
    if (!result) return [];
    const actions = result as any[];
    return actions.map((a) => ({
      title: a.title,
      kind: a.kind,
      diagnostics: a.diagnostics,
      edit: a.edit
        ? {
            changes: Object.fromEntries(
              Object.entries(a.edit.changes).map(([uri, edits]) => [
                uri,
                (edits as any[]).map(normalizeTextEdit),
              ]),
            ),
          }
        : undefined,
      command: a.command,
    }));
  }

  private createTransport(config: LspConfig): LspTransport {
    if (config.transport === "worker" && config.server === "typescript") {
      return new TypeScriptWorkerTransport();
    }
    if (config.transport === "replit") {
      return new ReplitTransport(config.languageId);
    }
    return new OfflineWasmTransport(config.languageId);
  }

  private async initialize() {
    const result = await this.sendRequest("initialize", {
      processId: null,
      clientInfo: { name: "canvas-ide", version: "1.0.0" },
      capabilities: {
        textDocument: {
          completion: { completionItem: { snippetSupport: true } },
          hover: { contentFormat: ["markdown", "plaintext"] },
          definition: {},
          references: {},
          signatureHelp: {},
          formatting: {},
          codeAction: {},
          synchronization: { didSave: true },
        },
      },
    });
    if (result) {
      const caps = (result as any).capabilities ?? {};
      this.capabilities = {
        completion: !!caps.completionProvider,
        hover: !!caps.hoverProvider,
        definition: !!caps.definitionProvider,
        references: !!caps.referencesProvider,
        signatureHelp: !!caps.signatureHelpProvider,
        formatting: !!caps.documentFormattingProvider,
        codeAction: !!caps.codeActionProvider,
        diagnostics: true,
      };
    }
    this.sendNotification("initialized", {});
  }

  private sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.transport) return reject(new Error("No transport"));
      const id = this.requestId++;
      this.pendingRequests.set(id, { resolve, reject });
      this.transport.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  private sendNotification(method: string, params: unknown) {
    this.transport?.send({ jsonrpc: "2.0", method, params });
  }

  private handleMessage(msg: LspMessage) {
    if (msg.method === "textDocument/publishDiagnostics") {
      const params = msg.params as any;
      this.eventHandlers.diagnostics?.({
        uri: params.uri,
        diagnostics: (params.diagnostics ?? []).map((d: any) => ({
          range: d.range,
          severity: d.severity,
          message: d.message,
          source: d.source,
          code: d.code,
        })),
      });
    }
  }
}

function normalizeCompletionItem(item: any): CompletionItem {
  return {
    label: item.label ?? item.text ?? "",
    kind: item.kind,
    detail: item.detail,
    documentation: item.documentation,
    insertText: item.insertText ?? item.textEdit?.newText ?? item.label,
  };
}

function normalizeTextEdit(edit: any): TextEdit {
  return {
    range: {
      startLine: edit.range.start.line + 1,
      startCol: edit.range.start.character + 1,
      endLine: edit.range.end.line + 1,
      endCol: edit.range.end.character + 1,
    },
    newText: edit.newText,
  };
}
