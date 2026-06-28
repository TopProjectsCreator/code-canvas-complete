import { redact } from "@/redactor/lib/redaction";

export function previewRedaction(text: string) {
  const r = redact(text, { detectNames: false });
  return {
    redacted: r.text,
    matches: r.matches.map((m) => ({
      type: m.type,
      token: m.token,
      original: m.original,
      start: m.start,
      end: m.end,
    })),
    counts: r.counts,
  };
}

/** Run redaction on OCR-extracted text from an image. */
export function previewImageRedaction(ocrText: string) {
  const r = redact(ocrText, { detectNames: false });
  return {
    redacted: r.text,
    matches: r.matches.map((m) => ({
      type: m.type,
      token: m.token,
      original: m.original,
      start: m.start,
      end: m.end,
    })),
    counts: r.counts,
    hasPii: r.matches.length > 0,
  };
}

// ── Client-side image pixelation (Canvas API) ────────────────

export interface OCRWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Pixelate PII regions in an image using the Canvas API and return a data URL. */
export async function pixelateImageOnCanvas(
  imageDataUrl: string,
  words: OCRWord[],
  matches: { token: string; start: number; end: number }[],
  fullText: string,
): Promise<string | null> {
  const img = await loadImage(imageDataUrl);
  if (!img) return null;

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  // Map character positions to word indices (same algorithm as server-side)
  const charToWord: number[] = [];
  let textPos = 0;
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    const pos = fullText.indexOf(w.text, textPos);
    if (pos >= 0) {
      while (textPos < pos) {
        charToWord.push(-1);
        textPos++;
      }
      for (let ci = 0; ci < w.text.length; ci++) {
        charToWord.push(wi);
        textPos++;
      }
    } else {
      for (let ci = 0; ci < w.text.length; ci++) {
        charToWord.push(wi);
      }
      charToWord.push(-1);
    }
  }

  // Build regions from matches
  const rawRegions: CanvasRegion[] = [];
  for (const m of matches) {
    const wordIndices = new Set<number>();
    for (let i = m.start; i < m.end && i < charToWord.length; i++) {
      if (charToWord[i] >= 0) wordIndices.add(charToWord[i]);
    }
    if (wordIndices.size === 0) continue;

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const wi of wordIndices) {
      const w = words[wi];
      if (!w) continue;
      x0 = Math.min(x0, w.bbox.x0);
      y0 = Math.min(y0, w.bbox.y0);
      x1 = Math.max(x1, w.bbox.x1);
      y1 = Math.max(y1, w.bbox.y1);
    }
    if (!isFinite(x0)) continue;

    rawRegions.push({
      token: m.token,
      x: Math.max(0, Math.floor(x0)),
      y: Math.max(0, Math.floor(y0)),
      w: Math.min(canvas.width - Math.floor(x0), Math.ceil(x1 - x0)),
      h: Math.min(canvas.height - Math.floor(y0), Math.ceil(y1 - y0)),
    });
  }

  // Merge overlapping regions
  const merged = mergeCanvasRegions(rawRegions);

  // Pixelate using raw pixel data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (const reg of merged) {
    if (reg.w < 2 || reg.h < 2) continue;
    pixelateCanvasRegion(pixels, canvas.width, canvas.height, reg.x, reg.y, reg.w, reg.h);
  }

  ctx.putImageData(imageData, 0, 0);

  // Draw token text on top
  ctx.save();
  for (const reg of merged) {
    if (reg.w < 2 || reg.h < 2) continue;
    drawCanvasToken(ctx, reg.token, reg.x, reg.y, reg.w, reg.h);
  }
  ctx.restore();

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function pixelateCanvasRegion(
  pixels: Uint8ClampedArray,
  imgW: number, imgH: number,
  rx: number, ry: number, rw: number, rh: number,
  blockSize = 8,
): void {
  const xEnd = Math.min(rx + rw, imgW);
  const yEnd = Math.min(ry + rh, imgH);

  for (let by = ry; by < yEnd; by += blockSize) {
    for (let bx = rx; bx < xEnd; bx += blockSize) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let py = by; py < Math.min(by + blockSize, yEnd); py++) {
        for (let px = bx; px < Math.min(bx + blockSize, xEnd); px++) {
          const idx = (py * imgW + px) * 4;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
          count++;
        }
      }
      if (count === 0) continue;
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      for (let py = by; py < Math.min(by + blockSize, yEnd); py++) {
        for (let px = bx; px < Math.min(bx + blockSize, xEnd); px++) {
          const idx = (py * imgW + px) * 4;
          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
        }
      }
    }
  }
}

interface CanvasRegion {
  token: string;
  x: number; y: number; w: number; h: number;
}

function mergeCanvasRegions(regions: CanvasRegion[]): CanvasRegion[] {
  if (regions.length <= 1) return regions;
  const sorted = [...regions].sort((a, b) => a.x - b.x || a.y - b.y);
  const merged: CanvasRegion[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    const overlapX = Math.min(prev.x + prev.w, curr.x + curr.w) - Math.max(prev.x, curr.x);
    const overlapY = Math.min(prev.y + prev.h, curr.y + curr.h) - Math.max(prev.y, curr.y);
    if (overlapX > 0 && overlapY > 0) {
      const x1 = Math.max(prev.x + prev.w, curr.x + curr.w);
      const y1 = Math.max(prev.y + prev.h, curr.y + curr.h);
      prev.x = Math.min(prev.x, curr.x);
      prev.y = Math.min(prev.y, curr.y);
      prev.w = x1 - prev.x;
      prev.h = y1 - prev.y;
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

function drawCanvasToken(
  ctx: CanvasRenderingContext2D,
  token: string,
  rx: number, ry: number, rw: number, rh: number,
): void {
  const maxFontSize = Math.min(rw / token.length * 1.5, rh * 0.8);
  const fontSize = Math.max(8, Math.min(maxFontSize, 48));
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = Math.max(1, fontSize / 12);

  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  ctx.strokeText(token, cx, cy);
  ctx.fillText(token, cx, cy);
}
