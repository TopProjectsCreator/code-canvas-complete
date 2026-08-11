import { convertToExcalidrawElements } from '@excalidraw/excalidraw';

export interface ThreadSeed {
  id: string;
  title: string;
  category: string | null;
  content?: string | null;
  author?: string | null;
}

export interface CommentSeed {
  id: string;
  thread_id: string;
  parent_id: string | null;
  content: string;
  depth: number;
  author?: string | null;
  created_at?: string | null;
}

export interface BuiltCard {
  elements: any[];
  files: Record<string, any>;
  height: number;
}

// Wide, sketch-style cards: full content, small text, generous canvas spacing.
export const CARD_W = 960;
export const COMMENT_W = 880;
export const CLUSTER_GAP_X = 1180;
export const CLUSTER_GAP_Y = 180;

const BODY_FONT = 16;
const LINE_H = 1.25;
const PAD = 24;
const GAP = 16;
const IMG_MAX_W = 440;
const IMG_MAX_H = 340;
const CHIP_MAX_W = 340;
const STROKE = '#1e1e1e';
const CARD_BG = '#ffffff';
const CHIP_BG = '#e7f0ff';
const CHIP_STROKE = '#1971c2';
const CHIP_TEXT = '#1971c2';

/** Strips HTML/markdown wrappers down to readable plain text. Never truncates by default. */
export function toPlainText(raw: string | null | undefined, max = Number.POSITIVE_INFINITY): string {
  if (!raw) return '';
  let text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<img[^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length > max) text = `${text.slice(0, max).trimEnd()}…`;
  return text;
}

/** Pulls every image URL out of HTML `<img src>` and markdown `![alt](url)`. */
export function extractImageUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const urls: string[] = [];
  const push = (u?: string | null) => {
    if (!u) return;
    const clean = u.trim().replace(/&amp;/g, '&');
    if (clean && !urls.includes(clean)) urls.push(clean);
  };
  for (const m of raw.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) push(m[1]);
  for (const m of raw.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) push(m[1]);
  return urls;
}

// ---------------------------------------------------------------- text layout

function charsPerLine(width: number, fontSize: number) {
  return Math.max(8, Math.floor(width / (fontSize * 0.55)));
}

/** Word-wraps text to a pixel width so the card height matches what renders. */
function wrapText(text: string, width: number, fontSize = BODY_FONT): string {
  const cap = charsPerLine(width, fontSize);
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      let w = word;
      while (w.length > cap) {
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, cap));
        w = w.slice(cap);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= cap) line += ` ${w}`;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out.join('\n');
}

function textHeight(wrapped: string, fontSize = BODY_FONT): number {
  return Math.max(1, wrapped.split('\n').length) * Math.round(fontSize * LINE_H);
}

// -------------------------------------------------------------- image loading

type LoadedImage = { fileId: string; dataURL: string; mimeType: string; w: number; h: number };

const imageCache = new Map<string, LoadedImage | null>();

function hashId(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i++) {
    h1 = (h1 ^ input.charCodeAt(i)) * 0x01000193 >>> 0;
    h2 = (h2 + input.charCodeAt(i) * (i + 7)) >>> 0;
  }
  return `img${h1.toString(36)}${h2.toString(36)}${input.length.toString(36)}`;
}

/** Fetches + downscales an image into an Excalidraw binary file entry. */
async function loadImage(url: string): Promise<LoadedImage | null> {
  if (imageCache.has(url)) return imageCache.get(url) ?? null;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('not an image');
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1000 / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const mimeType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const dataURL = canvas.toDataURL(mimeType, 0.85);
    const loaded: LoadedImage = { fileId: hashId(url), dataURL, mimeType, w, h };
    imageCache.set(url, loaded);
    return loaded;
  } catch {
    imageCache.set(url, null);
    return null;
  }
}

async function loadImages(raw: string | null | undefined): Promise<{ loaded: LoadedImage[]; failed: string[] }> {
  const urls = extractImageUrls(raw).slice(0, 6);
  const results = await Promise.all(urls.map((u) => loadImage(u).then((r) => [u, r] as const)));
  const loaded: LoadedImage[] = [];
  const failed: string[] = [];
  for (const [u, r] of results) {
    if (r) loaded.push(r);
    else failed.push(u);
  }
  return { loaded, failed };
}

