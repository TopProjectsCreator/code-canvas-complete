import { describe, expect, it } from 'vitest';
import { binaryToUf2 } from '@/services/uf2';

describe('binaryToUf2', () => {
  it('builds aligned UF2 blocks with valid markers', () => {
    const firmware = new Uint8Array([1, 2, 3, 4, 5]);
    const uf2 = binaryToUf2(firmware, {
      startAddress: 0x10000000,
      familyId: 0xE48BFF56,
    });

    expect(uf2.length).toBe(512);

    const view = new DataView(uf2.buffer);
    expect(view.getUint32(0, true)).toBe(0x0A324655);
    expect(view.getUint32(4, true)).toBe(0x9E5D5157);
    expect(view.getUint32(12, true)).toBe(0x10000000);
    expect(view.getUint32(16, true)).toBe(5);
    expect(view.getUint32(20, true)).toBe(0);
    expect(view.getUint32(24, true)).toBe(1);
    expect(view.getUint32(28, true)).toBe(0xE48BFF56);
    expect(view.getUint32(508, true)).toBe(0x0AB16F30);
  });
});
