/**
 * Image redaction – detects PII in images via OCR and redacts it at the pixel level.
 *
 * Flow per image:
 *   base64 → ImageScript decode → Tesseract OCR → text + bounding boxes
 *   → run redaction patterns on OCR text → for each PII match,
 *     pixelate the region and draw the token text → re-encode → base64
 */

import { redact, type RedactOptions } from "./redaction.ts";
import type { Shape } from "./translate.ts";

// Lazy singleton Tesseract worker
let ocrWorker: { recognize: (img: Uint8Array) => Promise<{ text: string; words: OCRWord[] }> } | null = null;

async function getOCR(): Promise<typeof ocrWorker> {
  if (!ocrWorker) {
    // dynamically import so a failure here doesn't crash unrelated requests
    try {
      const T = await import("npm:tesseract.js@5");
      const worker = await T.createWorker("eng");
      ocrWorker = {
        async recognize(img: Uint8Array) {
          const { data } = await worker.recognize(img);
          return {
            text: data.text,
            words: (data.words ?? []).map((w: Record<string, unknown>) => ({
              text: w.text as string,
              bbox: w.bbox as OCRBBox,
            })),
          };
        },
      };
    } catch (e) {
      console.error("OCR init failed, image redaction disabled", e);
      ocrWorker = null;
      return null;
    }
  }
  return ocrWorker;
}

interface OCRWord {
  text: string;
  bbox: OCRBBox;
}

interface OCRBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface ImageBlock {
  index: number; // position within its parent array
  mimeType: string; // image/png or image/jpeg
  data: string; // base64-encoded pixel data (without data: URI prefix)
}

export interface ImageRedactionResult {
  body: Record<string, unknown>;
  map: Record<string, string>; // token → original (shared with text redaction)
  counts: Record<string, number>;
  imageCount: number;
  redactedImageCount: number;
}

// ── Entry point ──────────────────────────────────────────────

export async function redactImagesInBody(
  body: Record<string, unknown>,
  shape: Shape,
  opts: RedactOptions,
  enabled: boolean,
): Promise<ImageRedactionResult> {
  if (!enabled) return { body, map: {}, counts: {}, imageCount: 0, redactedImageCount: 0 };

  const blocks = findImageBlocks(body, shape);
  if (blocks.length === 0) return { body, map: {}, counts: {}, imageCount: 0, redactedImageCount: 0 };

  const ocr = await getOCR();
  if (!ocr) return { body, map: {}, counts: {}, imageCount: 0, redactedImageCount: 0 };

  const IM = await importImageScript();

  const result: ImageRedactionResult = {
    body,
    map: {},
    counts: {},
    imageCount: blocks.length,
    redactedImageCount: 0,
  };

  const processed: ImageBlock[] = [];

  for (const block of blocks) {
    try {
      const processedBlock = await processSingleImage(block, ocr, opts, IM, result);
      processed.push(processedBlock);
      if (processedBlock.data !== block.data) {
        result.redactedImageCount++;
      }
    } catch (e) {
      console.error("Image redaction failed for block", block.index, e);
      processed.push(block); // keep original on failure
    }
  }

  result.body = replaceImageBlocks(body, shape, processed);
  return result;
}

// ── Image block finding ──────────────────────────────────────