function fitImage(img: LoadedImage) {
  const scale = Math.min(IMG_MAX_W / img.w, IMG_MAX_H / img.h, 1);
  return { w: Math.round(img.w * scale), h: Math.round(img.h * scale) };
}

// --------------------------------------------------------------- card builder

interface CardBlocks {
  chip?: string;
  author?: string;
  body: string;
}

/** Lays out one content-shaped card: text column left, images column right. */
function buildCard(
  blocks: CardBlocks,
  images: LoadedImage[],
  opts: { x: number; y: number; width: number; id: string; link: string; customData: any }
): BuiltCard {
  const { x, y, width, id, link, customData } = opts;
  const groupId = `${id}-group`;
  const sized = images.map((img) => ({ img, ...fitImage(img) }));
  const imgColW = sized.length ? Math.max(...sized.map((s) => s.w)) : 0;
  const textW = Math.max(
    240,
    width - PAD * 2 - (imgColW ? imgColW + GAP : 0)
  );

  const children: any[] = [];
  let ty = y + PAD;

  if (blocks.chip) {
    const chipInner = Math.min(CHIP_MAX_W, textW) - 20;
    const wrapped = wrapText(blocks.chip, chipInner);
    const chipH = textHeight(wrapped) + 20;
    children.push({
      type: 'rectangle',
      id: `${id}-chip`,
      x: x + PAD,
      y: ty,
      width: Math.min(CHIP_MAX_W, textW),
      height: chipH,
      backgroundColor: CHIP_BG,
      strokeColor: CHIP_STROKE,
      fillStyle: 'solid',
      strokeWidth: 2,
      roundness: { type: 3 },
      groupIds: [groupId],
      label: { text: wrapped, fontSize: BODY_FONT, strokeColor: CHIP_TEXT, textAlign: 'left', verticalAlign: 'top' },
    });
    ty += chipH + GAP;
  }

  if (blocks.author) {
    const wrapped = wrapText(blocks.author, textW);
    children.push({
      type: 'text',
      id: `${id}-author`,
      x: x + PAD,
      y: ty,
      width: textW,
      height: textHeight(wrapped),
      text: wrapped,
      fontSize: BODY_FONT,
      strokeColor: STROKE,
      groupIds: [groupId],
    });
    ty += textHeight(wrapped) + 6;
  }

  if (blocks.body) {
    const wrapped = wrapText(blocks.body, textW);
    children.push({
      type: 'text',
      id: `${id}-body`,
      x: x + PAD,
      y: ty,
      width: textW,
      height: textHeight(wrapped),
      text: wrapped,
      fontSize: BODY_FONT,
      strokeColor: STROKE,
      groupIds: [groupId],
    });
    ty += textHeight(wrapped);
  }

  const textColH = ty - (y + PAD);

  const files: Record<string, any> = {};
  let iy = y + PAD;
  for (const s of sized) {
    children.push({
      type: 'image',
      id: `${id}-img-${s.img.fileId}`,
      x: x + width - PAD - s.w,
      y: iy,
      width: s.w,
      height: s.h,
      fileId: s.img.fileId,
      groupIds: [groupId],
    });
    files[s.img.fileId] = {
      id: s.img.fileId,
      dataURL: s.img.dataURL,
      mimeType: s.img.mimeType,
      created: Date.now(),
    };
    iy += s.h + GAP;
  }
  const imgColH = sized.length ? iy - GAP - (y + PAD) : 0;

  const height = Math.max(80, Math.max(textColH, imgColH) + PAD * 2);

  const skeleton: any[] = [
    {
      type: 'rectangle',
      id,
      x,
      y,
      width,
      height,
      backgroundColor: CARD_BG,
      strokeColor: STROKE,
      fillStyle: 'solid',
      strokeWidth: 2,
      roundness: { type: 3 },
      link,
      customData,
      groupIds: [groupId],
    },
    ...children,
  ];

  return { elements: convertToExcalidrawElements(skeleton as any), files, height };
}

