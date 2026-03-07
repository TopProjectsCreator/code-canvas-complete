import { UploadConfig } from '@/components/arduino/ArduinoUploadDialog';
import { flashHex } from './stk500';

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

export class ArduinoUploadService {
  /**
   * Compile sketch via backend edge function, then flash via Web Serial + STK500v1
   */
  static async uploadViaSerial(
    sketch: string,
    config: UploadConfig,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    const serial = getSerial();
    if (!serial) {
      throw new Error('Web Serial API not supported. Use Chrome or Edge.');
    }

    // Stage 1: Compile
    onProgress?.('Compiling sketch...', 0);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('Project configuration missing');
    }

    const compileUrl = `https://${projectId}.supabase.co/functions/v1/compile-arduino`;
    const compileResponse = await fetch(compileUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sketch, board: config.boardId }),
    });

    if (!compileResponse.ok) {
      const errorData = await compileResponse.json().catch(() => ({}));
      if (compileResponse.status === 422) {
        throw new Error(`Compilation errors:\n${errorData.errors || 'Unknown error'}`);
      }
      throw new Error(`Compilation failed: ${errorData.error || compileResponse.statusText}`);
    }

    const compileResult = await compileResponse.json();

    if (!compileResult.hex) {
      // Assembly-only fallback
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

    // Stage 2: Flash via STK500v1
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
      await port.open({ baudRate: 115200 });

      await flashHex(port, compileResult.hex, (msg, pct) => {
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

    // Read loop (non-blocking via async)
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

    // Return a stop function
    return async () => {
      running = false;
      try {
        reader.releaseLock();
        await serialPort.close();
      } catch { /* ignore */ }
    };
  }
}
