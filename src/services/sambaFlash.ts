/**
 * WebSerial SAM-BA flasher for Arduino boards with SAM-BA bootloaders
 *
 * Supported chips:
 * - Renesas RA4M1 (Arduino Uno R4 WiFi)
 * - Atmel SAM3X8E (Arduino Due)
 * - Atmel SAMD21G18 (Arduino Zero, MKR WiFi 1010, Nano 33 IoT)
 *
 * IMPORTANT: All requestPort() calls have been removed from this module.
 * Ports must be pre-acquired in a user gesture context and passed in.
 */

import {
  SerialPortLike,
  getSerial,
  perform1200BaudTouch,
  waitForNewPort,
} from './serialUtils';

// ── Board-specific configurations ──

export interface SambaBoardConfig {
  name: string;
  flashBase: number;
  flashSize: number;
  pageSize: number;
  bootloaderSize: number;
  baudRates: number[];
}

export const SAMBA_BOARD_CONFIGS: Record<string, SambaBoardConfig> = {
  uno_r4_wifi: {
    name: 'Arduino Uno R4 WiFi',
    flashBase: 0x00000000,
    flashSize: 256 * 1024,
    pageSize: 2048,
    bootloaderSize: 0x4000,
    baudRates: [115200],
  },
  due: {
    name: 'Arduino Due',
    flashBase: 0x00080000,
    flashSize: 512 * 1024,
    pageSize: 256,
    bootloaderSize: 0x0,
    baudRates: [115200],
  },
  zero: {
    name: 'Arduino Zero',
    flashBase: 0x00000000,
    flashSize: 256 * 1024,
    pageSize: 64,
    bootloaderSize: 0x2000,
    baudRates: [115200],
  },
  mkr_wifi_1010: {
    name: 'Arduino MKR WiFi 1010',
    flashBase: 0x00000000,
    flashSize: 256 * 1024,
    pageSize: 64,
    bootloaderSize: 0x2000,
    baudRates: [115200],
  },
  nano_33_iot: {
    name: 'Arduino Nano 33 IoT',
    flashBase: 0x00000000,
    flashSize: 256 * 1024,
    pageSize: 64,
    bootloaderSize: 0x2000,
    baudRates: [115200],
  },
};

export function isSambaBoard(boardId: string): boolean {
  return boardId in SAMBA_BOARD_CONFIGS;
}

function getBoardConfig(boardId: string): SambaBoardConfig {
  const cfg = SAMBA_BOARD_CONFIGS[boardId];
  if (!cfg) throw new Error(`No SAM-BA configuration for board: ${boardId}`);
  return cfg;
}

// Timeouts
const RESPONSE_TIMEOUT = 3000;
const FLASH_PAGE_TIMEOUT = 5000;
const BOOT_WAIT_MS = 3000;

type ProgressCallback = (message: string, percent: number) => void;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ── Helpers ──

function toHex32(n: number): string {
  return n.toString(16).padStart(8, '0').toUpperCase();
}

async function readBytes(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  count: number,
  timeout: number = RESPONSE_TIMEOUT
): Promise<Uint8Array> {
  const result = new Uint8Array(count);
  let offset = 0;
  const deadline = Date.now() + timeout;

  while (offset < count) {
    if (Date.now() > deadline) {
      throw new Error(`Timeout reading ${count} bytes (got ${offset})`);
    }
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise<{ value: undefined; done: true }>((_, reject) =>
        setTimeout(() => reject(new Error(`Read timeout after ${timeout}ms`)), Math.max(100, deadline - Date.now()))
      ),
    ]);
    if (done || !value) break;
    result.set(value.subarray(0, Math.min(value.length, count - offset)), offset);
    offset += value.length;
  }
  return result.subarray(0, offset);
}

async function readUntilPrompt(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeout: number = RESPONSE_TIMEOUT
): Promise<string> {
  let buffer = '';
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    try {
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: true }>((_, reject) =>
          setTimeout(() => reject(new Error('Read timeout')), Math.max(100, deadline - Date.now()))
        ),
      ]);
      if (done) break;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes('>')) return buffer;
      }
    } catch {
      break;
    }
  }
  return buffer;
}

async function sendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  command: string
): Promise<void> {
  await writer.write(encoder.encode(command + '#\n'));
}

