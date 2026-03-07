import { useMemo, useRef, useState } from 'react';
import { Play, Square, Upload, Download } from 'lucide-react';
import { ScratchArchive, exportSb3, importSb3 } from '@/services/scratchSb3';

interface ScratchBlock {
  id: string;
  opcode: 'move' | 'turn' | 'say' | 'wait';
  value: string;
}

interface ScratchPanelProps {
  archive: ScratchArchive | null;
  onArchiveChange: (archive: ScratchArchive | null) => void;
  onProjectJsonUpdate: (json: string) => void;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
}

const generateId = () => Math.random().toString(36).slice(2, 9);

export const ScratchPanel = ({
  archive,
  onArchiveChange,
  onProjectJsonUpdate,
  isRunning,
  onRun,
  onStop,
}: ScratchPanelProps) => {
  const [blocks, setBlocks] = useState<ScratchBlock[]>([]);
  const [sprite, setSprite] = useState({ x: 140, y: 100, rotation: 0, speech: '' });
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const targetsCount = useMemo(() => {
    if (!archive) return 0;
    try {
      const parsed = JSON.parse(archive.projectJson) as { targets?: unknown[] };
      return parsed.targets?.length ?? 0;
    } catch {
      return 0;
    }
  }, [archive]);

  const addBlock = (opcode: ScratchBlock['opcode']) => {
    const defaults: Record<ScratchBlock['opcode'], string> = {
      move: '10',
      turn: '15',
      say: 'Hello!',
      wait: '1',
    };
    setBlocks((prev) => [...prev, { id: generateId(), opcode, value: defaults[opcode] }]);
  };

  const runBlocks = async () => {
    onRun();
    for (let i = 0; i < blocks.length; i += 1) {
      setRunningIndex(i);
      const block = blocks[i];
      if (block.opcode === 'move') {
        const amount = Number(block.value) || 0;
        setSprite((prev) => ({ ...prev, x: Math.max(0, Math.min(280, prev.x + amount)) }));
      }
      if (block.opcode === 'turn') {
        const amount = Number(block.value) || 0;
        setSprite((prev) => ({ ...prev, rotation: prev.rotation + amount }));
      }
      if (block.opcode === 'say') {
        setSprite((prev) => ({ ...prev, speech: block.value }));
      }
      if (block.opcode === 'wait') {
        const seconds = Math.max(0, Number(block.value) || 0);
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      }
    }
    setRunningIndex(null);
    onStop();
  };

  const handleImport = async (file: File) => {
    const data = await file.arrayBuffer();
    const parsed = await importSb3(data);
    onArchiveChange(parsed.archive);
    onProjectJsonUpdate(parsed.archive.projectJson);
  };

  const handleExport = async () => {
    if (!archive) return;
    const data = await exportSb3(archive);
    const blob = new Blob([data], { type: 'application/x.scratch.sb3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.sb3';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full bg-background text-foreground flex flex-col">
      <div className="h-10 border-b border-border px-3 flex items-center justify-between">
        <div className="text-sm font-medium">Scratch Blocks Workspace</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 text-xs border border-border rounded flex items-center gap-1" onClick={() => importInputRef.current?.click()}>
            <Upload className="w-3 h-3" /> Import .sb3
          </button>
          <button className="px-2 py-1 text-xs border border-border rounded flex items-center gap-1" onClick={handleExport} disabled={!archive}>
            <Download className="w-3 h-3" /> Export .sb3
          </button>
          <button className="px-2 py-1 text-xs border border-border rounded flex items-center gap-1" onClick={runBlocks} disabled={isRunning}>
            <Play className="w-3 h-3" /> Green Flag
          </button>
          <button className="px-2 py-1 text-xs border border-border rounded flex items-center gap-1" onClick={onStop}>
            <Square className="w-3 h-3" /> Stop
          </button>
          <input
            ref={importInputRef}
            className="hidden"
            type="file"
            accept=".sb3"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr_320px] flex-1 min-h-0">
        <div className="border-r border-border p-3 space-y-2">
          <div className="text-xs uppercase text-muted-foreground">Blocks</div>
          <button className="w-full text-left text-sm px-2 py-1 rounded bg-accent" onClick={() => addBlock('move')}>move [10] steps</button>
          <button className="w-full text-left text-sm px-2 py-1 rounded bg-accent" onClick={() => addBlock('turn')}>turn [15] degrees</button>
          <button className="w-full text-left text-sm px-2 py-1 rounded bg-accent" onClick={() => addBlock('say')}>say [Hello!]</button>
          <button className="w-full text-left text-sm px-2 py-1 rounded bg-accent" onClick={() => addBlock('wait')}>wait [1] secs</button>
          <div className="text-xs text-muted-foreground pt-3">Imported Scratch targets: {targetsCount}</div>
        </div>

        <div className="p-3 min-h-0 overflow-auto">
          <div className="text-xs uppercase text-muted-foreground mb-2">Scripts</div>
          <div className="space-y-2">
            {blocks.length === 0 && <div className="text-sm text-muted-foreground">Add blocks from the left palette.</div>}
            {blocks.map((block, index) => (
              <div key={block.id} className={`flex items-center gap-2 rounded px-2 py-2 border ${runningIndex === index ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <span className="text-xs uppercase text-muted-foreground w-14">{block.opcode}</span>
                <input
                  value={block.value}
                  onChange={(e) => setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, value: e.target.value } : b)))}
                  className="text-sm bg-background border border-border rounded px-2 py-1 flex-1"
                />
                <button
                  className="text-xs text-red-400"
                  onClick={() => setBlocks((prev) => prev.filter((b) => b.id !== block.id))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-l border-border p-3 space-y-3">
          <div className="text-xs uppercase text-muted-foreground">Stage</div>
          <div className="relative w-[280px] h-[210px] border border-border rounded bg-slate-900 overflow-hidden">
            <div
              className="absolute w-8 h-8 rounded-full bg-orange-400 border border-orange-200"
              style={{ left: `${sprite.x}px`, top: `${sprite.y}px`, transform: `rotate(${sprite.rotation}deg)` }}
            />
            {sprite.speech && (
              <div className="absolute left-2 top-2 bg-white text-black text-xs px-2 py-1 rounded">{sprite.speech}</div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Project JSON</div>
          <textarea
            className="w-full h-48 bg-background border border-border rounded p-2 text-xs font-mono"
            value={archive?.projectJson || ''}
            onChange={(e) => {
              if (!archive) return;
              onArchiveChange({ ...archive, projectJson: e.target.value });
              onProjectJsonUpdate(e.target.value);
            }}
            placeholder="Import an .sb3 to edit project.json"
          />
        </div>
      </div>
    </div>
  );
};
