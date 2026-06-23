import type { LspServerStatus } from "./types";

const TS_WORKER_URL = new URL("./servers/tsWorker.ts", import.meta.url);

export interface LspMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface LspTransport {
  readonly status: LspServerStatus;
  connect(): Promise<void>;
  disconnect(): void;
  send(message: LspMessage): void;
  onMessage(handler: (msg: LspMessage) => void): void;
  onStatusChange(handler: (status: LspServerStatus) => void): void;
  onError(handler: (error: string) => void): void;
}

export interface LspTransportFactory {
  create(languageId: string): LspTransport;
}

class BaseTransport implements LspTransport {
  protected _status: LspServerStatus = "disconnected";
  protected messageHandlers: Set<(msg: LspMessage) => void> = new Set();
  protected statusHandlers: Set<(status: LspServerStatus) => void> = new Set();
  protected errorHandlers: Set<(error: string) => void> = new Set();

  get status() {
    return this._status;
  }

  protected setStatus(status: LspServerStatus) {
    this._status = status;
    this.statusHandlers.forEach((h) => h(status));
  }

  connect(): Promise<void> {
    throw new Error("Not implemented");
  }
  disconnect(): void {
    throw new Error("Not implemented");
  }
  send(_message: LspMessage): void {
    throw new Error("Not implemented");
  }

  onMessage(handler: (msg: LspMessage) => void) {
    this.messageHandlers.add(handler);
  }
  onStatusChange(handler: (status: LspServerStatus) => void) {
    this.statusHandlers.add(handler);
  }
  onError(handler: (error: string) => void) {
    this.errorHandlers.add(handler);
  }

  protected dispatchMessage(msg: LspMessage) {
    this.messageHandlers.forEach((h) => h(msg));
  }

  protected dispatchError(error: string) {
    this.errorHandlers.forEach((h) => h(error));
  }
}

/**
 * Transport for TypeScript language server running in a Web Worker.
 */
export class TypeScriptWorkerTransport extends BaseTransport {
  private worker: Worker | null = null;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private messageBuffer: string[] = [];

  constructor() {
    super();
  }

  async connect(): Promise<void> {
    if (this.worker) return;
    this.setStatus("connecting");
    try {
      this.worker = new Worker(TS_WORKER_URL, { type: "module" });
      this.worker.onmessage = (e) => {
        const msg = e.data as LspMessage;
        if (msg.id !== undefined) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            this.pending.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(msg.error.message));
            } else {
              pending.resolve(msg.result);
            }
          }
        } else {
          this.dispatchMessage(msg);
        }
      };
      this.worker.onerror = (e) => {
        this.dispatchError(e.message);
        this.setStatus("error");
      };
      this.setStatus("connected");
    } catch (err) {
      this.setStatus("error");
      throw err;
    }
  }

  disconnect(): void {
    this.worker?.terminate();
    this.worker = null;
    this.setStatus("disconnected");
  }

  send(message: LspMessage): void {
    if (!this.worker) return;
    this.worker.postMessage(message);
  }

  sendRequest(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  sendNotification(method: string, params: unknown): void {
    this.send({ jsonrpc: "2.0", method, params });
  }
}

/**
 * Transport for Replit backend LSP bridge (WebSocket).
 */
export class ReplitTransport extends BaseTransport {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private languageId: string) {
    super();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = `${protocol}//${window.location.host}/api/lsp/ws?language=${languageId}`;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.setStatus("connecting");

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.setStatus("connected");
          resolve();
        };
        this.ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as LspMessage;
            this.dispatchMessage(msg);
          } catch {
            // ignore malformed messages
          }
        };
        this.ws.onclose = () => {
          this.setStatus("disconnected");
          this.tryReconnect();
        };
        this.ws.onerror = () => {
          this.dispatchError("WebSocket connection failed");
          reject(new Error("WebSocket connection failed"));
        };
      } catch (err) {
        this.setStatus("error");
        reject(err);
      }
    });
  }

  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.ws?.close();
    this.ws = null;
    this.setStatus("disconnected");
  }

  send(message: LspMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("error");
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    setTimeout(() => this.connect().catch(() => {}), delay);
  }
}

/**
 * Offline WASM fallback transport (lazy download, run in worker).
 */
export class OfflineWasmTransport extends BaseTransport {
  private worker: Worker | null = null;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private wasmUrl: string;

  constructor(languageId: string) {
    super();
    this.wasmUrl = `https://cdn.jsdelivr.net/npm/${languageId}-wasm@latest/dist/worker.js`;
  }

  async connect(): Promise<void> {
    if (this.worker) return;
    this.setStatus("connecting");
    try {
      this.worker = new Worker(this.wasmUrl, { type: "module" });
      this.worker.onmessage = (e) => {
        const msg = e.data as LspMessage;
        if (msg.id !== undefined) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            this.pending.delete(msg.id);
            if (msg.error) pending.reject(new Error(msg.error.message));
            else pending.resolve(msg.result);
          }
        } else {
          this.dispatchMessage(msg);
        }
      };
      this.worker.onerror = (e) => {
        this.dispatchError(e.message);
        this.setStatus("error");
      };
      this.setStatus("connected");
    } catch (err) {
      this.setStatus("error");
      throw err;
    }
  }

  disconnect(): void {
    this.worker?.terminate();
    this.worker = null;
    this.setStatus("disconnected");
  }

  send(message: LspMessage): void {
    this.worker?.postMessage(message);
  }

  sendRequest(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  sendNotification(method: string, params: unknown): void {
    this.send({ jsonrpc: "2.0", method, params });
  }
}
