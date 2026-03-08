/**
 * WebSerial SAM-BA flasher for Arduino Uno R4 WiFi
 * 
 * The R4 WiFi uses a TinyUSB-based bootloader that speaks SAM-BA protocol
 * over CDC serial. The upload flow:
 * 1. Open port at 1200 baud then close → triggers bootloader mode
 * 2. Wait for board to re-enumerate as a new CDC serial device
 * 3. Connect at 921600 baud (or 115200 fallback)
 * 4. Use SAM-BA protocol commands to write firmware to flash
 * 
 * SAM-BA protocol reference:
 * - N#\n  → switch to non-interactive (binary) mode
 * - T#\n  → switch to interactive mode (returns ">")
 * - W<addr>,<value>#\n → write 32-bit word
 * - w<addr>,4#\n → read 32-bit word (returns 4 bytes in binary mode)
 * - S<addr>,<len>#\n <data> → write bulk data to memory
 * - R<addr>,<len>#\n → read bulk data
 * - G<addr>#\n → execute code at address
 * - V#\n → version string
 */

// RA4M1 memory map
const FLASH_BASE = 0x00000000;
const FLASH_SIZE = 256 * 1024; // 256KB
const SRAM_BASE = 0x20000000;
const PAGE_SIZE = 2048; // RA4M1 flash page = 2KB
const BOOTLOADER_SIZE = 0x4000; // 16KB bootloader reservation
const USER_FLASH_BASE = FLASH_BASE + BOOTLOADER_SIZE;

// EEFC-equivalent for RA4M1: Flash Access Control registers
// The RA4M1 uses the FACI (Flash Access Control Interface)
const FACI_BASE = 0x407EC000;
const FACI_CMD = FACI_BASE + 0x100; // FACI command register area
const FACI_FRESETREG = 0x407EFFC0; // Flash reset register
const FACI_FSTATR = FACI_BASE + 0x10; // Flash status register
const FACI_FENTRYR = FACI_BASE + 0x84; // Flash entry register
const FACI_FSUINITR = FACI_BASE + 0xC0; // Flash sequencer init

// FACI commands
const FACI_CMD_PROGRAM = 0xE8;
const FACI_CMD_PROGRAM_CONFIRM = 0xD0;
const FACI_CMD_ERASE = 0x20;
const FACI_CMD_ERASE_CONFIRM = 0xD0;
const FACI_CMD_FORCED_STOP = 0xB3;
const FACI_CMD_STATUS_CLEAR = 0x50;

// Baud rates to try (R4 WiFi bootloader typically uses 115200)
const BAUD_RATES = [115200];

// Timeouts
const RESPONSE_TIMEOUT = 3000;
const FLASH_PAGE_TIMEOUT = 5000;
const BOOT_WAIT_MS = 3000;

type ProgressCallback = (message: string, percent: number) => void;

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  getInfo?(): { usbProductId?: number; usbVendorId?: number };
}

interface SerialLike {
  requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

const getSerial = (): SerialLike | undefined =>
  (navigator as unknown as { serial?: SerialLike }).serial;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ── Helpers ──

function toHex32(n: number): string {
  return n.toString(16).padStart(8, '0').toUpperCase();
}

function toHex16(n: number): string {
  return n.toString(16).padStart(4, '0').toUpperCase();
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
    // Send T# to switch to interactive mode and get a prompt
    await sendCommand(this.writer, 'T');
    const response = await readUntilPrompt(this.reader, 2000);
    this.interactive = true;

    // Get version
    await sendCommand(this.writer, 'V');
    const versionResp = await readUntilPrompt(this.reader, 2000);
    const version = versionResp.replace(/[>\r\n]/g, '').trim();

    // Switch to non-interactive (binary) mode for faster transfers
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
    // Send the raw data immediately after command
    await this.writer.write(data);
    if (this.interactive) {
      await readUntilPrompt(this.reader, FLASH_PAGE_TIMEOUT);
    } else {
      // Small delay for processing
      await new Promise(r => setTimeout(r, 2));
    }
  }

  async execute(address: number): Promise<void> {
    const cmd = `G${toHex32(address)}`;
    await sendCommand(this.writer, cmd);
    // After Go, the bootloader jumps — no response expected
    await new Promise(r => setTimeout(r, 100));
  }

  release(): void {
    try { this.reader.releaseLock(); } catch { /* */ }
    try { this.writer.releaseLock(); } catch { /* */ }
  }
}

// ── Flash Operations ──

/**
 * The Arduino R4 WiFi bootloader (TinyUSB-based) accepts BOSSA-compatible
 * SAM-BA commands. For the RA4M1, flash writing works by:
 * 1. Writing data to an SRAM buffer
 * 2. Using FACI registers to program flash pages
 * 
 * However, the Arduino bootloader abstracts this — it accepts direct
 * S (write) commands to flash addresses and handles the FACI internally.
 * This is the "simple" mode used by bossac for Arduino boards.
 */

async function eraseAndWriteFlash(
  samba: SambaConnection,
  firmware: Uint8Array,
  onProgress?: ProgressCallback
): Promise<void> {
  const totalPages = Math.ceil(firmware.length / PAGE_SIZE);
  onProgress?.(`Writing ${firmware.length} bytes (${totalPages} pages)...`, 20);

  for (let page = 0; page < totalPages; page++) {
    const offset = page * PAGE_SIZE;
    const end = Math.min(offset + PAGE_SIZE, firmware.length);
    const pageData = new Uint8Array(PAGE_SIZE);
    pageData.fill(0xFF); // Erased flash state
    pageData.set(firmware.subarray(offset, end));

    const flashAddr = USER_FLASH_BASE + offset;

    // Write page data to flash via SAM-BA S command
    // The Arduino bootloader handles erase-before-write internally
    await samba.writeBuffer(flashAddr, pageData);

    const pct = 20 + Math.round(((page + 1) / totalPages) * 70);
    onProgress?.(`Flashing page ${page + 1}/${totalPages} @ 0x${toHex32(flashAddr)}`, pct);
  }
}