function findImageBlocks(body: Record<string, unknown>, shape: Shape): ImageBlock[] {
  const blocks: ImageBlock[] = [];
  let idx = 0;

  if (shape === "openai") {
    const messages = body.messages as Array<Record<string, unknown>> | undefined;
    if (!messages) return blocks;
    for (const msg of messages) {
      const content = msg.content;
      if (typeof content === "string") continue;
      if (Array.isArray(content)) {
        for (const part of content) {
          if ((part as Record<string, unknown>).type === "image_url") {
            const iu = (part as Record<string, unknown>).image_url as Record<string, unknown> | undefined;
            if (!iu) continue;
            const url = iu.url as string ?? "";
            const parsed = parseBase64ImageData(url);
            if (parsed) {
              blocks.push({ index: idx++, mimeType: parsed.mimeType, data: parsed.data });
            }
          }
        }
      }
    }
  }

  if (shape === "anthropic") {
    const messages = body.messages as Array<Record<string, unknown>> | undefined;
    if (!messages) return blocks;
    for (const msg of messages) {
      const content = msg.content;
      if (typeof content === "string") continue;
      if (Array.isArray(content)) {
        for (const part of content) {
          if ((part as Record<string, unknown>).type === "image") {
            const src = (part as Record<string, unknown>).source as Record<string, unknown> | undefined;
            if (!src || src.type !== "base64") continue;
            blocks.push({
              index: idx++,
              mimeType: src.media_type as string ?? "image/png",
              data: src.data as string,
            });
          }
        }
      }
    }
  }

  if (shape === "gemini") {
    const contents = body.contents as Array<Record<string, unknown>> | undefined;
    if (!contents) return blocks;
    for (const c of contents) {
      const parts = c.parts as Array<Record<string, unknown>> | undefined;
      if (!parts) continue;
      for (const part of parts) {
        const id = part.inline_data as Record<string, unknown> | undefined;
        if (id) {
          blocks.push({
            index: idx++,
            mimeType: id.mime_type as string ?? "image/png",
            data: id.data as string,
          });
        }
      }
    }
  }

  return blocks;
}

// ── Image block replacement ──────────────────────────────────

function replaceImageBlocks(
  body: Record<string, unknown>,
  shape: Shape,
  blocks: ImageBlock[],
): Record<string, unknown> {
  let bi = 0;
  const out = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;

  if (shape === "openai") {
    const messages = out.messages as Array<Record<string, unknown>>;
    if (!messages) return body;
    for (const msg of messages) {
      const content = msg.content;
      if (typeof content === "string") continue;
      if (Array.isArray(content)) {
        for (const part of content) {
          if ((part as Record<string, unknown>).type === "image_url") {
            const iu = (part as Record<string, unknown>).image_url as Record<string, unknown>;
            if (bi < blocks.length) {
              const b = blocks[bi++];
              iu.url = `data:${b.mimeType};base64,${b.data}`;
            }
          }
        }
      }
    }
  }

  if (shape === "anthropic") {
    const messages = out.messages as Array<Record<string, unknown>>;
    if (!messages) return body;
    for (const msg of messages) {
      const content = msg.content;
      if (typeof content === "string") continue;
      if (Array.isArray(content)) {
        for (const part of content) {
          if ((part as Record<string, unknown>).type === "image") {
            const src = (part as Record<string, unknown>).source as Record<string, unknown>;
            if (bi < blocks.length) {
              src.data = blocks[bi++].data;
            }
          }
        }
      }
    }
  }

  if (shape === "gemini") {
    const contents = out.contents as Array<Record<string, unknown>>;
    if (!contents) return body;
    for (const c of contents) {
      const parts = c.parts as Array<Record<string, unknown>>;
      if (!parts) continue;
      for (const part of parts) {
        const id = part.inline_data as Record<string, unknown>;
        if (id && bi < blocks.length) {
          id.data = blocks[bi++].data;
        }
      }
    }
  }

  return out;
}

// ── Single image processing ──────────────────────────────────