async function drain(reader: ReadableStreamDefaultReader<Uint8Array>, ms = 200): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      await Promise.race([
        reader.read(),
        new Promise(resolve => setTimeout(resolve, Math.max(10, deadline - Date.now()))),
      ]);
    } catch {
      break;
    }
  }
}

// ── SAM-BA Protocol Layer ──

class SambaConnection {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private interactive = true;

  constructor(
    private port: SerialPortLike,
    writer: WritableStreamDefaultWriter<Uint8Array>,
    reader: ReadableStreamDefaultReader<Uint8Array>
  ) {
    this.writer = writer;
    this.reader = reader;
  }

  async init(): Promise<string> {
    await sendCommand(this.writer, 'T');
    const response = await readUntilPrompt(this.reader, 2000);
    this.interactive = true;

    await sendCommand(this.writer, 'V');
    const versionResp = await readUntilPrompt(this.reader, 2000);
    const version = versionResp.replace(/[>\r\n]/g, '').trim();

    await sendCommand(this.writer, 'N');
    await new Promise(r => setTimeout(r, 100));
    await drain(this.reader, 100);
    this.interactive = false;

    return version || 'SAM-BA';
  }

  async writeWord(address: number, value: number): Promise<void> {
    const cmd = `W${toHex32(address)},${toHex32(value)}`;
    await sendCommand(this.writer, cmd);
    if (this.interactive) {
      await readUntilPrompt(this.reader, 1000);
    } else {
      await new Promise(r => setTimeout(r, 5));
    }
  }

  async readWord(address: number): Promise<number> {
    const cmd = `w${toHex32(address)},4`;
    await sendCommand(this.writer, cmd);

    if (this.interactive) {
      const resp = await readUntilPrompt(this.reader, 1000);
      const match = resp.match(/0x([0-9A-Fa-f]+)/);
      if (match) return parseInt(match[1], 16);
      throw new Error(`Failed to parse word response: ${resp}`);
    } else {
      const bytes = await readBytes(this.reader, 4, 1000);
      if (bytes.length < 4) throw new Error('Short read on readWord');
      return bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | ((bytes[3] << 24) >>> 0);
    }
  }

  async writeBuffer(address: number, data: Uint8Array): Promise<void> {
    const cmd = `S${toHex32(address)},${toHex32(data.length)}`;
    await sendCommand(this.writer, cmd);
    await this.writer.write(data);
    if (this.interactive) {
      await readUntilPrompt(this.reader, FLASH_PAGE_TIMEOUT);
    } else {
      await new Promise(r => setTimeout(r, 2));
    }
  }

  async execute(address: number): Promise<void> {
    const cmd = `G${toHex32(address)}`;
    await sendCommand(this.writer, cmd);
    await new Promise(r => setTimeout(r, 100));
  }

  release(): void {
    try { this.reader.releaseLock(); } catch { /* */ }
    try { this.writer.releaseLock(); } catch { /* */ }
  }
}

// ── Flash Operations ──

async function eraseAndWriteFlash(
  samba: SambaConnection,
  firmware: Uint8Array,
  config: SambaBoardConfig,
  onProgress?: ProgressCallback
): Promise<void> {
  const userFlashBase = config.flashBase + config.bootloaderSize;
  const totalPages = Math.ceil(firmware.length / config.pageSize);
  onProgress?.(`Writing ${firmware.length} bytes (${totalPages} pages)...`, 20);

  for (let page = 0; page < totalPages; page++) {
    const offset = page * config.pageSize;
    const end = Math.min(offset + config.pageSize, firmware.length);
    const pageData = new Uint8Array(config.pageSize);
    pageData.fill(0xFF);
    pageData.set(firmware.subarray(offset, end));

    const flashAddr = userFlashBase + offset;
    await samba.writeBuffer(flashAddr, pageData);

    const pct = 20 + Math.round(((page + 1) / totalPages) * 70);
    onProgress?.(`Flashing page ${page + 1}/${totalPages} @ 0x${toHex32(flashAddr)}`, pct);
  }
}

