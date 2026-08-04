/**
 * Intel HEX format parser
 * Converts Intel HEX string into binary pages suitable for STK500v1 flashing
 */

export interface HexRecord {
  byteCount: number;
  address: number;
  type: number;
  data: Uint8Array;
}

export interface FlashPage {
  address: number;
  data: Uint8Array;
}

/**
 * Parse a single Intel HEX line into a record.
 * Throws on malformed or truncated lines — a corrupt line must never be
 * flashed silently (it would write garbage to the board).
 */
function parseHexLine(line: string): HexRecord | null {
  line = line.trim();
  if (!line.startsWith(':')) return null;

  const hex = line.slice(1);
  if (hex.length < 10 || hex.length % 2 !== 0) {
    throw new Error(`Malformed HEX record (bad length ${hex.length}): ${line}`);
  }
  if (!/^[0-9A-Fa-f]+$/.test(hex)) {
    throw new Error(`Malformed HEX record (non-hex characters): ${line}`);
  }

  const byteCount = parseInt(hex.slice(0, 2), 16);
  const address = parseInt(hex.slice(2, 6), 16);
  const type = parseInt(hex.slice(6, 8), 16);

  // Expected layout: count(1) + address(2) + type(1) + data(count) + checksum(1).
  if (hex.length !== 10 + byteCount * 2) {
    throw new Error(
      `Truncated HEX record (expected ${10 + byteCount * 2} hex chars for ${byteCount} data bytes, got ${hex.length}): ${line}`
    );
  }

  const data = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    data[i] = parseInt(hex.slice(8 + i * 2, 10 + i * 2), 16);
  }

  // Verify checksum: the sum of all bytes (including the checksum byte) must be 0 mod 256.
  let checksum = 0;
  for (let i = 0; i < hex.length; i += 2) {
    checksum += parseInt(hex.slice(i, i + 2), 16);
  }
  if ((checksum & 0xFF) !== 0) {
    throw new Error(`Checksum mismatch on HEX record: ${line}`);
  }

  return { byteCount, address, type, data };
}

/**
 * Parse Intel HEX string into a flat binary buffer
 */
export function parseIntelHex(hexString: string): { data: Uint8Array; startAddress: number } {
  const lines = hexString.split('\n').filter(l => l.trim().startsWith(':'));
  
  let baseAddress = 0;
  let minAddress = Infinity;
  let maxAddress = 0;
  const segments: { address: number; data: Uint8Array }[] = [];

  for (const line of lines) {
    const record = parseHexLine(line);
    if (!record) continue;

    switch (record.type) {
      case 0x00: { // Data record
        const fullAddress = baseAddress + record.address;
        segments.push({ address: fullAddress, data: record.data });
        minAddress = Math.min(minAddress, fullAddress);
        maxAddress = Math.max(maxAddress, fullAddress + record.data.length);
        break;
      }
      case 0x01: // EOF
        break;
      case 0x02: // Extended segment address
        if (record.data.length < 2) {
          throw new Error(`Malformed extended segment address record: ${line}`);
        }
        baseAddress = ((record.data[0] << 8) | record.data[1]) << 4;
        break;
      case 0x04: // Extended linear address
        if (record.data.length < 2) {
          throw new Error(`Malformed extended linear address record: ${line}`);
        }
        baseAddress = ((record.data[0] << 8) | record.data[1]) << 16;
        break;
    }
  }

  if (segments.length === 0) {
    throw new Error('No data records found in hex file');
  }

  // Create flat buffer
  const totalSize = maxAddress - minAddress;
  const buffer = new Uint8Array(totalSize).fill(0xFF); // Flash erased state

  for (const seg of segments) {
    const offset = seg.address - minAddress;
    buffer.set(seg.data, offset);
  }

  return { data: buffer, startAddress: minAddress };
}

/**
 * Split binary data into flash pages of given size
 */
export function splitIntoPages(data: Uint8Array, startAddress: number, pageSize: number): FlashPage[] {
  const pages: FlashPage[] = [];

  for (let i = 0; i < data.length; i += pageSize) {
    const chunk = data.slice(i, Math.min(i + pageSize, data.length));
    // Pad to full page size
    const padded = new Uint8Array(pageSize).fill(0xFF);
    padded.set(chunk);

    pages.push({
      address: startAddress + i,
      data: padded,
    });
  }

  return pages;
}
