/**
 * AVR109 (Caterina) bootloader protocol for ATmega32u4 boards
 * Used by: Arduino Leonardo, Arduino Micro
 *
 * Upload flow:
 * 1. 1200-baud touch → board resets into Caterina bootloader
 * 2. Wait for re-enumeration as new CDC port
 * 3. Connect at 57600 baud
 * 4. AVR109 command set: identify, chip erase, set address, block write, exit
 *
 * AVR109 command reference (single-byte commands, ASCII responses):
 *  'S'  → Software identifier (7 chars)
 *  'V'  → Software version (2 bytes: major, minor)
 *  'p'  → Programmer type ('S' = serial)
 *  'a'  → Auto-increment support ('Y'/'N')
 *  'b'  → Block mode support ('Y' + 2-byte size, or 'N')
 *  't'  → Supported device codes (list + 0x00 terminator)
 *  'e'  → Chip erase → 0x0D on success
 *  'A'  → Set address (2 bytes big-endian word address) → 0x0D
 *  'B'  → Block write (2-byte size BE + 'F'/'E' + data) → 0x0D
 *  'g'  → Block read  (2-byte size BE + 'F'/'E') → data
 *  'E'  → Exit bootloader → 0x0D
 *  'L'  → Leave programming mode → 0x0D
 */

import { parseIntelHex, splitIntoPages } from './hexParser';

const CONNECT_BAUD = 57600;
const BOOT_WAIT_MS = 2500;
const RESPONSE_TIMEOUT = 2000;
const PAGE_SIZE = 128; // ATmega32u4 SPM page size

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}

interface SerialLike {
  requestPort(options?: { filters?: Array<{ usbVendorId?: number }> }): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

const getSerial = (): SerialLike | undefined =>
  (navigator as unknown as { serial?: SerialLike }).serial;

type ProgressCb = (message: string, percent: number) => void;

// ── Low-level helpers ──

async function readBytes(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  count: number,
  timeout = RESPONSE_TIMEOUT
): Promise<Uint8Array> {
  const buf = new Uint8Array(count);
  let off = 0;
  const deadline = Date.now() + timeout;

  while (off < count) {
    if (Date.now() > deadline) throw new Error(`Timeout reading ${count} bytes (got ${off})`);
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise<{ value: undefined; done: true }>((_, rej) =>
        setTimeout(() => rej(new Error('Read timeout')), Math.max(50, deadline - Date.now()))
      ),
    ]);
    if (done || !value) break;
    for (let i = 0; i < value.length && off < count; i++) buf[off++] = value[i];
  }
  if (off < count) throw new Error(`Expected ${count} bytes, got ${off}`);
  return buf;
}

async function sendByte(writer: WritableStreamDefaultWriter<Uint8Array>, byte: number) {
  await writer.write(new Uint8Array([byte]));
}

async function sendBytes(writer: WritableStreamDefaultWriter<Uint8Array>, data: Uint8Array | number[]) {
  await writer.write(data instanceof Uint8Array ? data : new Uint8Array(data));
}

async function expectCR(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const resp = await readBytes(reader, 1);
  if (resp[0] !== 0x0d) throw new Error(`Expected CR (0x0D), got 0x${resp[0].toString(16)}`);
}

// ── AVR109 Commands ──

