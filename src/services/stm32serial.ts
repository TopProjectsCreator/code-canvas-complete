/**
 * STM32 System Bootloader (USART) flasher for Portenta H7 and GIGA R1 WiFi
 *
 * The STM32H747 has a built-in system bootloader in ROM that speaks a
 * well-documented UART protocol (AN2606/AN3155).
 *
 * Entry: Board must be in system bootloader mode:
 *   - BOOT0 pin high + reset, OR
 *   - Software jump to system bootloader address, OR
 *   - 1200-baud touch (Arduino bootloader triggers system bootloader)
 *
 * Protocol:
 *   - Send 0x7F to auto-detect baud rate
 *   - Commands: Get (0x00), Get ID (0x02), Read Memory (0x11),
 *     Write Memory (0x31), Erase (0x43/0x44), Go (0x21)
 *   - Each command: send cmd + complement, wait ACK (0x79) or NACK (0x1F)
 *   - Data frames include XOR checksum
 */

const ACK = 0x79;
const NACK = 0x1f;
const RESPONSE_TIMEOUT = 3000;
const ERASE_TIMEOUT = 30000;
const WRITE_TIMEOUT = 5000;
const BOOT_WAIT_MS = 3000;

// STM32 commands
const CMD_GET = 0x00;
const CMD_GET_ID = 0x02;
const CMD_READ_MEM = 0x11;
const CMD_WRITE_MEM = 0x31;
const CMD_ERASE = 0x44; // Extended erase for STM32H7
const CMD_GO = 0x21;

// STM32H747 flash
const FLASH_BASE = 0x08000000;
const FLASH_PAGE_SIZE = 256; // System bootloader write granularity
const BOOTLOADER_SIZE = 0x20000; // 128KB bootloader reservation (Arduino)
const USER_FLASH_BASE = FLASH_BASE + BOOTLOADER_SIZE;

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}

interface SerialLike {
  requestPort(options?: { filters?: Array<{ usbVendorId?: number }> }): Promise<SerialPortLike>;
}

const getSerial = (): SerialLike | undefined =>
  (navigator as unknown as { serial?: SerialLike }).serial;

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

async function waitAck(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeout = RESPONSE_TIMEOUT
): Promise<void> {
  const resp = await readBytes(reader, 1, timeout);
  if (resp[0] === NACK) throw new Error('NACK received from bootloader');
  if (resp[0] !== ACK) throw new Error(`Expected ACK (0x79), got 0x${resp[0].toString(16)}`);
}

function xorChecksum(data: Uint8Array | number[]): number {
  let chk = 0;
  for (const b of data) chk ^= b;
  return chk;
}

// ── STM32 Bootloader Commands ──

async function initConnection(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  // Send 0x7F for auto-baud detection
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await writer.write(new Uint8Array([0x7f]));
      await waitAck(reader, 2000);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error('Failed to initialize STM32 bootloader. Ensure board is in bootloader mode.');
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
  // PID is typically 2 bytes big-endian
  return n >= 2 ? (idBytes[0] << 8) | idBytes[1] : idBytes[0];
}

async function writeMemory(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  address: number,
  data: Uint8Array
): Promise<void> {
  if (data.length > 256 || data.length === 0) throw new Error(`Invalid write size: ${data.length}`);

  await sendCmd(writer, reader, CMD_WRITE_MEM);

  // Send address + checksum
  const addrBytes = [
    (address >> 24) & 0xff,
    (address >> 16) & 0xff,
    (address >> 8) & 0xff,
    address & 0xff,
  ];
  await writer.write(new Uint8Array([...addrBytes, xorChecksum(addrBytes)]));
  await waitAck(reader, WRITE_TIMEOUT);

  // Send N-1, data bytes, checksum
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
  reader: ReadableStreamDefaultReader<Uint8Array>,
  pages: number[]
): Promise<void> {
  await sendCmd(writer, reader, CMD_ERASE);

  if (pages.length === 0) {
    // Global mass erase: 0xFFFF
    const data = new Uint8Array([0xff, 0xff, 0x00]); // 0xFFFF + checksum
    await writer.write(data);
  } else {
    const n = pages.length - 1;
    const frame: number[] = [(n >> 8) & 0xff, n & 0xff];
    for (const p of pages) {
      frame.push((p >> 8) & 0xff, p & 0xff);
    }
    frame.push(xorChecksum(frame));
    await writer.write(new Uint8Array(frame));
  }

  await waitAck(reader, ERASE_TIMEOUT);
}