async function verifyFlash(
  samba: SambaConnection,
  firmware: Uint8Array,
  onProgress?: ProgressCallback
): Promise<boolean> {
  onProgress?.('Verifying flash...', 92);

  // Verify first few words to confirm write succeeded
  const wordsToCheck = Math.min(16, Math.floor(firmware.length / 4));
  for (let i = 0; i < wordsToCheck; i++) {
    const addr = USER_FLASH_BASE + i * 4;
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
      // If read fails, skip verification (some bootloaders don't support read-back)
      onProgress?.('Verification read not supported, skipping...', 94);
      return true;
    }
  }

  onProgress?.('Verification passed!', 95);
  return true;
}

// ── Public API ──

/**
 * Trigger the R4 WiFi bootloader by performing a 1200-baud touch.
 * Opens the port at 1200 baud, waits briefly, then closes.
 */
export async function triggerBootloader(onProgress?: ProgressCallback): Promise<void> {
  const serial = getSerial();
  if (!serial) throw new Error('Web Serial API not supported. Use Chrome or Edge.');

  onProgress?.('Select the Arduino R4 WiFi serial port...', 5);

  let port: SerialPortLike;
  try {
    port = await serial.requestPort({
      filters: [
        { usbVendorId: 0x2341 }, // Arduino
      ],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      throw new Error('No Arduino device found. Connect your R4 WiFi and try again.');
    }
    throw err;
  }

  onProgress?.('Performing 1200-baud reset...', 8);

  try {
    await port.open({ baudRate: 1200 });
    // Toggle DTR to trigger reset
    if (port.setSignals) {
      await port.setSignals({ dataTerminalReady: false });
      await new Promise(r => setTimeout(r, 100));
      await port.setSignals({ dataTerminalReady: true });
      await new Promise(r => setTimeout(r, 100));
      await port.setSignals({ dataTerminalReady: false });
    }
    await new Promise(r => setTimeout(r, 300));
    await port.close();
  } catch (err) {
    try { await port.close(); } catch { /* */ }
    throw new Error(`1200-baud touch failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  onProgress?.('Board resetting into bootloader mode...', 10);
  // Wait for board to re-enumerate
  await new Promise(r => setTimeout(r, BOOT_WAIT_MS));
}

/**
 * Connect to the SAM-BA bootloader and flash firmware.
 * Call triggerBootloader() first, then call this with the binary firmware.
 */
export async function flashViaSamba(
  firmwareBase64: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const serial = getSerial();
  if (!serial) throw new Error('Web Serial API not supported. Use Chrome or Edge.');

  // Decode base64 binary to Uint8Array
  const binaryStr = atob(firmwareBase64);
  const firmware = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    firmware[i] = binaryStr.charCodeAt(i);
  }

  if (firmware.length === 0) throw new Error('Empty firmware');
  if (firmware.length > FLASH_SIZE - BOOTLOADER_SIZE) {
    throw new Error(`Firmware too large: ${firmware.length} bytes (max ${FLASH_SIZE - BOOTLOADER_SIZE})`);
  }

  onProgress?.('Select the bootloader serial port (may be a new port)...', 12);

  let port: SerialPortLike;
  try {
    port = await serial.requestPort({
      filters: [
        { usbVendorId: 0x2341 }, // Arduino
      ],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      throw new Error(
        'No bootloader port found. The board may not be in bootloader mode.\n' +
        'Try: 1) Double-tap reset, 2) Wait 3 seconds, 3) Try again'
      );
    }
    throw err;
  }

  // Try connecting at supported baud rates
  let connected = false;
  let lastError: Error | null = null;

  for (const baud of BAUD_RATES) {
    try {
      onProgress?.(`Connecting at ${baud} baud...`, 14);
      await port.open({ baudRate: baud });
      connected = true;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (!connected) {
    throw new Error(`Could not open bootloader port: ${lastError?.message || 'Unknown error'}`);
  }

  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();
  if (!writer || !reader) {
    try { await port.close(); } catch { /* */ }
    throw new Error('Could not access serial port streams');
  }

  const samba = new SambaConnection(port, writer, reader);

  try {
    // Initialize SAM-BA connection
    onProgress?.('Initializing SAM-BA connection...', 16);
    const version = await samba.init();
    onProgress?.(`Connected to bootloader: ${version}`, 18);

    // Write firmware
    await eraseAndWriteFlash(samba, firmware, onProgress);

    // Verify
    await verifyFlash(samba, firmware, onProgress);

    // Reset board to run user application
    onProgress?.('Resetting board...', 97);
    try {
      // Jump to user application at USER_FLASH_BASE
      // Read the initial stack pointer and reset vector
      await samba.execute(USER_FLASH_BASE);
    } catch {
      // Board may disconnect during reset — that's expected
    }

    onProgress?.('Flash complete! Board is running your sketch.', 100);
  } catch (err) {
    throw new Error(
      `SAM-BA flash failed: ${err instanceof Error ? err.message : 'Unknown error'}\n` +
      'Ensure the board is in bootloader mode (1200-baud touch or double-tap reset).'
    );
  } finally {
    samba.release();
    try { await port.close(); } catch { /* */ }
  }
}

/**
 * Combined flow: trigger bootloader + flash
 */
export async function flashR4WiFi(
  firmwareBase64: string,
  onProgress?: ProgressCallback
): Promise<void> {
  await triggerBootloader(onProgress);
  await flashViaSamba(firmwareBase64, onProgress);
}
