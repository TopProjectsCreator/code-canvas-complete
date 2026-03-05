import { useState, useCallback, useEffect } from 'react';
import { ArduinoComponent, BreadboardCircuit } from '@/types/ide';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, MousePointer, Pen, Eraser, Play, Square } from 'lucide-react';
import { BreadboardCanvas } from './breadboard/BreadboardCanvas';
import { COMPONENT_TEMPLATES, WIRE_COLORS, COMPONENT_LABELS } from './breadboard/componentTemplates';
import { ComponentPropertyEditor } from './breadboard/ComponentPropertyEditor';
import { Wire, ToolMode, SimulationState } from './breadboard/types';
import { toast } from 'sonner';

interface BreadboardVisualizerProps {
  circuit: BreadboardCircuit;
  onCircuitChange: (circuit: BreadboardCircuit) => void;
  isReadOnly?: boolean;
}

// Counter to spread components across the board
let spawnIndex = 0;

export function BreadboardVisualizer({
  circuit,
  onCircuitChange,
  isReadOnly = false,
}: BreadboardVisualizerProps) {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [wireColor, setWireColor] = useState(WIRE_COLORS[0]);
  const [wires, setWires] = useState<Wire[]>(circuit.wires || []);

  useEffect(() => {
    setWires(circuit.wires || []);
  }, [circuit.wires]);

  const setWiresAndPersist = (newWires: Wire[]) => {
    setWires(newWires);
    onCircuitChange({ ...circuit, wires: newWires });
  };

  const [simulation, setSimulation] = useState<SimulationState>({
    running: false, tick: 0, pinStates: {}, ledStates: {}, buzzerStates: {},
  });
  const [simInterval, setSimInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const addComponent = (type: string) => {
    const tmpl = COMPONENT_TEMPLATES[type];
    if (!tmpl) return;
    // Spread components across the board using a grid pattern
    const col = spawnIndex % 6;
    const row = Math.floor(spawnIndex / 6) % 3;
    spawnIndex++;
    const newComp: ArduinoComponent = {
      id: `comp-${Date.now()}`,
      type,
      label: COMPONENT_LABELS[type] || type,
      pins: {},
      properties: type === 'led' ? { color: '#FF0000' } :
                  type === 'resistor' ? { resistance: '1K' } :
                  type === 'capacitor' ? { capacitance: '100μF' } :
                  type === 'potentiometer' ? { value: 0.5 } :
                  type === 'servo' ? { angle: 90 } :
                  type === 'sensor_temp' ? { temp: 25 } :
                  type === 'sensor_light' ? { light: 512 } : {},
      x: 120 + col * 150,
      y: 80 + row * 100,
    };
    onCircuitChange({ ...circuit, components: [...circuit.components, newComp] });
  };

  const deleteSelected = () => {
    if (!selectedComponent) return;
    const newWires = wires.filter(w =>
      w.from.componentId !== selectedComponent && w.to.componentId !== selectedComponent
    );
    setWiresAndPersist(newWires);
    onCircuitChange({
      ...circuit,
      components: circuit.components.filter(c => c.id !== selectedComponent),
    });
    setSelectedComponent(null);
  };

  const updateComponentProperties = (compId: string, newProps: Record<string, any>) => {
    onCircuitChange({
      ...circuit,
      components: circuit.components.map(c =>
        c.id === compId ? { ...c, properties: newProps } : c
      ),
    });
  };

  const toggleSimulation = useCallback(() => {
    if (simulation.running) {
      if (simInterval) clearInterval(simInterval);
      setSimInterval(null);
      setSimulation(prev => ({ ...prev, running: false, ledStates: {}, buzzerStates: {} }));
      toast.info('Simulation stopped');
    } else {
      const ledIds = circuit.components.filter(c => c.type === 'led' || c.type === 'rgb_led').map(c => c.id);
      const buzzerIds = circuit.components.filter(c => c.type === 'buzzer').map(c => c.id);
      const motorIds = circuit.components.filter(c => c.type === 'motor').map(c => c.id);

      const connectedComponents = new Set<string>();
      wires.forEach(w => {
        if (w.from.componentId) connectedComponents.add(w.from.componentId);
        if (w.to.componentId) connectedComponents.add(w.to.componentId);
      });

      const ledStates: Record<string, boolean> = {};
      const buzzerStates: Record<string, boolean> = {};

      ledIds.forEach(id => { ledStates[id] = connectedComponents.has(id); });
      buzzerIds.forEach(id => { buzzerStates[id] = connectedComponents.has(id); });
      motorIds.forEach(id => { ledStates[id] = connectedComponents.has(id); });

      setSimulation(prev => ({ ...prev, running: true, tick: 0, ledStates, buzzerStates }));

      const interval = setInterval(() => {
        setSimulation(prev => {
          const newTick = prev.tick + 1;
          const newLedStates = { ...prev.ledStates };
          ledIds.forEach(id => {
            if (!connectedComponents.has(id)) {
              newLedStates[id] = newTick % 2 === 0;
            }
          });
          return { ...prev, tick: newTick, ledStates: newLedStates };
        });
      }, 800);
      setSimInterval(interval);

      toast.success('Simulation started');
    }
  }, [simulation.running, simInterval, circuit.components, wires]);

  const componentTypes = Object.keys(COMPONENT_TEMPLATES);
  const filteredTypes = componentTypes.filter(t =>
    COMPONENT_LABELS[t]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedComp = circuit.components.find(c => c.id === selectedComponent);

  return (
    <div className="flex flex-col gap-3 p-3 bg-background rounded-lg border border-border">
      {/* Toolbar */}
      <div className="flex gap-1 flex-wrap items-center">
        <div className="flex gap-1 mr-2 border-r border-border pr-2">
          <Button size="sm" variant={toolMode === 'select' ? 'default' : 'outline'}
            onClick={() => setToolMode('select')} title="Select & Move">
            <MousePointer className="w-4 h-4" />
          </Button>
          <Button size="sm" variant={toolMode === 'wire' ? 'default' : 'outline'}
            onClick={() => setToolMode('wire')} title="Draw Wire">
            <Pen className="w-4 h-4" />
          </Button>
          <Button size="sm" variant={toolMode === 'delete' ? 'destructive' : 'outline'}
            onClick={() => setToolMode('delete')} title="Delete">
            <Eraser className="w-4 h-4" />
          </Button>
        </div>

        {toolMode === 'wire' && (
          <div className="flex gap-1 mr-2 border-r border-border pr-2">
            {WIRE_COLORS.slice(0, 6).map(color => (
              <button
                key={color}
                className={`w-5 h-5 rounded-full border-2 ${wireColor === color ? 'border-foreground scale-125' : 'border-muted'}`}
                style={{ backgroundColor: color }}
                onClick={() => setWireColor(color)}
              />
            ))}
          </div>
        )}

        <div className="mr-2 border-r border-border pr-2">
          <Button size="sm" variant={simulation.running ? 'destructive' : 'default'}
            onClick={toggleSimulation}
            className={simulation.running ? '' : 'bg-green-600 hover:bg-green-700 text-white'}>
            {simulation.running ? <Square className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {simulation.running ? 'Stop' : 'Simulate'}
          </Button>
        </div>

        {selectedComponent && (
          <Button size="sm" variant="destructive" onClick={deleteSelected}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        )}
      </div>

      {/* Add components */}
      <div className="flex items-center gap-2">
        <Input placeholder="Search components..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)} className="text-xs w-40" />
      </div>
      <div className="flex gap-1 flex-wrap">
        {filteredTypes.map(type => (
          <Button key={type} size="sm" variant="outline" onClick={() => addComponent(type)} className="text-xs h-7">
            <Plus className="w-3 h-3 mr-1" /> {COMPONENT_LABELS[type]}
          </Button>
        ))}
      </div>

      {/* Canvas + Property Editor side by side */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <BreadboardCanvas
            circuit={circuit}
            wires={wires}
            onCircuitChange={onCircuitChange}
            onWiresChange={setWiresAndPersist}
            selectedComponent={selectedComponent}
            onSelectComponent={setSelectedComponent}
            toolMode={toolMode}
            wireColor={wireColor}
            simulation={simulation}
            isReadOnly={isReadOnly}
          />
        </div>

        {/* Property editor panel */}
        {selectedComp && (
          <div className="w-52 flex-shrink-0">
            <ComponentPropertyEditor
              component={selectedComp}
              onUpdate={(newProps) => updateComponentProperties(selectedComp.id, newProps)}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {toolMode === 'select' && 'Click to select, drag to move'}
          {toolMode === 'wire' && 'Click a pin, then click another to connect'}
          {toolMode === 'delete' && 'Click a component or wire to delete'}
        </span>
        <span>
          {circuit.components.length} components · {wires.length} wires
          {simulation.running && ' · ⚡ Simulating'}
        </span>
      </div>
    </div>
  );
}
