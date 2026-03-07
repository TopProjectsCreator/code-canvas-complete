import { UploadConfig } from '@/components/arduino/ArduinoUploadDialog';
import { UploadConfig } from '@/components/arduino/ArduinoUploadDialog';
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

export class ArduinoUploadService {
  /**
   * Compile sketch via backend edge function, then flash via appropriate protocol
   */
  static async uploadViaSerial(
    sketch: string,
    config: UploadConfig,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    const isDFU = DFU_BOARDS.includes(config.boardId);

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

    // For DFU boards, expect binary (base64); for AVR, expect hex
    if (isDFU) {
      if (!compileResult.binary) {
        throw new Error('Compilation did not produce binary output for this board');
      }
    } else {
      if (!compileResult.hex) {
        if (compileResult.compiled && compileResult.asm) {
          throw new Error(
            'Sketch compiled to assembly but binary output is not available from the compiler service. ' +
            'This is a known limitation — try a simpler sketch or use Arduino IDE for full compilation.'
          );
        }
        throw new Error('Compilation did not produce flashable output');
      }
    }

    onProgress?.('Compilation successful!', 15);

    if (compileResult.warnings) {
      onProgress?.(`Warnings: ${compileResult.warnings}`, 15);
    }

    // Stage 2: Flash
    if (isDFU) {
      await this.flashViaDFU(compileResult.binary, onProgress);
    } else {
      await this.flashViaSTK500(compileResult.hex, config, onProgress);
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
