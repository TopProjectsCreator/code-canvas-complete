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

const ESP_FLASH_WRITE_SIZE = 0x4000;
const FLASH_SECTOR_SIZE = 4096;
const SYNC_TIMEOUT = 3000;
const CMD_TIMEOUT = 5000;
const FLASH_TIMEOUT = 30000;
const MAX_SKIPPED_FRAMES = 100;
const DEFAULT_BAUD = 115200;

type ProgressCb = (message: string, percent: number) => void;
type EspChip = 'esp32' | 'esp8266';

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

// Per-reader SLIP decode state. The decoder may receive multiple frames per
// chunk (the ROM replies to a single SYNC with up to 8 frames, often
// coalesced), so complete frames are queued and handed out one per call. A
// frame may also be split across chunk boundaries, so the partially-built
// frame and the in-frame/escape flags persist across calls too. Finally, a
// read that lost a race with the timeout may still deliver data afterwards —
// those bytes are kept in `prefetch` so a slow response isn't lost.
interface SlipReaderState {
  frames: Uint8Array[];
  prefetch: Uint8Array;
  frame: number[];
  inFrame: boolean;
  pendingEscape: boolean;
}

const slipReaderStates = new WeakMap<ReadableStreamDefaultReader<Uint8Array>, SlipReaderState>();

function slipStateFor(reader: ReadableStreamDefaultReader<Uint8Array>): SlipReaderState {
  let state = slipReaderStates.get(reader);
  if (!state) {
    state = { frames: [], prefetch: new Uint8Array(0), frame: [], inFrame: false, pendingEscape: false };
    slipReaderStates.set(reader, state);
  }
  return state;
}

// Exported for unit tests.
export async function slipReadFrame(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeout = CMD_TIMEOUT
): Promise<Uint8Array> {
  const state = slipStateFor(reader);
  if (state.frames.length > 0) return state.frames.shift()!;

  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    let value: Uint8Array | undefined;
    let done = false;

    if (state.prefetch.length > 0) {
      value = state.prefetch;
      state.prefetch = new Uint8Array(0);
    } else {
      const readPromise = reader.read();
      const timer = new Promise<{ value: undefined; done: true }>((_, rej) =>
        setTimeout(() => rej(new Error('SLIP read timeout')), Math.max(50, deadline - Date.now()))
      );
      timer.catch(() => { /* race already settled — nothing to do */ });
      try {
        const chunk = await Promise.race([readPromise, timer]);
        value = chunk.value;
        done = chunk.done;
      } catch (err) {
        // The timed-out read may still deliver a response afterwards — keep its
        // bytes so the next call can decode them (e.g. a slow SYNC response).
        readPromise.then(
          (chunk) => {
            if (chunk && chunk.value && chunk.value.length > 0) {
              const buf = new Uint8Array(state.prefetch.length + chunk.value.length);
              buf.set(state.prefetch);
              buf.set(chunk.value, state.prefetch.length);
              state.prefetch = buf;
            }
          },
          () => { /* stream cancelled — nothing to recover */ }
        );
        throw err;
      }
    }

    if (done || !value) {
      if (state.frames.length > 0) return state.frames.shift()!;
      throw new Error('SLIP stream closed before a complete frame was received');
    }

    // Restore per-call decode state (persists across chunks).
    const frame = state.frame;
    let inFrame = state.inFrame;
    let pendingEscape = state.pendingEscape;

    for (const byte of value) {
      if (byte === SLIP_END) {
        if (inFrame && frame.length > 0) {
          state.frames.push(new Uint8Array(frame));
          frame.length = 0;
          pendingEscape = false;
        } else {
          inFrame = true;
          frame.length = 0;
          pendingEscape = false;
        }
      } else if (inFrame) {
        if (pendingEscape) {
          // 0xdb was consumed as the escape marker — decode the byte after it.
          pendingEscape = false;
          if (byte === SLIP_ESC_END) frame.push(SLIP_END);
          else if (byte === SLIP_ESC_ESC) frame.push(SLIP_ESC);
          else frame.push(byte);
        } else if (byte === SLIP_ESC) {
          pendingEscape = true;
        } else {
          frame.push(byte);
        }
      }
    }

    state.inFrame = inFrame;
    state.pendingEscape = pendingEscape;

    if (state.frames.length > 0) return state.frames.shift()!;
  }

  if (state.frames.length > 0) return state.frames.shift()!;
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