async function processSingleImage(
  block: ImageBlock,
  ocr: NonNullable<Awaited<ReturnType<typeof getOCR>>>,
  opts: RedactOptions,
  IM: Awaited<ReturnType<typeof importImageScript>>,
  result: ImageRedactionResult,
): Promise<ImageBlock> {
  const rawBytes = base64ToBytes(block.data);
  let img: InstanceType<typeof IM.Image>;
  try {
    img = await IM.Image.decode(rawBytes);
  } catch {
    return block; // unsupported format
  }

  // OCR
  const ocrResult = await ocr.recognize(rawBytes);
  if (!ocrResult.text.trim()) return block;

  // Run redaction on OCR text to find PII
  const r = redact(ocrResult.text, opts);
  if (r.matches.length === 0) return block;

  // Map matches to word bounding boxes
  const regions = mapMatchesToBBoxes(r.matches, ocrResult.words, ocrResult.text);

  if (regions.length === 0) return block;

  // Apply pixelation + token overlay for each region
  const imgReverseMap: Record<string, string> = {}; // original → token (local to image pass)
  const localCounts: Record<string, number> = {};
  let redacted = false;
  for (const reg of regions) {
    const orig = reg.original;
    let token = imgReverseMap[orig];
    if (!token) {
      const label = reg.token.slice(1, reg.token.lastIndexOf("_"));
      localCounts[label] = (localCounts[label] ?? 0) + 1;
      token = `[${label}_${localCounts[label]}]`;
      imgReverseMap[orig] = token;
      result.map[token] = orig;
    }
    // Update global counts for seeding text redaction
    for (const [l, c] of Object.entries(localCounts)) {
      result.counts[l] = c;
    }

    // Normalise bbox coords to image dimensions
    const x = Math.max(0, Math.floor(reg.bbox.x0));
    const y = Math.max(0, Math.floor(reg.bbox.y0));
    const w = Math.min(img.width - x, Math.ceil(reg.bbox.x1 - reg.bbox.x0));
    const h = Math.min(img.height - y, Math.ceil(reg.bbox.y1 - reg.bbox.y0));
    if (w < 2 || h < 2) continue;

    pixelateRegion(img, x, y, w, h, 8);
    drawTokenOverlay(img, x, y, w, h, token);
    redacted = true;
  }

  if (!redacted) return block;

  // Re-encode
  const mimeType = block.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
  const encoded = mimeType === "image/jpeg"
    ? await img.encodeJPEG(85)
    : await img.encodePNG();

  return { ...block, data: bytesToBase64(encoded) };
}

// ── Match OCR text regions to bounding boxes ──────────────────

interface MatchRegion {
  token: string;
  original: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

function mapMatchesToBBoxes(
  matches: { token: string; original: string; start: number; end: number }[],
  words: OCRWord[],
  fullText: string,
): MatchRegion[] {
  // Build a character → word index
  // Start with char positions mapped to word indices
  const charToWord: number[] = [];
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    const pos = fullText.indexOf(w.text, charToWord.length > 0 ? charToWord.length - 1 : 0);
    // Approximate: just map each character of the word to this word index
    for (let ci = 0; ci < w.text.length; ci++) {
      charToWord.push(wi);
    }
    // Add a space between words
    charToWord.push(-1); // space
  }

  const regions: MatchRegion[] = [];

  for (const m of matches) {
    // Find which word(s) this match spans
    const wordIndices = new Set<number>();
    for (let i = m.start; i < m.end && i < charToWord.length; i++) {
      if (charToWord[i] >= 0) wordIndices.add(charToWord[i]);
    }
    if (wordIndices.size === 0) continue;

    // Compute combined bbox
    const selected = Array.from(wordIndices).map((i) => words[i]).filter(Boolean);
    if (selected.length === 0) continue;

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const w of selected) {
      x0 = Math.min(x0, w.bbox.x0);
      y0 = Math.min(y0, w.bbox.y0);
      x1 = Math.max(x1, w.bbox.x1);
      y1 = Math.max(y1, w.bbox.y1);
    }

    regions.push({
      token: m.token,
      original: m.original,
      bbox: { x0, y0, x1, y1 },
    });
  }

  // Merge overlapping regions
  return mergeOverlappingRegions(regions);
}

