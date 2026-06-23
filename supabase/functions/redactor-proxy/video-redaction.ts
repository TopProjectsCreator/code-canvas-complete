/**
 * Video redaction – detects PII in video via I-frame sampling + OCR.
 *
 * Flow per video URL in a request body:
 *   1. Detect video data URIs (video/*) in the request body
 *   2. Replace each with a proxy-managed streaming URL
 *   3. On fetch of that URL: download → demux (mp4box) → extract I-frames
 *      → h264 decode → OCR → pixelate → re-encode → remux → stream
 *
 * Architecture:
 *   Chat handler (instant):     replace video URL, forward
 *   Video handler (streaming):  serve progressively-redacted MP4
 *   Function stays alive via chunked transfer (resets timeout on each write)
 */

import { redact, type RedactOptions } from "./redaction.ts";
import type { Shape } from "./translate.ts";

// Re-exported helpers from image-redaction.ts (lazy-loaded there too)
let _ocrWorker: { recognize: (img: Uint8Array) => Promise<{ text: string; words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }> } | null = null;

async function getOCR() {
  if (!_ocrWorker) {
    try {
      const T = await import("npm:tesseract.js@5");
      const worker = await T.createWorker("eng");
      _ocrWorker = {
        async recognize(img: Uint8Array) {
          const { data } = await worker.recognize(img);
          return {
            text: data.text,
            words: (data.words ?? []).map((w: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }) => ({
              text: w.text,
              bbox: w.bbox,
            })),
          };
        },
      };
    } catch (e) {
      console.error("Video OCR init failed", e);
      return null;
    }
  }
  return _ocrWorker;
}

async function getImageScript() {
  const IM = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
  return IM as { Image: typeof import("https://deno.land/x/imagescript@1.3.0/mod.ts").Image };
}

function pixelateRegion(
  img: { width: number; height: number; getPixelAt: (x: number, y: number) => number; setPixelAt: (x: number, y: number, c: number) => void },
  x: number, y: number, w: number, h: number,
  blockSize = 8,
): void {
  const xEnd = Math.min(x + w, img.width);
  const yEnd = Math.min(y + h, img.height);
  for (let by = y; by < yEnd; by += blockSize) {
    for (let bx = x; bx < xEnd; bx += blockSize) {
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
      for (let py = by; py < Math.min(by + blockSize, yEnd); py++) {
        for (let px = bx; px < Math.min(bx + blockSize, xEnd); px++) {
          img.setPixelAt(px, py, avg);
        }
      }
    }
  }
}

