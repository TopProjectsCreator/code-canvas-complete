import { UploadConfig } from '@/components/arduino/ArduinoUploadDialog';
import { supabase } from '@/integrations/supabase/client';
import { isVerifiedWebFlashBoard } from '@/data/arduinoTemplates';
import { flashHex } from './stk500';
import { requestDFUDevice, flashDFU } from './dfuFlash';

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbProductId?: number };
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}

interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

const getSerial = (): SerialLike | undefined =>
  (navigator as unknown as { serial?: SerialLike }).serial;

// ARM-based boards that use DFU instead of STK500v1
const DFU_BOARDS = ['uno_r4_wifi'];
const OTA_BRIDGE_URL = import.meta.env.VITE_OTA_BRIDGE_URL || 'http://127.0.0.1:3232';
const OTA_BRIDGE_TOKEN = import.meta.env.VITE_OTA_BRIDGE_TOKEN;
const REQUEST_TIMEOUT_MS = 45000;

export class ArduinoUploadService {
  private static async buildCompileHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (publishableKey) {
      headers.apikey = publishableKey;
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
  }

  private static assertBoardSupported(boardId: string): void {
    if (!isVerifiedWebFlashBoard(boardId)) {
      throw new Error(
        `Board "${boardId}" is currently in planning/simulation mode. ` +
        'Verified web compile+flash support is available for Uno/Nano/Mega/Leonardo/Micro/Uno R4 WiFi. '
      );
    }
  }

