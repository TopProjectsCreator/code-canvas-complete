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
              Arduino App Lab-inspired studio for building embedded AI apps with local LLMs, Python + C++ workflows, and board-native deployment.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto h-full p-6 space-y-5">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="font-semibold mb-2">App Bricks Composer</h3>
              <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>Drag modular bricks for Chat, Vision, Sensor Stream, and Automation loops.</li>
                <li>Mix Python orchestration bricks with C++ hardware control bricks.</li>
                <li>Generate starter pipelines for smart assistant, anomaly alert, and telemetry apps.</li>
              </ul>
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
        <DialogContent className="bg-slate-950 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Model Catalog</DialogTitle>
            <DialogDescription className="text-slate-300">
              Select local LLM bundles, tokenizer settings, and fallback micro-models for offline-first assistant behavior.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={openSubModal === 'deploy'} onOpenChange={(open) => setOpenSubModal(open ? 'deploy' : null)}>
        <DialogContent className="bg-slate-950 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Container Deploy</DialogTitle>
            <DialogDescription className="text-slate-300">
              Build, sign, and deploy app containers with staged rollout to dev board, QA board, or classroom fleet.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={openSubModal === 'runtime'} onOpenChange={(open) => setOpenSubModal(open ? 'runtime' : null)}>
        <DialogContent className="bg-slate-950 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Python↔C++ Runtime Bridge</DialogTitle>
            <DialogDescription className="text-slate-300">
              Inspect bridge bindings, call graphs, and event queues that synchronize Python AI logic with real-time sketch code.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
