import { describe, expect, it } from 'vitest';
import { slipEncode, slipReadFrame } from '@/services/esptool';

function readerFromChunks(chunks: number[][], delayMs = 0) {
  let i = 0;
  const reader = {
    read: async () => {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (i < chunks.length) return { value: new Uint8Array(chunks[i++]), done: false };
      // Keep the frame parser waiting so it can still find a completed frame
      return new Promise(() => {});
    },
  };
  return reader as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

describe('SLIP framing round-trip', () => {
  it('encodes and decodes a payload containing 0xC0 and 0xDB', async () => {
    const payload = new Uint8Array([0x01, 0xc0, 0x02, 0xdb, 0x03, 0x00]);
    const encoded = slipEncode(payload);

    // Raw escaped bytes must appear in the encoded stream
    expect(Array.from(encoded)).toContain(0xdb);

    const decoded = await slipReadFrame(readerFromChunks([Array.from(encoded)]), 2000);
    expect(Array.from(decoded)).toEqual(Array.from(payload));
  });

  it('decodes SLIP_ESC_END (0xdc) to SLIP_END (0xc0)', async () => {
    // 0xc0 in payload -> encoded as [0xdb, 0xdc]
    const decoded = await slipReadFrame(readerFromChunks([[0xc0, 0xdb, 0xdc, 0xc0]]), 2000);
    expect(Array.from(decoded)).toEqual([0xc0]);
  });

  it('decodes SLIP_ESC_ESC (0xdd) to SLIP_ESC (0xdb)', async () => {
    // 0xdb in payload -> encoded as [0xdb, 0xdd]
    const decoded = await slipReadFrame(readerFromChunks([[0xc0, 0xdb, 0xdd, 0xc0]]), 2000);
    expect(Array.from(decoded)).toEqual([0xdb]);
  });

  it('handles escape sequences split across chunk boundaries', async () => {
    const payload = new Uint8Array([0xab, 0xc0, 0xcd, 0xdb, 0xef]);
    const encoded = slipEncode(payload);
    const bytes = Array.from(encoded);

    // Split the stream mid-escape so the pending-escape flag must persist
    const splitAt = bytes.indexOf(0xdb) + 1; // right after the escape byte
    const decoded = await slipReadFrame(
      readerFromChunks([bytes.slice(0, splitAt), bytes.slice(splitAt)]),
      2000,
    );
    expect(Array.from(decoded)).toEqual(Array.from(payload));
  });
});
