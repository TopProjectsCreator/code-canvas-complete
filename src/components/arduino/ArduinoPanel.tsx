import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArduinoUploadService } from '@/services/arduinoUploadService';
import { BreadboardVisualizer } from './BreadboardVisualizer';
import { LibraryManager } from './LibraryManager';
import { ArduinoUploadDialog, UploadConfig } from './ArduinoUploadDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileNode, BreadboardCircuit } from '@/types/ide';
import { Upload, Zap, Package, Sparkles } from 'lucide-react';
import { arduinoLibraries, arduinoBoards } from '@/data/arduinoTemplates';
import { toast } from 'sonner';

interface ArduinoPanelProps {
  files: FileNode[];
  onFileUpdate: (fileId: string, content: string) => void;
  /**
   * Called when the panel needs a new file added to the workspace (e.g. circuit.json).
   */
  onAddFile?: (name: string, content: string, language?: string) => void;
  currentTemplate: string;
}

type AppBrickType = 'chat' | 'vision' | 'sensor-stream' | 'automation' | 'actuator';

interface AppBrick {
  id: string;
  type: AppBrickType;
  title: string;
  description: string;
  config: Record<string, string | number | boolean>;
}

const APP_BRICK_PALETTE: AppBrick[] = [
  {
    id: 'chat',
    type: 'chat',
    title: 'Chat Brick',
    description: 'Natural language intent parsing and command routing.',
    config: { wakeWord: 'uno', temperature: 0.3 },
  },
  {
    id: 'vision',
    type: 'vision',
    title: 'Vision Brick',
    description: 'Image/frame inference for object or gesture triggers.',
    config: { model: 'nano-detector', minConfidence: 0.7 },
  },
  {
    id: 'sensor-stream',
    type: 'sensor-stream',
    title: 'Sensor Stream Brick',
    description: 'Continuous sensor ingest with smoothing + thresholds.',
    config: { pin: 'A0', intervalMs: 250, threshold: 600 },
  },
  {
    id: 'automation',
    type: 'automation',
    title: 'Automation Brick',
    description: 'Rule engine for if/else loops and scheduled checks.',
    config: { expression: 'value > threshold', cooldownMs: 1000 },
  },
  {
    id: 'actuator',
    type: 'actuator',
    title: 'Actuator Brick',
    description: 'Pin-level action output (LED, relay, servo, motor).',
    config: { action: 'blink', pin: 'LED_BUILTIN', durationMs: 80 },
  },
];

/** Recursively find a file by name */
const findFileByName = (nodes: FileNode[], name: string): FileNode | undefined => {
  for (const n of nodes) {
    if (n.type === 'file' && n.name === name) return n;
    if (n.children) {
      const found = findFileByName(n.children, name);
      if (found) return found;
    }
  }
  return undefined;
};

