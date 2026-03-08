/**
 * Minimal esptool-compatible flasher for ESP32 and ESP8266 via WebSerial
 *
 * IMPORTANT: All requestPort() calls removed. Port must be pre-acquired
 * in a user gesture context and passed in.
 */

import { SerialPortLike } from './serialUtils';

const SLIP_END = 0xc0;
const SLIP_ESC = 0xdb;
const SLIP_ESC_END = 0xdc;
const SLIP_ESC_ESC = 0xdd;

const ESP_SYNC = 0x08;
const ESP_READ_REG = 0x0a;
const ESP_FLASH_BEGIN = 0x02;
const ESP_FLASH_DATA = 0x03;
const ESP_FLASH_END = 0x04;

const CHIP_DETECT_MAGIC_REG = 0x40001000;
const ESP8266_MAGIC = 0xfff0c101;
const ESP32_MAGIC = 0x00f01d83;

const ESP_FLASH_WRITE_SIZE = 0x4000;
const FLASH_SECTOR_SIZE = 4096;
const SYNC_TIMEOUT = 3000;
const CMD_TIMEOUT = 5000;
const FLASH_TIMEOUT = 30000;
const DEFAULT_BAUD = 115200;

type ProgressCb = (message: string, percent: number) => void;

// ── SLIP framing ──

function slipEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [SLIP_END];
  for (const byte of data) {
    if (byte === SLIP_END) { out.push(SLIP_ESC, SLIP_ESC_END); }
    else if (byte === SLIP_ESC) { out.push(SLIP_ESC, SLIP_ESC_ESC); }
    else { out.push(byte); }
  }
  out.push(SLIP_END);
  return new Uint8Array(out);
}

async function slipReadFrame(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeout = CMD_TIMEOUT
): Promise<Uint8Array> {
  const deadline = Date.now() + timeout;
  const frame: number[] = [];
  let inFrame = false;

  while (Date.now() < deadline) {
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise<{ value: undefined; done: true }>((_, rej) =>
        setTimeout(() => rej(new Error('SLIP read timeout')), Math.max(50, deadline - Date.now()))
      ),
    ]);
    if (done || !value) break;

    for (const byte of value) {
      if (byte === SLIP_END) {
        if (inFrame && frame.length > 0) return new Uint8Array(frame);
        inFrame = true;
        frame.length = 0;
      } else if (inFrame) {
        if (byte === SLIP_ESC) continue;
        if (frame.length > 0 && frame[frame.length - 1] === SLIP_ESC) {
          frame.pop();
          if (byte === SLIP_ESC_END) frame.push(SLIP_END);
          else if (byte === SLIP_ESC_ESC) frame.push(SLIP_ESC);
          else frame.push(byte);
        } else {
          frame.push(byte);
        }
      }
    }
  }
  throw new Error('SLIP frame read timeout');
}

function espChecksum(data: Uint8Array): number {
  let chk = 0xef;
  for (const b of data) chk ^= b;
  return chk;
}

function buildCommand(opcode: number, data: Uint8Array, checksum = 0): Uint8Array {
  const pkt = new Uint8Array(8 + data.length);
  pkt[0] = 0x00;
  pkt[1] = opcode;
  pkt[2] = data.length & 0xff;
  pkt[3] = (data.length >> 8) & 0xff;
  pkt[4] = checksum & 0xff;
  pkt[5] = (checksum >> 8) & 0xff;
  pkt[6] = (checksum >> 16) & 0xff;
  pkt[7] = (checksum >> 24) & 0xff;
  pkt.set(data, 8);
  return pkt;
}

async function sendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  opcode: number,
  data: Uint8Array = new Uint8Array(0),
  checksum = 0,
  timeout = CMD_TIMEOUT
): Promise<{ value: number; data: Uint8Array }> {
  const cmd = buildCommand(opcode, data, checksum);
  await writer.write(slipEncode(cmd));

  const frame = await slipReadFrame(reader, timeout);
  if (frame.length < 8) throw new Error(`Short response: ${frame.length} bytes`);
  if (frame[0] !== 0x01) throw new Error(`Not a response frame`);
  if (frame[1] !== opcode) throw new Error(`Opcode mismatch`);

  const value = frame[4] | (frame[5] << 8) | (frame[6] << 16) | ((frame[7] << 24) >>> 0);
  const respData = frame.subarray(8);

  if (respData.length >= 2) {
    const status = respData[respData.length - 2];
    if (status !== 0) {
      throw new Error(`Command 0x${opcode.toString(16)} failed: status=${status}`);
    }
  }

  return { value, data: respData.subarray(0, respData.length - 2) };
}

async function enterBootloader(port: SerialPortLike): Promise<void> {
  if (!port.setSignals) return;
  await port.setSignals({ dataTerminalReady: false, requestToSend: true });
  await new Promise(r => setTimeout(r, 100));
  await port.setSignals({ dataTerminalReady: true, requestToSend: false });
  await new Promise(r => setTimeout(r, 50));
  await port.setSignals({ dataTerminalReady: false });
}

