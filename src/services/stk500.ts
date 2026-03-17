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

const SYNC_TIMEOUT = 2000;
const RESPONSE_TIMEOUT = 5000;
const PAGE_SIZE = 128; // ATmega328P page size in bytes

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}

/**
 * Read exactly `count` bytes from the serial port with timeout
 */
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
      throw new Error(`Timeout waiting for ${count} bytes (got ${offset})`);
    }

    const { value, done } = await Promise.race([
      reader.read(),
      new Promise<{ value: undefined; done: true }>((_, reject) =>
        setTimeout(() => reject(new Error('Serial read timeout')), timeout)
      ),
    ]);

    if (done || !value) break;

    for (let i = 0; i < value.length && offset < count; i++) {
      result[offset++] = value[i];
    }
  }

  if (offset < count) {
    throw new Error(`Expected ${count} bytes but got ${offset}`);
  }

  return result;
}

/**
 * Send a command and expect STK_INSYNC + STK_OK response
 */
async function sendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  command: number[],
  timeout?: number
): Promise<Uint8Array> {
  const data = new Uint8Array([...command, CRC_EOP]);
  await writer.write(data);

  const response = await readBytes(reader, 2, timeout);

  if (response[0] !== STK_INSYNC) {
    throw new Error(`Expected STK_INSYNC (0x14), got 0x${response[0].toString(16)}`);
  }
  if (response[1] !== STK_OK) {
    throw new Error(`Expected STK_OK (0x10), got 0x${response[1].toString(16)}`);
  }

  return response;
}

/**
 * Reset the board by toggling DTR signal
 */
async function resetBoard(port: SerialPortLike): Promise<void> {
  if (!port.setSignals) {
    throw new Error('Serial port does not support setSignals (DTR toggle)');
  }

  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await new Promise(r => setTimeout(r, 250));
  await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  await new Promise(r => setTimeout(r, 50));
}

/**
 * Attempt to synchronize with the bootloader
 */
async function sync(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxAttempts: number = 10
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await sendCommand(writer, reader, [STK_GET_SYNC], SYNC_TIMEOUT);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  throw new Error('Failed to sync with bootloader after multiple attempts. Is the board connected?');
}

/**
 * Read device signature to confirm the bootloader is responding
 */
async function readSignature(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> {
  const data = new Uint8Array([STK_READ_SIGN, CRC_EOP]);
  await writer.write(data);

  const response = await readBytes(reader, 5);
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
  reader: ReadableStreamDefaultReader<Uint8Array>,
  wordAddress: number
): Promise<void> {
  const addrLow = wordAddress & 0xFF;
  const addrHigh = (wordAddress >> 8) & 0xFF;
  await sendCommand(writer, reader, [STK_LOAD_ADDRESS, addrLow, addrHigh]);
}

/**
 * Program a single page of flash memory
 */
async function programPage(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  pageData: Uint8Array
): Promise<void> {
  const sizeHigh = (pageData.length >> 8) & 0xFF;
  const sizeLow = pageData.length & 0xFF;
  const memType = 0x46; // 'F' for flash

  const command = new Uint8Array([
    STK_PROG_PAGE,
    sizeHigh,
    sizeLow,
    memType,
    ...pageData,
    CRC_EOP,
  ]);

  await writer.write(command);

  const response = await readBytes(reader, 2);
  if (response[0] !== STK_INSYNC || response[1] !== STK_OK) {
    throw new Error('Page programming failed');
  }
}

/**
 * Read a single page of flash memory back from the board.
 */
async function readPage(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  pageLength: number
): Promise<Uint8Array> {
  const sizeHigh = (pageLength >> 8) & 0xFF;
  const sizeLow = pageLength & 0xFF;
  const memType = 0x46; // 'F' for flash

  const command = new Uint8Array([
    STK_READ_PAGE,
    sizeHigh,
    sizeLow,
    memType,
    CRC_EOP,
  ]);

  await writer.write(command);

  const response = await readBytes(reader, pageLength + 2);
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
  reader: ReadableStreamDefaultReader<Uint8Array>,
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

  onProgress?.('Resetting board...', 0);
  await resetBoard(port);
  await new Promise(r => setTimeout(r, 200));

  const reader = port.readable?.getReader();
  const writer = port.writable?.getWriter();

  if (!reader || !writer) {
    throw new Error('Serial port is not ready for flashing');
  }

  try {
    onProgress?.('Syncing with bootloader...', 5);
    await sync(writer, reader, 12);

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
    reader.releaseLock();
    writer.releaseLock();
  }
}
