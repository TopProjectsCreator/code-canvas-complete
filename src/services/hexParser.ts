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
 * Parse a single Intel HEX line into a record
 */
function parseHexLine(line: string): HexRecord | null {
  line = line.trim();
  if (!line.startsWith(':')) return null;

  const hex = line.slice(1);
  if (hex.length < 10) return null;

  const byteCount = parseInt(hex.slice(0, 2), 16);
  const address = parseInt(hex.slice(2, 6), 16);
  const type = parseInt(hex.slice(6, 8), 16);

  const data = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    data[i] = parseInt(hex.slice(8 + i * 2, 10 + i * 2), 16);
  }

  // Verify checksum
  let checksum = 0;
  for (let i = 0; i < hex.length; i += 2) {
    checksum += parseInt(hex.slice(i, i + 2), 16);
  }
  if ((checksum & 0xFF) !== 0) {
    console.warn(`Checksum mismatch on line: ${line}`);
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
        baseAddress = ((record.data[0] << 8) | record.data[1]) << 4;
        break;
      case 0x04: // Extended linear address
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
