import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, RefreshCw, Users } from 'lucide-react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { WhiteboardHistory, type WhiteboardScene } from '@/components/threads/WhiteboardHistory';
import {
  buildThreadCluster,
  buildThreadCard,
  buildCommentCard,
  orderComments,
  threadFingerprint,
  CLUSTER_GAP_X,
  CLUSTER_GAP_Y,
  type ThreadSeed,
  type CommentSeed,
} from '@/lib/threadWhiteboardCards';


type Scene = { elements: any[]; appState?: any; files?: Record<string, any> };
type PeerRole = 'editor' | 'viewer';
interface PeerStats { added: number; modified: number; deleted: number }
interface PeerMeta {
  user_id: string;
  display_name: string;
  email?: string | null;
  online_at: string;
  stats: PeerStats;
}

const BOARD_ID = 'threads';
const PLACE_MARGIN = 60;
const PLACE_STEP = 40;
const PLACE_MAX_Y = 400000;
/** Top edge of the single left-to-right lane every generated cluster sits in. */
const LANE_Y = 40;
const LANE_START_X = 40;

interface Rect { x: number; y: number; w: number; h: number }

/** Bounding box of a set of elements, in scene coordinates. */
/** Attaches @handle + avatar URL to thread/comment seeds so cards show who made them. */
async function attachAuthors<T extends { author_id?: string | null }>(
  rows: T[]
): Promise<(T & { author?: string | null; author_avatar?: string | null })[]> {
  const ids = [...new Set(rows.map((r) => r.author_id).filter(Boolean))] as string[];
  if (!ids.length) return rows as any;
  const { data } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', ids);
  const map = new Map((data || []).map((p: any) => [p.user_id, p]));
  return rows.map((r) => {
    const profile = r.author_id ? map.get(r.author_id) : null;
    return {
      ...r,
      author: profile?.display_name ?? null,
      author_avatar: profile?.avatar_url ?? null,
    };
  });
}

function bboxOf(elements: readonly any[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements as any[]) {
    if (!el || el.isDeleted) continue;
    const x = el.x || 0;
    const y = el.y || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + (el.width || 0));
    maxY = Math.max(maxY, y + (el.height || 0));
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Every live element as its own rectangle — what new cards must avoid. */
function occupiedRects(elements: readonly any[]): Rect[] {
  const rects: Rect[] = [];
  for (const el of elements as any[]) {
    if (!el || el.isDeleted) continue;
    const w = el.width || 0;
    const h = el.height || 0;
    if (w <= 0 || h <= 0) continue;
    rects.push({ x: el.x || 0, y: el.y || 0, w, h });
  }
  return rects;
}

function overlaps(a: Rect, b: Rect, pad = PLACE_MARGIN): boolean {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w + pad > b.x &&
    a.y < b.y + b.h + pad &&
    a.y + a.h + pad > b.y
  );
}

/**
 * Places generated clusters in ONE left-to-right lane: every new cluster goes
 * to the right of everything already on the board, all sharing the same top
 * edge. Nothing is ever tucked into a random free gap, so the board reads as a
 * single horizontal row of conversations.
 */
function makePlacer(existing: Rect[]) {
  const taken = [...existing];
  // Start the lane past the right edge of everything that already exists.
  let cursorX = taken.reduce((max, r) => Math.max(max, r.x + r.w + CLUSTER_GAP_X), LANE_START_X);
  const firstFreeY = (x: number, w: number, h: number, startY: number) => {
    let y = startY;
    for (let guard = 0; guard < 5000 && y < PLACE_MAX_Y; guard++) {
      const candidate: Rect = { x, y, w, h };
      const hit = taken.find((t) => overlaps(t, candidate));
      if (!hit) return y;
      y = Math.max(y + PLACE_STEP, hit.y + hit.h + PLACE_MARGIN);
    }
    return y;
  };
  return {
    /** Next slot in the lane, to the right of the previous cluster. */
    place(w: number, h: number): { x: number; y: number } {
      let x = cursorX;
      // Slide right until the lane slot is genuinely free.
      for (let guard = 0; guard < 5000; guard++) {
        const candidate: Rect = { x, y: LANE_Y, w, h };
        const hit = taken.find((t) => overlaps(t, candidate));
        if (!hit) break;
        x = Math.max(x + PLACE_STEP, hit.x + hit.w + CLUSTER_GAP_X);
      }
      const spot = { x, y: LANE_Y };
      taken.push({ ...spot, w, h });
      cursorX = x + w + CLUSTER_GAP_X;
      return spot;
    },
    /** Keeps a preferred spot when it is free, otherwise joins the lane. */
    placeNear(x: number, y: number, w: number, h: number): { x: number; y: number } {
      const candidate: Rect = { x, y, w, h };
      if (!taken.some((t) => overlaps(t, candidate))) {
        taken.push(candidate);
        return { x, y };
      }
      // Replies may only slide straight down under their parent; anything else
      // goes to the end of the lane instead of into a random hole.
      const pushedDown = firstFreeY(x, w, h, y);
      if (pushedDown < y + h * 4) {
        taken.push({ x, y: pushedDown, w, h });
        return { x, y: pushedDown };
      }
      return this.place(w, h);
    },
    reserve(rect: Rect) {
      taken.push(rect);
    },
  };
}


