import { describe, expect, it } from 'vitest';
import { slipReadFrame, parseResponseStatus } from '@/services/esptool';
import { parseIntelHex } from '@/services/hexParser';
import { BufferedByteReader } from '@/services/sambaFlash';

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

  it('treats empty or sub-status bodies as successful', () => {
    expect(parseResponseStatus(new Uint8Array(0)).status).toBe(0);
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
});