/**
 * Parse the trailing status bytes of a ROM response frame.
 * - ESP8266: 2 status bytes at the very end.
 * - ESP32 and newer: 2 status bytes followed by 2 reserved bytes.
 *
 * When the chip is not known yet (sync / chip detection) the ESP32 layout is
 * tried first. This is safe for the pre-detection commands used here (SYNC,
 * READ_REG): their bodies contain no payload data, so the status occupies the
 * first 2 bytes in both layouts and the two interpretations agree. Once the
 * chip is detected, all flash commands pass the chip explicitly.
 *
 * A body that cannot contain a status word is protocol corruption and is
 * rejected — it must never be treated as a successful response.
 */
// Exported for unit tests.
export function parseResponseStatus(
  respData: Uint8Array,
  chip?: EspChip
): { status: number; dataLength: number } {
  const len = respData.length;
  if (len < 2) {
    throw new Error(`Short response body (${len} bytes) — missing status bytes`);
  }

  if (chip === 'esp8266') {
    const status = respData[len - 2] | (respData[len - 1] << 8);
    return { status, dataLength: len - 2 };
  }

  if (chip === 'esp32') {
    // ESP32 bodies are [data…, status(2), reserved(2)] — anything shorter
    // than 4 bytes is truncated and must not be accepted as success.
    if (len < 4) {
      throw new Error(`Truncated ESP32 response body (${len} bytes) — missing status/reserved bytes`);
    }
    const status = respData[len - 4] | (respData[len - 3] << 8);
    return { status, dataLength: len - 4 };
  }

  if (len >= 4) {
    const esp32Status = respData[len - 4] | (respData[len - 3] << 8);
    if (esp32Status === 0) return { status: 0, dataLength: len - 4 };
  }
  const esp8266Status = respData[len - 2] | (respData[len - 1] << 8);
  return { status: esp8266Status, dataLength: len - 2 };
}

/**
 * Send a command and read its response.
 *
 * The serial stream is shared, so the response to the previous command may
 * still be queued (e.g. the ROM answers one SYNC with up to 8 frames, and
 * some ESP8266s reply with even more). Instead of assuming the next frame is
 * ours, frames are read in a loop and skipped until one carries this
 * command's opcode — exactly what esptool.py does. The loop is bounded both
 * by the overall timeout and by MAX_SKIPPED_FRAMES, so a dead stream fails
 * with a timeout rather than spinning forever.
 */
