/**
 * STK500v1 protocol implementation for Arduino Uno (Optiboot bootloader)
 * Handles board reset, sync, page-by-page flashing, and readback verification via Web Serial API
 */

import { parseIntelHex, splitIntoPages } from './hexParser';

// STK500v1 constants
const STK_OK = 0x10;
const STK_INSYNC = 0x14;
const CRC_EOP = 0x20; // "space" marks end of command
const STK_GET_SYNC = 0x30;
const STK_ENTER_PROGMODE = 0x50;
const STK_LEAVE_PROGMODE = 0x51;
const STK_LOAD_ADDRESS = 0x55;
const STK_PROG_PAGE = 0x64;
const STK_READ_PAGE = 0x74;
const STK_READ_SIGN = 0x75;

const RESPONSE_TIMEOUT = 5000;
const PAGE_SIZE = 128; // ATmega328P page size in bytes
const SYNC_ATTEMPT_TIMEOUT = 350;

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}

type ResetStrategy = 'classic' | 'avrdude' | 'inverted';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const toError = (error: unknown, fallback: string): Error =>
  error instanceof Error ? error : new Error(fallback);

class BufferedSerialReader {
  private readonly buffer: number[] = [];
  private readLoop: Promise<void>;
  private done = false;
  private disposed = false;
  private readError: Error | null = null;

  constructor(private readonly reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.readLoop = this.consume();
  }

  private async consume(): Promise<void> {
    try {
      while (!this.disposed) {
        const { value, done } = await this.reader.read();
        if (done) {
          this.done = true;
          return;
        }

        if (value?.length) {
          this.buffer.push(...value);
        }
      }
    } catch (error) {
      if (!this.disposed) {
        this.readError = toError(error, 'Serial read failed');
      }
    }
  }

  clear(): void {
    this.buffer.length = 0;
  }

  async readBytes(count: number, timeout: number = RESPONSE_TIMEOUT): Promise<Uint8Array> {
    const deadline = Date.now() + timeout;

    while (this.buffer.length < count) {
      if (this.readError) {
        throw this.readError;
      }

      if (this.done) {
        break;
      }

      if (Date.now() >= deadline) {
        throw new Error(`Timeout waiting for ${count} bytes (got ${this.buffer.length})`);
      }

      await sleep(10);
    }

    if (this.buffer.length < count) {
      throw new Error(`Expected ${count} bytes but got ${this.buffer.length}`);
    }

    return new Uint8Array(this.buffer.splice(0, count));
  }

  async drainInput(quietMs = 120): Promise<void> {
    this.clear();

    let lastCount = this.buffer.length;
    let lastChangeAt = Date.now();
    const deadline = Date.now() + quietMs * 4;

    while (Date.now() < deadline) {
      await sleep(10);
      const currentCount = this.buffer.length;

      if (currentCount !== lastCount) {
        lastCount = currentCount;
        lastChangeAt = Date.now();
      }

      if (Date.now() - lastChangeAt >= quietMs) {
        break;
      }
    }

    this.clear();
  }

  async dispose(): Promise<void> {
    this.disposed = true;

    try {
      await this.reader.cancel();
    } catch {
      // ignore cancellation errors during cleanup
    }

    await this.readLoop.catch(() => undefined);

    try {
      this.reader.releaseLock();
    } catch {
      // ignore release errors during cleanup
    }
  }
}

/**
 * Send a command and expect STK_INSYNC + STK_OK response
 */
async function sendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: BufferedSerialReader,
  command: number[],
  timeout?: number
): Promise<Uint8Array> {
  reader.clear();
  await writer.write(new Uint8Array([...command, CRC_EOP]));

  const response = await reader.readBytes(2, timeout);

  if (response[0] !== STK_INSYNC) {
    throw new Error(`Expected STK_INSYNC (0x14), got 0x${response[0].toString(16)}`);
  }
  if (response[1] !== STK_OK) {
    throw new Error(`Expected STK_OK (0x10), got 0x${response[1].toString(16)}`);
  }

  return response;
}

