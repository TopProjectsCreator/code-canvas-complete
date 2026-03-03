import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BreadboardVisualizer } from './BreadboardVisualizer';
import { LibraryManager } from './LibraryManager';
import { ArduinoUploadDialog } from './ArduinoUploadDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FileNode, BreadboardCircuit } from '@/types/ide';
import { Upload, Zap } from 'lucide-react';
import { arduinoLibraries } from '@/data/arduinoTemplates';

interface ArduinoPanelProps {
  files: FileNode[];
  onFileUpdate: (fileId: string, content: string) => void;
  currentTemplate: string;
}

export function ArduinoPanel({ files, onFileUpdate, currentTemplate }: ArduinoPanelProps) {
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [circuit, setCircuit] = useState<BreadboardCircuit>({
    id: 'circuit-1',
    boardId: 'uno',
    components: [],
    connections: [],
    code: '',
  });

  const sketchFile = files.find((f) => f.name === 'sketch.ino');
  const circuitFile = files.find((f) => f.name === 'circuit.json');

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
  }, [circuitFile?.id]);

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
        <Button variant="outline">
          <Zap className="w-4 h-4 mr-2" /> Serial Monitor
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
              <Label>Board</Label>
              <p className="text-sm text-gray-300">{circuit.boardId.toUpperCase()}</p>
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