// ── Font data (matching image-redaction.ts) ──────────────────

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
  img: { width: number; height: number; setPixelAt: (x: number, y: number, c: number) => void },
  regionX: number, regionY: number, regionW: number, regionH: number,
  token: string,
): void {
  const textW = token.length * (FONT_W + CHAR_SPACE);
  const textH = FONT_H;
  const scaleX = Math.max(1, Math.floor(regionW / textW));
  const scaleY = Math.max(1, Math.floor(regionH / textH));
  const scale = Math.min(scaleX, scaleY, 4);
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

// ── Types ────────────────────────────────────────────────────

export interface VideoBlock {
  index: number;
  type: "data_uri" | "file_uri";
  mimeType: string;
  data: string; // base64 data or file URL
}

export interface VideoRedactionResult {
  body: Record<string, unknown>;
  map: Record<string, string>;
  counts: Record<string, number>;
  videoCount: number;
  redactedVideoCount: number;
}

interface SessionStore {
  originalUrl: string;
  mimeType: string;
  processedChunks: Uint8Array[];
  processingDone: boolean;
  map: Record<string, string>;
  counts: Record<string, number>;
  status: "downloading" | "processing" | "done" | "error";
  error?: string;
}

// In-memory session store (per edge function instance)
const sessions = new Map<string, SessionStore>();

// ── Video block detection ────────────────────────────────────

export async function redactVideosInBody(
  body: Record<string, unknown>,
  shape: Shape,
  opts: RedactOptions,
  enabled: boolean,
): Promise<VideoRedactionResult> {
  if (!enabled) return { body, map: {}, counts: {}, videoCount: 0, redactedVideoCount: 0 };

  const blocks = findVideoBlocks(body, shape);
  if (blocks.length === 0) return { body, map: {}, counts: {}, videoCount: 0, redactedVideoCount: 0 };

  const result: VideoRedactionResult = {
    body,
    map: {},
    counts: {},
    videoCount: blocks.length,
    redactedVideoCount: 0,
  };

  for (const block of blocks) {
    const sessionId = crypto.randomUUID();
    const session: SessionStore = {
      originalUrl: block.data,
      mimeType: block.mimeType,
      processedChunks: [],
      processingDone: false,
      map: {},
      counts: {},
      status: "downloading",
    };
    sessions.set(sessionId, session);

    // Start background processing (fire-and-forget within this function's lifetime)
    processVideo(sessionId, opts).catch((e) => {
      console.error("Video processing failed for session", sessionId, e);
      const s = sessions.get(sessionId);
      if (s) {
        s.status = "error";
        s.error = e.message;
        s.processingDone = true;
      }
    });

    // Replace the video block with a session URL
    replaceVideoBlock(body, shape, block.index, sessionId);
    result.redactedVideoCount++;
  }

  result.body = body;
  return result;
}

// ── Video block finding ──────────────────────────────────────

function findVideoBlocks(body: Record<string, unknown>, shape: Shape): VideoBlock[] {
  const blocks: VideoBlock[] = [];
  let idx = 0;

  if (shape === "openai") {
    const messages = body.messages as Array<Record<string, unknown>> | undefined;
    if (!messages) return blocks;
    for (const msg of messages) {
      const content = msg.content;
      if (typeof content === "string") continue;
      if (Array.isArray(content)) {
        for (const part of content) {
          const p = part as Record<string, unknown>;
          if (p.type === "image_url") {
            const iu = p.image_url as Record<string, unknown> | undefined;
            if (!iu) continue;
            const url = iu.url as string ?? "";
            const parsed = parseVideoDataUri(url);
            if (parsed) {
              blocks.push({ index: idx++, type: "data_uri", mimeType: parsed.mimeType, data: parsed.data });
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
          const p = part as Record<string, unknown>;
          if (p.type === "image") {
            const src = p.source as Record<string, unknown> | undefined;
            if (!src || src.type !== "base64") continue;
            if (isVideoMime(src.media_type as string)) {
              blocks.push({ index: idx++, type: "data_uri", mimeType: src.media_type as string, data: src.data as string });
            }
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
        const p = part as Record<string, unknown>;
        const id = p.inline_data as Record<string, unknown> | undefined;
        if (id && isVideoMime(id.mime_type as string)) {
          blocks.push({ index: idx++, type: "data_uri", mimeType: id.mime_type as string, data: id.data as string });
        }
        // Also check for file_data references (Gemini file uploads)
        const fd = p.file_data as Record<string, unknown> | undefined;
        if (fd && fd.mime_type && isVideoMime(fd.mime_type as string)) {
          blocks.push({ index: idx++, type: "file_uri", mimeType: fd.mime_type as string, data: fd.file_uri as string });
        }
      }
    }
  }

  return blocks;
}

function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

function parseVideoDataUri(uri: string): { mimeType: string; data: string } | null {
  const match = uri.match(/^data:(video\/(?:mp4|webm|quicktime|x-matroska));base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function replaceVideoBlock(
  body: Record<string, unknown>,
  shape: Shape,
  blockIndex: number,
  sessionId: string,
): void {
  let bi = 0;

  const proxyBase = Deno.env.get("SUPABASE_URL") ?? "http://localhost";
  const videoUrl = `${proxyBase}/functions/v1/redactor-proxy/v/${sessionId}.mp4`;

  if (shape === "openai") {
    const messages = body.messages as Array<Record<string, unknown>>;
    if (!messages) return;
    for (const msg of messages) {
      const content = msg.content;
      if (typeof content === "string") continue;
      if (Array.isArray(content)) {
        for (const part of content) {
          if ((part as Record<string, unknown>).type === "image_url") {
            const iu = (part as Record<string, unknown>).image_url as Record<string, unknown>;
            if (bi === blockIndex) {
              iu.url = videoUrl;
            }
            bi++;
          }
        }
      }
    }
  }

  if (shape === "anthropic") {
    const messages = body.messages as Array<Record<string, unknown>>;
    if (!messages) return;
    for (const msg of messages) {
      const content = msg.content;
      if (typeof content === "string") continue;
      if (Array.isArray(content)) {
        for (const part of content) {
          if ((part as Record<string, unknown>).type === "image") {
            const src = (part as Record<string, unknown>).source as Record<string, unknown>;
            if (bi === blockIndex) {
              src.type = "base64";
              src.media_type = "video/mp4";
              src.data = videoUrl;
            }
            bi++;
          }
        }
      }
    }
  }

  if (shape === "gemini") {
    const contents = body.contents as Array<Record<string, unknown>>;
    if (!contents) return;
    for (const c of contents) {
      const parts = c.parts as Array<Record<string, unknown>>;
      if (!parts) continue;
      for (const part of parts) {
        const id = part.inline_data as Record<string, unknown> | undefined;
        const fd = part.file_data as Record<string, unknown> | undefined;
        const isVideoBlock =
          (id && isVideoMime(id.mime_type as string)) ||
          (fd && isVideoMime(fd.mime_type as string));
        if (!isVideoBlock) continue;
        if (bi === blockIndex) {
          if (id) id.data = videoUrl;
          if (fd) fd.file_uri = videoUrl;
        }
        bi++;
      }
    }
  }
}

// ── Video processing pipeline ─────────────────────────────────

async function processVideo(sessionId: string, opts: RedactOptions): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    session.status = "downloading";
    const response = await fetch(session.originalUrl);

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    session.status = "processing";

    // Get the reader for streaming download
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body not readable");

    // We need mp4box for demuxing
    const MP4Box = await importMP4Box();
    const file = MP4Box.createFile();
    let videoTrack: any = null;
    let audioTrack: any = null;
    const samples: { data: Uint8Array; duration: number; isSync: boolean; dts: number; cts: number }[] = [];

    // Track I-frames for processing
    const iframeSamples: number[] = [];

    // Accumulate data and feed chunks to mp4box
    let offset = 0;
    const buffers: Uint8Array[] = [];

    file.onReady = (info: any) => {
      for (const track of info.tracks) {
        if (track.type === "video") videoTrack = track;
        if (track.type === "audio") audioTrack = track;
      }
    };

    file.onSamples = (trackId: number, _user: unknown, sampleList: any[]) => {
      for (const sample of sampleList) {
        const isSync = sample.is_sync === true;
        samples.push({
          data: new Uint8Array(sample.data),
          duration: sample.duration,
          isSync,
          dts: sample.dts,
          cts: sample.cts,
        });
        if (isSync) {
          iframeSamples.push(samples.length - 1);
        }
      }
    };

    // Read chunks
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        buffers.push(result.value);
        const buf = result.value.buffer.slice(
          result.value.byteOffset,
          result.value.byteOffset + result.value.byteLength,
        );
        const mb = MP4Box.MP4BoxBuffer.fromArrayBuffer(buf, offset);
        file.appendBuffer(mb);
        offset += buf.byteLength;
      }
      // Process available I-frames as they come
      if (videoTrack && iframeSamples.length > 0) {
        await processAvailableIFrames(
          samples, iframeSamples, videoTrack, file,
          session, opts,
        );
      }
    }

    file.flush();

    // Process any remaining I-frames
    if (videoTrack && iframeSamples.length > 0) {
      await processAvailableIFrames(
        samples, iframeSamples, videoTrack, file,
        session, opts,
      );
    }

    // Build a redacted MP4 by remuxing
    const redactedMp4 = await buildRedactedMp4(
      samples, videoTrack, audioTrack, file, session,
    );

    session.processedChunks = [new Uint8Array(redactedMp4)];
    session.processingDone = true;
    session.status = "done";

  } catch (e) {
    session.status = "error";
    session.error = (e as Error).message;
    session.processingDone = true;
  }
}

// Process I-frames that have been accumulated
async function processAvailableIFrames(
  samples: any[],
  iframeIndices: number[],
  videoTrack: any,
  file: any,
  session: SessionStore,
  opts: RedactOptions,
): Promise<void> {
  const ocr = await getOCR();
  if (!ocr) return;

  const IM = await getImageScript();

  let processed = 0;
  while (iframeIndices.length > 0) {
    const idx = iframeIndices.shift()!;
    const sample = samples[idx];
    if (!sample) continue;

    try {
      // Decode I-frame from h264 NAL
      const decoded = await decodeIFrame(sample.data, videoTrack);
      if (!decoded) continue;

      // Convert raw RGBA pixels to an ImageScript Image for PNG encoding (needed for OCR)
      const width = videoTrack.track_width ?? videoTrack.width ?? 1920;
      const height = videoTrack.track_height ?? videoTrack.height ?? 1080;
      const rawImg = new IM.Image(width, height);
      let srcIdx = 0;
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const r = decoded[srcIdx];
          const g = decoded[srcIdx + 1];
          const b = decoded[srcIdx + 2];
          rawImg.setPixelAt(px, py, (255 << 24) | (r << 16) | (g << 8) | b);
          srcIdx += 4;
        }
      }
      const pngBytes = await rawImg.encode();

      // Run OCR
      const ocrResult = await ocr.recognize(pngBytes);
      if (!ocrResult.text.trim()) continue;

      // Run redaction on OCR text
      const r = redact(ocrResult.text, opts);
      if (r.matches.length === 0) continue;

      // Map matches to regions and pixelate
      const regions = mapMatchesToBBoxes(r.matches, ocrResult.words, ocrResult.text);
      if (regions.length === 0) continue;

      // Decode as ImageScript Image for pixelation
      const decodedImg = await IM.Image.decode(pngBytes);
      const imgReverseMap: Record<string, string> = {};
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
          session.map[token] = orig;
        }
        const x = Math.max(0, Math.floor(reg.bbox.x0));
        const y = Math.max(0, Math.floor(reg.bbox.y0));
        const w = Math.min(decodedImg.width - x, Math.ceil(reg.bbox.x1 - reg.bbox.x0));
        const h = Math.min(decodedImg.height - y, Math.ceil(reg.bbox.y1 - reg.bbox.y0));
        if (w < 2 || h < 2) continue;
        pixelateRegion(decodedImg as any, x, y, w, h, 8);
        drawTokenOverlay(decodedImg as any, x, y, w, h, token);
        redacted = true;
      }

      if (!redacted) continue;

      // Update global counts
      for (const [l, c] of Object.entries(localCounts)) {
        session.counts[l] = (session.counts[l] ?? 0) + c;
      }

      // Extract raw RGBA pixels from the pixelated ImageScript Image
      // ImageScript Image has a `bytes` or `encode()` method that returns raw pixels
      const rgbaBytes = new Uint8Array(decodedImg.width * decodedImg.height * 4);
      for (let py = 0; py < decodedImg.height; py++) {
        for (let px = 0; px < decodedImg.width; px++) {
          const c = decodedImg.getPixelAt(px, py);
          const idx = (py * decodedImg.width + px) * 4;
          rgbaBytes[idx] = (c >> 16) & 0xFF;     // R
          rgbaBytes[idx + 1] = (c >> 8) & 0xFF;  // G
          rgbaBytes[idx + 2] = c & 0xFF;          // B
          rgbaBytes[idx + 3] = 255;               // A
        }
      }

      // Re-encode the I-frame as h264 and replace in samples
      const reencoded = await encodeIFrame(rgbaBytes, videoTrack);
      if (reencoded) {
        sample.data = reencoded;
        processed++;
      }
    } catch (e) {
      console.error("I-frame processing failed at index", idx, e);
    }
  }
}

