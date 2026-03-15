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
      inductor: { inductance: '10mH' },
      diode: { diodeType: '1N4148' },
      fuse: { rating: '1A' },
      thermistor: { nominal: '10K', beta: 3950 },
      photo_diode: { wavelength: 940 },
      battery_holder: { cells: 2, cellVoltage: 1.5 },

      button: { normallyOpen: true },
      toggle_switch: { on: false },
      dip_switch: { sw1: false, sw2: false, sw3: false, sw4: false },
      reed_switch: { normallyOpen: true },
      tilt_sensor: { angle: 45 },
      rotary_encoder: { position: 0 },
      joystick: { xAxis: 512, yAxis: 512 },
      keypad_4x4: { key: '1' },

      transistor_npn: { partNumber: '2N2222', gain: 100 },
      mosfet: { partNumber: 'IRF540', channel: 'N-CH' },
      triac: { partNumber: 'BT136' },
      optocoupler: { partNumber: '4N35' },
      ssr: { loadVoltage: '24VAC' },
      voltage_reg: { regType: '7805' },
      op_amp: { partNumber: 'LM358' },
      logic_level_shifter: { channels: 4 },
      boost_converter: { vout: 5 },
      buck_converter: { vout: 3.3 },

      sensor_temp: { temp: 25 },
      sensor_light: { light: 512 },
      potentiometer: { value: 0.5 },
      current_sensor: { partNumber: 'ACS712', range: '±5A' },
      hall_sensor: { threshold: 500 },
      pir_sensor: { holdTime: 3 },
      ultrasonic: { distance: 100 },
      flame_sensor: { intensity: 300 },
      gas_sensor: { ppm: 400 },
      sound_sensor: { level: 300 },
      soil_sensor: { moisture: 50 },
      rain_sensor: { wetness: 0 },
      dht11: { humidity: 50 },
      dht22: { humidity: 50 },
      ds18b20: { temp: 25 },
      bme280: { pressure: 1013 },
      mpu6050: { tilt: 0 },
      bh1750: { lux: 120 },
      tof_sensor: { distance: 250 },
      fingerprint_sensor: { templates: 0 },
      rfid_rc522: { uid: 'DE AD BE EF' },

      buzzer: { frequency: '2000', active: true },
      piezo: { frequency: 2000 },
      rgb_led: { red: 255, green: 0, blue: 0 },
      motor: { speed: 'medium', reverse: false },
      servo: { angle: 90 },
      stepper_motor: { steps: 200 },
      dc_fan: { duty: 50 },
      seven_seg: { digit: 0 },
      lcd: { lcdType: '16x2', text: 'Hello!' },
      oled_display: { text: 'OLED' },
      tft_display: { text: 'TFT' },
      ws2812_strip: { count: 8 },
      neopixel_ring: { count: 16 },

      ic: { icType: '555' },
      shift_register: { icType: '74HC595' },
      relay: { relayType: '5V-SPDT', energized: false },
      h_bridge: { icType: 'L293D' },
      eeprom: { size: '24LC256' },
      rtc_module: { datetime: '2026-01-01 12:00' },
      load_cell_amp: { weight: 0 },
      stepper_driver: { microstep: '1/16' },
      dac_module: { output: 1.2 },
      adc_module: { input: 1.2 },

      ir_receiver: { protocol: 'NEC' },
      ir_emitter: { code: '0x20DF10EF' },
      gps_module: { coords: '37.7749,-122.4194' },
      gsm_module: { signal: -70 },
      wifi_module: { ssid: 'MyWiFi' },
      bluetooth_module: { name: 'HC-05' },
      nrf24: { channel: 76 },
      lora_module: { frequency: 868 },
      can_module: { bitrate: '500k' },
      rs485_module: { baud: 9600 },
      usb_ttl: { baud: 115200 },
      ethernet_w5500: { ip: '192.168.1.100' },
      sd_card: { capacity: '16GB' },

      barrel_jack: { vin: '9V' },
      terminal_block: { labelText: 'TB1' },
      screw_terminal_2p: { labelText: 'J1' },
      screw_terminal_3p: { labelText: 'J2' },
      poe_module: { vout: '5V' },
      crystal: { frequency: '16MHz' },
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
          <div className="flex gap-1 mr-2 border-r border-border pr-2 items-center flex-wrap">
            {WIRE_COLORS.map(color => (
              <button key={color}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${wireColor === color ? 'border-foreground scale-125' : 'border-muted'}`}
                style={{ backgroundColor: color }}
                onClick={() => setWireColor(color)}
                title={color}
              />
            ))}
            <label className="relative w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground cursor-pointer flex items-center justify-center overflow-hidden" title="Custom color">
              <span className="text-[10px] leading-none text-muted-foreground">+</span>
              <input
                type="color"
                value={wireColor}
                onChange={(e) => setWireColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
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
