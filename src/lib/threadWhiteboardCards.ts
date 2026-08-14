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

// Content-shaped cards: a card is only as big as the text + images inside it.
// CARD_W / COMMENT_W are MAXIMUMS, never fixed widths.
export const CARD_W = 720;
export const COMMENT_W = 660;
export const CLUSTER_GAP_X = 900;
export const CLUSTER_GAP_Y = 140;
const TREE_GAP_X = 110;

const BODY_FONT = 16;
const LINE_H = 1.25;
const CHAR_W = 0.55; // average advance width of the hand-drawn font at 1px size
const PAD = 20;
const GAP = 14;
const MIN_TEXT_W = 150;
const IMG_MAX_W = 320;
const IMG_MAX_H = 260;
const CHIP_MAX_W = 320;
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

let measureCtx: CanvasRenderingContext2D | null | undefined;
let fontReady: Promise<void> | null = null;

/**
 * Excalidraw renders text in Excalifont, which is ~17% wider than the fallback
 * sans. Measuring before that font is loaded is what makes text spill out of
 * cards, so every builder awaits this first.
 */
export function ensureCardFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  if (!fontReady) {
    fontReady = (async () => {
      try {
        await document.fonts.load(`${BODY_FONT}px Excalifont`);
      } catch {
        /* fall back to the width fudge in measureLine */
      }
    })();
  }
  return fontReady;
}

/** True once Excalifont actually measures differently from the fallback sans. */
function excalifontLoaded(ctx: CanvasRenderingContext2D, fontSize: number): boolean {
  const probe = 'MMMMwwwwiiii';
  ctx.font = `${fontSize}px Excalifont`;
  const a = ctx.measureText(probe).width;
  ctx.font = `${fontSize}px sans-serif`;
  const b = ctx.measureText(probe).width;
  return Math.abs(a - b) > 0.5;
}

/** Real pixel width of a line in Excalidraw's hand-drawn font (canvas-measured). */
function measureLine(line: string, fontSize = BODY_FONT): number {
  if (!line) return 0;
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) return line.length * fontSize * CHAR_W;
  const loaded = excalifontLoaded(measureCtx, fontSize);
  measureCtx.font = `${fontSize}px Excalifont, Virgil, "Segoe UI", sans-serif`;
  // Pad when Excalifont has not loaded yet so wrapped text never spills out.
  return measureCtx.measureText(line).width * (loaded ? 1 : 1.2);
}



