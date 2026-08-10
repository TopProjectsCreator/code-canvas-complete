import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LspClient } from "./client";
import type { LspMessage } from "./transport";
import type { LspConfig } from "./types";

type ParsedMessage = Omit<LspMessage, "params"> & {
  params?: {
    textDocument?: { text?: string; uri?: string };
    contentChanges?: { text?: string }[];
    [key: string]: unknown;
  };
};

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

const config: LspConfig = {
  server: "python",
  transport: "replit",
  languageId: "python",
  fileExtensions: [".py"],
};

function parsed(ws: MockWebSocket): LspMessage[] {
  return ws.sent.map((s) => JSON.parse(s));
}

function respondToInitialize(ws: MockWebSocket, capabilities: Record<string, unknown> = {}) {
  const init = parsed(ws).find((m) => m.method === "initialize");
  if (!init?.id) throw new Error("No initialize request sent yet");
  ws.onmessage?.({
    data: JSON.stringify({ jsonrpc: "2.0", id: init.id, result: { capabilities } }),
  });
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("LspClient reconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket);
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];
  });

  it("re-initializes the session and reopens documents after a transport reconnect", async () => {
    const uri = "file:///test.py";
    const client = new LspClient();

    const connectPromise = client.connect(config, uri);
    const ws1 = MockWebSocket.instances[0];
    expect(ws1).toBeDefined();
    ws1.open();
    await flush();
    respondToInitialize(ws1);
    await connectPromise;

    client.openDocument(uri, "python", "print('hello')");

    expect(parsed(ws1).some((m) => m.method === "initialize")).toBe(true);
    expect(
      parsed(ws1).some(
        (m) => m.method === "textDocument/didOpen" && m.params?.textDocument?.text === "print('hello')",
      ),
    ).toBe(true);

    // Network drops; the reconnect is scheduled with backoff.
    ws1.close();
    expect(client.connected).toBe(false);

    // Edits typed while disconnected update local state but are not sent.
    client.changeDocument(uri, "print('hello world')");
    expect(parsed(ws1).some((m) => m.method === "textDocument/didChange")).toBe(false);

    // Backoff elapses and a fresh socket is opened.
    await vi.advanceTimersByTimeAsync(2000);
    const ws2 = MockWebSocket.instances[1];
    expect(ws2).toBeDefined();
    ws2.open();
    await flush();

    // The fresh socket must be re-initialized before anything else.
    expect(parsed(ws2).some((m) => m.method === "initialize")).toBe(true);
    expect(client.connected).toBe(true);

    respondToInitialize(ws2, { hoverProvider: true });
    await flush();

    // The document is reopened with the latest buffered text, so edits made
    // during the drop are replayed.
    const didOpens = parsed(ws2).filter((m) => m.method === "textDocument/didOpen");
    expect(didOpens).toHaveLength(1);
    expect(didOpens[0].params?.textDocument?.text).toBe("print('hello world')");

    // Once the session is re-initialized, changes flow to the new socket again.
    client.changeDocument(uri, "print('done')");
    const didChanges = parsed(ws2).filter((m) => m.method === "textDocument/didChange");
    expect(didChanges).toHaveLength(1);
    expect(didChanges[0].params?.contentChanges?.[0]?.text).toBe("print('done')");

    client.disconnect();
  });

  it("does not fire reconnected handlers for the initial connection", async () => {
    const uri = "file:///test.py";
    const client = new LspClient();

    const connectPromise = client.connect(config, uri);
    const ws1 = MockWebSocket.instances[0];
    ws1.open();
    await flush();
    respondToInitialize(ws1);
    await connectPromise;

    // Only the first socket exists; no reconnect happened.
    expect(MockWebSocket.instances).toHaveLength(1);

    client.disconnect();
  });
});
