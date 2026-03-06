import { useState, useCallback, useEffect } from 'react';
import { ArduinoComponent, BreadboardCircuit } from '@/types/ide';
import { Button } from '@/components/ui/button';
import { MousePointer, Pen, Eraser, Play, Square, Trash2 } from 'lucide-react';
import { BreadboardCanvas, snapToGrid } from './breadboard/BreadboardCanvas';
import { COMPONENT_TEMPLATES, WIRE_COLORS, COMPONENT_LABELS } from './breadboard/componentTemplates';
import { ComponentPropertyEditor } from './breadboard/ComponentPropertyEditor';
import { ComponentPalette } from './breadboard/ComponentPalette';
import { Wire, ToolMode, SimulationState } from './breadboard/types';
import { toast } from 'sonner';

interface BreadboardVisualizerProps {
  circuit: BreadboardCircuit;
  onCircuitChange: (circuit: BreadboardCircuit) => void;
  isReadOnly?: boolean;
}

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

  useEffect(() => { setWires(circuit.wires || []); }, [circuit.wires]);

  const setWiresAndPersist = (newWires: Wire[]) => {
    setWires(newWires);
    onCircuitChange({ ...circuit, wires: newWires });
  };

  const [simulation, setSimulation] = useState<SimulationState>({
    running: false, tick: 0, pinStates: {}, ledStates: {}, buzzerStates: {},
  });
  const [simInterval, setSimInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const getDefaultProps = (type: string): Record<string, any> => {
    const defaults: Record<string, Record<string, any>> = {
      led: { color: '#FF0000' },
      resistor: { resistance: '1K' },
      capacitor: { capacitance: '100μF' },
      potentiometer: { value: 0.5 },
      servo: { angle: 90 },
      sensor_temp: { temp: 25 },
      sensor_light: { light: 512 },
      buzzer: { frequency: '2000', active: true },
      diode: { diodeType: '1N4148' },
      transistor_npn: { partNumber: '2N2222', gain: 100 },
      motor: { speed: 'medium', reverse: false },
      button: { normallyOpen: true },
      ic: { icType: '555' },
      relay: { relayType: '5V-SPDT', energized: false },
      toggle_switch: { on: false },
      seven_seg: { digit: 0 },
      fuse: { rating: '1A' },
      inductor: { inductance: '10mH' },
      voltage_reg: { regType: '7805' },
      mosfet: { partNumber: 'IRF540', channel: 'N-CH' },
      optocoupler: { partNumber: '4N35' },
      lcd: { lcdType: '16x2', text: 'Hello!' },
      shift_register: { icType: '74HC595' },
      crystal: { frequency: '16MHz' },
      dip_switch: { sw1: false, sw2: false, sw3: false, sw4: false },
      barrel_jack: {},
      h_bridge: { icType: 'L293D' },
      current_sensor: { partNumber: 'ACS712', range: '±5A' },
    };
    return defaults[type] || {};
  };

  const addComponent = (type: string, x?: number, y?: number) => {
    const tmpl = COMPONENT_TEMPLATES[type];
    if (!tmpl) return;
    
    let posX: number, posY: number;
    if (x !== undefined && y !== undefined) {
      // Drop position (already snapped)
      posX = x - tmpl.width / 2;
      posY = y - tmpl.height / 2;
    } else {
      // Grid-based spawn
      const col = spawnIndex % 6;
      const row = Math.floor(spawnIndex / 6) % 3;
      spawnIndex++;
      const snapped = snapToGrid(120 + col * 150, 80 + row * 100);
      posX = snapped.x;
      posY = snapped.y;
    }
    
    const finalPos = snapToGrid(posX, posY);
    
    const newComp: ArduinoComponent = {
      id: `comp-${Date.now()}`,
      type,
      label: COMPONENT_LABELS[type] || type,
      pins: {},
      properties: getDefaultProps(type),
      x: finalPos.x,
      y: finalPos.y,
    };
    onCircuitChange({ ...circuit, components: [...circuit.components, newComp] });
  };

  const handleDropComponent = (type: string, x: number, y: number) => {
    addComponent(type, x, y);
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
      setSimulation(prev => ({ ...prev, running: false, ledStates: {}, buzzerStates: {}, pinStates: {} }));
      toast.info('Simulation stopped');
    } else {
      const ledIds = circuit.components.filter(c => c.type === 'led' || c.type === 'rgb_led').map(c => c.id);
      const buzzerIds = circuit.components.filter(c => c.type === 'buzzer').map(c => c.id);
      const motorIds = circuit.components.filter(c => c.type === 'motor').map(c => c.id);
      const servoIds = circuit.components.filter(c => c.type === 'servo').map(c => c.id);

      const connectedComponents = new Set<string>();
      const boardConnections: Record<string, string[]> = {}; // pinLabel -> [componentId]
      
      wires.forEach(w => {
        if (w.from.componentId) connectedComponents.add(w.from.componentId);
        if (w.to.componentId) connectedComponents.add(w.to.componentId);
        
        // Track board pin connections
        if (w.from.componentId === 'board' && w.to.componentId && w.to.componentId !== 'board') {
          const pinIdx = w.from.pinIndex ?? 0;
          const ARDUINO_PIN_LABELS = [
            ...Array.from({length:14}, (_,i) => `D${i}`),
            ...Array.from({length:6}, (_,i) => `A${i}`),
            '5V', '3.3V', 'GND', 'VIN',
          ];
          const label = ARDUINO_PIN_LABELS[pinIdx] || `D${pinIdx}`;
          if (!boardConnections[label]) boardConnections[label] = [];
          boardConnections[label].push(w.to.componentId);
        }
        if (w.to.componentId === 'board' && w.from.componentId && w.from.componentId !== 'board') {
          const pinIdx = w.to.pinIndex ?? 0;
          const ARDUINO_PIN_LABELS = [
            ...Array.from({length:14}, (_,i) => `D${i}`),
            ...Array.from({length:6}, (_,i) => `A${i}`),
            '5V', '3.3V', 'GND', 'VIN',
          ];
          const label = ARDUINO_PIN_LABELS[pinIdx] || `D${pinIdx}`;
          if (!boardConnections[label]) boardConnections[label] = [];
          boardConnections[label].push(w.from.componentId);
        }
      });

      const ledStates: Record<string, boolean> = {};
      const buzzerStates: Record<string, boolean> = {};
      const pinStates: Record<string, Record<string, number>> = { board: {} };

      ledIds.forEach(id => { ledStates[id] = connectedComponents.has(id); });
      buzzerIds.forEach(id => { buzzerStates[id] = connectedComponents.has(id); });
      motorIds.forEach(id => { ledStates[id] = connectedComponents.has(id); });

      // Set pin states based on connections
      Object.entries(boardConnections).forEach(([pinLabel, compIds]) => {
        const hasLed = compIds.some(id => ledIds.includes(id));
        const hasBuzzer = compIds.some(id => buzzerIds.includes(id));
        const hasMotor = compIds.some(id => motorIds.includes(id));
        if (hasLed || hasBuzzer || hasMotor) pinStates.board[pinLabel] = 1;
      });

      setSimulation(prev => ({ ...prev, running: true, tick: 0, ledStates, buzzerStates, pinStates }));

      const interval = setInterval(() => {
        setSimulation(prev => {
          const newTick = prev.tick + 1;
          const newLedStates = { ...prev.ledStates };
          const newPinStates = { ...prev.pinStates, board: { ...prev.pinStates.board } };
          
          // Blink unconnected LEDs
          ledIds.forEach(id => {
            if (!connectedComponents.has(id)) {
              newLedStates[id] = newTick % 2 === 0;
            }
          });

          // Animate servo angles
          servoIds.forEach(id => {
            if (connectedComponents.has(id)) {
              // Sweep simulation
              const angle = (Math.sin(newTick * 0.3) * 0.5 + 0.5) * 180;
              const comp = circuit.components.find(c => c.id === id);
              if (comp) comp.properties.angle = Math.round(angle);
            }
          });

          // Pulse board pins
          Object.keys(newPinStates.board).forEach(pin => {
            if (pin.startsWith('D') && newPinStates.board[pin]) {
              // Digital pins toggle for PWM simulation
              newPinStates.board[pin] = newTick % 2 === 0 ? 1 : 0;
            }
          });

          return { ...prev, tick: newTick, ledStates: newLedStates, pinStates: newPinStates };
        });
      }, 800);
      setSimInterval(interval);
      toast.success('Simulation started — connect components to Arduino pins!');
    }
  }, [simulation.running, simInterval, circuit.components, wires]);

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
              <button key={color}
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

      {/* Main area: palette + canvas + properties */}
      <div className="flex gap-3">
        {/* Component palette */}
        <ComponentPalette onAddComponent={(type) => addComponent(type)} />

        {/* Canvas */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="min-w-[700px]">
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
              onDropComponent={handleDropComponent}
            />
          </div>
        </div>

        {/* Property editor */}
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
          {toolMode === 'select' && 'Drag from palette or click to select · Components snap to grid'}
          {toolMode === 'wire' && 'Click a pin, then click another to connect · Wire to Arduino pins!'}
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