async function goToAddress(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  address: number
): Promise<void> {
  await sendCmd(writer, reader, CMD_GO);
  const addrBytes = [
    (address >> 24) & 0xff,
    (address >> 16) & 0xff,
    (address >> 8) & 0xff,
    address & 0xff,
  ];
  await writer.write(new Uint8Array([...addrBytes, xorChecksum(addrBytes)]));
  try { await waitAck(reader, 1000); } catch { /* board may jump immediately */ }
}

// ── 1200-baud touch ──

async function triggerBootloader(onProgress?: ProgressCb): Promise<void> {
  const serial = getSerial();
  if (!serial) throw new Error('Web Serial API not supported. Use Chrome or Edge.');

  onProgress?.('Select the board serial port...', 5);
  const port = await serial.requestPort({ filters: [{ usbVendorId: 0x2341 }] });

  onProgress?.('Triggering bootloader via 1200-baud touch...', 8);
  try {
    await port.open({ baudRate: 1200 });
    if (port.setSignals) {
      await port.setSignals({ dataTerminalReady: false });
      await new Promise(r => setTimeout(r, 100));
      await port.setSignals({ dataTerminalReady: true });
      await new Promise(r => setTimeout(r, 100));
      await port.setSignals({ dataTerminalReady: false });
    }
    await new Promise(r => setTimeout(r, 200));
    await port.close();
  } catch (err) {
    try { await port.close(); } catch { /**/ }
    throw new Error(`Bootloader trigger failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  onProgress?.('Waiting for bootloader...', 10);
  await new Promise(r => setTimeout(r, BOOT_WAIT_MS));
}

// ── Public API ──

/**
 * Flash binary firmware to an STM32-based Arduino board (Portenta H7, GIGA R1)
 * via the STM32 system bootloader UART protocol.
 */
export async function flashViaSTM32(
  firmwareBase64: string,
  onProgress?: ProgressCb
): Promise<void> {
  const serial = getSerial();
  if (!serial) throw new Error('Web Serial API not supported. Use Chrome or Edge.');

  // Decode firmware
  const binaryStr = atob(firmwareBase64);
  const firmware = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) firmware[i] = binaryStr.charCodeAt(i);
  if (firmware.length === 0) throw new Error('Empty firmware');

  // Step 1: Trigger bootloader
  await triggerBootloader(onProgress);

  // Step 2: Connect to bootloader
  onProgress?.('Select the bootloader serial port...', 12);
  const port = await serial.requestPort({ filters: [{ usbVendorId: 0x2341 }] });
  await port.open({ baudRate: 115200 });

  const reader = port.readable!.getReader();
  const writer = port.writable!.getWriter();

  try {
    // Init auto-baud
    onProgress?.('Initializing STM32 bootloader...', 14);
    await initConnection(writer, reader);

    // Get chip ID
    const chipId = await getChipId(writer, reader);
    onProgress?.(`Connected to STM32 (PID: 0x${chipId.toString(16)})`, 16);

    // Erase flash (global erase for simplicity)
    onProgress?.('Erasing flash...', 18);
    await extendedErase(writer, reader, []);

    // Write firmware in 256-byte pages
    const totalPages = Math.ceil(firmware.length / FLASH_PAGE_SIZE);
    for (let i = 0; i < totalPages; i++) {
      const offset = i * FLASH_PAGE_SIZE;
      const end = Math.min(offset + FLASH_PAGE_SIZE, firmware.length);
      const page = new Uint8Array(FLASH_PAGE_SIZE);
      page.fill(0xff);
      page.set(firmware.subarray(offset, end));

      const addr = USER_FLASH_BASE + offset;
      const pct = 20 + Math.round((i / totalPages) * 70);
      onProgress?.(`Writing page ${i + 1}/${totalPages} @ 0x${addr.toString(16)}...`, pct);

      await writeMemory(writer, reader, addr, page);
    }

    // Jump to application
    onProgress?.('Starting application...', 95);
    await goToAddress(writer, reader, USER_FLASH_BASE);

    onProgress?.('Upload complete! Board is running your sketch.', 100);
  } finally {
    try { reader.releaseLock(); } catch { /**/ }
    try { writer.releaseLock(); } catch { /**/ }
    try { await port.close(); } catch { /**/ }
  }
}