async function sendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  opcode: number,
  data: Uint8Array = new Uint8Array(0),
  checksum = 0,
  timeout = CMD_TIMEOUT,
  chip?: EspChip
): Promise<{ value: number; data: Uint8Array }> {
  const cmd = buildCommand(opcode, data, checksum);
  await writer.write(slipEncode(cmd));

  const deadline = Date.now() + timeout;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_SKIPPED_FRAMES; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const frame = await slipReadFrame(reader, remaining);

    if (frame.length < 8 || frame[0] !== 0x01 || frame[1] !== opcode) {
      // Stale frame from a previous command (or serial garbage) — skip it and
      // keep reading. slipReadFrame throws on timeout/stream close, which
      // propagates straight out of sendCommand.
      lastError = new Error(`Unexpected frame (opcode 0x${frame[1]?.toString(16) ?? '??'})`);
      continue;
    }

    const value = frame[4] | (frame[5] << 8) | (frame[6] << 16) | ((frame[7] << 24) >>> 0);
    const respData = frame.subarray(8);

    const { status, dataLength } = parseResponseStatus(respData, chip);
    if (status !== 0) {
      throw new Error(`Command 0x${opcode.toString(16)} failed: status=${status}`);
    }

    return { value, data: respData.subarray(0, dataLength) };
  }

  throw lastError ?? new Error(`Command 0x${opcode.toString(16)} timed out (no matching response)`);
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

  // The ROM answers one SYNC with multiple frames; sendCommand's skip loop
  // discards any leftovers when reading the next command's response, so no
  // explicit drain is needed here.
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await sendCommand(writer, reader, ESP_SYNC, syncData, 0, SYNC_TIMEOUT);
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
): Promise<EspChip> {
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
  offset: number,
  chip: EspChip
): Promise<void> {
  const numBlocks = Math.ceil(size / ESP_FLASH_WRITE_SIZE);
  const eraseSize = Math.ceil(size / FLASH_SECTOR_SIZE) * FLASH_SECTOR_SIZE;
  const data = new Uint8Array(16);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, eraseSize, true);
  dv.setUint32(4, numBlocks, true);
  dv.setUint32(8, ESP_FLASH_WRITE_SIZE, true);
  dv.setUint32(12, offset, true);
  // The ROM performs the erase up front, so give it time proportional to the
  // erased size (~40 s per MiB, like esptool's timeout_per_mb) instead of a
  // fixed 30 s — a large erase can otherwise abort mid-flight, leaving the
  // chip half-erased.
  const eraseTimeout = Math.max(CMD_TIMEOUT, Math.ceil((eraseSize / (1024 * 1024)) * 40 * 1000));
  await sendCommand(writer, reader, ESP_FLASH_BEGIN, data, 0, eraseTimeout, chip);
}

async function flashBlock(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  blockData: Uint8Array,
  seq: number,
  chip: EspChip
): Promise<void> {
  const header = new Uint8Array(16);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, blockData.length, true);
  dv.setUint32(4, seq, true);
  const payload = new Uint8Array(header.length + blockData.length);
  payload.set(header);
  payload.set(blockData, header.length);

  // A transient line error must not abort the whole flash — esptool retries
  // block writes too. Note: if the first attempt actually wrote the block but
  // its acknowledgement was lost, the ROM rejects the retry (bad sequence
  // number), so this only recovers errors that occurred before the write.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await sendCommand(writer, reader, ESP_FLASH_DATA, payload, espChecksum(blockData), FLASH_TIMEOUT, chip);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function flashEnd(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  reboot: boolean,
  chip: EspChip
): Promise<void> {
  const data = new Uint8Array(4);
  new DataView(data.buffer).setUint32(0, reboot ? 0 : 1, true);
  try {
    await sendCommand(writer, reader, ESP_FLASH_END, data, 0, 2000, chip);
  } catch {
    // Swallowing is intentional here (esptool does the same for ROM flashes):
    // the board reboots on this command, so the port often goes away before the
    // response arrives. All payload blocks have already been written and
    // status-checked at this point, so a lost final ack cannot hide corruption.
  }
}

// ── Public API ──

/**
 * Flash firmware to ESP32/ESP8266 via ROM bootloader.
 * @param port - Pre-acquired serial port (from user gesture)
 */
export async function flashViaEsptool(
  firmwareBase64: string,
  port: SerialPortLike,
  _chipHint?: string,
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
    await flashBegin(writer, reader, firmware.length, flashOffset, chip);

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
      await flashBlock(writer, reader, chunk, i, chip);
    }

    onProgress?.('Finalizing flash...', 93);
    await flashEnd(writer, reader, true, chip);
    onProgress?.('Upload complete! Board is restarting.', 100);
  } finally {
    try { reader.releaseLock(); } catch { /**/ }
    try { writer.releaseLock(); } catch { /**/ }
    try { await port.close(); } catch { /**/ }
  }
}
