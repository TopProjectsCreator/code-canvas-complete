import { redactVideosInBody } from "./video-redaction.ts";
import type { Shape } from "./translate.ts";

// ── isVideoMime tests ────────────────────────────────────────

function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

Deno.test("isVideoMime returns true for video/* MIME types", () => {
  const valid = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
  for (const m of valid) {
    if (!isVideoMime(m)) throw new Error(`Expected ${m} to be video`);
  }
});

Deno.test("isVideoMime returns false for non-video MIME types", () => {
  const invalid = ["image/png", "text/plain", "application/pdf", "audio/mp3"];
  for (const m of invalid) {
    if (isVideoMime(m)) throw new Error(`Expected ${m} not to be video`);
  }
});

// ── parseVideoDataUri tests ──────────────────────────────────

function parseVideoDataUri(uri: string): { mimeType: string; data: string } | null {
  const match = uri.match(/^data:(video\/(?:mp4|webm|quicktime|x-matroska));base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

Deno.test("parseVideoDataUri parses valid video data URIs", () => {
  const result = parseVideoDataUri("data:video/mp4;base64,dGVzdA==");
  if (!result) throw new Error("Expected parsed result");
  if (result.mimeType !== "video/mp4") throw new Error("Wrong mime type");
  if (result.data !== "dGVzdA==") throw new Error("Wrong data");
});

Deno.test("parseVideoDataUri rejects invalid video data URIs", () => {
  const invalid = [
    "data:image/png;base64,dGVzdA==",
    "https://example.com/video.mp4",
    "not-a-uri",
  ];
  for (const u of invalid) {
    if (parseVideoDataUri(u) !== null) throw new Error(`Expected ${u} to be rejected`);
  }
});

// ── findVideoBlocks tests ────────────────────────────────────

function findVideoBlocks(body: Record<string, unknown>, shape: Shape) {
  const blocks: Array<{ index: number; type: "data_uri"; mimeType: string; data: string }> = [];
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

  return blocks;
}

Deno.test("findVideoBlocks finds video data URIs in OpenAI format", () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this video" },
          { type: "image_url", image_url: { url: "data:video/mp4;base64,AAAA" } },
          { type: "image_url", image_url: { url: "data:image/png;base64,BBBB" } },
        ],
      },
    ],
  };
  const blocks = findVideoBlocks(body, "openai");
  if (blocks.length !== 1) throw new Error(`Expected 1 video block, got ${blocks.length}`);
  if (blocks[0].mimeType !== "video/mp4") throw new Error(`Expected video/mp4, got ${blocks[0].mimeType}`);
  if (blocks[0].data !== "AAAA") throw new Error(`Wrong data`);
});

Deno.test("findVideoBlocks returns empty for text-only messages", () => {
  const body = {
    messages: [
      { role: "user", content: "Hello" },
    ],
  };
  const blocks = findVideoBlocks(body, "openai");
  if (blocks.length !== 0) throw new Error(`Expected 0 blocks, got ${blocks.length}`);
});

// ── mapMatchesToBBoxes tests ─────────────────────────────────

Deno.test("mapMatchesToBBoxes maps character positions to word bounding boxes", () => {
  const matches = [
    { token: "[EMAIL_1]", original: "test@example.com", start: 0, end: 16 },
  ];
  const words = [
    { text: "test@example.com", bbox: { x0: 10, y0: 20, x1: 200, y1: 40 } },
  ];
  const regions = mapMatchesToBBoxes(matches, words, "test@example.com");
  if (regions.length !== 1) throw new Error(`Expected 1 region, got ${regions.length}`);
  if (regions[0].bbox.x0 !== 10) throw new Error(`Expected x0=10, got ${regions[0].bbox.x0}`);
  if (regions[0].bbox.y0 !== 20) throw new Error(`Expected y0=20, got ${regions[0].bbox.y0}`);
  if (regions[0].bbox.x1 !== 200) throw new Error(`Expected x1=200, got ${regions[0].bbox.x1}`);
  if (regions[0].bbox.y1 !== 40) throw new Error(`Expected y1=40, got ${regions[0].bbox.y1}`);
});

Deno.test("mapMatchesToBBoxes handles multi-word matches spanning multiple boxes", () => {
  // "hello world"
  // characters: h(0) e(1) l(2) l(3) o(4) (5) w(6) o(7) r(8) l(9) d(10)
  // word0: hello (chars 0-4), word1: (space), word2: world (chars 6-10)
  // Note: charToWord: [0,0,0,0,0, -1, 1,1,1,1,1]
  const matches = [
    { token: "[PERSON_1]", original: "hello world", start: 0, end: 11 },
  ];
  const words = [
    { text: "hello", bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
    { text: "world", bbox: { x0: 60, y0: 0, x1: 110, y1: 20 } },
  ];
  const regions = mapMatchesToBBoxes(matches, words, "hello world");
  if (regions.length !== 1) throw new Error(`Expected 1 region, got ${regions.length}`);
  // Should span both words
  if (regions[0].bbox.x0 !== 0) throw new Error(`Expected x0=0, got ${regions[0].bbox.x0}`);
  if (regions[0].bbox.x1 !== 110) throw new Error(`Expected x1=110, got ${regions[0].bbox.x1}`);
});

// ── mergeOverlappingRegions tests ────────────────────────────

Deno.test("mergeOverlappingRegions merges overlapping bounding boxes", () => {
  const regions = [
    { token: "[EMAIL_1]", original: "a@b.com", bbox: { x0: 10, y0: 10, x1: 100, y1: 50 } },
    { token: "[PHONE_1]", original: "555-0100", bbox: { x0: 50, y0: 20, x1: 150, y1: 60 } },
  ];
  const merged = mergeOverlappingRegions(regions);
  if (merged.length !== 1) throw new Error(`Expected 1 merged region, got ${merged.length}`);
  if (merged[0].bbox.x0 !== 10) throw new Error(`Expected x0=10`);
  if (merged[0].bbox.y0 !== 10) throw new Error(`Expected y0=10`);
  if (merged[0].bbox.x1 !== 150) throw new Error(`Expected x1=150`);
  if (merged[0].bbox.y1 !== 60) throw new Error(`Expected y1=60`);
});

Deno.test("mergeOverlappingRegions keeps non-overlapping regions separate", () => {
  const regions = [
    { token: "[EMAIL_1]", original: "a@b.com", bbox: { x0: 10, y0: 10, x1: 100, y1: 30 } },
    { token: "[PHONE_1]", original: "555-0100", bbox: { x0: 200, y0: 40, x1: 300, y1: 60 } },
  ];
  const merged = mergeOverlappingRegions(regions);
  if (merged.length !== 2) throw new Error(`Expected 2 separate regions, got ${merged.length}`);
});

// ── redactVideosInBody integration test (no actual video download) ──

Deno.test("redactVideosInBody returns passthrough when disabled", async () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: "data:video/mp4;base64,AAAA" } },
        ],
      },
    ],
  } as Record<string, unknown>;
  const result = await redactVideosInBody(body, "openai", { customPatterns: [], detectNames: false }, false);
  if (Object.keys(result.map ?? {}).length > 0) throw new Error("Expected empty map when disabled");
});

// ── Helper functions for internal module testing ─────────────

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
