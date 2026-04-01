export interface Uf2BuildOptions {
  startAddress: number;
  familyId: number;
  payloadSize?: number;
}

const UF2_MAGIC_START0 = 0x0A324655;
const UF2_MAGIC_START1 = 0x9E5D5157;
const UF2_MAGIC_END = 0x0AB16F30;
const UF2_FLAG_FAMILY_ID_PRESENT = 0x00002000;
const UF2_BLOCK_SIZE = 512;
const UF2_DEFAULT_PAYLOAD = 256;

export function binaryToUf2(data: Uint8Array, options: Uf2BuildOptions): Uint8Array {
  const payloadSize = options.payloadSize ?? UF2_DEFAULT_PAYLOAD;
  if (payloadSize <= 0 || payloadSize > 476) {
    throw new Error('Invalid UF2 payload size');
  }

  const totalBlocks = Math.ceil(data.length / payloadSize);
  const out = new Uint8Array(totalBlocks * UF2_BLOCK_SIZE);

  for (let blockNo = 0; blockNo < totalBlocks; blockNo++) {
    const blockOffset = blockNo * UF2_BLOCK_SIZE;
    const chunkStart = blockNo * payloadSize;
    const chunk = data.subarray(chunkStart, Math.min(chunkStart + payloadSize, data.length));

    const dv = new DataView(out.buffer, out.byteOffset + blockOffset, UF2_BLOCK_SIZE);
    dv.setUint32(0, UF2_MAGIC_START0, true);
    dv.setUint32(4, UF2_MAGIC_START1, true);
    dv.setUint32(8, UF2_FLAG_FAMILY_ID_PRESENT, true);
    dv.setUint32(12, options.startAddress + chunkStart, true);
    dv.setUint32(16, chunk.length, true);
    dv.setUint32(20, blockNo, true);
    dv.setUint32(24, totalBlocks, true);
    dv.setUint32(28, options.familyId, true);

    out.set(chunk, blockOffset + 32);
    dv.setUint32(UF2_BLOCK_SIZE - 4, UF2_MAGIC_END, true);
  }

  return out;
}