/**
 * Reset the board by toggling modem control lines.
 * Different Uno-compatible USB bridges wire DTR/RTS slightly differently,
 * so we support a few reset strategies and try them in order.
 */
async function resetBoard(port: SerialPortLike, strategy: ResetStrategy = 'classic'): Promise<void> {
  if (!port.setSignals) {
    return;
  }

  try {
    switch (strategy) {
      case 'classic':
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
        await sleep(50);
        await port.setSignals({ dataTerminalReady: false, requestToSend: false });
        await sleep(50);
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
        await sleep(220);
        break;

      case 'avrdude':
        await port.setSignals({ dataTerminalReady: false, requestToSend: false });
        await sleep(20);
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
        await sleep(250);
        break;

      case 'inverted':
        await port.setSignals({ dataTerminalReady: false, requestToSend: false });
        await sleep(50);
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
        await sleep(50);
        await port.setSignals({ dataTerminalReady: false, requestToSend: false });
        await sleep(220);
        break;
    }
  } catch {
    // Some serial drivers/bridges don't fully support signal toggling.
  }
}

/**
 * Attempt to synchronize with the bootloader.
 * Use short per-attempt timeouts so we can send several sync probes while the
 * bootloader window is still open after a reset.
 */
async function sync(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: BufferedSerialReader,
  maxAttempts: number = 10,
  attemptTimeout: number = SYNC_ATTEMPT_TIMEOUT
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await sendCommand(writer, reader, [STK_GET_SYNC], attemptTimeout);
      return;
    } catch {
      await sleep(50);
    }
  }

  throw new Error('Failed to sync with bootloader after multiple attempts. Is the board connected?');
}

async function syncWithFallbacks(
  port: SerialPortLike,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: BufferedSerialReader,
  onProgress?: (message: string, percent: number) => void
): Promise<void> {
  const plans: Array<{
    label: string;
    percent: number;
    attempts: number;
    strategy?: ResetStrategy;
  }> = [
    { label: 'Checking bootloader...', percent: 2, attempts: 3 },
    { label: 'Resetting board...', percent: 4, attempts: 6, strategy: 'avrdude' },
    { label: 'Retrying reset...', percent: 5, attempts: 8, strategy: 'classic' },
    { label: 'Trying alternate reset...', percent: 6, attempts: 10, strategy: 'inverted' },
  ];

  for (const plan of plans) {
    onProgress?.(plan.label, plan.percent);

    if (plan.strategy) {
      await resetBoard(port, plan.strategy);
      await reader.drainInput();
    } else {
      reader.clear();
    }

    try {
      await sync(writer, reader, plan.attempts);
      return;
    } catch {
      // Try the next reset strategy.
    }
  }

  throw new Error('Failed to sync with bootloader after trying multiple reset strategies. Press reset once and try again.');
}

/**
 * Read device signature to confirm the bootloader is responding
 */
