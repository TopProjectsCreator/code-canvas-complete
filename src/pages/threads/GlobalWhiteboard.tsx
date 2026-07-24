import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, Users } from 'lucide-react';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

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
const CARD_W = 240;
const CARD_H = 96;

function scatterPos(i: number) {
  const cols = 5;
  const col = i % cols;
  const row = Math.floor(i / cols);
  const jitterX = ((i * 53) % 40) - 20;
  const jitterY = ((i * 97) % 40) - 20;
  return {
    x: 40 + col * (CARD_W + 60) + jitterX,
    y: 40 + row * (CARD_H + 80) + jitterY,
  };
}

function buildThreadCard(thread: { id: string; title: string; category: string | null }, idx: number) {
  const { x, y } = scatterPos(idx);
  const palette = ['#dbeafe', '#fef3c7', '#dcfce7', '#fce7f3', '#ede9fe', '#ffe4e6'];
  const strokes = ['#1e40af', '#a16207', '#166534', '#9d174d', '#5b21b6', '#9f1239'];
  const c = idx % palette.length;
  const label = (thread.category ? `[${thread.category}] ` : '') + thread.title;
  return convertToExcalidrawElements([
    {
      type: 'rectangle',
      x,
      y,
      width: CARD_W,
      height: CARD_H,
      backgroundColor: palette[c],
      strokeColor: strokes[c],
      fillStyle: 'solid',
      strokeWidth: 2,
      roundness: { type: 3 },
      link: `/threads/${thread.id}`,
      customData: { threadId: thread.id, kind: 'thread-card' },
      label: { text: label, fontSize: 16 },
    } as any,
  ]);
}

export default function GlobalWhiteboard() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const apiRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState<Scene>({ elements: [], appState: { viewBackgroundColor: '#fafaf9' } });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const broadcastThrottleRef = useRef<number>(0);
  const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<any>(null);
  const clientIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const lastSentHashRef = useRef<string>('');
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

  // Load scene, then reconcile with existing threads
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [boardRes, threadsRes] = await Promise.all([
        supabase.from('global_whiteboard').select('scene').eq('id', BOARD_ID).maybeSingle(),
        supabase.from('threads').select('id, title, category').order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;

      const scene: Scene = (boardRes.data?.scene as Scene) || { elements: [], appState: {} };
      const elements = Array.isArray(scene.elements) ? [...scene.elements] : [];
      const threads = threadsRes.data || [];

      const presentIds = new Set(
        elements.map((el: any) => el?.customData?.threadId).filter(Boolean)
      );

      let idx = elements.length;
      const additions: any[] = [];
      for (const t of threads) {
        if (!presentIds.has(t.id)) {
          additions.push(...buildThreadCard(t as any, idx));
          idx++;
        }
      }

      const merged = [...elements, ...additions];
      const initMap = new Map<string, { version: number; isDeleted: boolean }>();
      for (const el of merged) {
        if (el?.id) initMap.set(el.id, { version: el.version || 0, isDeleted: !!el.isDeleted });
      }
      prevElementsRef.current = initMap;

      setInitial({
        elements: merged,
        appState: { ...(scene.appState || {}), viewBackgroundColor: scene.appState?.viewBackgroundColor || '#fafaf9' },
        files: scene.files || {},
      });
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime: remote scene, presence, new threads, permission changes
  useEffect(() => {
    if (!ready) return;
    const presenceKey = user?.id || `guest-${clientIdRef.current}`;
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
          if (row.updated_by && row.updated_by === user?.id) return;
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
        (payload: any) => {
          const t = payload.new;
          if (!t || !apiRef.current) return;
          const current = apiRef.current.getSceneElements() as any[];
          if (current.some((el) => el?.customData?.threadId === t.id)) return;
          const card = buildThreadCard(t, current.length);
          applyingRemoteRef.current = true;
          apiRef.current.updateScene({ elements: [...current, ...card] });
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
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({
            user_id: user.id,
            display_name: myDisplayName,
            email: user.email,
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
  }, [ready, user?.id, myDisplayName]);

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

  const persist = useCallback(async (elements: readonly any[], appState: any, files: Record<string, any>) => {
    if (!user) return;
    const referenced = new Set(
      (elements as any[])
        .filter((el) => el?.type === 'image' && el?.fileId && !el?.isDeleted)
        .map((el) => el.fileId as string)
    );
    const trimmedFiles: Record<string, any> = {};
    for (const [k, v] of Object.entries(files || {})) {
      if (referenced.has(k)) trimmedFiles[k] = v;
    }
    const scene: Scene = {
      elements: elements as any[],
      appState: { viewBackgroundColor: appState?.viewBackgroundColor || '#fafaf9' },
      files: trimmedFiles,
    };
    const filesHash = Object.keys(trimmedFiles).sort().join(',');
    const hash = String(elements.length) + ':' + (elements[elements.length - 1]?.version || 0) + ':' + filesHash;
    if (hash === lastSentHashRef.current) return;
    lastSentHashRef.current = hash;
    await supabase.from('global_whiteboard').upsert(
      {
        id: BOARD_ID,
        scene: scene as any,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  }, [user]);

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
    debounceRef.current = setTimeout(() => persist(elements, appState, files || {}), 600);
  }, [persist, broadcastScene, diffAndAttribute]);

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
    <div className="fixed inset-0 flex flex-col bg-background">
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
