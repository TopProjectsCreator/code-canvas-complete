import { ArduinoComponent } from '@/types/ide';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
];

const RESISTANCE_VALUES = [
  '100', '220', '330', '470', '1K', '2.2K', '4.7K', '10K', '47K', '100K', '1M',
];

const CAPACITANCE_VALUES = [
  '1μF', '10μF', '22μF', '47μF', '100μF', '220μF', '470μF', '1000μF',
];

export function ComponentPropertyEditor({ component, onUpdate }: ComponentPropertyEditorProps) {
  const props = component.properties || {};

  const updateProp = (key: string, value: any) => {
    onUpdate({ ...props, [key]: value });
  };

  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border text-sm">
      <div className="font-medium text-foreground">{component.label} Properties</div>

      {/* LED color */}
      {(component.type === 'led') && (
        <div className="space-y-1">
          <Label className="text-xs">Color</Label>
          <div className="flex gap-1.5">
            {LED_COLORS.map(c => (
              <button
                key={c.value}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
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
              <Slider
                min={0} max={255} step={1}
                value={[props[ch] ?? 0]}
                onValueChange={([v]) => updateProp(ch, v)}
              />
            </div>
          ))}
        </>
      )}

      {/* Resistor value */}
      {component.type === 'resistor' && (
        <div className="space-y-1">
          <Label className="text-xs">Resistance</Label>
          <Select value={props.resistance || '1K'} onValueChange={(v) => updateProp('resistance', v)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESISTANCE_VALUES.map(r => (
                <SelectItem key={r} value={r}>{r}Ω</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Capacitor value */}
      {component.type === 'capacitor' && (
        <div className="space-y-1">
          <Label className="text-xs">Capacitance</Label>
          <Select value={props.capacitance || '100μF'} onValueChange={(v) => updateProp('capacitance', v)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAPACITANCE_VALUES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Potentiometer */}
      {component.type === 'potentiometer' && (
        <div className="space-y-1">
          <Label className="text-xs">Position: {Math.round((props.value ?? 0.5) * 100)}%</Label>
          <Slider
            min={0} max={1} step={0.01}
            value={[props.value ?? 0.5]}
            onValueChange={([v]) => updateProp('value', v)}
          />
        </div>
      )}

      {/* Servo angle */}
      {component.type === 'servo' && (
        <div className="space-y-1">
          <Label className="text-xs">Angle: {props.angle ?? 0}°</Label>
          <Slider
            min={0} max={180} step={1}
            value={[props.angle ?? 0]}
            onValueChange={([v]) => updateProp('angle', v)}
          />
        </div>
      )}

      {/* Sensor simulation values */}
      {component.type === 'sensor_temp' && (
        <div className="space-y-1">
          <Label className="text-xs">Temperature: {props.temp ?? 25}°C</Label>
          <Slider
            min={-40} max={125} step={1}
            value={[props.temp ?? 25]}
            onValueChange={([v]) => updateProp('temp', v)}
          />
        </div>
      )}

      {component.type === 'sensor_light' && (
        <div className="space-y-1">
          <Label className="text-xs">Light Level: {props.light ?? 512}</Label>
          <Slider
            min={0} max={1023} step={1}
            value={[props.light ?? 512]}
            onValueChange={([v]) => updateProp('light', v)}
          />
        </div>
      )}

      {/* Position */}
      <div className="flex gap-2">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">X</Label>
          <Input type="number" value={Math.round(component.x)} className="h-7 text-xs"
            onChange={e => updateProp('__x', Number(e.target.value))} readOnly />
        </div>
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Y</Label>
          <Input type="number" value={Math.round(component.y)} className="h-7 text-xs"
            onChange={e => updateProp('__y', Number(e.target.value))} readOnly />
        </div>
      </div>
    </div>
  );
}
