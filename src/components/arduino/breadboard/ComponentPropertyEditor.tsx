import { ArduinoComponent } from '@/types/ide';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface ComponentPropertyEditorProps {
  component: ArduinoComponent;
  onUpdate: (properties: Record<string, any>) => void;
}

const LED_COLORS = [
  { label: 'Red', value: '#FF0000' },
  { label: 'Green', value: '#00CC00' },
  { label: 'Blue', value: '#0066FF' },
  { label: 'Yellow', value: '#FFDD00' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Orange', value: '#FF6600' },
  { label: 'Pink', value: '#FF66CC' },
  { label: 'Purple', value: '#AA00FF' },
];

const RESISTANCE_VALUES = [
  '100', '220', '330', '470', '1K', '2.2K', '4.7K', '10K', '47K', '100K', '1M',
];

const CAPACITANCE_VALUES = [
  '1μF', '10μF', '22μF', '47μF', '100μF', '220μF', '470μF', '1000μF',
];

const DIODE_TYPES = [
  { label: '1N4148 (Signal)', value: '1N4148' },
  { label: '1N4007 (Rectifier)', value: '1N4007' },
  { label: 'Zener 5.1V', value: 'Zener5V1' },
  { label: 'Schottky', value: 'Schottky' },
];

const TRANSISTOR_TYPES = [
  { label: '2N2222 (NPN)', value: '2N2222' },
  { label: '2N3904 (NPN)', value: '2N3904' },
  { label: 'BC547 (NPN)', value: 'BC547' },
  { label: 'TIP120 (NPN Darlington)', value: 'TIP120' },
];

const BUZZER_FREQ = [
  { label: '1kHz', value: '1000' },
  { label: '2kHz', value: '2000' },
  { label: '4kHz', value: '4000' },
  { label: '8kHz', value: '8000' },
];

const IC_TYPES = [
  { label: '555 Timer', value: '555' },
  { label: '74HC595 (Shift Reg)', value: '74HC595' },
  { label: 'LM7805 (Regulator)', value: 'LM7805' },
  { label: 'ATtiny85', value: 'ATtiny85' },
];

const MOTOR_SPEEDS = [
  { label: 'Slow', value: 'slow' },
  { label: 'Medium', value: 'medium' },
  { label: 'Fast', value: 'fast' },
];

const RELAY_TYPES = [
  { label: '5V SPDT', value: '5V-SPDT' },
  { label: '12V SPDT', value: '12V-SPDT' },
];

function SelectProp({ label, value, options, onChange }: {
  label: string; value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ComponentPropertyEditor({ component, onUpdate }: ComponentPropertyEditorProps) {
  const props = component.properties || {};

  const updateProp = (key: string, value: any) => {
    onUpdate({ ...props, [key]: value });
  };

  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border text-sm max-h-[360px] overflow-y-auto">
      <div className="font-medium text-foreground text-xs">{component.label}</div>

      {/* LED color */}
      {component.type === 'led' && (
        <div className="space-y-1">
          <Label className="text-xs">Color</Label>
          <div className="flex gap-1.5 flex-wrap">
            {LED_COLORS.map(c => (
              <button key={c.value}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  props.color === c.value ? 'border-foreground scale-125' : 'border-muted-foreground/30'
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => updateProp('color', c.value)}
                title={c.label}
              />
            ))}
          </div>
        </div>
      )}

      {/* RGB LED */}
      {component.type === 'rgb_led' && (
        <>
          {['red', 'green', 'blue'].map(ch => (
            <div key={ch} className="space-y-1">
              <Label className="text-xs capitalize">{ch}: {props[ch] ?? 0}</Label>
              <Slider min={0} max={255} step={1}
                value={[props[ch] ?? 0]}
                onValueChange={([v]) => updateProp(ch, v)} />
            </div>
          ))}
        </>
      )}

      {/* Resistor */}
      {component.type === 'resistor' && (
        <SelectProp label="Resistance"
          value={props.resistance || '1K'}
          options={RESISTANCE_VALUES.map(r => ({ label: r + 'Ω', value: r }))}
          onChange={v => updateProp('resistance', v)} />
      )}

      {/* Capacitor */}
      {component.type === 'capacitor' && (
        <SelectProp label="Capacitance"
          value={props.capacitance || '100μF'}
          options={CAPACITANCE_VALUES.map(c => ({ label: c, value: c }))}
          onChange={v => updateProp('capacitance', v)} />
      )}

      {/* Potentiometer */}
      {component.type === 'potentiometer' && (
        <div className="space-y-1">
          <Label className="text-xs">Position: {Math.round((props.value ?? 0.5) * 100)}%</Label>
          <Slider min={0} max={1} step={0.01}
            value={[props.value ?? 0.5]}
            onValueChange={([v]) => updateProp('value', v)} />
        </div>
      )}

      {/* Servo */}
      {component.type === 'servo' && (
        <div className="space-y-1">
          <Label className="text-xs">Angle: {props.angle ?? 90}°</Label>
          <Slider min={0} max={180} step={1}
            value={[props.angle ?? 90]}
            onValueChange={([v]) => updateProp('angle', v)} />
        </div>
      )}

      {/* Temp sensor */}
      {component.type === 'sensor_temp' && (
        <div className="space-y-1">
          <Label className="text-xs">Temp: {props.temp ?? 25}°C</Label>
          <Slider min={-40} max={125} step={1}
            value={[props.temp ?? 25]}
            onValueChange={([v]) => updateProp('temp', v)} />
        </div>
      )}

      {/* Light sensor */}
      {component.type === 'sensor_light' && (
        <div className="space-y-1">
          <Label className="text-xs">Light: {props.light ?? 512}</Label>
          <Slider min={0} max={1023} step={1}
            value={[props.light ?? 512]}
            onValueChange={([v]) => updateProp('light', v)} />
        </div>
      )}

      {/* Buzzer */}
      {component.type === 'buzzer' && (
        <>
          <SelectProp label="Frequency"
            value={props.frequency || '2000'}
            options={BUZZER_FREQ}
            onChange={v => updateProp('frequency', v)} />
          <div className="flex items-center justify-between">
            <Label className="text-xs">Active (built-in osc.)</Label>
            <Switch checked={props.active ?? true}
              onCheckedChange={v => updateProp('active', v)} />
          </div>
        </>
      )}

      {/* Diode */}
      {component.type === 'diode' && (
        <SelectProp label="Type"
          value={props.diodeType || '1N4148'}
          options={DIODE_TYPES}
          onChange={v => updateProp('diodeType', v)} />
      )}

      {/* Transistor */}
      {component.type === 'transistor_npn' && (
        <>
          <SelectProp label="Part Number"
            value={props.partNumber || '2N2222'}
            options={TRANSISTOR_TYPES}
            onChange={v => updateProp('partNumber', v)} />
          <div className="space-y-1">
            <Label className="text-xs">Gain (hFE): {props.gain ?? 100}</Label>
            <Slider min={10} max={500} step={10}
              value={[props.gain ?? 100]}
              onValueChange={([v]) => updateProp('gain', v)} />
          </div>
        </>
      )}

      {/* Motor */}
      {component.type === 'motor' && (
        <>
          <SelectProp label="Speed"
            value={props.speed || 'medium'}
            options={MOTOR_SPEEDS}
            onChange={v => updateProp('speed', v)} />
          <div className="flex items-center justify-between">
            <Label className="text-xs">Reverse</Label>
            <Switch checked={props.reverse ?? false}
              onCheckedChange={v => updateProp('reverse', v)} />
          </div>
        </>
      )}

      {/* Button */}
      {component.type === 'button' && (
        <div className="flex items-center justify-between">
          <Label className="text-xs">Normally Open</Label>
          <Switch checked={props.normallyOpen ?? true}
            onCheckedChange={v => updateProp('normallyOpen', v)} />
        </div>
      )}

      {/* IC */}
      {component.type === 'ic' && (
        <SelectProp label="IC Type"
          value={props.icType || '555'}
          options={IC_TYPES}
          onChange={v => updateProp('icType', v)} />
      )}

      {/* Relay */}
      {component.type === 'relay' && (
        <>
          <SelectProp label="Type"
            value={props.relayType || '5V-SPDT'}
            options={RELAY_TYPES}
            onChange={v => updateProp('relayType', v)} />
          <div className="flex items-center justify-between">
            <Label className="text-xs">Energized</Label>
            <Switch checked={props.energized ?? false}
              onCheckedChange={v => updateProp('energized', v)} />
          </div>
        </>
      )}

      {/* Toggle switch */}
      {component.type === 'toggle_switch' && (
        <div className="flex items-center justify-between">
          <Label className="text-xs">Position</Label>
          <Switch checked={props.on ?? false}
            onCheckedChange={v => updateProp('on', v)} />
        </div>
      )}

      {/* Seven segment */}
      {component.type === 'seven_seg' && (
        <div className="space-y-1">
          <Label className="text-xs">Digit: {props.digit ?? 0}</Label>
          <Slider min={0} max={9} step={1}
            value={[props.digit ?? 0]}
            onValueChange={([v]) => updateProp('digit', v)} />
        </div>
      )}

      {/* Fuse */}
      {component.type === 'fuse' && (
        <SelectProp label="Rating"
          value={props.rating || '1A'}
          options={['250mA', '500mA', '1A', '2A', '5A'].map(v => ({ label: v, value: v }))}
          onChange={v => updateProp('rating', v)} />
      )}
    </div>
  );
}
