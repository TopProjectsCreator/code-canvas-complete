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

// Wide, sketch-style cards: full content, small text, generous canvas spacing.
export const CARD_W = 960;
export const COMMENT_W = 880;
export const CLUSTER_GAP_X = 1180;
export const CLUSTER_GAP_Y = 180;
const BODY_FONT = 16;

const PALETTE = ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'];
const STROKES = ['#1e1e1e', '#1e1e1e', '#1e1e1e', '#1e1e1e', '#1e1e1e', '#1e1e1e'];

/** Strips HTML/markdown wrappers down to readable plain text. Never truncates by default. */
export function toPlainText(raw: string | null | undefined, max = Number.POSITIVE_INFINITY): string {
  if (!raw) return '';
  let text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '[image] $1')
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

function wrapHeight(text: string, width: number, fontSize: number, minHeight: number): number {
  const charsPerLine = Math.max(12, Math.floor(width / (fontSize * 0.55)));
  const lines = text
    .split('\n')
    .reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.max(minHeight, 48 + lines * (fontSize * 1.4));
}

export function threadCardHeight(thread: ThreadSeed): number {
  const body = toPlainText(thread.content);
  const head = (thread.category ? `[${thread.category}] ` : '') + thread.title;
  return wrapHeight(`${head}\n\n${body}`, CARD_W - 48, BODY_FONT, 140);
}

export function commentCardHeight(comment: CommentSeed): number {
  const body = toPlainText(comment.content);
  const author = comment.author ? `${comment.author}:\n` : '';
  return wrapHeight(`${author}${body}`, COMMENT_W - 48, BODY_FONT, 90);
}


/**
 * Builds a full thread cluster: the thread card plus every reply as its own
 * card, indented by depth and arrow-linked to its parent.
 */
export function buildThreadCluster(
  thread: ThreadSeed,
  comments: CommentSeed[],
  originX: number,
  originY: number,
  colorIndex = 0
) {
  const c = colorIndex % PALETTE.length;
  const head = (thread.category ? `[${thread.category}] ` : '') + thread.title;
  const body = toPlainText(thread.content);
  const label = body ? `${head}\n\n${body}` : head;
  const threadElId = `thread-${thread.id}`;
  const threadH = threadCardHeight(thread);

  const skeleton: any[] = [
    {
      type: 'rectangle',
      id: threadElId,
      x: originX,
      y: originY,
      width: CARD_W,
      height: threadH,
      backgroundColor: PALETTE[c],
      strokeColor: STROKES[c],
      fillStyle: 'solid',
      strokeWidth: 2,
      roundness: { type: 3 },
      link: `/threads/${thread.id}`,
      customData: { threadId: thread.id, kind: 'thread-card' },
      label: { text: label, fontSize: BODY_FONT, textAlign: 'left', verticalAlign: 'top' },
    },
  ];

  // Sort replies so parents always come before children.
  const ordered = orderComments(comments);
  let cursorY = originY + threadH + 140;

  for (const cm of ordered) {
    const h = commentCardHeight(cm);
    const indent = Math.min(cm.depth ?? 0, 4) * 120;
    const elId = `comment-${cm.id}`;
    const author = cm.author ? `${cm.author}:\n` : '';
    skeleton.push({
      type: 'rectangle',
      id: elId,
      x: originX + 40 + indent,
      y: cursorY,
      width: COMMENT_W,
      height: h,
      backgroundColor: '#ffffff',
      strokeColor: STROKES[c],
      fillStyle: 'solid',
      strokeWidth: 2,
      roundness: { type: 3 },
      link: `/threads/${thread.id}`,
      customData: { threadId: thread.id, commentId: cm.id, kind: 'comment-card' },
      label: {
        text: `${author}${toPlainText(cm.content)}`,
        fontSize: BODY_FONT,
        textAlign: 'left',
        verticalAlign: 'top',
      },
    });
    skeleton.push({
      type: 'arrow',
      x: originX + 60 + indent,
      y: cursorY - 110,
      width: 60,
      height: 90,
      strokeColor: STROKES[c],
      strokeWidth: 2,
      customData: { threadId: thread.id, commentId: cm.id, kind: 'comment-link' },
      start: { id: cm.parent_id ? `comment-${cm.parent_id}` : threadElId },
      end: { id: elId },
    });
    cursorY += h + 140;
  }


  return {
    elements: convertToExcalidrawElements(skeleton as any),
    height: cursorY - originY,
  };
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

/** Builds a single reply card + arrow, appended below an existing cluster. */
export function buildCommentCard(
  comment: CommentSeed,
  x: number,
  y: number,
  threadId: string,
  colorIndex = 0
) {
  const c = colorIndex % PALETTE.length;
  const h = commentCardHeight(comment);
  const elId = `comment-${comment.id}`;
  const author = comment.author ? `${comment.author}:\n` : '';
  return {
    elements: convertToExcalidrawElements([
      {
        type: 'rectangle',
        id: elId,
        x,
        y,
        width: COMMENT_W,
        height: h,
        backgroundColor: '#ffffff',
        strokeColor: STROKES[c],
        fillStyle: 'solid',
        strokeWidth: 2,
        roundness: { type: 3 },
        link: `/threads/${threadId}`,
        customData: { threadId, commentId: comment.id, kind: 'comment-card' },
        label: {
          text: `${author}${toPlainText(comment.content)}`,
          fontSize: BODY_FONT,
          textAlign: 'left',
          verticalAlign: 'top',
        },
      },
    ] as any),

    height: h,
  };
}