async function readSignature(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: BufferedSerialReader
): Promise<string> {
  reader.clear();
  await writer.write(new Uint8Array([STK_READ_SIGN, CRC_EOP]));

  const response = await reader.readBytes(5);
  if (response[0] !== STK_INSYNC || response[4] !== STK_OK) {
    throw new Error('Failed to read device signature');
  }

  return `0x${Array.from(response.slice(1, 4))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Set the load address for the next page write (word address, not byte)
 */
async function loadAddress(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: BufferedSerialReader,
  wordAddress: number
): Promise<void> {
  const addrLow = wordAddress & 0xff;
  const addrHigh = (wordAddress >> 8) & 0xff;
  await sendCommand(writer, reader, [STK_LOAD_ADDRESS, addrLow, addrHigh]);
}

/**
 * Program a single page of flash memory
 */
async function programPage(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: BufferedSerialReader,
  pageData: Uint8Array
): Promise<void> {
  const sizeHigh = (pageData.length >> 8) & 0xff;
  const sizeLow = pageData.length & 0xff;
  const memType = 0x46; // 'F' for flash

  const command = new Uint8Array([
    STK_PROG_PAGE,
    sizeHigh,
    sizeLow,
    memType,
    ...pageData,
    CRC_EOP,
  ]);

  reader.clear();
  await writer.write(command);

  const response = await reader.readBytes(2);
  if (response[0] !== STK_INSYNC || response[1] !== STK_OK) {
    throw new Error('Page programming failed');
  }
}

/**
 * Read a single page of flash memory back from the board.
 */
async function readPage(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: BufferedSerialReader,
  pageLength: number
): Promise<Uint8Array> {
  const sizeHigh = (pageLength >> 8) & 0xff;
  const sizeLow = pageLength & 0xff;
  const memType = 0x46; // 'F' for flash

  const command = new Uint8Array([
    STK_READ_PAGE,
    sizeHigh,
    sizeLow,
    memType,
    CRC_EOP,
  ]);

  reader.clear();
  await writer.write(command);

  const response = await reader.readBytes(pageLength + 2);
  if (response[0] !== STK_INSYNC) {
    throw new Error('Flash verification failed to start');
  }
  if (response[response.length - 1] !== STK_OK) {
    throw new Error('Flash verification failed to complete');
  }

  return response.slice(1, response.length - 1);
}

async function verifyFlash(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: BufferedSerialReader,
  pages: Array<{ address: number; data: Uint8Array }>,
  onProgress?: (message: string, percent: number) => void
): Promise<void> {
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const wordAddress = page.address >> 1;
    const percent = 90 + Math.round(((i + 1) / totalPages) * 8);

    onProgress?.(`Verifying page ${i + 1}/${totalPages}...`, percent);

    await loadAddress(writer, reader, wordAddress);
    const readBack = await readPage(writer, reader, page.data.length);

    for (let byteIndex = 0; byteIndex < page.data.length; byteIndex++) {
      if (readBack[byteIndex] !== page.data[byteIndex]) {
        const failedAddress = page.address + byteIndex;
        throw new Error(`Flash verification failed at 0x${failedAddress.toString(16)}`);
      }
    }
  }
}

/**
 * Flash an Intel HEX string to the connected Arduino board
 */
export async function flashHex(
  port: SerialPortLike,
  hexData: string,
  onProgress?: (message: string, percent: number) => void
): Promise<void> {
  const { data, startAddress } = parseIntelHex(hexData);
  const pages = splitIntoPages(data, startAddress, PAGE_SIZE);

  const baseReader = port.readable?.getReader();
  const writer = port.writable?.getWriter();

  if (!baseReader || !writer) {
    throw new Error('Serial port is not ready for flashing');
  }

  const reader = new BufferedSerialReader(baseReader);

  try {
    onProgress?.('Preparing upload...', 0);
    await syncWithFallbacks(port, writer, reader, onProgress);

    const signature = await readSignature(writer, reader);
    onProgress?.(`Bootloader detected (${signature})`, 8);

    onProgress?.('Entering programming mode...', 10);
    await sendCommand(writer, reader, [STK_ENTER_PROGMODE]);

    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const wordAddress = page.address >> 1;
      const percent = 10 + Math.round((i / totalPages) * 75);

      onProgress?.(`Flashing page ${i + 1}/${totalPages}...`, percent);

      await loadAddress(writer, reader, wordAddress);
      await programPage(writer, reader, page.data);
    }

    onProgress?.('Verifying flash...', 90);
    await verifyFlash(writer, reader, pages, onProgress);

    onProgress?.('Leaving programming mode...', 98);
    await sendCommand(writer, reader, [STK_LEAVE_PROGMODE]);

    onProgress?.('Upload complete!', 100);
  } finally {
    await reader.dispose();
    writer.releaseLock();
  }
}