// ── h264 decode/encode helpers (Wasm-based) ──────────────────

let _h264Decoder: any = null;
let _h264Encoder: any = null;

async function getH264Decoder() {
  if (!_h264Decoder) {
    try {
      const mod = await import("npm:h264decoder");
      _h264Decoder = mod.default ?? mod;
    } catch (e) {
      console.warn("h264decoder not available, video I-frame decode disabled", e);
      return null;
    }
  }
  return _h264Decoder;
}

async function getH264Encoder() {
  if (!_h264Encoder) {
    try {
      const mod = await import("npm:h264-mp4-encoder");
      _h264Encoder = mod.default ?? mod;
    } catch (e) {
      console.warn("h264-mp4-encoder not available, video I-frame encode disabled", e);
      return null;
    }
  }
  return _h264Encoder;
}

async function decodeIFrame(
  nalData: Uint8Array,
  trackInfo: any,
): Promise<Uint8Array | null> {
  const decoder = await getH264Decoder();
  if (!decoder) return null;

  try {
    // h264decoder takes raw NAL data and returns raw RGBA pixels
    const result = await decoder.decode(nalData.buffer);
    return new Uint8Array(result);
  } catch (e) {
    console.warn("I-frame decode failed", e);
    return null;
  }
}

async function encodeIFrame(
  rgbaPixels: Uint8Array,
  trackInfo: any,
): Promise<Uint8Array | null> {
  const encoder = await getH264Encoder();
  if (!encoder) return null;

  try {
    const width = trackInfo.track_width ?? trackInfo.width ?? 1920;
    const height = trackInfo.track_height ?? trackInfo.height ?? 1080;
    // h264-mp4-encoder expects raw RGBA bytes
    const result = await encoder.encode(rgbaPixels.buffer, width, height);
    return new Uint8Array(result);
  } catch (e) {
    console.warn("I-frame encode failed", e);
    return null;
  }
}

