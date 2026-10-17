import { describe, expect, it } from 'vitest';
import { parseIntelHex, splitIntoPages } from '@/services/hexParser';

const VALID_HEX = [
  ':1000000041C0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFD',
  ':00000001FF',
].join('\n');

describe('parseIntelHex', () => {
  it('parses a valid hex file', () => {
    const { data, startAddress } = parseIntelHex(VALID_HEX);
    expect(startAddress).toBe(0);
    expect(data[0]).toBe(0x41);
    expect(data[1]).toBe(0xC0);
    expect(data[2]).toBe(0xFF);
  });

  it('ignores non-hex lines', () => {
    const { data, startAddress } = parseIntelHex(
      `some garbage\n${VALID_HEX}\nmore garbage`
    );
    expect(startAddress).toBe(0);
    expect(data[0]).toBe(0x41);
  });

  it('rejects a record with an invalid checksum', () => {
    const bad = [
      ':1000000041C0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFE',
      ':00000001FF',
    ].join('\n');
    expect(() => parseIntelHex(bad)).toThrow(/Checksum mismatch/);
  });

  it('rejects a truncated record whose length does not match the byte count', () => {
    const truncated = [
      ':1000000041C0',
      ':00000001FF',
    ].join('\n');
    expect(() => parseIntelHex(truncated)).toThrow(/does not match declared byte count/);
  });

  it('rejects a record with non-hex data', () => {
    const bad = [
      `:1000000041C0ZZZZ${'FF'.repeat(12)}00`,
      ':00000001FF',
    ].join('\n');
    expect(() => parseIntelHex(bad)).toThrow(/non-hex data/);
  });

  it('rejects a record that is too short', () => {
    expect(() => parseIntelHex(':0000\n:00000001FF')).toThrow(/too short/);
  });

  it('throws when there are no data records', () => {
    expect(() => parseIntelHex(':00000001FF')).toThrow(/No data records/);
  });

  it('applies the extended linear address to data records', () => {
    const hex = [
      ':020000040800F2',
      ':1000000041C0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFD',
      ':00000001FF',
    ].join('\n');
    const { data, startAddress } = parseIntelHex(hex);
    expect(startAddress).toBe(0x08000000);
    expect(data[0]).toBe(0x41);
  });
});

describe('splitIntoPages', () => {
  it('splits data into padded pages', () => {
    const { data, startAddress } = parseIntelHex(VALID_HEX);
    const pages = splitIntoPages(data, startAddress, 4);
    expect(pages.length).toBe(Math.ceil(data.length / 4));
    expect(pages[0].address).toBe(0);
    expect(Array.from(pages[0].data)).toEqual([0x41, 0xC0, 0xFF, 0xFF]);
  });
});