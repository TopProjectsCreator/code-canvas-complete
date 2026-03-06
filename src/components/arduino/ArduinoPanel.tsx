import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BreadboardVisualizer } from './BreadboardVisualizer';
import { LibraryManager } from './LibraryManager';
import { ArduinoUploadDialog } from './ArduinoUploadDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileNode, BreadboardCircuit } from '@/types/ide';
import { Upload, Zap } from 'lucide-react';
import { arduinoLibraries } from '@/data/arduinoTemplates';

interface ArduinoPanelProps {
  files: FileNode[];
  onFileUpdate: (fileId: string, content: string) => void;
  /**
   * Called when the panel needs a new file added to the workspace (e.g. circuit.json).
   */
  onAddFile?: (name: string, content: string, language?: string) => void;
  currentTemplate: string;
}

const arduinoBoards: Record<string, { name: string }> = {
  uno: { name: 'Arduino Uno' },
  nano: { name: 'Arduino Nano' },
  mega: { name: 'Arduino Mega' },
  leonardo: { name: 'Arduino Leonardo' },
};

export function ArduinoPanel({ files, onFileUpdate, onAddFile, currentTemplate }: ArduinoPanelProps) {
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [circuit, setCircuit] = useState<BreadboardCircuit>({
    id: 'circuit-1',
    boardId: 'uno',
    components: [],
    connections: [],
    wires: [],
    code: '',
  });

  const sketchFile = files.find((f) => f.name === 'sketch.ino');
  const circuitFile = files.find((f) => f.name === 'circuit.json');

  // Load circuit from file (or create one if missing)
  useEffect(() => {
    if (circuitFile && circuitFile.content) {
      try {
        const parsed = JSON.parse(circuitFile.content);
        setCircuit(parsed);
      } catch (e) {
        console.error('Failed to parse circuit.json');
      }
    } else if (!circuitFile && onAddFile) {
      // if there's no circuit file yet, create a blank one so state can persist
      const placeholder: BreadboardCircuit = {
        id: `circuit-${Date.now()}`,
        boardId: circuit.boardId,
        components: circuit.components,
        connections: circuit.connections || [],
        wires: circuit.wires || [],
        code: circuit.code,
      };
      onAddFile('circuit.json', JSON.stringify(placeholder, null, 2), 'json');
    }
  }, [circuitFile?.id]);


  useEffect(() => {
    const code = sketchFile?.content || '';
    if (circuit.code === code) return;
    const updated = { ...circuit, code };
    setCircuit(updated);
    if (circuitFile?.id) {
      onFileUpdate(circuitFile.id, JSON.stringify(updated, null, 2));
    }
  }, [sketchFile?.content]);

  const getSketchWithLibraries = (): string => {
    const libraryIncludes = selectedLibraries
      .map((libId) => arduinoLibraries[libId]?.include || '')
      .filter(Boolean)
      .join('\n');

    return libraryIncludes
      ? `${libraryIncludes}\n\n${sketchFile?.content || ''}`
      : sketchFile?.content || '';
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
            <div>
              <Label>Flash Memory</Label>
              <p className="text-sm text-gray-300">32KB</p>
            </div>
            <div>
              <Label>Selected Libraries</Label>
              <p className="text-sm text-gray-300">{selectedLibraries.length}</p>
            </div>
            <div>
              <Label>Components</Label>
              <p className="text-sm text-gray-300">{circuit.components.length}</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <ArduinoUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUpload={async (config) => {
          // Handle upload
          const { ArduinoUploadService } = await import('@/services/arduinoUploadService');
          if (config.uploadMethod === 'serial') {
            await ArduinoUploadService.uploadViaSerial(getSketchWithLibraries(), config);
          } else {
            await ArduinoUploadService.uploadViaBackend(getSketchWithLibraries(), config);
          }
        }}
        sketchCode={getSketchWithLibraries()}
      />
    </div>
  );
}