// ── Match OCR text to bounding boxes ─────────────────────────

interface MatchRegion {
  token: string;
  original: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

function mapMatchesToBBoxes(
  matches: { token: string; original: string; start: number; end: number }[],
  words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[],
  fullText: string,
): MatchRegion[] {
  const charToWord: number[] = [];
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    for (let ci = 0; ci < w.text.length; ci++) {
      charToWord.push(wi);
    }
    charToWord.push(-1);
  }

  const regions: MatchRegion[] = [];
  for (const m of matches) {
    const wordIndices = new Set<number>();
    for (let i = m.start; i < m.end && i < charToWord.length; i++) {
      if (charToWord[i] >= 0) wordIndices.add(charToWord[i]);
    }
    if (wordIndices.size === 0) continue;

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

  return mergeOverlappingRegions(regions);
}

function mergeOverlappingRegions(regions: MatchRegion[]): MatchRegion[] {
  if (regions.length <= 1) return regions;
  const sorted = [...regions].sort((a, b) => a.bbox.x0 - b.bbox.x0 || a.bbox.y0 - b.bbox.y0);
  const merged: MatchRegion[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    const overlapX = Math.min(prev.bbox.x1, curr.bbox.x1) - Math.max(prev.bbox.x0, curr.bbox.x0);
    const overlapY = Math.min(prev.bbox.y1, curr.bbox.y1) - Math.max(prev.bbox.y0, curr.bbox.y0);
    if (overlapX > 0 && overlapY > 0) {
      prev.bbox.x0 = Math.min(prev.bbox.x0, curr.bbox.x0);
      prev.bbox.y0 = Math.min(prev.bbox.y0, curr.bbox.y0);
      prev.bbox.x1 = Math.max(prev.bbox.x1, curr.bbox.x1);
      prev.bbox.y1 = Math.max(prev.bbox.y1, curr.bbox.y1);
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

// ── MP4 remuxing ─────────────────────────────────────────────

async function importMP4Box() {
  try {
    const MB = await import("npm:mp4box");
    return MB;
  } catch (e) {
    console.warn("mp4box not available, video processing disabled", e);
    throw e;
  }
}

async function buildRedactedMp4(
  samples: any[],
  videoTrack: any,
  audioTrack: any,
  file: any,
  session: SessionStore,
): Promise<ArrayBuffer> {
  const MP4Box = await importMP4Box();

  // Create a new MP4 file with the processed samples
  const outputFile = MP4Box.createFile();

  // Extract AVC decoder config from original track if present
  let avcConfigRecord: ArrayBuffer | undefined;
  try {
    const origDesc = (file as any).moov?.traks?.[0]?.mdia?.minf?.stbl?.stsd?.entries?.[0];
    if (origDesc?.avcC?.write) {
      const stream = new MP4Box.DataStream();
      origDesc.avcC.write(stream);
      avcConfigRecord = stream.buffer.slice(0, (stream as any).position);
    }
  } catch {
    // AVC config extraction failed; proceed without it
  }

  outputFile.addTrack({
    id: 1,
    width: videoTrack.track_width ?? videoTrack.width ?? 1920,
    height: videoTrack.track_height ?? videoTrack.height ?? 1080,
    hdlr: "vide",
    type: "avc1",
    timescale: videoTrack.timescale,
    avcDecoderConfigRecord: avcConfigRecord,
  });

  for (const sample of samples) {
    outputFile.addSample(1, sample.data, {
      duration: sample.duration,
      is_sync: sample.isSync,
      dts: sample.dts,
      cts: sample.cts,
    });
  }

  // Copy original audio track if present (we don't modify audio)
  if (audioTrack) {
    const audioDesc = outputFile.addTrack({
      id: 2,
      hdlr: "soun",
      type: audioTrack.codec ?? audioTrack.type ?? "mp4a",
      timescale: audioTrack.timescale,
      channel_count: audioTrack.channel_count ?? 2,
      samplerate: audioTrack.sample_rate ?? 48000,
    });
    // Copy audio samples from file (all samples, not just video)
    // This works because file has both tracks and we extract audio separately
    for (const s of file.samples ?? []) {
      if (s.track_id === (audioTrack.id ?? 2)) {
        outputFile.addSample(2, s.data, {
          duration: s.duration,
          is_sync: s.is_sync ?? false,
          dts: s.dts,
          cts: s.cts,
        });
      }
    }
  }

  // mp4box.save() returns a Blob
  const blob = await outputFile.save("redacted.mp4");
  const buffer = await blob.arrayBuffer();
  return buffer;
}

// ── Serving redacted video ───────────────────────────────────

/**
 * Generate a streaming response for a session's redacted video.
 * This is called when the AI provider fetches the proxy URL.
 * Uses chunked transfer to keep the edge function alive.
 */
export async function serveRedactedVideo(sessionId: string): Promise<Response> {
  const session = sessions.get(sessionId);
  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  const body = new ReadableStream({
    async start(controller) {
      const poll = setInterval(() => {
        if (session.processedChunks.length > 0) {
          const chunk = session.processedChunks.shift()!;
          controller.enqueue(chunk);
        }
        if (session.processingDone && session.processedChunks.length === 0) {
          controller.close();
          clearInterval(poll);
          sessions.delete(sessionId);
        }
        if (session.status === "error") {
          controller.error(new Error(session.error ?? "Processing failed"));
          clearInterval(poll);
          sessions.delete(sessionId);
        }
      }, 500);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": session.mimeType || "video/mp4",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}

// ── Get session PII map (for cross-media dedup) ──────────────

export function getSessionMap(sessionId: string): { map: Record<string, string>; counts: Record<string, number> } {
  const session = sessions.get(sessionId);
  if (!session) return { map: {}, counts: {} };
  return { map: session.map, counts: session.counts };
}

// ── Base64 helpers ──────────────────────────────────────────

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
