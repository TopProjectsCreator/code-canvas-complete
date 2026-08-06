import { describe, expect, it } from 'vitest';
import { slipReadFrame, parseResponseStatus, flashViaEsptool } from '@/services/esptool';
import { parseIntelHex } from '@/services/hexParser';
import { BufferedByteReader } from '@/services/sambaFlash';

// ── End-to-end ESP flash via a mock ROM bootloader port ──────
// Exercises the SLIP frame queue (multiple SYNC frames in one chunk), the
// per-chip status parsing, the opcode-skip loop (stale frames from a previous
// command must never poison the next command), and the FLASH_DATA retry.

function slipEncode(bytes: number[]): number[] {
  const out: number[] = [0xc0];
  for (const b of bytes) {
    if (b === 0xc0) out.push(0xdb, 0xdc);
    else if (b === 0xdb) out.push(0xdb, 0xdd);
    else out.push(b);
  }
  out.push(0xc0);
  return out;
}

function syncFrame(): number[] {
  return slipEncode([0x01, 0x08, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
}

function readRegFrame(): number[] {
  // ESP32 ROM response: header value = register value; body = [status(2), reserved(2)].
  return slipEncode([0x01, 0x0a, 0x00, 0x00, 0x00, 0x10, 0x00, 0x40, 0x00, 0x00, 0x00, 0x01]);
}

class MockEsp32Port {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  private controller!: ReadableStreamDefaultController<Uint8Array>;
  flashDataAttempts = 0;

  constructor(
    private readonly options: {
      /** How many frames the ROM sends for one SYNC (default 8). */
      syncFrames?: number;
      /** Extra stale sync frames sent immediately before the READ_REG response. */
      staleBeforeReadReg?: number;
    } = {}
  ) {
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
      },
    });
    this.writable = new WritableStream<Uint8Array>({
      write: async (chunk) => this.handleCommand(Uint8Array.from(chunk)),
    });
  }

  async open(): Promise<void> {}
  async close(): Promise<void> {}
  async setSignals(): Promise<void> {}

  private respond(opcode: number, value: number, status = 0): void {
    const body = [status & 0xff, (status >> 8) & 0xff, 0x00, 0x01];
    const header = [0x01, opcode, body.length & 0xff, (body.length >> 8) & 0xff,
      value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
    this.controller.enqueue(Uint8Array.from(slipEncode([...header, ...body])));
  }

  private async handleCommand(chunk: Uint8Array): Promise<void> {
    const decoded: number[] = [];
    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i];
      if (b === 0xc0) continue;
      if (b === 0xdb) {
        i++;
        decoded.push(chunk[i] === 0xdc ? 0xc0 : chunk[i] === 0xdd ? 0xdb : chunk[i]);
      } else {
        decoded.push(b);
      }
    }
    const opcode = decoded[1];

    switch (opcode) {
      case 0x08: { // SYNC — all responses coalesced into one chunk
        const frames: number[] = [];
        for (let i = 0; i < (this.options.syncFrames ?? 8); i++) frames.push(...syncFrame());
        this.controller.enqueue(Uint8Array.from(frames));
        return;
      }
      case 0x0a: { // READ_REG
        const stale = this.options.staleBeforeReadReg ?? 0;
        if (stale > 0) {
          const frames: number[] = [];
          for (let i = 0; i < stale; i++) frames.push(...syncFrame());
          frames.push(...readRegFrame());
          this.controller.enqueue(Uint8Array.from(frames));
        } else {
          this.respond(0x0a, 0x40001000);
        }
        return;
      }
      case 0x02: // FLASH_BEGIN
        this.respond(0x02, 0);
        return;
      case 0x03: { // FLASH_DATA — reject the first attempt, accept the retry
        this.flashDataAttempts++;
        this.respond(0x03, 0, this.flashDataAttempts === 1 ? 1 : 0);
        return;
      }
      case 0x04: // FLASH_END
        this.respond(0x04, 0);
        return;
      default:
        throw new Error(`Unexpected opcode 0x${opcode.toString(16)}`);
    }
  }
}

