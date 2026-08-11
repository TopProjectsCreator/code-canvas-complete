import { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  threadId: string;
}

type Scene = { elements: any[]; appState?: any; files?: Record<string, any> };

export function ThreadWhiteboard({ threadId }: Props) {
  const { user } = useAuth();
  const apiRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState<Scene>({ elements: [], appState: { viewBackgroundColor: '#ffffff' } });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const broadcastThrottleRef = useRef<number>(0);
  const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<any>(null);
  const clientIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const lastSentHashRef = useRef<string>('');
  const applyingRemoteRef = useRef(false);
  const [peerCount, setPeerCount] = useState(1);

  // Load initial scene
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('thread_whiteboards')
        .select('scene')
        .eq('thread_id', threadId)
        .maybeSingle();
      if (cancelled) return;
      if (data?.scene) {
        const s = data.scene as Scene;
        setInitial({
          elements: Array.isArray(s.elements) ? s.elements : [],
          appState: { ...(s.appState || {}), viewBackgroundColor: s.appState?.viewBackgroundColor || '#ffffff' },
          files: s.files || {},
        });
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [threadId]);

  // Realtime subscription: remote scene updates + presence
  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel(`whiteboard:${threadId}`, { config: { presence: { key: user?.id || crypto.randomUUID() } } })
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'thread_whiteboards', filter: `thread_id=eq.${threadId}` },
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
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPeerCount(Math.max(1, Object.keys(state).length));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [ready, threadId, user?.id]);

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
      appState: { viewBackgroundColor: appState?.viewBackgroundColor || '#ffffff' },
      files: trimmedFiles,
    };
    const filesHash = Object.keys(trimmedFiles).sort().join(',');
    // Signature must change whenever ANY element changes (moves, styling, deletes),
    // not just when the element count or the last element's version changes.
    let versionSum = 0;
    let deletedCount = 0;
    for (const el of elements as any[]) {
      versionSum += (el?.version || 0) + (el?.versionNonce || 0) % 1000;
      if (el?.isDeleted) deletedCount++;
    }
    const hash = `${elements.length}:${deletedCount}:${versionSum}:${filesHash}`;
    if (hash === lastSentHashRef.current) return;
    lastSentHashRef.current = hash;
    await supabase.from('thread_whiteboards').upsert({
      thread_id: threadId,
      scene: scene as any,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'thread_id' });
  }, [threadId, user]);

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

  const onChange = useCallback((elements: readonly any[], appState: any, files: Record<string, any>) => {
    if (applyingRemoteRef.current) return;
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
    debounceRef.current = setTimeout(() => persist(elements, appState, files || {}), 500);
  }, [persist, broadcastScene]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
  }, []);

  if (!ready) {
    return <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Loading whiteboard…</div>;
  }

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur border border-border px-3 py-1 text-xs font-medium shadow">
        {peerCount} {peerCount === 1 ? 'person' : 'people'} here
      </div>
      <Excalidraw
        initialData={initial}
        onChange={onChange}
        excalidrawAPI={(api: any) => { apiRef.current = api; }}
        viewModeEnabled={!user}
      />
    </div>
  );
}
