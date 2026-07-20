import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/ui/button';

type Scene = { elements: any[]; appState?: any; files?: Record<string, any> };

const BOARD_ID = 'threads';
const CARD_W = 240;
const CARD_H = 96;

function scatterPos(i: number) {
  // scatter cards in a loose grid
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
  const apiRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState<Scene>({ elements: [], appState: { viewBackgroundColor: '#fafaf9' } });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSentHashRef = useRef<string>('');
  const applyingRemoteRef = useRef(false);
  const [peerCount, setPeerCount] = useState(1);

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
        elements
          .map((el: any) => el?.customData?.threadId)
          .filter(Boolean)
      );

      let idx = elements.length;
      const additions: any[] = [];
      for (const t of threads) {
        if (!presentIds.has(t.id)) {
          additions.push(...buildThreadCard(t as any, idx));
          idx++;
        }
      }

      setInitial({
        elements: [...elements, ...additions],
        appState: { ...(scene.appState || {}), viewBackgroundColor: scene.appState?.viewBackgroundColor || '#fafaf9' },
        files: scene.files || {},
      });
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime: remote scene updates + presence + new threads
  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel(`global_whiteboard:${BOARD_ID}`, {
        config: { presence: { key: user?.id || crypto.randomUUID() } },
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
          if (files.length && apiRef.current.addFiles) {
            apiRef.current.addFiles(files);
          }
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
        const state = channel.presenceState();
        setPeerCount(Math.max(1, Object.keys(state).length));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready, user?.id]);

  const persist = useCallback(async (elements: readonly any[], appState: any) => {
    if (!user) return;
    const scene: Scene = {
      elements: elements as any[],
      appState: { viewBackgroundColor: appState?.viewBackgroundColor || '#fafaf9' },
    };
    const hash = String(elements.length) + ':' + (elements[elements.length - 1]?.version || 0);
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

  const onChange = useCallback((elements: readonly any[], appState: any) => {
    if (applyingRemoteRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(elements, appState), 500);
  }, [persist]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

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
        <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
          {peerCount} {peerCount === 1 ? 'person' : 'people'} here
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {ready ? (
          <Excalidraw
            initialData={initial}
            onChange={onChange}
            excalidrawAPI={(api: any) => { apiRef.current = api; }}
            viewModeEnabled={!user}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            Loading whiteboard…
          </div>
        )}
      </div>
      {!user && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/90 backdrop-blur border px-4 py-2 text-xs shadow">
          Sign in to draw and move cards. View-only mode.
        </div>
      )}
    </div>
  );
}