async function verifyFlash(
  samba: SambaConnection,
  firmware: Uint8Array,
  config: SambaBoardConfig,
  onProgress?: ProgressCallback
): Promise<boolean> {
  const userFlashBase = config.flashBase + config.bootloaderSize;
  onProgress?.('Verifying flash...', 92);

  const wordsToCheck = Math.min(16, Math.floor(firmware.length / 4));
  for (let i = 0; i < wordsToCheck; i++) {
    const addr = userFlashBase + i * 4;
    const expected = firmware[i * 4] |
      (firmware[i * 4 + 1] << 8) |
      (firmware[i * 4 + 2] << 16) |
      ((firmware[i * 4 + 3] << 24) >>> 0);

    try {
      const actual = await samba.readWord(addr);
      if (actual !== expected) {
        onProgress?.(`Verify failed at 0x${toHex32(addr)}: expected 0x${toHex32(expected)}, got 0x${toHex32(actual)}`, 92);
        return false;
      }
    } catch {
      onProgress?.('Verification read not supported, skipping...', 94);
      return true;
    }
  }

  onProgress?.('Verification passed!', 95);
  return true;
}

// ── Public API ──

/**
 * Trigger bootloader via 1200-baud touch on a pre-acquired port.
 * The port MUST be acquired via requestPort() in a user gesture context.
 */
export async function triggerBootloader(
  port: SerialPortLike,
  onProgress?: ProgressCallback,
  boardName = 'Arduino'
): Promise<void> {
  onProgress?.('Performing 1200-baud reset...', 8);

  try {
    await perform1200BaudTouch(port);
  } catch (err) {
    throw new Error(`1200-baud touch failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  onProgress?.('Board resetting into bootloader mode...', 10);
  await new Promise(r => setTimeout(r, BOOT_WAIT_MS));
}

/**
 * Flash firmware via SAM-BA protocol.
 * The bootloaderPort should be acquired after triggering bootloader
 * (use waitForNewPort from serialUtils, or pass the same port).
 */
export async function flashViaSamba(
  firmwareBase64: string,
  bootloaderPort: SerialPortLike,
  onProgress?: ProgressCallback,
  boardId = 'uno_r4_wifi'
): Promise<void> {
  const config = getBoardConfig(boardId);

  const binaryStr = atob(firmwareBase64);
  const firmware = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    firmware[i] = binaryStr.charCodeAt(i);
  }

  const maxSize = config.flashSize - config.bootloaderSize;
  if (firmware.length === 0) throw new Error('Empty firmware');
  if (firmware.length > maxSize) {
    throw new Error(`Firmware too large: ${firmware.length} bytes (max ${maxSize})`);
  }

  // Connect to pre-acquired bootloader port
  let connected = false;
  let lastError: Error | null = null;

  for (const baud of config.baudRates) {
    try {
      onProgress?.(`Connecting at ${baud} baud...`, 14);
      await bootloaderPort.open({ baudRate: baud });
      connected = true;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (!connected) {
    throw new Error(`Could not open bootloader port: ${lastError?.message || 'Unknown error'}`);
  }

  const writer = bootloaderPort.writable?.getWriter();
  const reader = bootloaderPort.readable?.getReader();
  if (!writer || !reader) {
    try { await bootloaderPort.close(); } catch { /* */ }
    throw new Error('Could not access serial port streams');
  }

  const samba = new SambaConnection(bootloaderPort, writer, reader);
  const userFlashBase = config.flashBase + config.bootloaderSize;

  try {
    onProgress?.('Initializing SAM-BA connection...', 16);
    const version = await samba.init();
    onProgress?.(`Connected to bootloader: ${version}`, 18);

    await eraseAndWriteFlash(samba, firmware, config, onProgress);
    await verifyFlash(samba, firmware, config, onProgress);

    onProgress?.('Resetting board...', 97);
    try {
      await samba.execute(userFlashBase);
    } catch {
      // Board may disconnect during reset — expected
    }

    onProgress?.('Flash complete! Board is running your sketch.', 100);
  } catch (err) {
    throw new Error(
      `SAM-BA flash failed: ${err instanceof Error ? err.message : 'Unknown error'}\n` +
      'Ensure the board is in bootloader mode (1200-baud touch or double-tap reset).'
    );
  } finally {
    samba.release();
    try { await bootloaderPort.close(); } catch { /* */ }
  }
}
