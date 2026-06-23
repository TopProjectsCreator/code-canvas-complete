/// <reference lib="webworker" />

interface FileEntry {
  content: string;
  version: number;
}

const files = new Map<string, FileEntry>();
let ts: typeof import("typescript") | null = null;
let languageService: any = null;
let pendingMessages: MessageEvent[] = [];
let loading = false;

function loadTypeScript(): Promise<void> {
  if (ts) return Promise.resolve();
  if (loading) return new Promise((resolve) => {
    const check = () => {
      if (ts) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
  loading = true;
  return importScriptsWithRetry("https://cdn.jsdelivr.net/npm/typescript@5.8.3/lib/typescript.js")
    .then(() => {
      ts = (self as any).ts;
      loading = false;
      processPending();
    })
    .catch((err) => {
      loading = false;
      postError("Failed to load TypeScript: " + err.message);
    });
}

function importScriptsWithRetry(url: string, retries = 3): Promise<void> {
  return new Promise((resolve, reject) => {
    const tryLoad = (attempt: number) => {
      try {
        importScripts(url);
        resolve();
      } catch (err) {
        if (attempt < retries) {
          setTimeout(() => tryLoad(attempt + 1), 1000 * (attempt + 1));
        } else {
          reject(err);
        }
      }
    };
    tryLoad(0);
  });
}

function getCanonicalFileName(fileName: string): string {
  return fileName.toLowerCase();
}

function createLanguageService() {
  if (!ts) return;
  const host: any = {
    getScriptFileNames: () => Array.from(files.keys()),
    getScriptVersion: (fileName: string) => {
      const entry = files.get(fileName);
      return entry ? String(entry.version) : "0";
    },
    getScriptSnapshot: (fileName: string) => {
      const entry = files.get(fileName);
      if (!entry) return undefined;
      return ts!.ScriptSnapshot.fromString(entry.content);
    },
    getScriptKind: (fileName: string) => {
      const ext = fileName.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "ts": return ts!.ScriptKind.TS;
        case "tsx": return ts!.ScriptKind.TSX;
        case "jsx": return ts!.ScriptKind.JSX;
        case "js":
        case "mjs":
        case "cjs": return ts!.ScriptKind.JS;
        default: return ts!.ScriptKind.TS;
      }
    },
    getCurrentDirectory: () => "/",
    getCompilationSettings: () => ({
      target: ts!.ScriptTarget.ES2022,
      module: ts!.ModuleKind.ESNext,
      moduleResolution: ts!.ModuleResolutionKind.Bundler,
      jsx: ts!.JsxEmit.ReactJSX,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      allowJs: true,
      checkJs: true,
      noEmit: true,
      resolveJsonModule: true,
      allowImportingTsExtensions: true,
    }),
    getDefaultLibFileName: () => "lib.d.ts",
    fileExists: (fileName: string) => files.has(getCanonicalFileName(fileName)),
    readFile: (fileName: string) => files.get(getCanonicalFileName(fileName))?.content,
    readDirectory: () => [],
    directoryExists: () => true,
    getDirectories: () => [],
    useCaseSensitiveFileNames: () => false,
  };

  languageService = ts!.createLanguageService(host, ts!.createDocumentRegistry());
}

function getDiagnostics(): any[] {
  if (!languageService) return [];
  const allDiagnostics: any[] = [];
  for (const fileName of files.keys()) {
    const syntactic = languageService.getSyntacticDiagnostics(fileName);
    const semantic = languageService.getSemanticDiagnostics(fileName);
    const suggestions = languageService.getSuggestionDiagnostics(fileName);
    for (const diag of [...syntactic, ...semantic, ...suggestions]) {
      const pos = diag.file ? diag.file.getLineAndCharacterOfPosition(diag.start!) : { line: 0, character: 0 };
      const endPos = diag.file && diag.length ? diag.file.getLineAndCharacterOfPosition(diag.start! + diag.length) : pos;
      allDiagnostics.push({
        range: {
          start: { line: pos.line, character: pos.character },
          end: { line: endPos.line, character: endPos.character },
        },
        severity: diag.category === 1 ? 1 : diag.category === 2 ? 2 : 3,
        message: ts!.flattenDiagnosticMessageText(diag.messageText, "\n"),
        source: "ts",
        code: diag.code,
      });
    }
  }
  return allDiagnostics;
}

function handleMessage(msg: any): void {
  if (!msg || !msg.method) return;

  if (!ts && msg.method !== "initialize") {
    pendingMessages.push({ data: msg } as any);
    loadTypeScript();
    return;
  }

  const sendResponse = (result: unknown, error?: { code: number; message: string }) => {
    self.postMessage({
      jsonrpc: "2.0",
      id: msg.id,
      result: error ? undefined : result,
      error: error ?? undefined,
    });
  };

  const sendNotification = (method: string, params: unknown) => {
    self.postMessage({ jsonrpc: "2.0", method, params });
  };

  try {
    switch (msg.method) {
      case "initialize": {
        loadTypeScript().then(() => {
          createLanguageService();
          sendResponse({
            capabilities: {
              textDocumentSync: 1,
              completionProvider: { triggerCharacters: [".", "<", "\"", "'", "/", "@", "("] },
              hoverProvider: true,
              definitionProvider: true,
              referencesProvider: true,
              signatureHelpProvider: { triggerCharacters: ["(", ","] },
              documentFormattingProvider: true,
              codeActionProvider: true,
            },
            serverInfo: { name: "TypeScript Language Service", version: ts?.version ?? "5.x" },
          });
        }).catch((err) => {
          sendResponse(null, { code: -32603, message: String(err) });
        });
        break;
      }

      case "initialized": {
        break;
      }

      case "textDocument/didOpen": {
        const params = msg.params as any;
        const uri = params.textDocument.uri;
        const text = params.textDocument.text;
        const fn = uriToFileName(uri);
        if (fn) files.set(fn, { content: text, version: 1 });
        updateAndPublish(uri, sendNotification);
        break;
      }

      case "textDocument/didChange": {
        const params = msg.params as any;
        const uri = params.textDocument.uri;
        const text = params.contentChanges[0].text;
        const fn = uriToFileName(uri);
        if (fn) {
          const entry = files.get(fn);
          files.set(fn, { content: text, version: (entry?.version ?? 0) + 1 });
        }
        updateAndPublish(uri, sendNotification);
        break;
      }

      case "textDocument/didClose": {
        const params = msg.params as any;
        const fn = uriToFileName(params.textDocument.uri);
        if (fn) files.delete(fn);
        break;
      }

      case "textDocument/completion": {
        const params = msg.params as any;
        const pos = params.position;
        const fileName = uriToFileName(params.textDocument.uri);
        if (!languageService || !fileName) { sendResponse({ items: [] }); break; }
        const offset = getOffset(fileName, pos.line, pos.character);
        const completions = languageService.getCompletionsAtPosition(fileName, offset, {});
        const items = completions?.entries.map((entry: any) => ({
          label: entry.name,
          kind: entry.kind,
          detail: entry.source,
          insertText: entry.insertText ?? entry.name,
        })) ?? [];
        sendResponse({ items });
        break;
      }

      case "textDocument/hover": {
        const params = msg.params as any;
        const pos = params.position;
        const fileName = uriToFileName(params.textDocument.uri);
        if (!languageService || !fileName) { sendResponse(null); break; }
        const offset = getOffset(fileName, pos.line, pos.character);
        const info = languageService.getQuickInfoAtPosition(fileName, offset);
        sendResponse(info ? {
          contents: { kind: "markdown", value: ts!.displayPartsToString(info.displayParts) },
          range: info.textSpan ? {
            start: getLineAndChar(fileName, info.textSpan.start),
            end: getLineAndChar(fileName, info.textSpan.start + info.textSpan.length),
          } : undefined,
        } : null);
        break;
      }

      case "textDocument/definition": {
        const params = msg.params as any;
        const pos = params.position;
        const fileName = uriToFileName(params.textDocument.uri);
        if (!languageService || !fileName) { sendResponse(null); break; }
        const offset = getOffset(fileName, pos.line, pos.character);
        const defs = languageService.getDefinitionAtPosition(fileName, offset);
        sendResponse(defs?.map((def: any) => ({
          uri: def.fileName,
          range: {
            start: getLineAndChar(def.fileName, def.textSpan.start),
            end: getLineAndChar(def.fileName, def.textSpan.start + def.textSpan.length),
          },
        })) ?? null);
        break;
      }

      case "textDocument/references": {
        const params = msg.params as any;
        const pos = params.position;
        const fileName = uriToFileName(params.textDocument.uri);
        if (!languageService || !fileName) { sendResponse([]); break; }
        const offset = getOffset(fileName, pos.line, pos.character);
        const refs = languageService.getReferencesAtPosition(fileName, offset);
        sendResponse(refs?.map((ref: any) => ({
          uri: ref.fileName,
          range: {
            start: getLineAndChar(ref.fileName, ref.textSpan.start),
            end: getLineAndChar(ref.fileName, ref.textSpan.start + ref.textSpan.length),
          },
        })) ?? []);
        break;
      }

      case "textDocument/signatureHelp": {
        const params = msg.params as any;
        const pos = params.position;
        const fileName = uriToFileName(params.textDocument.uri);
        if (!languageService || !fileName) { sendResponse(null); break; }
        const offset = getOffset(fileName, pos.line, pos.character);
        const sigs = languageService.getSignatureHelpItems(fileName, offset, {});
        sendResponse(sigs ? {
          signatures: sigs.items.map((item: any) => ({
            label: ts!.displayPartsToString(item.parameters.map((p: any) => p.displayParts ?? []).flat()),
            documentation: ts!.displayPartsToString(item.documentation),
            parameters: item.parameters.map((p: any) => ({
              label: ts!.displayPartsToString(p.displayParts ?? []),
              documentation: ts!.displayPartsToString(p.documentation),
            })),
          })),
          activeSignature: sigs.selectedItemIndex,
          activeParameter: sigs.argumentIndex,
        } : null);
        break;
      }

      case "textDocument/formatting": {
        const params = msg.params as any;
        const fileName = uriToFileName(params.textDocument.uri);
        const entry = fileName ? files.get(fileName) : undefined;
        if (!languageService || !fileName || !entry) { sendResponse([]); break; }
        const edits = languageService.getFormattingEditsForDocument(fileName, { tabSize: 2, insertSpaces: true, newLineCharacter: "\n" });
        sendResponse(edits.map((edit: any) => ({
          range: {
            start: getLineAndChar(fileName, edit.span.start),
            end: getLineAndChar(fileName, edit.span.start + edit.span.length),
          },
          newText: edit.newText,
        })));
        break;
      }

      case "textDocument/codeAction": {
        const params = msg.params as any;
        const diags = params.context?.diagnostics ?? [];
        const actions: any[] = diags.map((diag: any) => ({
          title: `Fix: ${diag.message.substring(0, 60)}`,
          kind: "quickfix",
          diagnostics: [diag],
        }));
        sendResponse(actions);
        break;
      }

      default:
        sendResponse(null);
    }
  } catch (err) {
    sendResponse(null, { code: -32603, message: String(err) });
  }
}

function uriToFileName(uri: string): string | null {
  const parts = uri.replace("file://", "").split("/");
  return parts[parts.length - 1] ?? null;
}

function getLineAndChar(fileName: string, offset: number): { line: number; character: number } {
  const entry = files.get(fileName);
  if (!entry) return { line: 0, character: 0 };
  const text = entry.content;
  let line = 0;
  let lastNewline = -1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      lastNewline = i;
    }
  }
  return { line, character: offset - lastNewline - 1 };
}

function getOffset(fileName: string, line: number, character: number): number {
  const entry = files.get(fileName);
  if (!entry) return 0;
  const text = entry.content;
  let currentLine = 0;
  let offset = 0;
  while (currentLine < line && offset < text.length) {
    if (text[offset] === '\n') currentLine++;
    offset++;
  }
  return offset + character;
}

function updateAndPublish(uri: string, notify: (method: string, params: unknown) => void) {
  if (!languageService) return;
  try { languageService.cleanupSemanticCache(); } catch {}
  const diagnostics = getDiagnostics();
  notify("textDocument/publishDiagnostics", { uri, diagnostics });
}

function processPending() {
  const msgs = pendingMessages.splice(0);
  for (const msg of msgs) {
    handleMessage(msg.data);
  }
}

function postError(message: string) {
  self.postMessage({
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params: { uri: "", diagnostics: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, severity: 1, message, source: "ts" }] },
  });
}

self.onmessage = (e: MessageEvent) => {
  handleMessage(e.data);
};