async function getSoftwareId(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> {
  await sendByte(writer, 0x53); // 'S'
  const resp = await readBytes(reader, 7);
  return new TextDecoder().decode(resp);
}

async function getBlockSupport(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<number> {
  await sendByte(writer, 0x62); // 'b'
  const resp = await readBytes(reader, 1);
  if (resp[0] === 0x59) { // 'Y'
    const sizeBytes = await readBytes(reader, 2);
    return (sizeBytes[0] << 8) | sizeBytes[1];
  }
  return 0; // no block mode
}

async function chipErase(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  await sendByte(writer, 0x65); // 'e'
  await expectCR(reader);
}

async function setAddress(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  wordAddress: number
): Promise<void> {
  await sendBytes(writer, [
    0x41, // 'A'
    (wordAddress >> 8) & 0xff,
    wordAddress & 0xff,
  ]);
  await expectCR(reader);
}

async function blockWrite(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  data: Uint8Array,
  memType: number = 0x46 // 'F' = flash
): Promise<void> {
  const header = new Uint8Array([
    0x42, // 'B'
    (data.length >> 8) & 0xff,
    data.length & 0xff,
    memType,
  ]);
  const packet = new Uint8Array(header.length + data.length);
  packet.set(header);
  packet.set(data, header.length);
  await sendBytes(writer, packet);
  await expectCR(reader);
}

async function exitBootloader(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  await sendByte(writer, 0x45); // 'E'
  try { await expectCR(reader); } catch { /* board may disconnect immediately */ }
}

// ── 1200-baud touch ──

async function trigger1200BaudTouch(onProgress?: ProgressCb): Promise<void> {
  const serial = getSerial();
  if (!serial) throw new Error('Web Serial API not supported. Use Chrome or Edge.');

  onProgress?.('Select the Leonardo/Micro serial port...', 5);

  const port = await serial.requestPort({ filters: [{ usbVendorId: 0x2341 }] });

  onProgress?.('Performing 1200-baud reset...', 8);
  try {
    await port.open({ baudRate: 1200 });
    if (port.setSignals) {
      await port.setSignals({ dataTerminalReady: false });
      await new Promise(r => setTimeout(r, 50));
      await port.setSignals({ dataTerminalReady: true });
      await new Promise(r => setTimeout(r, 50));
      await port.setSignals({ dataTerminalReady: false });
    }
    await new Promise(r => setTimeout(r, 200));
    await port.close();
  } catch (err) {
    try { await port.close(); } catch { /**/ }
    throw new Error(`1200-baud touch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  onProgress?.('Board resetting into bootloader...', 10);
  await new Promise(r => setTimeout(r, BOOT_WAIT_MS));
}

// ── Public API ──

/**
 * Flash Intel HEX firmware to a Leonardo/Micro via AVR109 (Caterina) protocol.
 * Handles 1200-baud reset, reconnection, erase, and page-by-page write.
 */
export async function flashViaAVR109(
  hexData: string,
  onProgress?: ProgressCb
): Promise<void> {
  // Parse hex
  const { data, startAddress } = parseIntelHex(hexData);
  const pages = splitIntoPages(data, startAddress, PAGE_SIZE);

  // Step 1: trigger bootloader
  await trigger1200BaudTouch(onProgress);

  // Step 2: connect to bootloader port
  const serial = getSerial()!;
  onProgress?.('Select the bootloader port (may be a new port)...', 12);

  const port = await serial.requestPort({ filters: [{ usbVendorId: 0x2341 }] });
  await port.open({ baudRate: CONNECT_BAUD });

  const reader = port.readable!.getReader();
  const writer = port.writable!.getWriter();

  try {
    // Identify
    onProgress?.('Connecting to Caterina bootloader...', 15);
    const swId = await getSoftwareId(writer, reader);
    onProgress?.(`Bootloader: ${swId}`, 16);

    const blockSize = await getBlockSupport(writer, reader);
    const writeSize = blockSize > 0 ? Math.min(blockSize, PAGE_SIZE) : PAGE_SIZE;

    // Chip erase
    onProgress?.('Erasing chip...', 18);
    await chipErase(writer, reader);

    // Flash pages
    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const wordAddr = page.address >> 1;
      const pct = 20 + Math.round((i / totalPages) * 70);
      onProgress?.(`Flashing page ${i + 1}/${totalPages}...`, pct);

      await setAddress(writer, reader, wordAddr);

      // Write in blockSize chunks if page is larger
      for (let off = 0; off < page.data.length; off += writeSize) {
        const chunk = page.data.subarray(off, Math.min(off + writeSize, page.data.length));
        await blockWrite(writer, reader, chunk);
      }
    }

    // Exit
    onProgress?.('Exiting bootloader...', 95);
    await exitBootloader(writer, reader);

    onProgress?.('Upload complete!', 100);
  } finally {
    try { reader.releaseLock(); } catch { /**/ }
    try { writer.releaseLock(); } catch { /**/ }
    try { await port.close(); } catch { /**/ }
  }
}