function threadBlocks(thread: ThreadSeed, failed: string[]): CardBlocks {
  const chip = (thread.category ? `[${thread.category}] ` : '') + thread.title;
  const bodyParts = [toPlainText(thread.content)].filter(Boolean);
  if (failed.length) bodyParts.push(failed.map((u) => `[image] ${u}`).join('\n'));
  return { chip, body: bodyParts.join('\n\n') };
}

function commentBlocks(comment: CommentSeed, failed: string[]): CardBlocks {
  const bodyParts = [toPlainText(comment.content)].filter(Boolean);
  if (failed.length) bodyParts.push(failed.map((u) => `[image] ${u}`).join('\n'));
  return {
    author: comment.author ? `@${String(comment.author).replace(/^@/, '')}:` : undefined,
    body: bodyParts.join('\n\n'),
  };
}

/**
 * Builds a full thread cluster: the thread card plus every reply as its own
 * content-shaped card, indented by depth and arrow-linked to its parent.
 */
export async function buildThreadCluster(
  thread: ThreadSeed,
  comments: CommentSeed[],
  originX: number,
  originY: number
): Promise<BuiltCard> {
  const elements: any[] = [];
  const files: Record<string, any> = {};

  const threadElId = `thread-${thread.id}`;
  const threadImages = await loadImages(thread.content);
  const threadCard = buildCard(threadBlocks(thread, threadImages.failed), threadImages.loaded, {
    x: originX,
    y: originY,
    width: CARD_W,
    id: threadElId,
    link: `/threads/${thread.id}`,
    customData: { threadId: thread.id, kind: 'thread-card' },
  });
  elements.push(...threadCard.elements);
  Object.assign(files, threadCard.files);

  const ordered = orderComments(comments);
  let cursorY = originY + threadCard.height + CLUSTER_GAP_Y;

  for (const cm of ordered) {
    const indent = Math.min(cm.depth ?? 0, 4) * 120;
    const built = await buildCommentCard(cm, originX + 40 + indent, cursorY, thread.id);
    elements.push(...built.elements);
    Object.assign(files, built.files);
    elements.push(
      ...convertToExcalidrawElements([
        {
          type: 'arrow',
          x: originX + 60 + indent,
          y: cursorY - (CLUSTER_GAP_Y - 30),
          width: 60,
          height: CLUSTER_GAP_Y - 60,
          strokeColor: STROKE,
          strokeWidth: 2,
          customData: { threadId: thread.id, commentId: cm.id, kind: 'comment-link' },
          start: { id: cm.parent_id ? `comment-${cm.parent_id}` : threadElId },
          end: { id: `comment-${cm.id}` },
        },
      ] as any)
    );
    cursorY += built.height + CLUSTER_GAP_Y;
  }

  return { elements, files, height: cursorY - originY };
}

/** Depth-first ordering (parents before their children). */
export function orderComments(comments: CommentSeed[]): CommentSeed[] {
  const byParent = new Map<string | null, CommentSeed[]>();
  for (const c of comments) {
    const key = c.parent_id ?? null;
    const list = byParent.get(key) ?? [];
    list.push(c);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  }
  const out: CommentSeed[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null) => {
    for (const c of byParent.get(parent) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      walk(c.id);
    }
  };
  walk(null);
  // Orphans (parent outside this set) still get rendered at root level.
  for (const c of comments) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push({ ...c, parent_id: null, depth: 0 });
    }
  }
  return out;
}

/** Builds a single reply card, appended below an existing cluster. */
export async function buildCommentCard(
  comment: CommentSeed,
  x: number,
  y: number,
  threadId: string
): Promise<BuiltCard> {
  const { loaded, failed } = await loadImages(comment.content);
  return buildCard(commentBlocks(comment, failed), loaded, {
    x,
    y,
    width: COMMENT_W,
    id: `comment-${comment.id}`,
    link: `/threads/${threadId}`,
    customData: { threadId, commentId: comment.id, kind: 'comment-card' },
  });
}