export function ArduinoPanel({ files, onFileUpdate, onAddFile, currentTemplate }: ArduinoPanelProps) {
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [aiStudioOpen, setAiStudioOpen] = useState(false);
  const [openSubModal, setOpenSubModal] = useState<null | 'models' | 'deploy' | 'runtime'>(null);
  const [selectedModelProfile, setSelectedModelProfile] = useState<'tiny' | 'balanced' | 'max'>('balanced');
  const [deployTarget, setDeployTarget] = useState<'dev-board' | 'qa-board' | 'classroom-fleet'>('dev-board');
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [composerBricks, setComposerBricks] = useState<AppBrick[]>([]);
  const [draggedPaletteBrickId, setDraggedPaletteBrickId] = useState<string | null>(null);
  const [draggedComposerBrickId, setDraggedComposerBrickId] = useState<string | null>(null);
  const [circuit, setCircuit] = useState<BreadboardCircuit>({
    id: 'circuit-1',
    boardId: 'uno',
    components: [],
    connections: [],
    wires: [],
    code: '',
  });

  const sketchFile = findFileByName(files, 'sketch.ino');
  const circuitFile = findFileByName(files, 'circuit.json');
  const appLabManifestFile = findFileByName(files, 'app-lab.manifest.json');
  const runtimeBridgePythonFile = findFileByName(files, 'runtime_bridge.py');
  const runtimeBridgeCppFile = findFileByName(files, 'runtime_bridge.ino');

  // Load circuit from file
  useEffect(() => {
    if (circuitFile && circuitFile.content) {
      try {
        const parsed = JSON.parse(circuitFile.content);
        setCircuit(parsed);
      } catch (e) {
        console.error('Failed to parse circuit.json');
      }
    }
  }, [circuitFile?.id, circuitFile?.content]);

  useEffect(() => {
    const code = sketchFile?.content || '';
    if (circuit.code === code) return;
    setCircuit(prev => {
      if (prev.code === code) return prev;
      const updated = { ...prev, code };
      if (circuitFile?.id) {
        onFileUpdate(circuitFile.id, JSON.stringify(updated, null, 2));
      }
      return updated;
    });
  }, [sketchFile?.content, circuitFile?.id, onFileUpdate]);

  const getSketchWithLibraries = (): string => {
    const libraryIncludes = selectedLibraries
      .map((libId) => arduinoLibraries[libId]?.include || '')
      .filter(Boolean)
      .join('\n');

    return libraryIncludes
      ? `${libraryIncludes}\n\n${sketchFile?.content || ''}`
      : sketchFile?.content || '';
  };

  const upsertFile = (name: string, content: string, language?: string) => {
    const existing = findFileByName(files, name);
    if (existing?.id) {
      onFileUpdate(existing.id, content);
      return 'updated';
    }
    if (onAddFile) {
      onAddFile(name, content, language);
      return 'created';
    }
    return 'missing-add-handler';
  };

  const createAppLabManifest = () => {
    const board = arduinoBoards[circuit.boardId];
    const sketch = getSketchWithLibraries();
    const manifest = {
      name: 'uno-q-ai-app',
      boardId: circuit.boardId,
      boardName: board?.name ?? 'Unknown Board',
      modelProfile: selectedModelProfile,
      deployTarget,
      features: {
        localLLM: true,
        vision: visionEnabled,
        wifi: Boolean(board?.wifi),
        bluetooth: Boolean(board?.bluetooth),
        serialMonitor: Boolean(board?.serial),
      },
      runtime: {
        pythonBridge: true,
        cppBridge: true,
        sourceSketch: 'sketch.ino',
      },
      circuit: {
        components: circuit.components.length,
        wires: circuit.wires?.length || 0,
      },
      selectedLibraries,
      generatedAt: new Date().toISOString(),
      promptHints: sketch.split('\n').filter((line) => line.includes("include")).slice(0, 8),
    };

    const result = upsertFile('app-lab.manifest.json', JSON.stringify(manifest, null, 2), 'json');
    if (result === 'missing-add-handler') {
      toast.error('Could not create app-lab.manifest.json (onAddFile is unavailable).');
      return;
    }
    toast.success(`App Lab manifest ${result}.`);
  };

  const createRuntimeBridgeFiles = () => {
    const pythonBridge = `# Auto-generated by Arduino Uno Q AI Studio
from typing import Dict, Any

def run_agent(input_payload: Dict[str, Any]) -> Dict[str, Any]:
    # TODO: Connect local LLM runtime here.
    return {
        "intent": input_payload.get("intent", "unknown"),
        "action": "noop",
        "confidence": 0.0,
        "vision_enabled": ${visionEnabled ? 'True' : 'False'},
        "model_profile": "${selectedModelProfile}"
    }
`;

    const cppBridge = `// Auto-generated by Arduino Uno Q AI Studio
String handleAgentAction(String action) {
  if (action == "blink") {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(80);
    digitalWrite(LED_BUILTIN, LOW);
    return "ok:blink";
  }
  if (action == "sample_sensor") {
    int reading = analogRead(A0);
    return String("ok:sensor:") + String(reading);
  }
  return "noop";
}
`;

    const pyResult = upsertFile('runtime_bridge.py', pythonBridge, 'python');
    const cppResult = upsertFile('runtime_bridge.ino', cppBridge, 'cpp');
    if (pyResult === 'missing-add-handler' || cppResult === 'missing-add-handler') {
      toast.error('Could not scaffold runtime bridge files (onAddFile is unavailable).');
      return;
    }
    toast.success('Runtime bridge files generated for Python and C++.');
  };

  const addComposerBrick = (brickId: string) => {
    const paletteBrick = APP_BRICK_PALETTE.find((brick) => brick.id === brickId);
    if (!paletteBrick) return;
    setComposerBricks((prev) => [
      ...prev,
      {
        ...paletteBrick,
        id: `${paletteBrick.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    ]);
  };

  const moveComposerBrick = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setComposerBricks((prev) => {
      const sourceIndex = prev.findIndex((brick) => brick.id === sourceId);
      const targetIndex = prev.findIndex((brick) => brick.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const removeComposerBrick = (id: string) => {
    setComposerBricks((prev) => prev.filter((brick) => brick.id !== id));
  };

  const updateComposerBrickConfig = (id: string, key: string, value: string) => {
    setComposerBricks((prev) =>
      prev.map((brick) => {
        if (brick.id !== id) return brick;
        return {
          ...brick,
          config: {
            ...brick.config,
            [key]: value,
          },
        };
      }),
    );
  };

  const createComposerFlowFiles = () => {
    if (!composerBricks.length) {
      toast.error('Add at least one App Brick before generating a flow.');
      return;
    }

    const hasTrigger = composerBricks.some((brick) => ['chat', 'vision', 'sensor-stream'].includes(brick.type));
    const hasOutput = composerBricks.some((brick) => ['automation', 'actuator'].includes(brick.type));
    if (!hasTrigger || !hasOutput) {
      toast.error('A true app flow needs at least one trigger brick and one automation/actuator brick.');
      return;
    }

    const flow = {
      name: 'uno-q-app',
      version: '1.0.0',
      boardId: circuit.boardId,
      modelProfile: selectedModelProfile,
      visionEnabled,
      deployTarget,
      bricks: composerBricks.map((brick, index) => ({
        id: brick.id,
        type: brick.type,
        title: brick.title,
        order: index,
        config: brick.config,
      })),
      routes: composerBricks
        .slice(0, -1)
        .map((brick, index) => ({ from: brick.id, to: composerBricks[index + 1].id })),
      generatedAt: new Date().toISOString(),
    };

    const typeSet = new Set(composerBricks.map((brick) => brick.type));
    const pythonFlow = `# Auto-generated App Bricks runtime
from typing import Any, Dict

APP = ${JSON.stringify(flow, null, 2)}

def run_app(input_payload: Dict[str, Any]) -> Dict[str, Any]:
    state: Dict[str, Any] = {"steps": [], "input": input_payload, "routes": APP["routes"]}
    ${typeSet.has('chat') ? 'state["steps"].append("chat:intent-routing")' : ''}
    ${typeSet.has('vision') ? 'state["steps"].append("vision:frame-inference")' : ''}
    ${typeSet.has('sensor-stream') ? 'state["steps"].append("sensor:stream-aggregation")' : ''}
    ${typeSet.has('automation') ? 'state["steps"].append("automation:rule-eval")' : ''}
    ${typeSet.has('actuator') ? 'state["steps"].append("actuator:pin-output")' : ''}
    return state
`;

    const hasActuator = composerBricks.some((brick) => brick.type === 'actuator');
    const cppRuntime = `// Auto-generated App Bricks runtime
String runAppBrickAction(String action, int value) {
  ${hasActuator ? `
  if (action == "blink") {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(80);
    digitalWrite(LED_BUILTIN, LOW);
    return "ok:blink";
  }` : ''}
  if (action == "sample_sensor") {
    int reading = analogRead(A0);
    return String("ok:sensor:") + String(reading);
  }
  return "noop";
}
`;

    const results = [
      upsertFile('app-bricks.app.json', JSON.stringify(flow, null, 2), 'json'),
      upsertFile('app_bricks_runtime.py', pythonFlow, 'python'),
      upsertFile('app_bricks_runtime.ino', cppRuntime, 'cpp'),
    ];
    if (results.includes('missing-add-handler')) {
      toast.error('Could not generate App Bricks runtime files (onAddFile is unavailable).');
      return;
    }
    toast.success('App Bricks app bundle generated (JSON + Python + C++ runtime).');
  };

  return (
    <div className="space-y-4 p-4 bg-slate-950">
      <div className="flex gap-2">
        <Button onClick={() => setUploadDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Upload className="w-4 h-4 mr-2" /> Upload to Board
        </Button>
        <Button variant="outline" title="Run simulation to view serial output in the built-in monitor">
          <Zap className="w-4 h-4 mr-2" /> Serial Monitor (Sim)
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('open-parts-inventory', { detail: { platform: 'arduino' } }),
            )
          }
        >
          <Package className="w-4 h-4 mr-2" /> Parts
        </Button>
        <Button variant="outline" onClick={() => setAiStudioOpen(true)}>
          <Sparkles className="w-4 h-4 mr-2" /> Arduino Uno Q AI Studio
        </Button>
      </div>

      <Tabs defaultValue="breadboard" className="w-full">
        <TabsList className="bg-slate-900 border-b border-slate-700">
          <TabsTrigger value="breadboard">Breadboard</TabsTrigger>
          <TabsTrigger value="libraries">Libraries</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="breadboard" className="space-y-4">
          <BreadboardVisualizer
            circuit={circuit}
            onCircuitChange={(newCircuit) => {
              setCircuit(newCircuit);
              if (circuitFile?.id) {
                onFileUpdate(circuitFile.id, JSON.stringify(newCircuit, null, 2));
              }
            }}
          />
        </TabsContent>

        <TabsContent value="libraries" className="space-y-4">
          <LibraryManager selectedLibraries={selectedLibraries} onLibrariesChange={setSelectedLibraries} />
        </TabsContent>

        <TabsContent value="info">
          <Card className="p-4 bg-slate-900 border-slate-700 space-y-3">
            <div>
              <Label htmlFor="info-board">Board</Label>
              <Select
                value={circuit.boardId}
                onValueChange={(value) => {
                  const updated = { ...circuit, boardId: value };
                  setCircuit(updated);
                  if (circuitFile?.id) {
                    onFileUpdate(circuitFile.id, JSON.stringify(updated, null, 2));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select board" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(arduinoBoards).map(([id, board]) => (
                    <SelectItem key={id} value={id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const board = arduinoBoards[circuit.boardId];
              if (!board) return null;
              return (
                <>
                  <div>
                    <Label>CPU</Label>
                    <p className="text-sm text-gray-300">{board.cpu}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Flash Memory</Label>
                      <p className="text-sm text-gray-300">{board.flash}KB</p>
                    </div>
                    <div>
                      <Label>RAM</Label>
                      <p className="text-sm text-gray-300">{board.ram}KB</p>
                    </div>
                    <div>
                      <Label>Digital Pins</Label>
                      <p className="text-sm text-gray-300">{board.pins}</p>
                    </div>
                    <div>
                      <Label>Voltage</Label>
                      <p className="text-sm text-gray-300">{board.voltage}V</p>
                    </div>
                  </div>
                  <div>
                    <Label>Connectivity</Label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {board.serial && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700">Serial</span>
                      )}
                      {board.wifi && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-300 border border-green-700">WiFi</span>
                      )}
                      {board.bluetooth && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700">Bluetooth</span>
                      )}
                      {!board.wifi && !board.bluetooth && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-600">Wired Only</span>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
            <div className="border-t border-slate-700 pt-3">
              <Label>Selected Libraries</Label>
              <p className="text-sm text-gray-300">{selectedLibraries.length}</p>
            </div>
            <div>
              <Label>Components</Label>
              <p className="text-sm text-gray-300">{circuit.components.length}</p>
            </div>
            <div>
              <Label>Wires</Label>
              <p className="text-sm text-gray-300">{circuit.wires?.length || 0}</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <ArduinoUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUpload={async (config: UploadConfig, port, onProgress?: (message: string, percent?: number) => void) => {
          if (config.uploadMethod === 'wifi') {
            await ArduinoUploadService.uploadViaWiFi(getSketchWithLibraries(), config, onProgress);
            return;
          }
          if (config.uploadMethod === 'bluetooth') {
            await ArduinoUploadService.uploadViaBluetooth(getSketchWithLibraries(), config, onProgress);
            return;
          }
          await ArduinoUploadService.uploadViaSerial(getSketchWithLibraries(), config, port, onProgress);
        }}
        sketchCode={getSketchWithLibraries()}
      />

      <Dialog open={aiStudioOpen} onOpenChange={setAiStudioOpen}>
        <DialogContent className="max-w-5xl h-[85vh] bg-slate-950 border-slate-700 text-white overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-700 p-6">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-violet-400" />
              Arduino Uno Q AI Studio
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              App Bricks Composer + Local LLM + Edge AI Rack for building offline-first embedded AI apps with Python + C++ workflows and board-native deployment.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto h-full p-6 space-y-5">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="font-semibold mb-2">App Bricks Composer</h3>
              <p className="text-sm text-slate-300 mb-3">
                Drag blocks from the palette into your flow lane, reorder by dragging, configure each brick, then generate a real app bundle.
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                <div
                  className="rounded border border-slate-700 p-3 bg-slate-950/50 space-y-2"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedPaletteBrickId) addComposerBrick(draggedPaletteBrickId);
                    setDraggedPaletteBrickId(null);
                  }}
                >
                  <p className="text-xs uppercase tracking-wide text-slate-400">Palette</p>
                  {APP_BRICK_PALETTE.map((brick) => (
                    <div
                      key={brick.id}
                      draggable
                      onDragStart={() => setDraggedPaletteBrickId(brick.id)}
                      onDragEnd={() => setDraggedPaletteBrickId(null)}
                      className="rounded border border-slate-700 p-2 bg-slate-900 cursor-grab active:cursor-grabbing"
                    >
                      <p className="font-medium text-sm">{brick.title}</p>
                      <p className="text-xs text-slate-400">{brick.description}</p>
                    </div>
                  ))}
                </div>

                <div
                  className="rounded border border-slate-700 p-3 bg-slate-950/50 space-y-2 min-h-[220px]"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedPaletteBrickId) addComposerBrick(draggedPaletteBrickId);
                    setDraggedPaletteBrickId(null);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Flow Lane</p>
                    <Button size="sm" variant="secondary" onClick={createComposerFlowFiles}>
                      Generate App Bundle
                    </Button>
                  </div>

                  {composerBricks.length === 0 ? (
                    <p className="text-xs text-slate-500">Drop blocks here to build your pipeline.</p>
                  ) : (
                    composerBricks.map((brick, index) => (
                      <div
                        key={brick.id}
                        draggable
                        onDragStart={() => setDraggedComposerBrickId(brick.id)}
                        onDragEnd={() => setDraggedComposerBrickId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggedComposerBrickId) moveComposerBrick(draggedComposerBrickId, brick.id);
                          setDraggedComposerBrickId(null);
                        }}
                        className="rounded border border-violet-700/60 p-2 bg-violet-950/20 cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{index + 1}. {brick.title}</p>
                            <p className="text-xs text-slate-400">{brick.description}</p>
                            <div className="mt-2 grid md:grid-cols-2 gap-2">
                              {Object.entries(brick.config).map(([key, value]) => (
                                <label key={key} className="text-xs text-slate-300">
                                  <span className="block text-[11px] text-slate-400 mb-1">{key}</span>
                                  <input
                                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                                    value={String(value)}
                                    onChange={(event) => updateComposerBrickConfig(brick.id, key, event.target.value)}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removeComposerBrick(brick.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="font-semibold mb-2">Local LLM + Edge AI Rack</h3>
              <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>Deploy quantized local language models for offline chat and command interpretation.</li>
                <li>Attach vision and anomaly models to the board accelerator path.</li>
                <li>Choose memory profiles: tiny, balanced, or max-context for each model lane.</li>
              </ul>
            </Card>

            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="font-semibold mb-2">Hybrid Runtime Workbench</h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="rounded border border-slate-700 p-3 bg-slate-950/60">
                  <p className="font-medium">Python Agent Layer</p>
                  <p className="text-slate-300">High-level logic for prompts, app state, and model coordination.</p>
                </div>
                <div className="rounded border border-slate-700 p-3 bg-slate-950/60">
                  <p className="font-medium">C++ Hardware Layer</p>
                  <p className="text-slate-300">Timing-critical control, ISR handling, and deterministic I/O control.</p>
                </div>
                <div className="rounded border border-slate-700 p-3 bg-slate-950/60">
                  <p className="font-medium">Bridge RPC Channel</p>
                  <p className="text-slate-300">Connect Python tasks to sketch calls with typed request/response contracts.</p>
                </div>
                <div className="rounded border border-slate-700 p-3 bg-slate-950/60">
                  <p className="font-medium">Profiling Overlay</p>
                  <p className="text-slate-300">Track RAM, token throughput, and accelerator utilization while iterating.</p>
                </div>
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-700 p-4 space-y-3">
              <h3 className="font-semibold mb-2">Studio Controls (Live Logic)</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Model Profile</Label>
                  <Select value={selectedModelProfile} onValueChange={(value: 'tiny' | 'balanced' | 'max') => setSelectedModelProfile(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiny">Tiny (fastest)</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="max">Max Context</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Deploy Target</Label>
                  <Select value={deployTarget} onValueChange={(value: 'dev-board' | 'qa-board' | 'classroom-fleet') => setDeployTarget(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dev-board">Dev Board</SelectItem>
                      <SelectItem value="qa-board">QA Board</SelectItem>
                      <SelectItem value="classroom-fleet">Classroom Fleet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant={visionEnabled ? 'default' : 'outline'} onClick={() => setVisionEnabled((v) => !v)}>
                  {visionEnabled ? 'Vision: Enabled' : 'Vision: Disabled'}
                </Button>
                <Button onClick={createAppLabManifest}>Generate App Lab Manifest</Button>
                <Button variant="secondary" onClick={createRuntimeBridgeFiles}>Generate Runtime Bridge Files</Button>
              </div>
              <p className="text-xs text-slate-400">
                Manifest: {appLabManifestFile ? 'present' : 'missing'} • Python bridge: {runtimeBridgePythonFile ? 'present' : 'missing'} • C++ bridge: {runtimeBridgeCppFile ? 'present' : 'missing'}
              </p>
            </Card>

            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="font-semibold mb-3">Deployment + Tooling Submodals</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setOpenSubModal('models')}>
                  Model Catalog
                </Button>
                <Button variant="secondary" onClick={() => setOpenSubModal('deploy')}>
                  Container Deploy
                </Button>
                <Button variant="secondary" onClick={() => setOpenSubModal('runtime')}>
                  Python↔C++ Runtime
                </Button>
              </div>
            </Card>
          </div>

          <DialogFooter className="border-t border-slate-700 p-4">
            <Button variant="outline" onClick={() => setAiStudioOpen(false)}>
              Close Studio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openSubModal === 'models'} onOpenChange={(open) => setOpenSubModal(open ? 'models' : null)}>
        <DialogContent className="bg-slate-950 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Model Catalog</DialogTitle>
            <DialogDescription className="text-slate-300">
              Select local LLM bundles, tokenizer settings, and fallback micro-models for offline-first assistant behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-200">
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <p className="font-medium mb-1">Primary LLM Lanes</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li>Tiny lane for voice commands and fast control loops.</li>
                <li>Balanced lane for planning, summaries, and coding assist.</li>
                <li>Max-context lane for long sessions and design memory.</li>
              </ul>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <p className="font-medium mb-1">Edge AI Attachments</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li>Vision detector bundle for gesture/object triggers.</li>
                <li>Anomaly model for sensor drift and fault alerts.</li>
                <li>Fallback micro-models for low-RAM safety mode.</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openSubModal === 'deploy'} onOpenChange={(open) => setOpenSubModal(open ? 'deploy' : null)}>
        <DialogContent className="bg-slate-950 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Container Deploy</DialogTitle>
            <DialogDescription className="text-slate-300">
              Build, sign, and deploy app containers with staged rollout to dev board, QA board, or classroom fleet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-200">
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <p className="font-medium mb-1">Release Pipeline</p>
              <ol className="list-decimal pl-5 space-y-1 text-slate-300">
                <li>Build app bundle from App Bricks graph + runtime bridge.</li>
                <li>Run smoke tests for model load, sensor I/O, and response latency.</li>
                <li>Sign image and push staged rollout package.</li>
              </ol>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <p className="font-medium mb-1">Rollout Policies</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li>Dev Board: instant deploy for iteration.</li>
                <li>QA Board: canary rollout with health checks.</li>
                <li>Classroom Fleet: phased updates + rollback snapshots.</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openSubModal === 'runtime'} onOpenChange={(open) => setOpenSubModal(open ? 'runtime' : null)}>
        <DialogContent className="bg-slate-950 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Python↔C++ Runtime Bridge</DialogTitle>
            <DialogDescription className="text-slate-300">
              Inspect bridge bindings, call graphs, and event queues that synchronize Python AI logic with real-time sketch code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-200">
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <p className="font-medium mb-1">Bridge Contract</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li>Typed request/response schema for every hardware action.</li>
                <li>Streaming channel for tokens, logs, and sensor frames.</li>
                <li>Timeout + retry strategy for noisy serial/Wi-Fi links.</li>
              </ul>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <p className="font-medium mb-1">Runtime Observability</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li>Queue depth and ISR pressure timeline.</li>
                <li>Heap usage and model context utilization markers.</li>
                <li>Event trace for Python decisions → C++ actuator outputs.</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