export default function GlobalWhiteboard() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const apiRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [initial, setInitial] = useState<Scene>({ elements: [], appState: { viewBackgroundColor: '#fafaf9' } });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const broadcastThrottleRef = useRef<number>(0);
  const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<any>(null);
  const clientIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const lastSentHashRef = useRef<string>('');
  const knownFileIdsRef = useRef<Set<string>>(new Set());
  const applyingRemoteRef = useRef(false);
  // Cards generated while reconciling the saved scene with the threads table.
  const pendingInitialSaveRef = useRef<{ elements: any[]; files: Record<string, any> } | null>(null);
  // Realtime handlers are wired before persist/broadcast exist, so reach them via refs.
  const persistRef = useRef<(elements: readonly any[], appState: any, files: Record<string, any>) => Promise<void>>();
  const broadcastRef = useRef<(elements: readonly any[], files: Record<string, any>) => void>();

  // Peer/presence state
  const [peers, setPeers] = useState<PeerMeta[]>([]);
  // Per-user permission overrides set by admins (userId -> role). Ephemeral.
  const [permissions, setPermissions] = useState<Record<string, PeerRole>>({});
  const myRole: PeerRole = user ? (permissions[user.id] ?? 'editor') : 'viewer';

  // Track authored diffs locally, then publish via presence.track
  const prevElementsRef = useRef<Map<string, { version: number; isDeleted: boolean }>>(new Map());
  const myStatsRef = useRef<PeerStats>({ added: 0, modified: 0, deleted: 0 });

  const myDisplayName =
    (user?.user_metadata as { display_name?: string })?.display_name ||
    user?.email?.split('@')[0] ||
    'Guest';

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  // Load scene, then reconcile with existing threads + their full reply trees
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [boardRes, threadsRes, commentsRes] = await Promise.all([
        supabase.from('global_whiteboard').select('scene').eq('id', BOARD_ID).maybeSingle(),
        supabase
          .from('threads')
          .select('id, title, category, content, author_id')
          .order('created_at', { ascending: true }),
        supabase
          .from('comments')
          .select('id, thread_id, parent_id, content, depth, created_at, author_id')
          .order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;

      const scene: Scene = (boardRes.data?.scene as Scene) || { elements: [], appState: {} };
      const rawElements = Array.isArray(scene.elements) ? [...scene.elements] : [];
      const [threads, comments] = await Promise.all([
        attachAuthors((threadsRes.data || []) as any[]),
        attachAuthors((commentsRes.data || []) as any[]),
      ]) as unknown as [ThreadSeed[], CommentSeed[]];

      // Existing elements are NEVER touched: nothing here deletes, rebuilds,
      // restyles or re-places anything already on the board. Generated content
      // is additive only, so anything moved by hand stays exactly where it was.
      const elements = rawElements;

      const commentsByThread = new Map<string, CommentSeed[]>();
      for (const c of comments) {
        const list = commentsByThread.get(c.thread_id) ?? [];
        list.push(c);
        commentsByThread.set(c.thread_id, list);
      }

      const workingElements = elements;

      const presentThreads = new Set(
        workingElements
          .filter((el: any) => el?.customData?.kind === 'thread-card')
          .map((el: any) => el.customData.threadId as string)
      );
      const presentComments = new Set(
        workingElements.map((el: any) => el?.customData?.commentId).filter(Boolean) as string[]
      );

      // Placement avoids every live element, so generated cards never land on
      // top of existing cards, images or hand-drawn work.
      const placer = makePlacer(occupiedRects(workingElements));


      const additions: any[] = [];
      const additionFiles: Record<string, any> = {};

      for (const t of threads) {
        const threadComments = commentsByThread.get(t.id) ?? [];
        if (!presentThreads.has(t.id)) {
          const probe = await buildThreadCluster(t, threadComments, 0, 0);
          const size = bboxOf(probe.elements);
          const { x, y } = placer.place(size.w, size.h);
          const cluster = await buildThreadCluster(t, threadComments, x, y);
          additions.push(...cluster.elements);
          Object.assign(additionFiles, cluster.files);
          continue;
        }
        // Thread already on the board — append only the replies it is missing.
        const missing = orderComments(threadComments).filter((c) => !presentComments.has(c.id));
        if (!missing.length) continue;
        const owned = workingElements.filter((el: any) => el?.customData?.threadId === t.id && !el.isDeleted);
        const baseX = Math.min(...owned.map((el: any) => el.x || 0));
        let cursorY = Math.max(...owned.map((el: any) => (el.y || 0) + (el.height || 0))) + CLUSTER_GAP_Y;
        for (const cm of missing) {
          const probe = await buildCommentCard(cm, 0, 0, t.id);
          const size = bboxOf(probe.elements);
          const parent = cm.parent_id
            ? workingElements.find(
                (el: any) => el?.customData?.kind === 'comment-card' && el?.customData?.commentId === cm.parent_id,
              )
            : null;
          const preferredX = parent ? (parent.x || baseX) : baseX;
          const preferredY = parent
            ? (parent.y || 0) + (parent.height || 0) + CLUSTER_GAP_Y
            : cursorY;
          const spot = placer.placeNear(preferredX, preferredY, size.w, size.h);
          const built = await buildCommentCard(cm, spot.x, spot.y, t.id);
          additions.push(...built.elements);
          Object.assign(additionFiles, built.files);
          cursorY = spot.y + built.height + CLUSTER_GAP_Y;
        }
      }


      const merged = [...workingElements, ...additions];
      const mergedFiles = { ...(scene.files || {}), ...additionFiles };
      const initMap = new Map<string, { version: number; isDeleted: boolean }>();
      for (const el of merged) {
        if (el?.id) initMap.set(el.id, { version: el.version || 0, isDeleted: !!el.isDeleted });
      }
      prevElementsRef.current = initMap;
      knownFileIdsRef.current = new Set(Object.keys(scene.files || {}));

      setInitial({
        elements: merged,
        appState: { ...(scene.appState || {}), viewBackgroundColor: scene.appState?.viewBackgroundColor || '#fafaf9' },
        files: mergedFiles,
      });
      liveCountRef.current = merged.filter((el: any) => el && !el.isDeleted).length;
      // Generated cards created during reconciliation are not saved by the canvas
      // (nothing changed from Excalidraw's point of view), so queue an explicit save.
      if (additions.length || staleThreads.size || strayIds.size) {
        pendingInitialSaveRef.current = { elements: merged, files: mergedFiles };
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);


  // Realtime: remote scene, presence, new threads, permission changes
  useEffect(() => {
    if (!ready) return;
    const presenceKey = userId || `guest-${clientIdRef.current}`;
    const channel = supabase
      .channel(`global_whiteboard:${BOARD_ID}`, {
        config: { presence: { key: presenceKey } },
      })
      .on('broadcast', { event: 'scene' }, (msg: any) => {
        const p = msg.payload || {};
        if (!apiRef.current || p.clientId === clientIdRef.current) return;
        if (!Array.isArray(p.elements)) return;
        applyingRemoteRef.current = true;
        if (p.files && apiRef.current.addFiles) {
          const arr = Object.values(p.files);
          if (arr.length) apiRef.current.addFiles(arr);
        }
        apiRef.current.updateScene({ elements: p.elements });
        applyingRemoteRef.current = false;
      })
      .on('broadcast', { event: 'permission' }, (msg: any) => {
        const p = msg.payload || {};
        if (!p.userId || !p.role) return;
        setPermissions((prev) => ({ ...prev, [p.userId]: p.role }));
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_whiteboard', filter: `id=eq.${BOARD_ID}` },
        (payload: any) => {
          const row = payload.new;
          if (!row || !apiRef.current) return;
          if (row.updated_by && row.updated_by === userId) return;
          const scene = row.scene as Scene;
          if (!scene?.elements) return;
          applyingRemoteRef.current = true;
          const files = scene.files ? Object.values(scene.files) : [];
          if (files.length && apiRef.current.addFiles) apiRef.current.addFiles(files);
          apiRef.current.updateScene({ elements: scene.elements });
          applyingRemoteRef.current = false;
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'threads' },
        async (payload: any) => {
          if (!payload.new || !apiRef.current) return;
          const [t] = (await attachAuthors([payload.new])) as any[];
          if (!apiRef.current) return;
          const current = apiRef.current.getSceneElements() as any[];
          const existingCard = current.find(
            (el) => el?.customData?.kind === 'thread-card' && el?.customData?.threadId === t.id && !el.isDeleted
          );
          if (existingCard) {
            const groupIds = new Set<string>(existingCard.groupIds || []);
            const built = await buildThreadCard(t as ThreadSeed, existingCard.x || 0, existingCard.y || 0);
            if (!apiRef.current) return;
            const kept = current.filter(
              (el) =>
                el?.id !== existingCard.id &&
                !(el?.groupIds || []).some((groupId: string) => groupIds.has(groupId))
            );
            const next = [...kept, ...built.elements];
            applyingRemoteRef.current = true;
            const builtFiles = Object.values(built.files);
            if (builtFiles.length && apiRef.current.addFiles) apiRef.current.addFiles(builtFiles as any);
            apiRef.current.updateScene({ elements: next });
            applyingRemoteRef.current = false;
            lastSentHashRef.current = '';
            const allFiles = { ...(apiRef.current.getFiles?.() || {}), ...built.files };
            await persistRef.current?.(next, { viewBackgroundColor: '#fafaf9' }, allFiles);
            broadcastRef.current?.(next, allFiles);
            return;
          }
          const probe = await buildThreadCluster(t as ThreadSeed, [], 0, 0);
          const size = bboxOf(probe.elements);
          const spot = makePlacer(occupiedRects(current)).place(size.w, size.h);
          const cluster = await buildThreadCluster(t as ThreadSeed, [], spot.x, spot.y);
          if (!apiRef.current) return;
          const nextEls = [...current, ...cluster.elements];
          applyingRemoteRef.current = true;
          const clusterFiles = Object.values(cluster.files);
          if (clusterFiles.length && apiRef.current.addFiles) apiRef.current.addFiles(clusterFiles as any);
          apiRef.current.updateScene({ elements: nextEls });
          applyingRemoteRef.current = false;
          // Save immediately: the suppressed onChange means nothing else will
          // persist this card, and its image binaries would be lost.
          lastSentHashRef.current = '';
          const clusterAllFiles = { ...(apiRef.current.getFiles?.() || {}), ...cluster.files };
          await persistRef.current?.(nextEls, { viewBackgroundColor: '#fafaf9' }, clusterAllFiles);
          broadcastRef.current?.(nextEls, clusterAllFiles);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        async (payload: any) => {
          if (!payload.new || !apiRef.current) return;
          const [cm] = (await attachAuthors([payload.new])) as unknown as CommentSeed[];
          if (!apiRef.current) return;
          const current = apiRef.current.getSceneElements() as any[];
          if (current.some((el) => el?.customData?.commentId === cm.id)) return;
          const owned = current.filter(
            (el) => el?.customData?.threadId === cm.thread_id && !el.isDeleted
          );
          if (!owned.length) return;
          const baseX = Math.min(...owned.map((el) => el.x || 0));
          const cursorY = Math.max(...owned.map((el) => (el.y || 0) + (el.height || 0))) + CLUSTER_GAP_Y;
          const parent = cm.parent_id
            ? current.find(
                (el) => el?.customData?.kind === 'comment-card' && el?.customData?.commentId === cm.parent_id,
              )
            : null;
          const probe = await buildCommentCard(cm, 0, 0, cm.thread_id);
          const size = bboxOf(probe.elements);
          const spot = makePlacer(occupiedRects(current)).placeNear(
            parent ? (parent.x || baseX) : baseX,
            parent ? (parent.y || 0) + (parent.height || 0) + CLUSTER_GAP_Y : cursorY,
            size.w,
            size.h
          );
          const built = await buildCommentCard(cm, spot.x, spot.y, cm.thread_id);
          if (!apiRef.current) return;
          const nextEls = [...current, ...built.elements];
          applyingRemoteRef.current = true;
          const builtFiles = Object.values(built.files);
          if (builtFiles.length && apiRef.current.addFiles) apiRef.current.addFiles(builtFiles as any);
          apiRef.current.updateScene({ elements: nextEls });
          applyingRemoteRef.current = false;
          lastSentHashRef.current = '';
          const allFiles = { ...(apiRef.current.getFiles?.() || {}), ...built.files };
          await persistRef.current?.(nextEls, { viewBackgroundColor: '#fafaf9' }, allFiles);
          broadcastRef.current?.(nextEls, allFiles);
        }
      )

      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PeerMeta>();
        const list: PeerMeta[] = [];
        for (const key of Object.keys(state)) {
          const metas = state[key];
          const last = metas && metas[metas.length - 1];
          if (last && last.user_id) list.push(last);
        }
        list.sort((a, b) => a.display_name.localeCompare(b.display_name));
        setPeers(list);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && userId) {
          await channel.track({
            user_id: userId,
            display_name: myDisplayName,
            email: userEmail,
            online_at: new Date().toISOString(),
            stats: myStatsRef.current,
          } satisfies PeerMeta);
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [ready, userId, userEmail, myDisplayName]);

  // Republish presence when my stats change (throttled)
  const republishStatsThrottleRef = useRef<number>(0);
  const republishStats = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !user) return;
    const now = Date.now();
    if (now - republishStatsThrottleRef.current < 400) return;
    republishStatsThrottleRef.current = now;
    ch.track({
      user_id: user.id,
      display_name: myDisplayName,
      email: user.email,
      online_at: new Date().toISOString(),
      stats: myStatsRef.current,
    } satisfies PeerMeta);
  }, [user, myDisplayName]);

  // Number of live (non-deleted) elements last known to be safely stored.
  const liveCountRef = useRef(0);

  const persist = useCallback(async (elements: readonly any[], appState: any, files: Record<string, any>) => {
    if (!user) return;
    const liveCount = (elements as any[]).filter((el) => el && !el.isDeleted).length;
    // Guard against the catastrophic case: a client that loaded an empty/failed
    // scene must never blank out a board that still holds content.
    if (liveCount === 0 && liveCountRef.current > 0) {
      console.warn('[Whiteboard] Refused to save an empty scene over', liveCountRef.current, 'elements');
      toast({
        title: 'Empty save blocked',
        description: 'The board still holds content elsewhere — reload before drawing.',
        variant: 'destructive',
      });
      return;
    }
    // Every image element must ship with its binary, otherwise it is saved as a
    // permanently blank box. Fall back to the canvas file map, and if the binary
    // still cannot be found, drop the element instead of persisting an orphan.
    const canvasFiles = (apiRef.current?.getFiles?.() || {}) as Record<string, any>;
    const pool = { ...canvasFiles, ...(files || {}) };
    const trimmedFiles: Record<string, any> = {};
    const orphanIds = new Set<string>();
    for (const el of elements as any[]) {
      if (el?.type !== 'image' || !el.fileId || el.isDeleted) continue;
      const binary = pool[el.fileId];
      if (binary) trimmedFiles[el.fileId] = binary;
      else if (!knownFileIdsRef.current.has(el.fileId)) orphanIds.add(el.id);
    }
    const safeElements = orphanIds.size
      ? (elements as any[]).filter((el) => !orphanIds.has(el.id))
      : (elements as any[]);
    const filesHash = Object.keys(trimmedFiles).sort().join(',');
    // Signature must change whenever ANY element changes (moves, styling, deletes),
    // not just when the element count or the last element's version changes.
    let versionSum = 0;
    let deletedCount = 0;
    for (const el of safeElements) {
      versionSum += (el?.version || 0) + (el?.versionNonce || 0) % 1000;
      if (el?.isDeleted) deletedCount++;
    }
    const hash = `${safeElements.length}:${liveCount}:${deletedCount}:${versionSum}:${filesHash}`;
    if (hash === lastSentHashRef.current) return;
    const newFiles = Object.fromEntries(
      Object.entries(trimmedFiles).filter(([id]) => !knownFileIdsRef.current.has(id))
    );
    const { error } = await (supabase.rpc as any)('save_global_whiteboard_scene', {
      _board_id: BOARD_ID,
      _elements: safeElements,
      _app_state: { viewBackgroundColor: appState?.viewBackgroundColor || '#fafaf9' },
      _new_files: newFiles,
    });
    if (error) throw error;
    lastSentHashRef.current = hash;
    for (const id of Object.keys(newFiles)) knownFileIdsRef.current.add(id);
    liveCountRef.current = liveCount;
  }, [user, toast]);

  const broadcastScene = useCallback((elements: readonly any[], files: Record<string, any>) => {
    const ch = channelRef.current;
    if (!ch) return;
    const referenced = new Set(
      (elements as any[])
        .filter((el) => el?.type === 'image' && el?.fileId && !el?.isDeleted)
        .map((el) => el.fileId as string)
    );
    const trimmedFiles: Record<string, any> = {};
    for (const [k, v] of Object.entries(files || {})) {
      if (referenced.has(k)) trimmedFiles[k] = v;
    }
    ch.send({
      type: 'broadcast',
      event: 'scene',
      payload: { clientId: clientIdRef.current, elements, files: trimmedFiles },
    });
  }, []);

  // Flush cards generated during reconciliation (and repaired clusters) so their
  // image binaries reach the database instead of living only in this tab.
  useEffect(() => {
    if (!ready || !user) return;
    const pending = pendingInitialSaveRef.current;
    if (!pending) return;
    pendingInitialSaveRef.current = null;
    (async () => {
      try {
        await persist(pending.elements, { viewBackgroundColor: '#fafaf9' }, pending.files);
        broadcastScene(pending.elements, pending.files);
      } catch (err) {
        console.error('[Whiteboard] Failed to save generated cards', err);
      }
    })();
  }, [ready, user, persist, broadcastScene]);



  persistRef.current = persist;
  broadcastRef.current = broadcastScene;

  const restoreScene = useCallback(async (scene: WhiteboardScene) => {
    if (!user) throw new Error('Sign in to restore a version.');
    const elements = Array.isArray(scene.elements) ? (scene.elements as any[]) : [];
    const files = (scene.files || {}) as Record<string, any>;
    const { error } = await supabase.from('global_whiteboard').upsert(
      {
        id: BOARD_ID,
        scene: { elements, appState: scene.appState || {}, files } as any,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    lastSentHashRef.current = '';
    knownFileIdsRef.current = new Set(Object.keys(files));
    liveCountRef.current = elements.filter((el) => el && !el.isDeleted).length;
    if (apiRef.current) {
      applyingRemoteRef.current = true;
      const fileList = Object.values(files);
      if (fileList.length && apiRef.current.addFiles) apiRef.current.addFiles(fileList);
      apiRef.current.updateScene({ elements });
      applyingRemoteRef.current = false;
    }
    broadcastScene(elements, files);
  }, [user, broadcastScene]);

  // Admin: throw away every generated card and rebuild the whole board with the
  // current content-shaped layout (old boards still hold the legacy wide boxes).
  const rebuildCards = useCallback(async () => {
    if (!user || !isAdmin || !apiRef.current) return;
    setRebuilding(true);
    try {
      const [threadsRes, commentsRes] = await Promise.all([
        supabase.from('threads').select('id, title, category, content, author_id').order('created_at', { ascending: true }),
        supabase
          .from('comments')
          .select('id, thread_id, parent_id, content, depth, created_at, author_id')
          .order('created_at', { ascending: true }),
      ]);
      const [threads, comments] = await Promise.all([
        attachAuthors((threadsRes.data || []) as any[]),
        attachAuthors((commentsRes.data || []) as any[]),
      ]) as unknown as [ThreadSeed[], CommentSeed[]];
      const commentsByThread = new Map<string, CommentSeed[]>();
      for (const c of comments) {
        const list = commentsByThread.get(c.thread_id) ?? [];
        list.push(c);
        commentsByThread.set(c.thread_id, list);
      }

      const current = (apiRef.current.getSceneElements() || []) as any[];
      const generatedIds = new Set<string>();
      const generatedGroups = new Set<string>();
      for (const el of current) {
        if (!el?.customData?.kind) continue;
        generatedIds.add(el.id);
        for (const g of el.groupIds || []) generatedGroups.add(g);
      }
      // Keep hand-drawn work; drop cards, their labels, images and link arrows.
      const kept = current.filter(
        (el) =>
          !generatedIds.has(el.id) &&
          !(el.containerId && generatedIds.has(el.containerId)) &&
          !(el.groupIds || []).some((g: string) => generatedGroups.has(g))
      );

      // Hand-drawn work stays put, so rebuilt clusters must route around it.
      const placer = makePlacer(occupiedRects(kept));
      const rebuilt: any[] = [];
      const files: Record<string, any> = {};
      for (const t of threads) {
        const threadComments = commentsByThread.get(t.id) ?? [];
        const probe = await buildThreadCluster(t, threadComments, 0, 0);
        const size = bboxOf(probe.elements);
        const { x, y } = placer.place(size.w, size.h);
        const cluster = await buildThreadCluster(t, threadComments, x, y);
        rebuilt.push(...cluster.elements);
        Object.assign(files, cluster.files);
      }

      const elements = [...kept, ...rebuilt];
      const allFiles = { ...(apiRef.current.getFiles?.() || {}), ...files };
      applyingRemoteRef.current = true;
      const fileList = Object.values(files);
      if (fileList.length && apiRef.current.addFiles) apiRef.current.addFiles(fileList);
      apiRef.current.updateScene({ elements });
      applyingRemoteRef.current = false;
      lastSentHashRef.current = '';
      liveCountRef.current = elements.filter((el) => el && !el.isDeleted).length;
      await persist(elements, { viewBackgroundColor: '#fafaf9' }, allFiles);
      broadcastScene(elements, allFiles);
      toast({ title: 'Cards rebuilt', description: `${threads.length} threads re-laid out with the new card style.` });
    } catch (err) {
      toast({
        title: 'Rebuild failed',
        description: err instanceof Error ? err.message : 'Could not rebuild the cards.',
        variant: 'destructive',
      });
    } finally {
      setRebuilding(false);
    }
  }, [user, isAdmin, persist, broadcastScene, toast]);


  const diffAndAttribute = useCallback((elements: readonly any[]) => {
    const prev = prevElementsRef.current;
    const next = new Map<string, { version: number; isDeleted: boolean }>();
    let added = 0, modified = 0, deleted = 0;
    for (const el of elements as any[]) {
      if (!el?.id) continue;
      const cur = { version: el.version || 0, isDeleted: !!el.isDeleted };
      next.set(el.id, cur);
      const before = prev.get(el.id);
      if (!before) {
        if (!cur.isDeleted) added++;
      } else {
        if (!before.isDeleted && cur.isDeleted) deleted++;
        else if (cur.version > before.version && !cur.isDeleted) modified++;
      }
    }
    prevElementsRef.current = next;
    if (added || modified || deleted) {
      myStatsRef.current = {
        added: myStatsRef.current.added + added,
        modified: myStatsRef.current.modified + modified,
        deleted: myStatsRef.current.deleted + deleted,
      };
      republishStats();
    }
  }, [republishStats]);

  const onChange = useCallback((elements: readonly any[], appState: any, files: Record<string, any>) => {
    if (applyingRemoteRef.current) {
      // still track prev state to avoid attributing remote changes to us
      const next = new Map<string, { version: number; isDeleted: boolean }>();
      for (const el of elements as any[]) {
        if (el?.id) next.set(el.id, { version: el.version || 0, isDeleted: !!el.isDeleted });
      }
      prevElementsRef.current = next;
      return;
    }
    if (myRoleRef.current === 'viewer') {
      return;
    }
    diffAndAttribute(elements);
    const now = Date.now();
    if (now - broadcastThrottleRef.current >= 50) {
      broadcastThrottleRef.current = now;
      broadcastScene(elements, files || {});
    } else {
      if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
      pendingBroadcastRef.current = setTimeout(() => {
        broadcastThrottleRef.current = Date.now();
        broadcastScene(elements, files || {});
      }, 50);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await persist(elements, appState, files || {});
      } catch (err) {
        console.error('[Whiteboard] Save failed:', err);
        const message = err && typeof err === 'object' && 'message' in err
          ? String(err.message)
          : 'Your changes may not be saved.';
        toast({ title: 'Whiteboard save failed', description: message, variant: 'destructive' });
      }
    }, 600);
  }, [persist, broadcastScene, diffAndAttribute, toast]);

  // Keep a stable ref so the callback passed to Excalidraw never changes identity.
  const myRoleRef = useRef<PeerRole>(myRole);
  useEffect(() => { myRoleRef.current = myRole; }, [myRole]);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const stableOnChange = useCallback(
    (elements: readonly any[], appState: any, files: Record<string, any>) => {
      onChangeRef.current(elements, appState, files);
    },
    [],
  );
  const stableExcalidrawAPI = useCallback((api: any) => { apiRef.current = api; }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
  }, []);

  const setPeerPermission = useCallback((targetUserId: string, role: PeerRole) => {
    const ch = channelRef.current;
    setPermissions((prev) => ({ ...prev, [targetUserId]: role }));
    if (ch) {
      ch.send({
        type: 'broadcast',
        event: 'permission',
        payload: { userId: targetUserId, role, setBy: user?.id },
      });
    }
  }, [user?.id]);

  const totalNet = useMemo(() => {
    return peers.reduce((sum, p) => sum + (p.stats?.added || 0) - (p.stats?.deleted || 0), 0);
  }, [peers]);

  const peerCount = Math.max(1, peers.length);
  const effectiveViewMode = !user || myRole === 'viewer';

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <Seo title="Threads Whiteboard — collaborate live" description="A single infinite whiteboard where every thread appears as a card. Draw, connect, and comment together in real time." path="/threads/whiteboard" />
      <div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/threads">
              <ArrowLeft className="h-4 w-4" />
              Back to threads
            </Link>
          </Button>
          <div className="text-sm font-medium">Threads Whiteboard</div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            Every thread is a card. Move, connect, and annotate — everyone sees it live.
          </div>
        </div>

        <div className="flex items-center gap-2">
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={rebuildCards}
            disabled={rebuilding || !user}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
            {rebuilding ? 'Rebuilding…' : 'Rebuild cards'}
          </Button>
        )}
        <WhiteboardHistory
          boardKind="global"
          boardId={BOARD_ID}
          onRestore={restoreScene}
          disabled={!user}
        />
        <Popover>
          <PopoverTrigger asChild>
            <button className="rounded-full bg-muted hover:bg-muted/70 px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {peerCount} {peerCount === 1 ? 'person' : 'people'} here
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 p-0">
            <div className="px-4 py-3 border-b">
              <div className="text-sm font-semibold">Live collaborators</div>
              <div className="text-xs text-muted-foreground">
                Net {totalNet >= 0 ? '+' : ''}{totalNet} shapes this session
                {isAdmin && ' · you can change per-user permissions'}
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y">
              {peers.length === 0 && (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No one is online yet.
                </div>
              )}
              {peers.map((p) => {
                const role: PeerRole = permissions[p.user_id] ?? 'editor';
                const net = (p.stats?.added || 0) - (p.stats?.deleted || 0);
                const isSelf = p.user_id === user?.id;
                return (
                  <div key={p.user_id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                      {(p.display_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{p.display_name}</span>
                        {isSelf && <Badge variant="secondary" className="text-[10px] px-1 py-0">you</Badge>}
                        <Badge
                          variant={role === 'viewer' ? 'outline' : 'default'}
                          className="text-[10px] px-1 py-0 gap-0.5"
                        >
                          {role === 'viewer' ? <Eye className="h-2.5 w-2.5" /> : <Pencil className="h-2.5 w-2.5" />}
                          {role}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <span className="text-green-600 dark:text-green-400">+{p.stats?.added || 0}</span>
                        {' · '}
                        <span>~{p.stats?.modified || 0}</span>
                        {' · '}
                        <span className="text-red-600 dark:text-red-400">−{p.stats?.deleted || 0}</span>
                        {' · net '}
                        <span className="font-medium text-foreground">{net >= 0 ? '+' : ''}{net}</span>
                      </div>
                    </div>
                    {isAdmin && !isSelf && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant={role === 'editor' ? 'default' : 'outline'}
                          className="h-7 px-2 text-[11px] gap-1"
                          onClick={() => setPeerPermission(p.user_id, 'editor')}
                        >
                          <Pencil className="h-3 w-3" /> Editor
                        </Button>
                        <Button
                          size="sm"
                          variant={role === 'viewer' ? 'default' : 'outline'}
                          className="h-7 px-2 text-[11px] gap-1"
                          onClick={() => setPeerPermission(p.user_id, 'viewer')}
                        >
                          <Eye className="h-3 w-3" /> Viewer
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!isAdmin && (
              <div className="px-4 py-2 border-t text-[11px] text-muted-foreground">
                Only admins can change viewer/editor permissions.
              </div>
            )}
          </PopoverContent>
        </Popover>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {ready ? (
          <MemoExcalidraw
            initial={initial}
            onChange={stableOnChange}
            onApi={stableExcalidrawAPI}
            viewMode={effectiveViewMode}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            Loading whiteboard…
          </div>
        )}
      </div>
      {effectiveViewMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/90 backdrop-blur border px-4 py-2 text-xs shadow">
          {!user
            ? 'Sign in to draw and move cards. View-only mode.'
            : 'An admin has set you to viewer. View-only mode.'}
        </div>
      )}
    </div>
  );
}

// Isolate Excalidraw from parent re-renders. Presence updates (setPeers) re-render
// GlobalWhiteboard on every realtime sync; without memoization, Excalidraw sees
// new callback identities each render and cascades into React error #185.
interface MemoExcalidrawProps {
  initial: Scene;
  onChange: (elements: readonly any[], appState: any, files: Record<string, any>) => void;
  onApi: (api: any) => void;
  viewMode: boolean;
}
const MemoExcalidraw = memo(
  function MemoExcalidraw({ initial, onChange, onApi, viewMode }: MemoExcalidrawProps) {
    return (
      <Excalidraw
        initialData={initial}
        onChange={onChange}
        excalidrawAPI={onApi}
        viewModeEnabled={viewMode}
      />
    );
  },
  (prev, next) =>
    prev.initial === next.initial &&
    prev.onChange === next.onChange &&
    prev.onApi === next.onApi &&
    prev.viewMode === next.viewMode,
);
