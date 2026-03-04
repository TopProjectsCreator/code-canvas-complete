import { UploadConfig } from '@/components/arduino/ArduinoUploadDialog';

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbProductId?: number };
  readable?: ReadableStream<Uint8Array>;
  writable?: WritableStream<Uint8Array>;
}

interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

const getSerial = (): SerialLike | undefined =>
  (navigator as unknown as { serial?: SerialLike }).serial;

export class ArduinoUploadService {
  /**
   * Upload sketch via Web Serial API (browser-native)
   */
  static async uploadViaSerial(
    sketch: string,
    config: UploadConfig,
    onProgress?: (message: string) => void
  ): Promise<void> {
    if (config.uploadMethod !== 'serial') {
      throw new Error(`Serial upload called with method ${config.uploadMethod}`);
    }
    const serial = getSerial();
    if (!serial) {
      throw new Error('Web Serial API not supported');
    }

    try {
      const port = await serial.requestPort();
      await port.open({ baudRate: config.baudRate });

      onProgress?.('Connected to board');

      const writer = port.writable?.getWriter();
      if (!writer) throw new Error('Could not get port writer');

      // Send sketch in chunks
      const encoder = new TextEncoder();
      const data = encoder.encode(sketch);
      const chunkSize = 64;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await writer.write(chunk);
        onProgress?.(`Uploading: ${Math.round((i / data.length) * 100)}%`);
      }

      writer.releaseLock();
      onProgress?.('Upload complete');

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await port.close();
    } catch (err) {
      throw new Error(
        `Serial upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Upload sketch via backend arduino-cli
   */
  static async uploadViaBackend(
    sketch: string,
    config: UploadConfig,
    onProgress?: (message: string) => void
  ): Promise<void> {
    if (config.uploadMethod !== 'serial') {
      throw new Error(`${config.uploadMethod} uploads are not supported by backend yet`);
    }
    try {
      onProgress?.('Compiling sketch...');

      const response = await fetch('/api/arduino/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sketch,
          board: config.boardId,
          port: config.portName,
          baudRate: config.baudRate,
          method: config.uploadMethod,
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      onProgress?.('Upload complete');
    } catch (err) {
      throw new Error(
        `Backend upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Open serial monitor for debugging
   */
  static async openSerialMonitor(
    port: string,
    baudRate: number,
    onData?: (data: string) => void
  ): Promise<void> {
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

    try {
      while (true) {
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
  }
}