function base64Firmware(size: number): string {
  const firmware = new Uint8Array(size);
  let binary = '';
  for (const byte of firmware) binary += String.fromCharCode(byte);
  return btoa(binary);
}

describe('flashViaEsptool (mock ROM bootloader)', () => {
  it('flashes successfully across sync, chip detect, a retried block write, and flash end', async () => {
    const port = new MockEsp32Port();
    await expect(flashViaEsptool(base64Firmware(0x4000), port, undefined, () => {})).resolves.toBeUndefined();
    expect(port.flashDataAttempts).toBe(2);
  });

  it('survives extra SYNC responses (ESP8266 quirk) and stale frames before READ_REG', async () => {
    // Some ESP8266s answer SYNC with more responses than expected, and those
    // stale frames can still be in flight when the next command is sent. The
    // opcode-skip loop must discard them instead of aborting on "opcode
    // mismatch".
    const port = new MockEsp32Port({ syncFrames: 12, staleBeforeReadReg: 3 });
    await expect(flashViaEsptool(base64Firmware(0x4000), port, undefined, () => {})).resolves.toBeUndefined();
    expect(port.flashDataAttempts).toBe(2);
  });
});

// ── SLIP framing (#434 / #454) ───────────────────────────────

function readerFromChunks(chunks: number[][]): ReadableStreamDefaultReader<Uint8Array> {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(Uint8Array.from(chunk));
      controller.close();
    },
  });
  return stream.getReader();
}

describe('slipReadFrame', () => {
  it('decodes a plain frame', async () => {
    const frame = [0x01, 0x02, 0x03];
    const reader = readerFromChunks([[0xc0, ...frame, 0xc0]]);
    await expect(slipReadFrame(reader, 500)).resolves.toEqual(Uint8Array.from(frame));
  });

  it('decodes escaped END (0xdb 0xdc) and ESC (0xdb 0xdd) bytes', async () => {
    const raw = [0xc0, 0xdb];
    const escaped = [0xdb, 0xdc, 0xdb, 0xdd];
    const reader = readerFromChunks([[0xc0, ...escaped, 0xc0]]);
    await expect(slipReadFrame(reader, 500)).resolves.toEqual(Uint8Array.from(raw));
  });

  it('decodes escaped bytes split across chunks', async () => {
    const escaped = [0xdb, 0xdc, 0x41, 0xdb, 0xdd, 0x42];
    const reader = readerFromChunks([[0xc0], [0xdb, 0xdc], [0x41], [0xdb, 0xdd, 0x42], [0xc0]]);
    await expect(slipReadFrame(reader, 500)).resolves.toEqual(Uint8Array.from([0xc0, 0x41, 0xdb, 0x42]));
  });

  it('ignores garbage between frames', async () => {
    const reader = readerFromChunks([[0xde, 0xad, 0xc0, 0x01, 0xc0]]);
    await expect(slipReadFrame(reader, 500)).resolves.toEqual(Uint8Array.from([0x01]));
  });

  it('queues multiple frames that arrive in a single chunk', async () => {
    const reader = readerFromChunks([[0xc0, 0x01, 0xc0, 0xc0, 0x02, 0xc0]]);
    await expect(slipReadFrame(reader, 500)).resolves.toEqual(Uint8Array.from([0x01]));
    await expect(slipReadFrame(reader, 500)).resolves.toEqual(Uint8Array.from([0x02]));
  });

  it('does not leak queued frames across different readers', async () => {
    const a = readerFromChunks([[0xc0, 0x01, 0xc0, 0xc0, 0x02, 0xc0]]);
    await expect(slipReadFrame(a, 500)).resolves.toEqual(Uint8Array.from([0x01]));

    const b = readerFromChunks([[0xc0, 0x03, 0xc0]]);
    await expect(slipReadFrame(b, 500)).resolves.toEqual(Uint8Array.from([0x03]));
    await expect(slipReadFrame(a, 500)).resolves.toEqual(Uint8Array.from([0x02]));
  });

  it('carries a partial frame across chunk boundaries after a complete frame', async () => {
    // Chunk 1: complete frame [0x01], then a partial frame starts (0x02).
    // Chunk 2: continuation of the partial frame (0x03) + END.
    const reader = readerFromChunks([[0xc0, 0x01, 0xc0, 0x02], [0x03, 0xc0]]);
    await expect(slipReadFrame(reader, 500)).resolves.toEqual(Uint8Array.from([0x01]));
    await expect(slipReadFrame(reader, 500)).resolves.toEqual(Uint8Array.from([0x02, 0x03]));
  });

  it('round-trips SLIP-encoded frames through every possible chunk boundary', async () => {
    // Encode three frames — plain, escape bytes in the payload, and a long
    // one. Split the encoded data at every byte position and verify every
    // frame decodes correctly regardless of where chunk boundaries fall.
    const frames: number[][] = [
      [0x01],
      [0xc0, 0xdb], // payload containing SLIP_END and SLIP_ESC — need escaping
      [0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c],
    ];
    const encoded = new Uint8Array(frames.flatMap((f) => slipEncode(f)));

    for (let split = 1; split < encoded.length; split++) {
      const r = readerFromChunks([[...encoded.slice(0, split)], [...encoded.slice(split)]]);
      for (const frame of frames) {
        const got = await slipReadFrame(r, 500);
        expect(Array.from(got)).toEqual(frame);
      }
    }
  });
});

