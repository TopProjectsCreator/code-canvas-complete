/**
 * STM32 System Bootloader (USART) flasher for Portenta H7 and GIGA R1 WiFi
 *
 * IMPORTANT: All requestPort() calls removed. Ports must be pre-acquired
 * in a user gesture context and passed in.
 */

import {
  SerialPortLike,
  getSerial,
  perform1200BaudTouch,
} from './serialUtils';

const ACK = 0x79;
const NACK = 0x1f;
const RESPONSE_TIMEOUT = 3000;
const ERASE_TIMEOUT = 30000;
const WRITE_TIMEOUT = 5000;
const BOOT_WAIT_MS = 3000;

const CMD_GET_ID = 0x02;
const CMD_WRITE_MEM = 0x31;
const CMD_ERASE = 0x44;
const CMD_GO = 0x21;

const FLASH_BASE = 0x08000000;
const FLASH_PAGE_SIZE = 256;
const BOOTLOADER_SIZE = 0x20000;
const USER_FLASH_BASE = FLASH_BASE + BOOTLOADER_SIZE;

type ProgressCb = (message: string, percent: number) => void;

// ── Helpers ──

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

async function waitAck(reader: ReadableStreamDefaultReader<Uint8Array>, timeout = RESPONSE_TIMEOUT): Promise<void> {
  const resp = await readBytes(reader, 1, timeout);
  if (resp[0] === NACK) throw new Error('NACK received from bootloader');
  if (resp[0] !== ACK) throw new Error(`Expected ACK (0x79), got 0x${resp[0].toString(16)}`);
}

function xorChecksum(data: Uint8Array | number[]): number {
  let chk = 0;
  for (const b of data) chk ^= b;
  return chk;
}

async function initConnection(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await writer.write(new Uint8Array([0x7f]));
      await waitAck(reader, 2000);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error('Failed to initialize STM32 bootloader.');
}

async function sendCmd(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  cmd: number
): Promise<void> {
  await writer.write(new Uint8Array([cmd, cmd ^ 0xff]));
  await waitAck(reader);
}

async function getChipId(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<number> {
  await sendCmd(writer, reader, CMD_GET_ID);
  const lenByte = await readBytes(reader, 1);
  const n = lenByte[0] + 1;
  const idBytes = await readBytes(reader, n);
  await waitAck(reader);
  return n >= 2 ? (idBytes[0] << 8) | idBytes[1] : idBytes[0];
}

async function writeMemory(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  address: number,
  data: Uint8Array
): Promise<void> {
  await sendCmd(writer, reader, CMD_WRITE_MEM);
  const addrBytes = [
    (address >> 24) & 0xff, (address >> 16) & 0xff,
    (address >> 8) & 0xff, address & 0xff,
  ];
  await writer.write(new Uint8Array([...addrBytes, xorChecksum(addrBytes)]));
  await waitAck(reader, WRITE_TIMEOUT);

  const n = data.length - 1;
  const frame = new Uint8Array(1 + data.length + 1);
  frame[0] = n;
  frame.set(data, 1);
  frame[frame.length - 1] = xorChecksum(frame.subarray(0, frame.length - 1));
  await writer.write(frame);
  await waitAck(reader, WRITE_TIMEOUT);
}

async function extendedErase(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  await sendCmd(writer, reader, CMD_ERASE);
  await writer.write(new Uint8Array([0xff, 0xff, 0x00]));
  await waitAck(reader, ERASE_TIMEOUT);
}

async function goToAddress(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  address: number
): Promise<void> {
  await sendCmd(writer, reader, CMD_GO);
  const addrBytes = [
    (address >> 24) & 0xff, (address >> 16) & 0xff,
    (address >> 8) & 0xff, address & 0xff,
  ];
  await writer.write(new Uint8Array([...addrBytes, xorChecksum(addrBytes)]));
  try { await waitAck(reader, 1000); } catch { /* board may jump */ }
}

// ── Public API ──

/**
 * Flash firmware to STM32-based Arduino board.
 * @param port - Pre-acquired serial port (from user gesture)
 */
export async function flashViaSTM32(
  firmwareBase64: string,
  port: SerialPortLike,
  onProgress?: ProgressCb
): Promise<void> {
  const binaryStr = atob(firmwareBase64);
  const firmware = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) firmware[i] = binaryStr.charCodeAt(i);
  if (firmware.length === 0) throw new Error('Empty firmware');

  // 1200-baud touch on pre-acquired port
  onProgress?.('Triggering bootloader...', 8);
  await perform1200BaudTouch(port);
  onProgress?.('Waiting for bootloader...', 10);
  await new Promise(r => setTimeout(r, BOOT_WAIT_MS));

  // Find re-enumerated port via getPorts
  const serial = getSerial()!;
  const ports = await serial.getPorts();
  const bootPort = ports.length > 0 ? ports[ports.length - 1] : port;

  onProgress?.('Connecting to STM32 bootloader...', 12);
  await bootPort.open({ baudRate: 115200 });
  const reader = bootPort.readable!.getReader();
  const writer = bootPort.writable!.getWriter();

  try {
    onProgress?.('Initializing...', 14);
    await initConnection(writer, reader);

    const chipId = await getChipId(writer, reader);
    onProgress?.(`Connected to STM32 (PID: 0x${chipId.toString(16)})`, 16);

    onProgress?.('Erasing flash...', 18);
    await extendedErase(writer, reader);

    const totalPages = Math.ceil(firmware.length / FLASH_PAGE_SIZE);
    for (let i = 0; i < totalPages; i++) {
      const offset = i * FLASH_PAGE_SIZE;
      const end = Math.min(offset + FLASH_PAGE_SIZE, firmware.length);
      const page = new Uint8Array(FLASH_PAGE_SIZE);
      page.fill(0xff);
      page.set(firmware.subarray(offset, end));
      const addr = USER_FLASH_BASE + offset;
      const pct = 20 + Math.round((i / totalPages) * 70);
      onProgress?.(`Writing page ${i + 1}/${totalPages}...`, pct);
      await writeMemory(writer, reader, addr, page);
    }

    onProgress?.('Starting application...', 95);
    await goToAddress(writer, reader, USER_FLASH_BASE);
    onProgress?.('Upload complete! Board is running your sketch.', 100);
  } finally {
    try { reader.releaseLock(); } catch { /**/ }
    try { writer.releaseLock(); } catch { /**/ }
    try { await bootPort.close(); } catch { /**/ }
  }
}
