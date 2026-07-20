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
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready, threadId, user?.id]);

  const persist = useCallback(async (elements: readonly any[], appState: any) => {
    if (!user) return;
    const scene: Scene = {
      elements: elements as any[],
      appState: { viewBackgroundColor: appState?.viewBackgroundColor || '#ffffff' },
    };
    const hash = String(elements.length) + ':' + (elements[elements.length - 1]?.version || 0);
    if (hash === lastSentHashRef.current) return;
    lastSentHashRef.current = hash;
    await supabase.from('thread_whiteboards').upsert({
      thread_id: threadId,
      scene: scene as any,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'thread_id' });
  }, [threadId, user]);

  const onChange = useCallback((elements: readonly any[], appState: any) => {
    if (applyingRemoteRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(elements, appState), 400);
  }, [persist]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

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
