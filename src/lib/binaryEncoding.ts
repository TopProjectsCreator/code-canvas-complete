// Chunked binary <-> base64 helpers safe for very large payloads (hundreds of MB).
// Avoids `String.fromCharCode(...bytes)` stack overflows and `atob`/`btoa` Latin1 errors.

const CHUNK = 0x8000; // 32KB

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
};

export const base64ToBytes = (b64: string): Uint8Array => {
  const clean = b64.replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

// Async chunked encoder yielding to the event loop so the UI doesn't freeze
// on very large files. Reports progress 0..1 if a callback is provided.
export const bytesToBase64Async = async (
  bytes: Uint8Array,
  onProgress?: (ratio: number) => void,
): Promise<string> => {
  let binary = '';
  const total = bytes.length;
  for (let i = 0; i < total; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
    if ((i & 0x7FFFF) === 0) {
      onProgress?.(Math.min(1, i / total));
      // yield to the event loop
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onProgress?.(1);
  return btoa(binary);
};

export const decodeMaybeDataUrl = (content: string): Uint8Array => {
  if (!content) return new Uint8Array(0);
  if (content.startsWith('data:')) {
    return base64ToBytes(content.split(',', 2)[1] || '');
  }
  const trimmed = content.trim();
  // Heuristic: pure base64 alphabet
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    try { return base64ToBytes(trimmed); } catch { /* fallthrough */ }
  }
  // Raw binary string fallback
  const out = new Uint8Array(content.length);
  for (let i = 0; i < content.length; i++) out[i] = content.charCodeAt(i) & 0xff;
  return out;
};

export const fileToBase64DataUrl = async (
  file: File | Blob,
  mime: string,
  onProgress?: (ratio: number) => void,
): Promise<string> => {
  const buf = await file.arrayBuffer();
  const b64 = await bytesToBase64Async(new Uint8Array(buf), onProgress);
  return `data:${mime};base64,${b64}`;
};
