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

  private static async uploadViaNetworkBridge(
    payload: Record<string, unknown>,
    method: 'ota' | 'bluetooth',
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    onProgress?.(`Connecting to local ${method.toUpperCase()} bridge...`, 20);

    const isLocalHostBridge = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(OTA_BRIDGE_URL);
    if (!isLocalHostBridge && !OTA_BRIDGE_URL.startsWith('https://')) {
      throw new Error('Remote OTA bridge must use HTTPS.');
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
        `Could not reach local ${method.toUpperCase()} uploader at ${OTA_BRIDGE_URL}.`
      );
    }

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`${method.toUpperCase()} upload failed: ${details}`);
    }

    onProgress?.(`${method.toUpperCase()} upload complete.`, 100);
  }

  /**
   * Determine flash protocol for a board
   */
  static getFlashProtocol(boardId: string): 'stk500' | 'avr109' | 'samba' | 'esptool' | 'stm32' {
    if (AVR109_BOARDS.includes(boardId)) return 'avr109';
    if (isSambaBoard(boardId)) return 'samba';
    if (ESP_BOARDS.includes(boardId)) return 'esptool';
    if (STM32_BOARDS.includes(boardId)) return 'stm32';
    return 'stk500';
  }

  /**
   * Compile + flash via serial.
   * The port MUST be pre-acquired in a user gesture context (click handler).
   */
  static async uploadViaSerial(
    sketch: string,
    config: UploadConfig,
    port: SerialPortLike,
    onProgress?: (message: string, percent?: number) => void
  ): Promise<void> {
    const protocol = this.getFlashProtocol(config.boardId);
    const compileResult = await this.compileSketch(sketch, config.boardId, onProgress);

    switch (protocol) {
      case 'avr109':
        await flashViaAVR109(compileResult.hex!, port, onProgress);
        break;

      case 'samba': {
        // Use the pre-acquired port for 1200-baud touch
        await triggerBootloader(port, (msg, pct) => onProgress?.(msg, pct));
        // After bootloader trigger, find the re-enumerated port via getPorts()
        const serial = getSerial()!;
        const existingPorts = await serial.getPorts();
        const bootPort = existingPorts.length > 0
          ? existingPorts[existingPorts.length - 1]
          : port;
        await flashViaSamba(compileResult.binary!, bootPort, (msg, pct) => onProgress?.(msg, pct), config.boardId);
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
    onProgress?.('Opening serial port...', 18);

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