async function syncBootloader(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  const syncData = new Uint8Array(36);
  syncData[0] = 0x07; syncData[1] = 0x07; syncData[2] = 0x12; syncData[3] = 0x20;
  syncData.fill(0x55, 4);

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await sendCommand(writer, reader, ESP_SYNC, syncData, 0, SYNC_TIMEOUT);
      for (let i = 0; i < 7; i++) {
        try { await slipReadFrame(reader, 200); } catch { break; }
      }
      return;
    } catch {
      await new Promise(r => setTimeout(r, 50));
    }
  }
  throw new Error('Failed to sync with ESP bootloader. Hold BOOT button during reset.');
}

async function detectChip(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<'esp32' | 'esp8266'> {
  const addrData = new Uint8Array(4);
  new DataView(addrData.buffer).setUint32(0, CHIP_DETECT_MAGIC_REG, true);
  const { value } = await sendCommand(writer, reader, ESP_READ_REG, addrData);
  if (value === ESP8266_MAGIC) return 'esp8266';
  return 'esp32';
}

async function flashBegin(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  size: number,
  offset: number
): Promise<void> {
  const numBlocks = Math.ceil(size / ESP_FLASH_WRITE_SIZE);
  const eraseSize = Math.ceil(size / FLASH_SECTOR_SIZE) * FLASH_SECTOR_SIZE;
  const data = new Uint8Array(16);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, eraseSize, true);
  dv.setUint32(4, numBlocks, true);
  dv.setUint32(8, ESP_FLASH_WRITE_SIZE, true);
  dv.setUint32(12, offset, true);
  await sendCommand(writer, reader, ESP_FLASH_BEGIN, data, 0, FLASH_TIMEOUT);
}

async function flashBlock(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  blockData: Uint8Array,
  seq: number
): Promise<void> {
  const header = new Uint8Array(16);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, blockData.length, true);
  dv.setUint32(4, seq, true);
  const payload = new Uint8Array(header.length + blockData.length);
  payload.set(header);
  payload.set(blockData, header.length);
  await sendCommand(writer, reader, ESP_FLASH_DATA, payload, espChecksum(blockData), FLASH_TIMEOUT);
}

async function flashEnd(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  reboot: boolean
): Promise<void> {
  const data = new Uint8Array(4);
  new DataView(data.buffer).setUint32(0, reboot ? 0 : 1, true);
  try {
    await sendCommand(writer, reader, ESP_FLASH_END, data, 0, 2000);
  } catch { /* board may reboot */ }
}

// ── Public API ──

/**
 * Flash firmware to ESP32/ESP8266 via ROM bootloader.
 * @param port - Pre-acquired serial port (from user gesture)
 */
export async function flashViaEsptool(
  firmwareBase64: string,
  port: SerialPortLike,
  chipHint: 'esp32' | 'esp8266' = 'esp32',
  onProgress?: ProgressCb
): Promise<void> {
  const binaryStr = atob(firmwareBase64);
  const firmware = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) firmware[i] = binaryStr.charCodeAt(i);
  if (firmware.length === 0) throw new Error('Empty firmware');

  await port.open({ baudRate: DEFAULT_BAUD });
  const reader = port.readable!.getReader();
  const writer = port.writable!.getWriter();

  try {
    onProgress?.('Entering bootloader mode...', 5);
    await enterBootloader(port);
    await new Promise(r => setTimeout(r, 200));

    onProgress?.('Syncing with bootloader...', 8);
    await syncBootloader(writer, reader);

    onProgress?.('Detecting chip...', 10);
    const chip = await detectChip(writer, reader);
    onProgress?.(`Detected: ${chip.toUpperCase()}`, 12);

    const flashOffset = chip === 'esp32' ? 0x10000 : 0x0;

    onProgress?.('Erasing flash region...', 15);
    await flashBegin(writer, reader, firmware.length, flashOffset);

    const blockSize = ESP_FLASH_WRITE_SIZE;
    const totalBlocks = Math.ceil(firmware.length / blockSize);

    for (let i = 0; i < totalBlocks; i++) {
      const offset = i * blockSize;
      const end = Math.min(offset + blockSize, firmware.length);
      const chunk = new Uint8Array(blockSize);
      chunk.fill(0xff);
      chunk.set(firmware.subarray(offset, end));
      const pct = 15 + Math.round((i / totalBlocks) * 75);
      onProgress?.(`Writing block ${i + 1}/${totalBlocks}...`, pct);
      await flashBlock(writer, reader, chunk, i);
    }

    onProgress?.('Finalizing flash...', 93);
    await flashEnd(writer, reader, true);
    onProgress?.('Upload complete! Board is restarting.', 100);
  } finally {
    try { reader.releaseLock(); } catch { /**/ }
    try { writer.releaseLock(); } catch { /**/ }
    try { await port.close(); } catch { /**/ }
  }
}
