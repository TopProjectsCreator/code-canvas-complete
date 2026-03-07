import { useMemo, useRef, useState, useEffect } from 'react';
import {
  StopCircle,
  Maximize2,
  Plus,
  Flag,
  Volume2,
  Brush,
  Code2,
  Search,
  ZoomIn,
  ZoomOut,
  CircleMinus,
  RotateCw,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react';
import VirtualMachine from 'scratch-vm';
import { ScratchArchive, exportSb3, importSb3 } from '@/services/scratchSb3';

type ScratchInputPrimitive = string | number | boolean;

interface ScratchBlockNode {
  id: string;
  opcode: string;
  next?: string | null;
  parent?: string | null;
  inputs?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  topLevel?: boolean;
  x?: number;
  y?: number;
}

interface ScratchTarget {
  isStage: boolean;
  name: string;
  variables?: Record<string, [string, ScratchInputPrimitive]>;
  lists?: Record<string, [string, ScratchInputPrimitive[]]>;
  blocks?: Record<string, ScratchBlockNode>;
  costumes?: Array<{ name: string; assetId: string; md5ext: string; dataFormat: string }>;
  sounds?: Array<{ name: string; assetId: string; md5ext: string; dataFormat: string }>;
  visible?: boolean;
  x?: number;
  y?: number;
  size?: number;
  direction?: number;
  [key: string]: unknown;
}

interface ScratchProject {
  targets: ScratchTarget[];
  monitors?: unknown[];
  extensions?: string[];
  meta?: Record<string, unknown>;
}

interface ScratchPanelProps {
  archive: ScratchArchive | null;
  onArchiveChange: (archive: ScratchArchive | null) => void;
  onProjectJsonUpdate: (json: string) => void;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
}


const DEFAULT_PROJECT: ScratchProject = {
  targets: [
    {
      isStage: true,
      name: 'Stage',
      variables: {},
      lists: {},
      blocks: {},
      costumes: [],
      sounds: [],
    },
    {
      isStage: false,
      name: 'Sprite1',
      variables: {},
      lists: {},
      blocks: {},
      costumes: [],
      sounds: [],
      visible: true,
      x: 0,
      y: 0,
      size: 100,
      direction: 90,
    },
  ],
  monitors: [],
  extensions: [],
  meta: {
    semver: '3.0.0',
    vm: '0.2.0',
    agent: 'code-canvas',
  },
};

const motionBlocks = [
  'move 10 steps',
  'turn ⟳ 15 degrees',
  'turn ⟲ 15 degrees',
  'go to random position',
  'go to x: 0  y: 0',
  'glide 1 secs to random position',
  'glide 1 secs to x: 0  y: 0',
  'point in direction 90',
  'point towards mouse-pointer',
  'change x by 10',
  'set x to 0',
  'change y by 10',
  'set y to 0',
  'if on edge, bounce',
];

const categoryRail = [
  { name: 'Motion', color: '#4c97ff' },
  { name: 'Looks', color: '#9966ff' },
  { name: 'Sound', color: '#cf63cf' },
  { name: 'Events', color: '#ffbf00' },
  { name: 'Control', color: '#ffab19' },
  { name: 'Sensing', color: '#5cb1d6' },
  { name: 'Operators', color: '#59c059' },
  { name: 'Variables', color: '#ff8c1a' },
  { name: 'My Blocks', color: '#ff6680' },
];

const generateId = () => Math.random().toString(36).slice(2, 10);
const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const safeParseProject = (archive: ScratchArchive | null): ScratchProject => {
  if (!archive?.projectJson) return DEFAULT_PROJECT;
  try {
    const parsed = JSON.parse(archive.projectJson) as ScratchProject;
    if (!Array.isArray(parsed.targets)) return DEFAULT_PROJECT;
    return parsed;
  } catch {
    return DEFAULT_PROJECT;
  }
};

const ensureArchive = (archive: ScratchArchive | null): ScratchArchive => {
  if (archive) return archive;
  return {
    projectJson: formatJson(DEFAULT_PROJECT),
    files: {},
    fileNames: ['project.json'],
  };
};

const makeNumberInput = (value: string) => [1, [4, value]];

export const ScratchPanel = ({ archive, onArchiveChange, onProjectJsonUpdate, isRunning, onRun, onStop }: ScratchPanelProps) => {
  const [activeEditorTab, setActiveEditorTab] = useState<'code' | 'costumes' | 'sounds'>('code');
  const [activeCategory] = useState('Motion');
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(1);
  const [projectJsonDraft, setProjectJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [stagePreview, setStagePreview] = useState({ x: 180, y: 110, direction: 90, visible: true });
  const [spriteVisible, setSpriteVisible] = useState(true);
  const [workspaceZoom, setWorkspaceZoom] = useState(1);
  const [vmReady, setVmReady] = useState(false);
  const [vmError, setVmError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const vmRef = useRef<any>(null);

  const project = useMemo(() => safeParseProject(archive), [archive]);
  const selectedTarget = project.targets[Math.max(0, Math.min(project.targets.length - 1, selectedTargetIndex))];
  const selectedBlocks = Object.values(selectedTarget?.blocks || {});
  const spriteTargets = project.targets.filter((target) => !target.isStage);

  const syncFromVm = () => {
    const vm = vmRef.current;
    if (!vm || !vm.runtime) return;
    const preferredName = selectedTarget?.name;
    const runtimeTarget = vm.runtime.targets?.find((t: any) => !t.isStage && t.sprite?.name === preferredName)
      || vm.runtime.targets?.find((t: any) => !t.isStage);
    if (!runtimeTarget) return;

    const x = Number(runtimeTarget.x || 0);
    const y = Number(runtimeTarget.y || 0);
    const direction = Number(runtimeTarget.direction || 90);
    const visible = Boolean(runtimeTarget.visible);

    setStagePreview({
      x: Math.max(10, Math.min(360, 180 + x * 0.7)),
      y: Math.max(10, Math.min(240, 110 - y * 0.6)),
      direction,
      visible,
    });
    setSpriteVisible(visible);
  };

  const loadVmFromArchive = async (nextArchive: ScratchArchive) => {
    if (!vmRef.current) return;
    try {
      const data = await exportSb3(nextArchive);
      await vmRef.current.loadProject(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      setVmError(null);
      syncFromVm();
    } catch (error) {
      setVmError(error instanceof Error ? error.message : 'Failed to load project in VM.');
    }
  };

  useEffect(() => {
    try {
      const vm = new (VirtualMachine as any)();
      vm.start();
      vmRef.current = vm;
      setVmReady(true);
      setVmError(null);
    } catch (error) {
      setVmError(error instanceof Error ? error.message : 'Failed to initialize scratch-vm.');
    }

    return () => {
      try {
        vmRef.current?.stopAll();
      } catch {
        // noop
      }
    };
  }, []);

  useEffect(() => {
    if (!archive || !vmReady) return;
    loadVmFromArchive(archive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archive, vmReady]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      syncFromVm();
    }, 120);
    return () => window.clearInterval(timer);
  });

  const updateProject = (updater: (current: ScratchProject) => ScratchProject) => {
    const nextProject = updater(project);
    const nextJson = formatJson(nextProject);
    const currentArchive = ensureArchive(archive);

    const nextArchive: ScratchArchive = {
      ...currentArchive,
      fileNames: currentArchive.fileNames.includes('project.json')
        ? currentArchive.fileNames
        : [...currentArchive.fileNames, 'project.json'],
      projectJson: nextJson,
    };

    onArchiveChange(nextArchive);
    onProjectJsonUpdate(nextJson);
    setProjectJsonDraft(nextJson);
    setJsonError(null);
  };

  const addSprite = () => {
    const existing = new Set(project.targets.map((t) => t.name));
    let i = 1;
    let name = `Sprite${i}`;
    while (existing.has(name)) {
      i += 1;
      name = `Sprite${i}`;
    }

    updateProject((current) => ({
      ...current,
      targets: [
        ...current.targets,
        {
          isStage: false,
          name,
          variables: {},
          lists: {},
          blocks: {},
          costumes: [],
          sounds: [],
          visible: true,
          x: 0,
          y: 0,
          size: 100,
          direction: 90,
        },
      ],
    }));

    setSelectedTargetIndex(project.targets.length);
  };

  const addMotionBlock = (label: string) => {
    if (!selectedTarget || selectedTarget.isStage || activeEditorTab !== 'code') return;
    const hatId = generateId();
    const blockId = generateId();

    const opcodeMap: Record<string, { opcode: string; inputs?: Record<string, unknown>; fields?: Record<string, unknown> }> = {
      'move 10 steps': { opcode: 'motion_movesteps', inputs: { STEPS: makeNumberInput('10') } },
      'turn ⟳ 15 degrees': { opcode: 'motion_turnright', inputs: { DEGREES: makeNumberInput('15') } },
      'turn ⟲ 15 degrees': { opcode: 'motion_turnleft', inputs: { DEGREES: makeNumberInput('15') } },
      'go to random position': { opcode: 'motion_goto', fields: { TO: ['_random_', null] } },
      'go to x: 0  y: 0': { opcode: 'motion_gotoxy', inputs: { X: makeNumberInput('0'), Y: makeNumberInput('0') } },
      'glide 1 secs to random position': { opcode: 'motion_glideto', inputs: { SECS: makeNumberInput('1') }, fields: { TO: ['_random_', null] } },
      'glide 1 secs to x: 0  y: 0': { opcode: 'motion_glidesecstoxy', inputs: { SECS: makeNumberInput('1'), X: makeNumberInput('0'), Y: makeNumberInput('0') } },
      'point in direction 90': { opcode: 'motion_pointindirection', inputs: { DIRECTION: makeNumberInput('90') } },
      'point towards mouse-pointer': { opcode: 'motion_pointtowards', fields: { TOWARDS: ['_mouse_', null] } },
      'change x by 10': { opcode: 'motion_changexby', inputs: { DX: makeNumberInput('10') } },
      'set x to 0': { opcode: 'motion_setx', inputs: { X: makeNumberInput('0') } },
      'change y by 10': { opcode: 'motion_changeyby', inputs: { DY: makeNumberInput('10') } },
      'set y to 0': { opcode: 'motion_sety', inputs: { Y: makeNumberInput('0') } },
      'if on edge, bounce': { opcode: 'motion_ifonedgebounce' },
    };

    const blockDef = opcodeMap[label] || opcodeMap['move 10 steps'];

    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const blockCount = Object.keys(target.blocks || {}).length;
        return {
          ...target,
          blocks: {
            ...(target.blocks || {}),
            [hatId]: {
              id: hatId,
              opcode: 'event_whenflagclicked',
              next: blockId,
              parent: null,
              topLevel: true,
              x: 40,
              y: 30 + blockCount * 70,
              inputs: {},
              fields: {},
            },
            [blockId]: {
              id: blockId,
              opcode: blockDef.opcode,
              next: null,
              parent: hatId,
              topLevel: false,
              inputs: blockDef.inputs || {},
              fields: blockDef.fields || {},
            },
          },
        };
      }),
    }));
  };

  const runPreview = async () => {
    try {
      if (!vmRef.current) return;
      onRun();
      vmRef.current.greenFlag();
      setTimeout(() => {
        syncFromVm();
      }, 120);
    } catch (error) {
      setVmError(error instanceof Error ? error.message : 'VM runtime error.');
      onStop();
    }
  };

  const handleVmStop = () => {
    try {
      vmRef.current?.stopAll();
      syncFromVm();
    } catch {
      // noop
    }
    onStop();
  };

  const handleImport = async (file: File) => {
    const data = await file.arrayBuffer();
    const parsed = await importSb3(data);
    onArchiveChange(parsed.archive);
    onProjectJsonUpdate(parsed.archive.projectJson);
    setProjectJsonDraft(parsed.archive.projectJson);
    setJsonError(null);
    setSelectedTargetIndex(1);
    await loadVmFromArchive(parsed.archive);
  };

  const handleExport = async () => {
    const data = await exportSb3(ensureArchive(archive));
    const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: 'application/x.scratch.sb3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.sb3';
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyJsonDraft = async () => {
    try {
      const parsed = JSON.parse(projectJsonDraft || '{}') as ScratchProject;
      if (!Array.isArray(parsed.targets)) {
        setJsonError('Invalid Scratch JSON: targets must be an array.');
        return;
      }
      const json = formatJson(parsed);
      const nextArchive = { ...ensureArchive(archive), projectJson: json };
      onArchiveChange(nextArchive);
      onProjectJsonUpdate(json);
      setProjectJsonDraft(json);
      setJsonError(null);
      await loadVmFromArchive(nextArchive);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  return (
    <div className="h-full bg-[#f1f4fa] flex flex-col text-[#4d4d4d]">
      <div className="h-9 border-b border-[#c8d0dd] bg-[#d9e3f2] px-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveEditorTab('code')}
            className={`px-4 h-7 rounded-t-xl text-sm flex items-center gap-1 ${activeEditorTab === 'code' ? 'bg-white text-[#6b5ce7] font-semibold' : 'bg-[#c9d3e4]'}`}
          >
            <Code2 className="w-4 h-4" /> Code
          </button>
          <button
            onClick={() => setActiveEditorTab('costumes')}
            className={`px-4 h-7 rounded-t-xl text-sm flex items-center gap-1 ${activeEditorTab === 'costumes' ? 'bg-white text-[#5a6b8a] font-semibold' : 'bg-[#c9d3e4]'}`}
          >
            <Brush className="w-4 h-4" /> Costumes
          </button>
          <button
            onClick={() => setActiveEditorTab('sounds')}
            className={`px-4 h-7 rounded-t-xl text-sm flex items-center gap-1 ${activeEditorTab === 'sounds' ? 'bg-white text-[#5a6b8a] font-semibold' : 'bg-[#c9d3e4]'}`}
          >
            <Volume2 className="w-4 h-4" /> Sounds
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${vmReady ? 'border-green-400 text-green-700 bg-green-50' : 'border-amber-400 text-amber-700 bg-amber-50'}`}>
            {vmReady ? 'VM Ready' : 'VM Starting'}
          </span>
          <button onClick={runPreview} className="text-green-600" title="Green Flag" disabled={isRunning || !vmReady}>
            <Flag className="w-5 h-5 fill-green-500" />
          </button>
          <button onClick={handleVmStop} className="text-red-500" title="Stop">
            <StopCircle className="w-5 h-5 fill-red-300" />
          </button>
          <button onClick={handleExport} className="px-2 py-1 text-xs rounded bg-white border border-[#c8d0dd]">Export .sb3</button>
          <button onClick={() => importInputRef.current?.click()} className="px-2 py-1 text-xs rounded bg-white border border-[#c8d0dd]">Import .sb3</button>
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

      <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr_520px]">
        <div className="border-r border-[#c8d0dd] bg-[#f3f5fb] flex min-h-0">
          <div className="w-[74px] border-r border-[#d6ddea] p-2 space-y-2 overflow-y-auto">
            {categoryRail.map((cat) => (
              <button key={cat.name} className="w-full flex flex-col items-center text-[12px] text-[#5e6a83] gap-0.5">
                <span className="w-7 h-7 rounded-full border border-[#aeb8cc]" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex-1 p-2 overflow-y-auto">
            <div className="text-[28px] leading-none text-[#4d97ff] mb-1">{activeCategory}</div>
            {activeEditorTab === 'code' ? (
              <div className="space-y-2 pr-2">
                {motionBlocks.map((label) => (
                  <button
                    key={label}
                    onClick={() => addMotionBlock(label)}
                    className="w-full text-left rounded-md bg-[#4c97ff] text-white text-[19px] px-4 py-2 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)] hover:bg-[#4289ec]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-full rounded-lg border border-dashed border-[#b9c4da] bg-white p-4 text-sm text-[#7a869f]">
                {activeEditorTab === 'costumes' ? 'Costume editor area (Scratch-compatible project data preserved).' : 'Sound editor area (Scratch-compatible project data preserved).'}
              </div>
            )}
          </div>
        </div>

        <div className="relative bg-[#f9fafc] overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              transform: `scale(${workspaceZoom})`,
              transformOrigin: 'top left',
              backgroundImage: 'radial-gradient(#d8deea 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          >
            {selectedBlocks.map((block) => (
              <div
                key={block.id}
                className="absolute rounded-md bg-[#4c97ff] text-white px-3 py-2 text-[15px] min-w-[220px] shadow"
                style={{ left: block.x ?? 40, top: block.y ?? 40 }}
              >
                {block.opcode.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
          <div className="absolute right-3 bottom-3 flex flex-col gap-2">
            <button className="w-9 h-9 rounded-full bg-white border border-[#c8d0dd] flex items-center justify-center" onClick={() => setWorkspaceZoom((z) => Math.min(1.4, z + 0.1))}><ZoomIn className="w-4 h-4" /></button>
            <button className="w-9 h-9 rounded-full bg-white border border-[#c8d0dd] flex items-center justify-center" onClick={() => setWorkspaceZoom((z) => Math.max(0.7, z - 0.1))}><ZoomOut className="w-4 h-4" /></button>
            <button className="w-9 h-9 rounded-full bg-white border border-[#c8d0dd] flex items-center justify-center" onClick={() => setWorkspaceZoom(1)}><CircleMinus className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="border-l border-[#c8d0dd] bg-[#e5edf9] grid grid-rows-[430px_1fr] min-h-0">
          <div className="p-2">
            <div className="rounded-xl bg-white border border-[#c8d0dd] h-full relative overflow-hidden">
              <div className="absolute left-0 top-0 right-0 h-full bg-[#f0f0f0]" />
              {stagePreview.visible && spriteVisible && (
                <div
                  className="absolute text-[100px] leading-none"
                  style={{ left: stagePreview.x, top: stagePreview.y, transform: `rotate(${stagePreview.direction - 90}deg)` }}
                >
                  🐱
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#c8d0dd] min-h-0 grid grid-rows-[120px_1fr]">
            <div className="p-2 bg-white border-b border-[#d7deeb]">
              <div className="grid grid-cols-[68px_1fr] items-center gap-2 text-sm text-[#4f5f80]">
                <div className="font-semibold">Sprite</div>
                <input
                  value={selectedTarget?.name || 'Sprite1'}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    updateProject((current) => ({
                      ...current,
                      targets: current.targets.map((target, idx) => idx === selectedTargetIndex ? { ...target, name: nextName } : target),
                    }));
                  }}
                  className="h-8 rounded-full border border-[#c8d0dd] px-3"
                />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                <div className="rounded-full border border-[#c8d0dd] h-8 flex items-center justify-center gap-1">x <input className="w-8 bg-transparent text-center" value={Math.round((stagePreview.x - 180) / 0.7)} readOnly /></div>
                <div className="rounded-full border border-[#c8d0dd] h-8 flex items-center justify-center gap-1">y <input className="w-8 bg-transparent text-center" value={Math.round((110 - stagePreview.y) / 0.6)} readOnly /></div>
                <div className="rounded-full border border-[#c8d0dd] h-8 flex items-center justify-center gap-1">size <input className="w-10 bg-transparent text-center" value={Math.round(selectedTarget?.size as number || 100)} readOnly /></div>
                <div className="rounded-full border border-[#c8d0dd] h-8 flex items-center justify-center gap-1">dir <input className="w-8 bg-transparent text-center" value={Math.round(stagePreview.direction || 90)} readOnly /></div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span>Show</span>
                <button className="w-8 h-8 rounded border border-[#c8d0dd] flex items-center justify-center" onClick={() => setSpriteVisible(true)}><Eye className="w-4 h-4 text-[#6b5ce7]" /></button>
                <button className="w-8 h-8 rounded border border-[#c8d0dd] flex items-center justify-center" onClick={() => setSpriteVisible(false)}><EyeOff className="w-4 h-4 text-[#6b5ce7]" /></button>
                <button className="w-8 h-8 rounded border border-[#c8d0dd] flex items-center justify-center" onClick={() => setStagePreview((p) => ({ ...p, direction: p.direction - 15 }))}><RotateCcw className="w-4 h-4" /></button>
                <button className="w-8 h-8 rounded border border-[#c8d0dd] flex items-center justify-center" onClick={() => setStagePreview((p) => ({ ...p, direction: p.direction + 15 }))}><RotateCw className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-2 overflow-y-auto bg-[#dfe7f7] flex gap-2">
              {spriteTargets.map((target, index) => {
                const mappedIndex = project.targets.findIndex((t) => t.name === target.name && !t.isStage);
                const selected = mappedIndex === selectedTargetIndex;
                return (
                  <button
                    key={target.name + index}
                    onClick={() => setSelectedTargetIndex(mappedIndex)}
                    className={`w-[95px] h-[92px] rounded-xl border-2 flex flex-col items-center justify-center ${selected ? 'border-[#7b61ff] bg-[#ede7ff]' : 'border-[#b9c5dc] bg-white'}`}
                  >
                    <div className="text-3xl">🐱</div>
                    <div className="text-xs mt-1">{target.name}</div>
                  </button>
                );
              })}
              <button onClick={addSprite} className="w-[95px] h-[92px] rounded-xl border border-dashed border-[#9db0d3] bg-white/70 flex items-center justify-center">
                <Plus className="w-5 h-5 text-[#6b7ea8]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[180px] border-t border-[#c8d0dd] bg-white p-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-[#6a7b9a]">Raw project.json (compatibility view)</div>
          <div className="flex items-center gap-2">
            {vmError && <span className="text-[11px] text-red-500 max-w-[480px] truncate">VM error: {vmError}</span>}
            <button onClick={applyJsonDraft} className="text-xs px-2 py-1 rounded border border-[#c8d0dd]">Apply</button>
          </div>
        </div>
        <div className="relative h-[136px]">
          <textarea
            className="w-full h-full border border-[#d4ddec] rounded bg-[#f9fbff] p-2 text-[11px] font-mono"
            value={projectJsonDraft || archive?.projectJson || formatJson(project)}
            onChange={(e) => setProjectJsonDraft(e.target.value)}
            spellCheck={false}
          />
          <Search className="absolute right-2 top-2 w-3 h-3 text-[#8b95a8]" />
        </div>
        {jsonError && <div className="text-[11px] text-red-500 mt-1">{jsonError}</div>}
      </div>
    </div>
  );
};
