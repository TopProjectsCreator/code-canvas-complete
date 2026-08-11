import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, Users } from 'lucide-react';
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
  buildCommentCard,
  orderComments,
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
const COLS = 4;

/** Packs clusters into columns, tracking each column's next free Y. */
function makePacker(columnTops: number[]) {
  const tops = [...columnTops];
  return {
    next(height: number) {
      let col = 0;
      for (let i = 1; i < tops.length; i++) if (tops[i] < tops[col]) col = i;
      const y = tops[col];
      tops[col] = y + height + CLUSTER_GAP_Y;
      return { x: 40 + col * CLUSTER_GAP_X, y };
    },
  };
}

export default function GlobalWhiteboard() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const apiRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState<Scene>({ elements: [], appState: { viewBackgroundColor: '#fafaf9' } });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const broadcastThrottleRef = useRef<number>(0);
  const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<any>(null);
  const clientIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const lastSentHashRef = useRef<string>('');
  const knownFileIdsRef = useRef<Set<string>>(new Set());
  const applyingRemoteRef = useRef(false);

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
          .select('id, title, category, content')
          .order('created_at', { ascending: true }),
        supabase
          .from('comments')
          .select('id, thread_id, parent_id, content, depth, created_at')
          .order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;

      const scene: Scene = (boardRes.data?.scene as Scene) || { elements: [], appState: {} };
      const elements = Array.isArray(scene.elements) ? [...scene.elements] : [];
      const threads = (threadsRes.data || []) as ThreadSeed[];
      const comments = (commentsRes.data || []) as CommentSeed[];

      const commentsByThread = new Map<string, CommentSeed[]>();
      for (const c of comments) {
        const list = commentsByThread.get(c.thread_id) ?? [];
        list.push(c);
        commentsByThread.set(c.thread_id, list);
      }

      const presentThreads = new Set(
        elements
          .filter((el: any) => el?.customData?.kind === 'thread-card')
          .map((el: any) => el.customData.threadId as string)
      );
      const presentComments = new Set(
        elements.map((el: any) => el?.customData?.commentId).filter(Boolean) as string[]
      );

      // Seed the packer with the bottom of whatever already sits in each column.
      const columnTops = Array.from({ length: COLS }, (_, col) => {
        const left = 40 + col * CLUSTER_GAP_X;
        const bottoms = elements
          .filter((el: any) => el && !el.isDeleted && el.x >= left - 40 && el.x < left + CLUSTER_GAP_X - 40)
          .map((el: any) => (el.y || 0) + (el.height || 0));
        return bottoms.length ? Math.max(...bottoms) + CLUSTER_GAP_Y : 40;
      });
      const packer = makePacker(columnTops);

      const additions: any[] = [];
      const additionFiles: Record<string, any> = {};

      for (const t of threads) {
        const threadComments = commentsByThread.get(t.id) ?? [];
        if (!presentThreads.has(t.id)) {
          const probe = await buildThreadCluster(t, threadComments, 0, 0);
          const { x, y } = packer.next(probe.height);
          const cluster = await buildThreadCluster(t, threadComments, x, y);
          additions.push(...cluster.elements);
          Object.assign(additionFiles, cluster.files);
          continue;
        }
        // Thread already on the board — append only the replies it is missing.
        const missing = orderComments(threadComments).filter((c) => !presentComments.has(c.id));
        if (!missing.length) continue;
        const owned = elements.filter((el: any) => el?.customData?.threadId === t.id && !el.isDeleted);
        const baseX = Math.min(...owned.map((el: any) => el.x || 0));
        let cursorY = Math.max(...owned.map((el: any) => (el.y || 0) + (el.height || 0))) + CLUSTER_GAP_Y;
        for (const cm of missing) {
          const indent = Math.min(cm.depth ?? 0, 4) * 120;
          const built = await buildCommentCard(cm, baseX + 40 + indent, cursorY, t.id);
          additions.push(...built.elements);
          Object.assign(additionFiles, built.files);
          cursorY += built.height + CLUSTER_GAP_Y;
        }
      }

      const merged = [...elements, ...additions];
      const initMap = new Map<string, { version: number; isDeleted: boolean }>();
      for (const el of merged) {
        if (el?.id) initMap.set(el.id, { version: el.version || 0, isDeleted: !!el.isDeleted });
      }
      prevElementsRef.current = initMap;
      knownFileIdsRef.current = new Set(Object.keys(scene.files || {}));

      setInitial({
        elements: merged,
        appState: { ...(scene.appState || {}), viewBackgroundColor: scene.appState?.viewBackgroundColor || '#fafaf9' },
        files: { ...(scene.files || {}), ...additionFiles },
      });
      liveCountRef.current = merged.filter((el: any) => el && !el.isDeleted).length;
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
        { event: 'INSERT', schema: 'public', table: 'threads' },
        async (payload: any) => {
          const t = payload.new;
          if (!t || !apiRef.current) return;
          const current = apiRef.current.getSceneElements() as any[];
          if (current.some((el) => el?.customData?.threadId === t.id)) return;
          const live = current.filter((el) => el && !el.isDeleted);
          const bottom = live.length ? Math.max(...live.map((el) => (el.y || 0) + (el.height || 0))) : 0;
          const cluster = await buildThreadCluster(t as ThreadSeed, [], 40, bottom + CLUSTER_GAP_Y);
          if (!apiRef.current) return;
          applyingRemoteRef.current = true;
          const clusterFiles = Object.values(cluster.files);
          if (clusterFiles.length && apiRef.current.addFiles) apiRef.current.addFiles(clusterFiles as any);
          apiRef.current.updateScene({ elements: [...current, ...cluster.elements] });
          applyingRemoteRef.current = false;
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        async (payload: any) => {
          const cm = payload.new as CommentSeed;
          if (!cm || !apiRef.current) return;
          const current = apiRef.current.getSceneElements() as any[];
          if (current.some((el) => el?.customData?.commentId === cm.id)) return;
          const owned = current.filter(
            (el) => el?.customData?.threadId === cm.thread_id && !el.isDeleted
          );
          if (!owned.length) return;
          const baseX = Math.min(...owned.map((el) => el.x || 0));
          const cursorY = Math.max(...owned.map((el) => (el.y || 0) + (el.height || 0))) + CLUSTER_GAP_Y;
          const indent = Math.min(cm.depth ?? 0, 4) * 120;
          const built = await buildCommentCard(cm, baseX + 40 + indent, cursorY, cm.thread_id);
          if (!apiRef.current) return;
          applyingRemoteRef.current = true;
          const builtFiles = Object.values(built.files);
          if (builtFiles.length && apiRef.current.addFiles) apiRef.current.addFiles(builtFiles as any);
          apiRef.current.updateScene({ elements: [...current, ...built.elements] });
          applyingRemoteRef.current = false;
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
    const referenced = new Set(
      (elements as any[])
        .filter((el) => el?.type === 'image' && el?.fileId && !el?.isDeleted)
        .map((el) => el.fileId as string)
    );
    const trimmedFiles: Record<string, any> = {};
    for (const [k, v] of Object.entries(files || {})) {
      if (referenced.has(k)) trimmedFiles[k] = v;
    }
    const filesHash = Object.keys(trimmedFiles).sort().join(',');
    // Signature must change whenever ANY element changes (moves, styling, deletes),
    // not just when the element count or the last element's version changes.
    let versionSum = 0;
    let deletedCount = 0;
    for (const el of elements as any[]) {
      versionSum += (el?.version || 0) + (el?.versionNonce || 0) % 1000;
      if (el?.isDeleted) deletedCount++;
    }
    const hash = `${elements.length}:${liveCount}:${deletedCount}:${versionSum}:${filesHash}`;
    if (hash === lastSentHashRef.current) return;
    const newFiles = Object.fromEntries(
      Object.entries(trimmedFiles).filter(([id]) => !knownFileIdsRef.current.has(id))
    );
    const { error } = await (supabase.rpc as any)('save_global_whiteboard_scene', {
      _board_id: BOARD_ID,
      _elements: elements,
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
        supabase.from('threads').select('id, title, category, content').order('created_at', { ascending: true }),
        supabase
          .from('comments')
          .select('id, thread_id, parent_id, content, depth, created_at')
          .order('created_at', { ascending: true }),
      ]);
      const threads = (threadsRes.data || []) as ThreadSeed[];
      const comments = (commentsRes.data || []) as CommentSeed[];
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

      const packer = makePacker(Array.from({ length: COLS }, () => 40));
      const rebuilt: any[] = [];
      const files: Record<string, any> = {};
      for (const t of threads) {
        const threadComments = commentsByThread.get(t.id) ?? [];
        const probe = await buildThreadCluster(t, threadComments, 0, 0);
        const { x, y } = packer.next(probe.height);
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
        toast({ title: 'Whiteboard save failed', description: 'Your changes may not be saved.', variant: 'destructive' });
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
