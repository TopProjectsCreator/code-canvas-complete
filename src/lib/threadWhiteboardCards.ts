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

export const CARD_W = 320;
export const COMMENT_W = 280;
export const CLUSTER_GAP_X = 460;
export const CLUSTER_GAP_Y = 80;

const PALETTE = ['#dbeafe', '#fef3c7', '#dcfce7', '#fce7f3', '#ede9fe', '#ffe4e6'];
const STROKES = ['#1e40af', '#a16207', '#166534', '#9d174d', '#5b21b6', '#9f1239'];

/** Strips HTML/markdown media syntax down to readable plain text. */
export function toPlainText(raw: string | null | undefined, max = 700): string {
  if (!raw) return '';
  let text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '[image]')
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
  const charsPerLine = Math.max(12, Math.floor(width / (fontSize * 0.58)));
  const lines = text
    .split('\n')
    .reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.max(minHeight, 28 + lines * (fontSize * 1.35));
}

export function threadCardHeight(thread: ThreadSeed): number {
  const body = toPlainText(thread.content);
  const head = (thread.category ? `[${thread.category}] ` : '') + thread.title;
  return wrapHeight(`${head}\n\n${body}`, CARD_W - 24, 16, 96);
}

export function commentCardHeight(comment: CommentSeed): number {
  const body = toPlainText(comment.content, 400);
  const author = comment.author ? `${comment.author}: ` : '';
  return wrapHeight(`${author}${body}`, COMMENT_W - 24, 14, 56);
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
      label: { text: label, fontSize: 16, textAlign: 'left', verticalAlign: 'top' },
    },
  ];

  // Sort replies so parents always come before children.
  const ordered = orderComments(comments);
  let cursorY = originY + threadH + 40;

  for (const cm of ordered) {
    const h = commentCardHeight(cm);
    const indent = Math.min(cm.depth ?? 0, 4) * 28;
    const elId = `comment-${cm.id}`;
    const author = cm.author ? `${cm.author}: ` : '';
    skeleton.push({
      type: 'rectangle',
      id: elId,
      x: originX + 24 + indent,
      y: cursorY,
      width: COMMENT_W,
      height: h,
      backgroundColor: '#ffffff',
      strokeColor: STROKES[c],
      fillStyle: 'solid',
      strokeWidth: 1,
      roundness: { type: 3 },
      link: `/threads/${thread.id}`,
      customData: { threadId: thread.id, commentId: cm.id, kind: 'comment-card' },
      label: {
        text: `${author}${toPlainText(cm.content, 400)}`,
        fontSize: 14,
        textAlign: 'left',
        verticalAlign: 'top',
      },
    });
    skeleton.push({
      type: 'arrow',
      x: originX + 12,
      y: cursorY - 24,
      width: 24,
      height: 24,
      strokeColor: STROKES[c],
      strokeWidth: 1,
      customData: { threadId: thread.id, commentId: cm.id, kind: 'comment-link' },
      start: { id: cm.parent_id ? `comment-${cm.parent_id}` : threadElId },
      end: { id: elId },
    });
    cursorY += h + 28;
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
  const author = comment.author ? `${comment.author}: ` : '';
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
        strokeWidth: 1,
        roundness: { type: 3 },
        link: `/threads/${threadId}`,
        customData: { threadId, commentId: comment.id, kind: 'comment-card' },
        label: {
          text: `${author}${toPlainText(comment.content, 400)}`,
          fontSize: 14,
          textAlign: 'left',
          verticalAlign: 'top',
        },
      },
    ] as any),
    height: h,
  };
}