// ── Response status bytes (#422) ─────────────────────────────

describe('parseResponseStatus', () => {
  it('reads ESP32 status from the 2 bytes before the reserved marker', () => {
    const body = Uint8Array.from([0x10, 0x20, 0x30, 0x40, 0x00, 0x00, 0x00, 0x01]);
    const { status, dataLength } = parseResponseStatus(body, 'esp32');
    expect(status).toBe(0);
    expect(dataLength).toBe(4);
  });

  it('detects a non-zero ESP32 status', () => {
    const body = Uint8Array.from([0x10, 0x20, 0x30, 0x40, 0x01, 0x00, 0x00, 0x01]);
    const { status } = parseResponseStatus(body, 'esp32');
    expect(status).toBe(1);
  });

  it('rejects truncated ESP32 bodies (missing status/reserved bytes)', () => {
    // A 2-byte body cannot contain [status(2), reserved(2)] — it must not be
    // accepted as a successful response.
    expect(() => parseResponseStatus(Uint8Array.from([0x00, 0x00]), 'esp32')).toThrow(/truncated/i);
    expect(() => parseResponseStatus(Uint8Array.from([0x00, 0x00, 0x00]), 'esp32')).toThrow(/truncated/i);
  });

  it('reads ESP8266 status from the last 2 bytes', () => {
    const body = Uint8Array.from([0x10, 0x20, 0x00, 0x00]);
    const { status, dataLength } = parseResponseStatus(body, 'esp8266');
    expect(status).toBe(0);
    expect(dataLength).toBe(2);
  });

  it('detects a non-zero ESP8266 status', () => {
    const body = Uint8Array.from([0x10, 0x20, 0x01, 0x00]);
    const { status } = parseResponseStatus(body, 'esp8266');
    expect(status).toBe(1);
  });

  it('falls back to the ESP8266 layout when the chip is unknown', () => {
    const esp8266 = Uint8Array.from([0x10, 0x20, 0x00, 0x00]);
    const { status: s1, dataLength: d1 } = parseResponseStatus(esp8266);
    expect(s1).toBe(0);
    expect(d1).toBe(2);

    const esp32 = Uint8Array.from([0x10, 0x20, 0x30, 0x40, 0x00, 0x00, 0x00, 0x01]);
    const { status: s2, dataLength: d2 } = parseResponseStatus(esp32);
    expect(s2).toBe(0);
    expect(d2).toBe(4);
  });

  it('throws on response bodies shorter than the status bytes', () => {
    expect(() => parseResponseStatus(new Uint8Array(0))).toThrow(/short/i);
    expect(() => parseResponseStatus(Uint8Array.from([0x00]))).toThrow(/short/i);
    expect(parseResponseStatus(Uint8Array.from([0x00, 0x00])).status).toBe(0);
  });
});

// ── Intel HEX parser (#453) ──────────────────────────────────

