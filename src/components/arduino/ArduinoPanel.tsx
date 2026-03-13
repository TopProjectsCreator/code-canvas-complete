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
import { FileNode, BreadboardCircuit } from '@/types/ide';
import { Upload, Zap } from 'lucide-react';
import { arduinoLibraries, arduinoBoards } from '@/data/arduinoTemplates';

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
              <p className="text-sm text-gray-300">{arduinoBoards[circuit.boardId]?.flash || 32}KB</p>
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
    </div>
  );
}