/** Word-wraps text to a pixel width so the card height matches what renders. */
function wrapText(text: string, width: number, fontSize = BODY_FONT): string {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      let w = word;
      // Break words that cannot fit on a line of their own.
      while (measureLine(w, fontSize) > width) {
        let cut = w.length;
        while (cut > 1 && measureLine(w.slice(0, cut), fontSize) > width) cut--;
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      if (!line) line = w;
      else if (measureLine(`${line} ${w}`, fontSize) <= width) line += ` ${w}`;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out.join('\n');
}

function textHeight(wrapped: string, fontSize = BODY_FONT): number {
  return Math.max(1, wrapped.split('\n').length) * Math.round(fontSize * LINE_H);
}

/** Pixel width of the longest line — used to shrink a card to its content. */
function textWidth(wrapped: string, fontSize = BODY_FONT): number {
  const longest = wrapped.split('\n').reduce((m, l) => Math.max(m, measureLine(l, fontSize)), 0);
  return Math.ceil(longest) + 6;
}

interface FittedText {
  wrapped: string;
  width: number;
  height: number;
}

/**
 * Wraps text and then measures it with Excalidraw's OWN text metrics, retrying
 * tighter wraps until it fits `maxW`. Using Excalidraw's measurement is what
 * keeps rendered text from spilling past the card border.
 */
function fitText(text: string, maxW: number, fontSize = BODY_FONT): FittedText {
  let wrapped = wrapText(text, maxW, fontSize);
  const own = (w: string): FittedText => ({
    wrapped: w,
    width: textWidth(w, fontSize),
    height: textHeight(w, fontSize),
  });
  let best = own(wrapped);
  for (let i = 0; i < 4; i++) {
    let measured: any;
    try {
      [measured] = convertToExcalidrawElements([
        { type: 'text', x: 0, y: 0, text: wrapped, fontSize } as any,
      ]) as any[];
    } catch {
      return best;
    }
    if (!measured?.width) return best;
    // Take the larger of the two metrics: Excalidraw measures with whatever
    // font is loaded right now, which under-reports before Excalifont lands.
    const mine = own(wrapped);
    best = {
      wrapped,
      width: Math.max(Math.ceil(measured.width), mine.width),
      height: Math.max(Math.ceil(measured.height), mine.height),
    };
    if (best.width <= maxW) return best;
    const target = Math.max(40, maxW * (maxW / best.width) * 0.97);
    const next = wrapText(text, target, fontSize);
    if (next === wrapped) return { ...best, width: Math.min(best.width, maxW) };
    wrapped = next;
  }
  return best;
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
  avatar?: LoadedImage | null;
  body: string;
}

/**
 * Lays out one content-shaped card. `maxWidth` is a ceiling, not a size: the
 * card shrinks to the widest wrapped line plus the image column, so short
 * replies become small cards and long ones grow.
 */
function buildCard(
  blocks: CardBlocks,
  images: LoadedImage[],
  opts: { x: number; y: number; maxWidth: number; id: string; link: string; customData: any }
): BuiltCard {
  const { x, y, maxWidth, id, link, customData } = opts;
  const groupId = `${id}-group`;
  const sized = images.map((img) => ({ img, ...fitImage(img) }));
  const imgColW = sized.length ? Math.max(...sized.map((s) => s.w)) : 0;
  const maxTextW = Math.max(MIN_TEXT_W, maxWidth - PAD * 2 - (imgColW ? imgColW + GAP : 0));

  // Wrap at the ceiling, then measure what the text actually needs.
  const chipFit = blocks.chip ? fitText(blocks.chip, Math.min(CHIP_MAX_W, maxTextW) - 20) : null;
  const avatar = blocks.author ? blocks.avatar ?? null : null;
  const avatarW = avatar ? AVATAR_SIZE + 8 : 0;
  const authorFit = blocks.author ? fitText(blocks.author, Math.max(60, maxTextW - avatarW)) : null;
  const bodyFit = blocks.body ? fitText(blocks.body, maxTextW) : null;
  const textW = Math.max(
    MIN_TEXT_W,
    Math.min(
      maxTextW,
      Math.max(
        chipFit ? chipFit.width + 20 : 0,
        authorFit ? authorFit.width + avatarW : 0,
        bodyFit?.width ?? 0
      )
    )
  );

  const children: any[] = [];
  let ty = y + PAD;

  if (chipFit) {
    const chipW = Math.min(Math.min(CHIP_MAX_W, textW), chipFit.width + 20);
    const chipH = chipFit.height + 18;
    children.push({
      type: 'rectangle',
      id: `${id}-chip`,
      x: x + PAD,
      y: ty,
      width: chipW,
      height: chipH,
      backgroundColor: CHIP_BG,
      strokeColor: CHIP_STROKE,
      fillStyle: 'solid',
      strokeWidth: 2,
      roundness: { type: 3 },
      groupIds: [groupId],
      label: { text: chipFit.wrapped, fontSize: BODY_FONT, strokeColor: CHIP_TEXT, textAlign: 'left', verticalAlign: 'top' },
    });
    ty += chipH + GAP;
  }

  if (authorFit) {
    const rowH = Math.max(authorFit.height, avatar ? AVATAR_SIZE : 0);
    if (avatar) {
      children.push({
        type: 'image',
        id: `${id}-avatar`,
        x: x + PAD,
        y: ty + Math.round((rowH - AVATAR_SIZE) / 2),
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        fileId: avatar.fileId,
        groupIds: [groupId],
      });
    }
    children.push({
      type: 'text',
      id: `${id}-author`,
      x: x + PAD + avatarW,
      y: ty + Math.round((rowH - authorFit.height) / 2),
      width: authorFit.width,
      height: authorFit.height,
      text: authorFit.wrapped,
      fontSize: BODY_FONT,
      strokeColor: AUTHOR_TEXT,
      groupIds: [groupId],
    });
    ty += rowH + 6;
  }

  if (bodyFit) {
    children.push({
      type: 'text',
      id: `${id}-body`,
      x: x + PAD,
      y: ty,
      width: bodyFit.width,
      height: bodyFit.height,
      text: bodyFit.wrapped,
      fontSize: BODY_FONT,
      strokeColor: STROKE,
      groupIds: [groupId],
    });
    ty += bodyFit.height;
  }


  const textColH = ty - (y + PAD);
  const width = PAD * 2 + textW + (imgColW ? imgColW + GAP : 0);

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

  const height = Math.max(60, Math.max(textColH, imgColH) + PAD * 2);

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

/**
 * Stamp of the content a card was built from. Cards created before a thread's
 * images existed carry an older stamp, which is how stale cards are detected
 * and rebuilt instead of staying text-only forever.
 */
export function threadFingerprint(thread: ThreadSeed): string {
  return hashId(`tree-v2|${thread.title || ''}|${thread.category || ''}|${thread.content || ''}`);
}

/** Builds only the thread's own card, used when its content changes later. */
export async function buildThreadCard(
  thread: ThreadSeed,
  x: number,
  y: number
): Promise<BuiltCard> {
  await ensureCardFont();
  const images = await loadImages(thread.content);
  return buildCard(threadBlocks(thread, images.failed), images.loaded, {
    x,
    y,
    maxWidth: CARD_W,
    id: `thread-${thread.id}`,
    link: `/threads/${thread.id}`,
    customData: { threadId: thread.id, kind: 'thread-card', fp: threadFingerprint(thread) },
  });
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
  await ensureCardFont();
  const elements: any[] = [];
  const files: Record<string, any> = {};
  const threadElId = `thread-${thread.id}`;
  const threadCard = await buildThreadCard(thread, originX, originY);
  elements.push(...threadCard.elements);
  Object.assign(files, threadCard.files);

  const ordered = orderComments(comments);
  if (!ordered.length) return { elements, files, height: threadCard.height };

  // Build once, then arrange the replies as an actual conversation tree. Each
  // parent's children occupy horizontal sibling branches beneath it instead of
  // becoming one long, thread-like vertical list.
  const cards = new Map<string, BuiltCard>();
  const commentsById = new Map(ordered.map((comment) => [comment.id, comment]));
  const children = new Map<string | null, CommentSeed[]>();
  for (const comment of ordered) {
    const parent = comment.parent_id && commentsById.has(comment.parent_id) ? comment.parent_id : null;
    const list = children.get(parent) ?? [];
    list.push(comment);
    children.set(parent, list);
    const card = await buildCommentCard(comment, 0, 0, thread.id);
    cards.set(comment.id, card);
    Object.assign(files, card.files);
  }

  const boundsOf = (card: BuiltCard) => {
    const live = card.elements.filter((el) => el && !el.isDeleted);
    const minX = Math.min(...live.map((el) => el.x || 0));
    const maxX = Math.max(...live.map((el) => (el.x || 0) + (el.width || 0)));
    return { width: Math.max(1, maxX - minX), height: card.height };
  };
  const subtreeWidths = new Map<string, number>();
  const subtreeWidth = (id: string): number => {
    const cached = subtreeWidths.get(id);
    if (cached !== undefined) return cached;
    const ownWidth = boundsOf(cards.get(id) as BuiltCard).width;
    const childWidths = (children.get(id) ?? []).map((child) => subtreeWidth(child.id));
    const descendantsWidth = childWidths.length
      ? childWidths.reduce((sum, width) => sum + width, 0) + TREE_GAP_X * (childWidths.length - 1)
      : 0;
    const width = Math.max(ownWidth, descendantsWidth);
    subtreeWidths.set(id, width);
    return width;
  };

  const placements = new Map<string, { x: number; y: number; width: number; height: number }>();
  const placeBranch = (comment: CommentSeed, left: number, top: number): number => {
    const card = cards.get(comment.id) as BuiltCard;
    const size = boundsOf(card);
    const branchWidth = subtreeWidth(comment.id);
    const x = left + (branchWidth - size.width) / 2;
    placements.set(comment.id, { x, y: top, width: size.width, height: size.height });
    const descendants = children.get(comment.id) ?? [];
    let childLeft = left;
    let branchBottom = top + size.height;
    for (const child of descendants) {
      const childBottom = placeBranch(child, childLeft, top + size.height + CLUSTER_GAP_Y);
      branchBottom = Math.max(branchBottom, childBottom);
      childLeft += subtreeWidth(child.id) + TREE_GAP_X;
    }
    return branchBottom;
  };

  const roots = children.get(null) ?? [];
  const rootWidths = roots.map((root) => subtreeWidth(root.id));
  const forestWidth = rootWidths.reduce((sum, width) => sum + width, 0) + TREE_GAP_X * Math.max(0, roots.length - 1);
  const threadLive = threadCard.elements.filter((el) => el && !el.isDeleted);
  const threadWidth = Math.max(...threadLive.map((el) => (el.x || 0) + (el.width || 0))) - originX;
  let branchLeft = originX + Math.max(0, (threadWidth - forestWidth) / 2);
  let clusterBottom = originY + threadCard.height;
  for (const root of roots) {
    clusterBottom = Math.max(
      clusterBottom,
      placeBranch(root, branchLeft, originY + threadCard.height + CLUSTER_GAP_Y),
    );
    branchLeft += subtreeWidth(root.id) + TREE_GAP_X;
  }

  for (const comment of ordered) {
    const card = cards.get(comment.id) as BuiltCard;
    const placement = placements.get(comment.id);
    if (!placement) continue;
    const moved = card.elements.map((element) => ({
      ...element,
      x: (element.x || 0) + placement.x,
      y: (element.y || 0) + placement.y,
    }));
    elements.push(...moved);

    const parentPlacement = comment.parent_id ? placements.get(comment.parent_id) : undefined;
    const parentX = parentPlacement ? parentPlacement.x + parentPlacement.width / 2 : originX + threadWidth / 2;
    const parentY = parentPlacement ? parentPlacement.y + parentPlacement.height : originY + threadCard.height;
    const childX = placement.x + placement.width / 2;
    const childY = placement.y;
    // Only ever draw a downward arrow parent -> child. An arrow that would end
    // at or above its parent's bottom edge is what puts a stray arrow above the
    // top thread card, so it is skipped entirely.
    if (childY > parentY + 4) {
      elements.push(
        ...convertToExcalidrawElements([
          {
            type: 'arrow',
            x: parentX,
            y: parentY,
            width: childX - parentX,
            height: childY - parentY,
            points: [[0, 0], [childX - parentX, childY - parentY]],
            strokeColor: STROKE,
            strokeWidth: 2,
            endArrowhead: 'arrow',
            customData: { threadId: thread.id, commentId: comment.id, kind: 'comment-link' },
            start: { id: comment.parent_id ? `comment-${comment.parent_id}` : threadElId },
            end: { id: `comment-${comment.id}` },
          },
        ] as any),
      );
    }

  }

  return { elements, files, height: clusterBottom - originY };
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
  await ensureCardFont();
  const { loaded, failed } = await loadImages(comment.content);

  return buildCard(commentBlocks(comment, failed), loaded, {
    x,
    y,
    maxWidth: COMMENT_W,
    id: `comment-${comment.id}`,
    link: `/threads/${threadId}`,
    customData: { threadId, commentId: comment.id, kind: 'comment-card' },
  });
}