const VALID_HEX = `:1000000041C0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFD
:00000001FF`;

describe('parseIntelHex', () => {
  it('parses a valid hex file', () => {
    const { data, startAddress } = parseIntelHex(VALID_HEX);
    expect(startAddress).toBe(0);
    expect(data.length).toBe(16);
    expect(data[0]).toBe(0x41);
    expect(data[1]).toBe(0xc0);
    expect(data[15]).toBe(0xff);
  });

  it('throws on a checksum mismatch instead of flashing garbage', () => {
    const bad = `:1000000041C0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFE
:00000001FF`;
    expect(() => parseIntelHex(bad)).toThrow(/checksum/i);
  });

  it('throws on a truncated data record', () => {
    const truncated = `:1000000041C0FFFFFFFFFF
:00000001FF`;
    expect(() => parseIntelHex(truncated)).toThrow(/truncated|malformed/i);
  });

  it('throws on non-hex characters', () => {
    const bad = `:10000000ZZC0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFD
:00000001FF`;
    expect(() => parseIntelHex(bad)).toThrow(/non-hex/i);
  });

  it('handles extended linear address records', () => {
    const hex = `:020000040800F2
:080000000102030405060708D4
:00000001FF`;
    const { startAddress, data } = parseIntelHex(hex);
    expect(startAddress).toBe(0x08000000);
    expect(data.length).toBe(8);
    expect(data[0]).toBe(1);
    expect(data[7]).toBe(8);
  });

  it('throws on a malformed extended address record', () => {
    const hex = `:00000004FC
:00000001FF`;
    expect(() => parseIntelHex(hex)).toThrow(/extended/i);
  });

  it('throws on non-record content instead of skipping it silently', () => {
    const bad = `garbage line
:1000000041C0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFD
:00000001FF`;
    expect(() => parseIntelHex(bad)).toThrow(/unexpected|not a record/i);
  });

  it('rejects files whose address span exceeds the firmware cap', () => {
    const hex = `:020000040000FA
:1000000041C0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFD
:020000042000DA
:1000000041C0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFD
:00000001FF`;
    expect(() => parseIntelHex(hex)).toThrow(/exceeds the supported firmware size/i);
  });
});

// ── SAM-BA coalesced chunks (#441) ───────────────────────────

describe('BufferedByteReader', () => {
  function readerFromValue(value: Uint8Array): ReadableStreamDefaultReader<Uint8Array> {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(value);
        controller.close();
      },
    });
    return stream.getReader();
  }

  it('advances by copied bytes, not chunk length, and buffers the surplus', async () => {
    // A single coalesced chunk carrying TWO 4-byte responses.
    const chunk = Uint8Array.from([0xaa, 0xbb, 0xcc, 0xdd, 0x11, 0x22, 0x33, 0x44]);
    const reader = new BufferedByteReader(readerFromValue(chunk));

    const first = await reader.readBytes(4, 500);
    expect(Array.from(first)).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);

    const second = await reader.readBytes(4, 500);
    expect(Array.from(second)).toEqual([0x11, 0x22, 0x33, 0x44]);
  });

  it('serves the surplus bytes from its buffer without touching the stream', async () => {
    const chunk = Uint8Array.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
    const reader = new BufferedByteReader(readerFromValue(chunk));

    const first = await reader.readBytes(2, 500);
    expect(Array.from(first)).toEqual([0xaa, 0xbb]);

    const second = await reader.readBytes(2, 500);
    expect(Array.from(second)).toEqual([0xcc, 0xdd]);

    const third = await reader.readBytes(2, 500);
    expect(Array.from(third)).toEqual([0xee, 0xff]);
  });

  it('continues reading across multiple chunks', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.from([0xaa, 0xbb]));
        controller.enqueue(Uint8Array.from([0xcc, 0xdd, 0xee, 0xff]));
        controller.close();
      },
    });
    const reader = new BufferedByteReader(stream.getReader());

    const first = await reader.readBytes(4, 500);
    expect(Array.from(first)).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);

    const second = await reader.readBytes(2, 500);
    expect(Array.from(second)).toEqual([0xee, 0xff]);
  });
});