  private static async withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        }
      }
    }
    throw lastError;
  }

  private static async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private static async compileSketch(
    sketch: string,
    boardId: string,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<{ hex?: string; binary?: string; warnings?: string }> {
    this.assertBoardSupported(boardId);
    onProgress?.('Compiling sketch...', 0);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('Project configuration missing');
    }

    const compileUrl = `https://${projectId}.supabase.co/functions/v1/compile-arduino`;
    const headers = await this.buildCompileHeaders();
    const compileResponse = await this.withRetry(() => this.fetchWithTimeout(compileUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sketch, board: boardId }),
    }));

    if (!compileResponse.ok) {
      const errorData = await compileResponse.json().catch(() => ({}));
      if (compileResponse.status === 422) {
        throw new Error(`Compilation errors:\n${errorData.errors || 'Unknown error'}`);
      }
      throw new Error(`Compilation failed: ${errorData.error || compileResponse.statusText}`);
    }

    const compileResult = await compileResponse.json();
    const isDFU = DFU_BOARDS.includes(boardId);

    if (isDFU) {
      if (!compileResult.binary) {
        throw new Error('Compilation did not produce binary output for this board');
      }
    } else if (!compileResult.hex) {
      if (compileResult.compiled && compileResult.asm) {
        throw new Error(
          'Sketch compiled to assembly but binary output is not available from the compiler service. ' +
          'This is a known limitation — try a simpler sketch or use Arduino IDE for full compilation.'
        );
      }
      throw new Error('Compilation did not produce flashable output');
    }

    onProgress?.('Compilation successful!', 15);
    if (compileResult.warnings) {
      onProgress?.(`Warnings: ${compileResult.warnings}`, 15);
    }

    return compileResult;
  }

  private static async uploadViaNetworkBridge(
    payload: Record<string, unknown>,
    method: 'ota' | 'bluetooth',
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    onProgress?.(`Connecting to local ${method.toUpperCase()} bridge...`, 20);

    const isLocalHostBridge = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(OTA_BRIDGE_URL);
    if (!isLocalHostBridge && !OTA_BRIDGE_URL.startsWith('https://')) {
      throw new Error('Remote OTA bridge must use HTTPS. Set VITE_OTA_BRIDGE_URL to an https:// endpoint.');
    }

    const bridgeHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (OTA_BRIDGE_TOKEN) {
      bridgeHeaders.Authorization = `Bearer ${OTA_BRIDGE_TOKEN}`;
    }

    let response: Response;
    try {
      response = await this.withRetry(() => this.fetchWithTimeout(`${OTA_BRIDGE_URL}/upload/${method}`, {
        method: 'POST',
        headers: bridgeHeaders,
        body: JSON.stringify(payload),
      }, 90000), 3);
    } catch {
      throw new Error(
        `Could not reach local ${method.toUpperCase()} uploader at ${OTA_BRIDGE_URL}. ` +
        'Start a local uploader service (same LAN/Bluetooth access as your board) or use Arduino IDE/CLI for production flashing.'
      );
    }

    if (!response.ok) {
      const details = await response.text().catch(() => 'No additional details available');
      throw new Error(`${method.toUpperCase()} upload failed: ${details}`);
    }

    onProgress?.(`${method.toUpperCase()} upload complete.`, 100);
  }

  /**
   * Compile sketch via backend edge function, then flash via appropriate protocol
   */
  static async uploadViaSerial(
    sketch: string,
    config: UploadConfig,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    const isDFU = DFU_BOARDS.includes(config.boardId);
    const compileResult = await this.compileSketch(sketch, config.boardId, onProgress);

    // Stage 2: Flash
    if (isDFU) {
      await this.flashViaDFU(compileResult.binary!, onProgress);
    } else {
      await this.flashViaSTK500(compileResult.hex!, config, onProgress);
    }
  }

  /**
   * Flash via WebUSB DFU for ARM-based boards (Uno R4 WiFi)
   */
  private static async flashViaDFU(
    binaryBase64: string,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    if (!navigator.usb) {
      throw new Error('WebUSB API not supported. Use Chrome or Edge.');
    }

    onProgress?.('Put your board in DFU mode (double-tap reset button), then select it...', 18);

    let device: USBDevice;
    try {
      device = await requestDFUDevice();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        throw new Error(
          'No DFU device found. Make sure your Arduino Uno R4 WiFi is in DFU mode:\n' +
          '1. Double-tap the reset button quickly\n' +
          '2. The LED should pulse/fade\n' +
          '3. Try selecting the device again'
        );
      }
      throw err;
    }

    // Decode base64 binary to Uint8Array
    const binaryStr = atob(binaryBase64);
    const firmware = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      firmware[i] = binaryStr.charCodeAt(i);
    }

    try {
      await flashDFU(device, firmware, (msg, pct) => {
        onProgress?.(msg, pct);
      });
    } catch (err) {
      throw new Error(
        `DFU flash failed: ${err instanceof Error ? err.message : 'Unknown error'}\n` +
        'Try double-tapping reset and retrying.'
      );
    }
  }

  /**
   * Flash via STK500v1 for AVR boards (Uno, Nano, Mega)
   */
  private static async flashViaSTK500(
    hexData: string,
    config: UploadConfig,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    const serial = getSerial();
    if (!serial) {
      throw new Error('Web Serial API not supported. Use Chrome or Edge.');
    }

    onProgress?.('Requesting serial port access...', 18);

    let port: SerialPortLike;
    try {
      port = await serial.requestPort();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw new Error('Serial port access denied. Please select a port when prompted.');
      }
      throw err;
    }

    try {
      await port.open({ baudRate: config.baudRate || 115200 });

      await flashHex(port, hexData, (msg, pct) => {
        onProgress?.(msg, pct);
      });

      await new Promise(r => setTimeout(r, 500));
      await port.close();
    } catch (err) {
      try { await port.close(); } catch { /* ignore */ }
      throw new Error(
        `Flash failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }


  static async uploadViaWiFi(
    sketch: string,
    config: UploadConfig,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    const compileResult = await this.compileSketch(sketch, config.boardId, onProgress);
    await this.uploadViaNetworkBridge(
      {
        boardId: config.boardId,
        host: config.portName,
        baudRate: config.baudRate,
        hex: compileResult.hex,
        binary: compileResult.binary,
      },
      'ota',
      onProgress
    );
  }

  static async uploadViaBluetooth(
    sketch: string,
    config: UploadConfig,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    const compileResult = await this.compileSketch(sketch, config.boardId, onProgress);
    await this.uploadViaNetworkBridge(
      {
        boardId: config.boardId,
        device: config.portName,
        baudRate: config.baudRate,
        hex: compileResult.hex,
        binary: compileResult.binary,
      },
      'bluetooth',
      onProgress
    );
  }


  /**
   * Open serial monitor for debugging
   */
  static async openSerialMonitor(
    _port: string,
    baudRate: number,
    onData?: (data: string) => void
  ): Promise<() => Promise<void>> {
    const serial = getSerial();
    if (!serial) {
      throw new Error('Web Serial API not supported');
    }

    const serialPort = await serial.requestPort();
    await serialPort.open({ baudRate });

    const reader = serialPort.readable?.getReader();
    if (!reader) throw new Error('Could not get port reader');

    const decoder = new TextDecoder();
    let buffer = '';
    let running = true;

    (async () => {
      try {
        while (running) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          lines.forEach((line) => onData?.(line));
        }
      } finally {
        reader.releaseLock();
        await serialPort.close();
      }
    })();

    return async () => {
      running = false;
      try {
        reader.releaseLock();
        await serialPort.close();
      } catch { /* ignore */ }
    };
  }
}
