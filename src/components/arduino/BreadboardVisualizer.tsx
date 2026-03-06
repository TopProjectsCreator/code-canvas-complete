import { useState, useCallback, useEffect, useRef } from 'react';
import { ArduinoComponent, BreadboardCircuit } from '@/types/ide';
import { Button } from '@/components/ui/button';
import { MousePointer, Pen, Eraser, Play, Square, Trash2, Terminal } from 'lucide-react';
import { BreadboardCanvas, snapToGrid } from './breadboard/BreadboardCanvas';
import { COMPONENT_TEMPLATES, WIRE_COLORS, COMPONENT_LABELS } from './breadboard/componentTemplates';
import { ComponentPropertyEditor } from './breadboard/ComponentPropertyEditor';
import { ComponentPalette } from './breadboard/ComponentPalette';
import { Wire, ToolMode, SimulationState } from './breadboard/types';
import { toast } from 'sonner';
import { createRuntime, stepSimulation } from './simulator';

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
    running: false, tick: 0, pinStates: {}, ledStates: {}, ledBrightness: {}, buzzerStates: {}, buzzerLevels: {}, buzzerFrequencies: {},
  });
  const [simInterval, setSimInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const runtimeRef = useRef(createRuntime(circuit.code || ''));
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<Record<string, OscillatorNode>>({});
  const gainRef = useRef<Record<string, GainNode>>({});
  const [serialOpen, setSerialOpen] = useState(false);

  const stopAudio = () => {
    Object.values(oscRef.current).forEach((osc) => {
      try { osc.stop(); } catch {}
      try { osc.disconnect(); } catch {}
    });
    Object.values(gainRef.current).forEach((g) => {
      try { g.disconnect(); } catch {}
    });
    oscRef.current = {};
    gainRef.current = {};
  };

  useEffect(() => {
    runtimeRef.current = createRuntime(circuit.code || '');
  }, [circuit.code]);

  useEffect(() => () => {
    if (simInterval) clearInterval(simInterval);
    stopAudio();
  }, [simInterval]);

  const syncBuzzerAudio = (levels: Record<string, number>, freqs: Record<string, number>) => {
    if (!Object.keys(levels).length) {
      stopAudio();
      return;
    }
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
    const ctx = audioCtxRef.current;

    Object.keys(oscRef.current).forEach((id) => {
      if ((levels[id] ?? 0) <= 0.02) {
        try { oscRef.current[id].stop(); } catch {}
        try { oscRef.current[id].disconnect(); } catch {}
        try { gainRef.current[id]?.disconnect(); } catch {}
        delete oscRef.current[id];
        delete gainRef.current[id];
      }
    });

    Object.entries(levels).forEach(([id, lvl]) => {
      if (lvl <= 0.02) return;
      const freq = Math.max(60, Math.min(12000, freqs[id] || 1800));
      if (!oscRef.current[id]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0;
        osc.start();
        oscRef.current[id] = osc;
        gainRef.current[id] = gain;
      }
      oscRef.current[id].frequency.value = freq;
      gainRef.current[id].gain.value = Math.min(0.2, lvl * 0.2);
    });
  };


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
      stopAudio();
      setSimulation(prev => ({ ...prev, running: false, ledStates: {}, ledBrightness: {}, buzzerStates: {}, buzzerLevels: {}, buzzerFrequencies: {}, pinStates: {} }));
      toast.info('Simulation stopped');
    } else {
      runtimeRef.current = createRuntime(circuit.code || '');
      setSimulation(prev => ({ ...prev, running: true, tick: 0, pinStates: { board: {} }, ledStates: {}, ledBrightness: {}, buzzerStates: {}, buzzerLevels: {}, buzzerFrequencies: {} }));

      const interval = setInterval(() => {
        const result = stepSimulation(runtimeRef.current, 180, circuit, wires);
        const boardStates: Record<string, number> = {};
        Object.entries(result.pinLevels).forEach(([pin, level]) => {
          boardStates[pin] = level > 0.5 ? 1 : 0;
        });
        const ledStates = Object.fromEntries(Object.entries(result.ledBrightness).map(([id, v]) => [id, v > 0.12]));
        const buzzerStates = Object.fromEntries(Object.entries(result.buzzerLevels).map(([id, v]) => [id, v > 0.05]));

        setSimulation(prev => ({
          ...prev,
          tick: prev.tick + 1,
          pinStates: { board: boardStates },
          ledStates,
          ledBrightness: result.ledBrightness,
          buzzerStates,
          buzzerLevels: result.buzzerLevels,
          buzzerFrequencies: result.buzzerFreq,
        }));
        syncBuzzerAudio(result.buzzerLevels, result.buzzerFreq);
      }, 180);
      setSimInterval(interval);
      toast.success('Simulation started — code + wiring simulation active.');
    }
  }, [simulation.running, simInterval, circuit, wires]);

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

      {simulation.running && (
        <div className="rounded border border-border bg-black/80 text-green-400 p-2 text-xs font-mono">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1"><Terminal className="w-3 h-3" /> Serial Monitor</div>
            <Button size="sm" variant="outline" onClick={() => setSerialOpen(v => !v)}>{serialOpen ? 'Hide' : 'Show'}</Button>
          </div>
          {serialOpen && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {(runtimeRef.current.serial.length ? runtimeRef.current.serial : ['(no serial output yet)']).map((line, idx) => (
                <div key={`${idx}-${line}`}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

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
