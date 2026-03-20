import { UploadConfig } from '@/components/arduino/ArduinoUploadDialog';
import { supabase } from '@/integrations/supabase/client';
import { isVerifiedWebFlashBoard } from '@/data/arduinoTemplates';
import { flashHex } from './stk500';
import { triggerBootloader, flashViaSamba, isSambaBoard, SAMBA_BOARD_CONFIGS } from './sambaFlash';
import { flashViaAVR109 } from './avr109';
import { flashViaEsptool } from './esptool';
import { flashViaSTM32 } from './stm32serial';
import { SerialPortLike, getSerial, waitForNewPort } from './serialUtils';

// Board → flash protocol mapping
const AVR109_BOARDS = ['leonardo', 'micro'];
const ESP_BOARDS = ['esp32', 'esp8266'];
const STM32_BOARDS = ['portenta_h7', 'giga_r1'];

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
        'Web compile+flash is not yet available for this board.'
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
  ): Promise<{ hex?: string; binary?: string; warnings?: string; baseAddress?: number }> {
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
    const needsBinary = isSambaBoard(boardId) || ESP_BOARDS.includes(boardId) || STM32_BOARDS.includes(boardId);

    if (needsBinary) {
      if (!compileResult.binary) {
        throw new Error('Compilation did not produce binary output for this board');
      }
    } else if (!compileResult.hex) {
      if (compileResult.compiled && compileResult.asm) {
        throw new Error(
          'Sketch compiled to assembly but binary output is not available. ' +
          'Try a simpler sketch or use Arduino IDE.'
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
...
      case 'samba': {
        // Use the pre-acquired port for 1200-baud touch
        await triggerBootloader(port, (msg, pct) => onProgress?.(msg, pct), config.boardId);
        const serial = getSerial()!;
        const existingPorts = await serial.getPorts();
        const bootPort = existingPorts.length > 0
          ? existingPorts[existingPorts.length - 1]
          : port;
        await flashViaSamba(
          compileResult.binary!,
          bootPort,
          (msg, pct) => onProgress?.(msg, pct),
          config.boardId,
          compileResult.baseAddress,
        );
        break;
      }

      case 'esptool': {
        const chipHint = config.boardId === 'esp8266' ? 'esp8266' : 'esp32';
        await flashViaEsptool(compileResult.binary!, port, chipHint, onProgress);
        break;
      }

      case 'stm32':
        await flashViaSTM32(compileResult.binary!, port, onProgress);
        break;

      case 'stk500':
      default:
        await this.flashViaSTK500(compileResult.hex!, port, config, onProgress);
        break;
    }
  }

  /**
   * Flash via STK500v1 for AVR boards (Uno, Nano, Mega)
   */
  private static async flashViaSTK500(
    hexData: string,
    port: SerialPortLike,
    config: UploadConfig,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    const baudRatesToTry = Array.from(new Set([
      config.baudRate || 115200,
      57600,
      115200,
    ]));

    let lastError: unknown;

    for (let attempt = 0; attempt < baudRatesToTry.length; attempt++) {
      const baudRate = baudRatesToTry[attempt];
      onProgress?.(`Opening serial port at ${baudRate} baud...`, 18);

      try {
        await port.open({ baudRate });

        await flashHex(port, hexData, (msg, pct) => {
          onProgress?.(msg, pct);
        });

        await new Promise(r => setTimeout(r, 500));
        await port.close();
        return;
      } catch (err) {
        lastError = err;
        try { await port.close(); } catch { /* ignore */ }

        const nextBaudRate = baudRatesToTry[attempt + 1];
        if (nextBaudRate) {
          onProgress?.(`Upload failed at ${baudRate} baud, retrying with ${nextBaudRate}...`, 18);
          await new Promise(r => setTimeout(r, 250));
        }
      }
    }

    throw new Error(
      `Flash failed after trying ${baudRatesToTry.join(', ')} baud: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`
    );
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
    port: SerialPortLike,
    baudRate: number,
    onData?: (data: string) => void
  ): Promise<() => Promise<void>> {
    await port.open({ baudRate });

    const reader = port.readable?.getReader();
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
        await port.close();
      }
    })();

    return async () => {
      running = false;
      try {
        reader.releaseLock();
        await port.close();
      } catch { /* ignore */ }
    };
  }
}
