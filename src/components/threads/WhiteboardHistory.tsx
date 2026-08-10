import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

export interface WhiteboardScene {
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

interface SnapshotRow {
  id: string;
  element_count: number;
  created_at: string;
  created_by: string | null;
  scene: unknown;
}

interface Props {
  boardKind: 'global' | 'thread';
  boardId: string;
  /** Called with the restored scene so the live canvas can be updated. */
  onRestore: (scene: WhiteboardScene) => Promise<void> | void;
  disabled?: boolean;
}

export function WhiteboardHistory({ boardKind, boardId, onRestore, disabled }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('whiteboard_snapshots')
      .select('id, element_count, created_at, created_by, scene')
      .eq('board_kind', boardKind)
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) {
      toast({ title: 'Could not load history', description: error.message, variant: 'destructive' });
      return;
    }
    setSnapshots((data || []) as SnapshotRow[]);
  }, [boardKind, boardId, toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleRestore = async (snap: SnapshotRow) => {
    setRestoringId(snap.id);
    try {
      const scene = (snap.scene || { elements: [] }) as WhiteboardScene;
      await onRestore({
        elements: Array.isArray(scene.elements) ? scene.elements : [],
        appState: scene.appState || {},
        files: scene.files || {},
      });
      toast({
        title: 'Whiteboard restored',
        description: `${snap.element_count} elements brought back.`,
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: 'Restore failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <History className="h-4 w-4" />
          History
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b">
          <div className="text-sm font-semibold">Version history</div>
          <div className="text-xs text-muted-foreground">
            Every save archives the previous board. Restore any point in time.
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {loading && (
            <div className="px-4 py-6 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading versions…
            </div>
          )}
          {!loading && snapshots.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No earlier versions yet.
            </div>
          )}
          {!loading &&
            snapshots.map((s) => (
              <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{s.element_count} elements</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] gap-1 shrink-0"
                  disabled={restoringId !== null || disabled}
                  onClick={() => handleRestore(s)}
                >
                  {restoringId === s.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Restore
                </Button>
              </div>
            ))}
        </div>
        {disabled && (
          <div className="px-4 py-2 border-t text-[11px] text-muted-foreground">
            Sign in to restore a previous version.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
