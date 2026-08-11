// TEMPORARY visual check page — not routed in production builds.
import { useEffect, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { buildThreadCluster, ensureCardFont } from '@/lib/threadWhiteboardCards';

export default function CardPreview() {
  const [api, setApi] = useState<any>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    (async () => {
      // Build only after Excalidraw has mounted so Excalifont is registered and
      // text measurement matches what the canvas will draw.
      await ensureCardFont();
      const built = await buildThreadCluster(
        { id: 't1', title: 'QOTD: Should we add GPU support?', category: 'Show & Tell', content: '<p>Short body.</p>' },
        [
          { id: 'c1', thread_id: 't1', parent_id: null, depth: 0, content: 'yes', author: 'demo1', created_at: '1' },
          {
            id: 'c2',
            thread_id: 't1',
            parent_id: 'c1',
            depth: 1,
            content:
              '<p>Trying to right now to see how long it takes for this prompt to finish. Translate the entire PostgreSQL codebase to idiomatic Rust, make no mistakes. I know that seems hard but there is nothing stopping you from doing the best work.</p>',
            author: 'ishumandi',
            created_at: '2',
          },
        ],
        40,
        40
      );
      if (cancelled) return;
      api.updateScene({ elements: built.elements });
      api.addFiles(Object.values(built.files));
      api.scrollToContent(built.elements, { fitToContent: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <div className="fixed inset-0">
      <Excalidraw excalidrawAPI={setApi} initialData={{ appState: { viewBackgroundColor: '#fafaf9' } }} />
    </div>
  );
}