function mergeOverlappingRegions(regions: MatchRegion[]): MatchRegion[] {
  if (regions.length <= 1) return regions;
  const sorted = [...regions].sort((a, b) => a.bbox.x0 - b.bbox.x0 || a.bbox.y0 - b.bbox.y0);
  const merged: MatchRegion[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    // Check overlap
    const overlapX = Math.min(prev.bbox.x1, curr.bbox.x1) - Math.max(prev.bbox.x0, curr.bbox.x0);
    const overlapY = Math.min(prev.bbox.y1, curr.bbox.y1) - Math.max(prev.bbox.y0, curr.bbox.y0);
    if (overlapX > 0 && overlapY > 0) {
      // Merge
      prev.bbox.x0 = Math.min(prev.bbox.x0, curr.bbox.x0);
      prev.bbox.y0 = Math.min(prev.bbox.y0, curr.bbox.y0);
      prev.bbox.x1 = Math.max(prev.bbox.x1, curr.bbox.x1);
      prev.bbox.y1 = Math.max(prev.bbox.y1, curr.bbox.y1);
      // prev.token stays unchanged (keep first token)
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

// ── Image manipulation ──────────────────────────────────────

function pixelateRegion(
  img: { width: number; height: number; getPixelAt: (x: number, y: number) => number; setPixelAt: (x: number, y: number, c: number) => void },
  x: number, y: number, w: number, h: number,
  blockSize: number,
): void {
  const xEnd = Math.min(x + w, img.width);
  const yEnd = Math.min(y + h, img.height);

  for (let by = y; by < yEnd; by += blockSize) {
    for (let bx = x; bx < xEnd; bx += blockSize) {
      // Average the block
      let r = 0, g = 0, b = 0, count = 0;
      for (let py = by; py < Math.min(by + blockSize, yEnd); py++) {
        for (let px = bx; px < Math.min(bx + blockSize, xEnd); px++) {
          const c = img.getPixelAt(px, py);
          r += (c >> 16) & 0xFF;
          g += (c >> 8) & 0xFF;
          b += c & 0xFF;
          count++;
        }
      }
      if (count === 0) continue;
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      const avg = (r << 16) | (g << 8) | b | 0xFF000000;

      // Fill the block with the average
      for (let py = by; py < Math.min(by + blockSize, yEnd); py++) {
        for (let px = bx; px < Math.min(bx + blockSize, xEnd); px++) {
          img.setPixelAt(px, py, avg);
        }
      }
    }
  }
}

// Simple bitmap font for token text (5×7 matrix)
// Supports: A-Z, 0-9, [, ], _, -
const FONT: Record<string, number[]> = {
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  'A': [0b00100, 0b01010, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'B': [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  'C': [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  'D': [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  'E': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  'F': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  'G': [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  'H': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'I': [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  'J': [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  'K': [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  'L': [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  'M': [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  'N': [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  'O': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'P': [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  'Q': [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  'R': [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  'S': [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  'T': [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  'U': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'V': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  'W': [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  'X': [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  'Y': [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  'Z': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '[': [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110],
  ']': [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110],
  '_': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b11111],
  '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
};

const FONT_W = 5;
const FONT_H = 7;
const CHAR_SPACE = 1;

function drawTokenOverlay(
  img: {
    width: number;
    height: number;
    setPixelAt: (x: number, y: number, c: number) => void;
  },
  regionX: number, regionY: number, regionW: number, regionH: number,
  token: string,
): void {
  const textW = token.length * (FONT_W + CHAR_SPACE);
  const textH = FONT_H;
  const scaleX = Math.max(1, Math.floor(regionW / textW));
  const scaleY = Math.max(1, Math.floor(regionH / textH));
  const scale = Math.min(scaleX, scaleY, 4); // cap at 4x

  const drawX = regionX + Math.max(0, Math.floor((regionW - textW * scale) / 2));
  const drawY = regionY + Math.max(0, Math.floor((regionH - textH * scale) / 2));

  const white = 0xFFFFFFFF;
  const charW = (FONT_W + CHAR_SPACE) * scale;

  for (let ci = 0; ci < token.length; ci++) {
    const ch = token[ci].toUpperCase();
    const pattern = FONT[ch];
    if (!pattern) continue;
    const cx = drawX + ci * charW;
    for (let row = 0; row < FONT_H; row++) {
      for (let col = 0; col < FONT_W; col++) {
        if ((pattern[row] >> (FONT_W - 1 - col)) & 1) {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = cx + col * scale + sx;
              const py = drawY + row * scale + sy;
              if (px < img.width && py < img.height) {
                img.setPixelAt(px, py, white);
              }
            }
          }
        }
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────

function parseBase64ImageData(url: string): { mimeType: string; data: string } | null {
  const match = url.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function importImageScript() {
  const IM = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
  return IM as { Image: typeof import("https://deno.land/x/imagescript@1.3.0/mod.ts").Image };
}
