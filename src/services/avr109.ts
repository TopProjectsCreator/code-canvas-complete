/**
 * AVR109 (Caterina) bootloader protocol for ATmega32u4 boards
 * Used by: Arduino Leonardo, Arduino Micro
 *
 * IMPORTANT: All requestPort() calls removed. Ports must be pre-acquired
 * in a user gesture context and passed in.
 */

import { parseIntelHex, splitIntoPages } from './hexParser';
import {
  SerialPortLike,
  getSerial,
  perform1200BaudTouch,
  waitForNewPort,
} from './serialUtils';

const CONNECT_BAUD = 57600;
const BOOT_WAIT_MS = 2500;
const RESPONSE_TIMEOUT = 2000;
const PAGE_SIZE = 128;

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
  await sendByte(writer, 0x53);
  const resp = await readBytes(reader, 7);
  return new TextDecoder().decode(resp);
}

async function getBlockSupport(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<number> {
  await sendByte(writer, 0x62);
  const resp = await readBytes(reader, 1);
  if (resp[0] === 0x59) {
    const sizeBytes = await readBytes(reader, 2);
    return (sizeBytes[0] << 8) | sizeBytes[1];
  }
  return 0;
}

async function chipErase(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  await sendByte(writer, 0x65);
  await expectCR(reader);
}

async function setAddress(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  wordAddress: number
): Promise<void> {
  await sendBytes(writer, [0x41, (wordAddress >> 8) & 0xff, wordAddress & 0xff]);
  await expectCR(reader);
}

async function blockWrite(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  data: Uint8Array,
  memType: number = 0x46
): Promise<void> {
  const header = new Uint8Array([0x42, (data.length >> 8) & 0xff, data.length & 0xff, memType]);
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
  await sendByte(writer, 0x45);
  try { await expectCR(reader); } catch { /* board may disconnect */ }
}

// ── Public API ──

/**
 * Flash Intel HEX firmware to a Leonardo/Micro via AVR109 (Caterina) protocol.
 * 
 * @param hexData - Intel HEX string
 * @param port - Pre-acquired serial port (from user gesture)
 * @param onProgress - Progress callback
 */
export async function flashViaAVR109(
  hexData: string,
  port: SerialPortLike,
  onProgress?: ProgressCb
): Promise<void> {
  const { data, startAddress } = parseIntelHex(hexData);
  const pages = splitIntoPages(data, startAddress, PAGE_SIZE);

  // Step 1: 1200-baud touch on the pre-acquired port
  onProgress?.('Performing 1200-baud reset...', 8);
  await perform1200BaudTouch(port);

  onProgress?.('Waiting for bootloader...', 10);
  await new Promise(r => setTimeout(r, BOOT_WAIT_MS));

  // Step 2: find the re-enumerated bootloader port via getPorts()
  const serial = getSerial()!;
  const existingPorts = await serial.getPorts();
  // Use the last available port (most likely the re-enumerated one)
  const bootPort = existingPorts.length > 0
    ? existingPorts[existingPorts.length - 1]
    : port; // fallback

  onProgress?.('Connecting to bootloader...', 12);
  await bootPort.open({ baudRate: CONNECT_BAUD });

  const reader = bootPort.readable!.getReader();
  const writer = bootPort.writable!.getWriter();

  try {
    onProgress?.('Connecting to Caterina bootloader...', 15);
    const swId = await getSoftwareId(writer, reader);
    onProgress?.(`Bootloader: ${swId}`, 16);

    const blockSize = await getBlockSupport(writer, reader);
    const writeSize = blockSize > 0 ? Math.min(blockSize, PAGE_SIZE) : PAGE_SIZE;

    onProgress?.('Erasing chip...', 18);
    await chipErase(writer, reader);

    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const wordAddr = page.address >> 1;
      const pct = 20 + Math.round((i / totalPages) * 70);
      onProgress?.(`Flashing page ${i + 1}/${totalPages}...`, pct);

      await setAddress(writer, reader, wordAddr);

      for (let off = 0; off < page.data.length; off += writeSize) {
        const chunk = page.data.subarray(off, Math.min(off + writeSize, page.data.length));
        await blockWrite(writer, reader, chunk);
      }
    }

    onProgress?.('Exiting bootloader...', 95);
    await exitBootloader(writer, reader);

    onProgress?.('Upload complete!', 100);
  } finally {
    try { reader.releaseLock(); } catch { /**/ }
    try { writer.releaseLock(); } catch { /**/ }
    try { await bootPort.close(); } catch { /**/ }
  }
}
