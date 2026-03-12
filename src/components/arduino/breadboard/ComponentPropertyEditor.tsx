import { ArduinoComponent } from '@/types/ide';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

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

const VREG_TYPES = [
  { label: '7805 (5V)', value: '7805' },
  { label: '7803 (3.3V)', value: '7803' },
  { label: '7812 (12V)', value: '7812' },
  { label: 'LM317 (Adj)', value: 'LM317' },
];

const MOSFET_TYPES = [
  { label: 'IRF540 (N-CH)', value: 'IRF540' },
  { label: 'IRF9540 (P-CH)', value: 'IRF9540' },
  { label: 'IRLZ44N (Logic)', value: 'IRLZ44N' },
  { label: '2N7000 (N-CH)', value: '2N7000' },
];

const LCD_TYPES = [
  { label: '16x2', value: '16x2' },
  { label: '20x4', value: '20x4' },
];

const SHIFT_REG_TYPES = [
  { label: '74HC595 (SIPO)', value: '74HC595' },
  { label: '74HC165 (PISO)', value: '74HC165' },
];

const INDUCTANCE_VALUES = [
  '1mH', '2.2mH', '4.7mH', '10mH', '22mH', '47mH', '100mH',
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

function TextProp({ label, value, onChange, type = 'text' }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: 'text' | 'number';
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        className="h-7 text-xs"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
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

      {/* Inductor */}
      {component.type === 'inductor' && (
        <SelectProp label="Inductance"
          value={props.inductance || '10mH'}
          options={INDUCTANCE_VALUES.map(v => ({ label: v, value: v }))}
          onChange={v => updateProp('inductance', v)} />
      )}

      {/* Voltage Regulator */}
      {component.type === 'voltage_reg' && (
        <SelectProp label="Type"
          value={props.regType || '7805'}
          options={VREG_TYPES}
          onChange={v => updateProp('regType', v)} />
      )}

      {/* MOSFET */}
      {component.type === 'mosfet' && (
        <>
          <SelectProp label="Part Number"
            value={props.partNumber || 'IRF540'}
            options={MOSFET_TYPES}
            onChange={v => {
              const ch = v.includes('9540') ? 'P-CH' : 'N-CH';
              onUpdate({ ...props, partNumber: v, channel: ch });
            }} />
          <div className="text-xs text-muted-foreground">Channel: {props.channel || 'N-CH'}</div>
        </>
      )}

      {/* Optocoupler */}
      {component.type === 'optocoupler' && (
        <SelectProp label="Part Number"
          value={props.partNumber || '4N35'}
          options={[
            { label: '4N35', value: '4N35' },
            { label: '6N137 (High Speed)', value: '6N137' },
            { label: 'PC817', value: 'PC817' },
          ]}
          onChange={v => updateProp('partNumber', v)} />
      )}

      {/* LCD */}
      {component.type === 'lcd' && (
        <SelectProp label="Size"
          value={props.lcdType || '16x2'}
          options={LCD_TYPES}
          onChange={v => updateProp('lcdType', v)} />
      )}

      {/* Shift Register */}
      {component.type === 'shift_register' && (
        <SelectProp label="Type"
          value={props.icType || '74HC595'}
          options={SHIFT_REG_TYPES}
          onChange={v => updateProp('icType', v)} />
      )}

      {/* Crystal Oscillator */}
      {component.type === 'crystal' && (
        <SelectProp label="Frequency"
          value={props.frequency || '16MHz'}
          options={['4MHz', '8MHz', '12MHz', '16MHz', '20MHz', '32.768kHz'].map(v => ({ label: v, value: v }))}
          onChange={v => updateProp('frequency', v)} />
      )}

      {/* DIP Switch */}
      {component.type === 'dip_switch' && (
        <>
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center justify-between">
              <Label className="text-xs">Switch {i}</Label>
              <Switch checked={props[`sw${i}`] ?? false}
                onCheckedChange={v => updateProp(`sw${i}`, v)} />
            </div>
          ))}
        </>
      )}

      {/* H-Bridge */}
      {component.type === 'h_bridge' && (
        <SelectProp label="Type"
          value={props.icType || 'L293D'}
          options={[
            { label: 'L293D', value: 'L293D' },
            { label: 'L298N', value: 'L298N' },
            { label: 'DRV8833', value: 'DRV8833' },
          ]}
          onChange={v => updateProp('icType', v)} />
      )}

      {/* Current Sensor */}
      {component.type === 'current_sensor' && (
        <>
          <SelectProp label="Range"
            value={props.range || '±5A'}
            options={[
              { label: '±5A', value: '±5A' },
              { label: '±20A', value: '±20A' },
              { label: '±30A', value: '±30A' },
            ]}
            onChange={v => updateProp('range', v)} />
          <TextProp label="Part Number" value={props.partNumber || 'ACS712'} onChange={v => updateProp('partNumber', v)} />
        </>
      )}

      {component.type === 'thermistor' && (
        <>
          <SelectProp label="Nominal Resistance"
            value={props.nominal || '10K'}
            options={['1K', '4.7K', '10K', '47K', '100K'].map(v => ({ label: `${v}Ω`, value: v }))}
            onChange={v => updateProp('nominal', v)} />
          <TextProp label="Beta Value" value={props.beta || 3950} type="number" onChange={v => updateProp('beta', Number(v) || 3950)} />
        </>
      )}
      {component.type === 'photo_diode' && (
        <TextProp label="Wavelength (nm)" value={props.wavelength || 940} type="number" onChange={v => updateProp('wavelength', Number(v) || 940)} />
      )}
      {component.type === 'battery_holder' && (
        <>
          <TextProp label="Cells" value={props.cells || 2} type="number" onChange={v => updateProp('cells', Number(v) || 1)} />
          <TextProp label="Cell Voltage (V)" value={props.cellVoltage || 1.5} type="number" onChange={v => updateProp('cellVoltage', Number(v) || 1.5)} />
        </>
      )}
      {component.type === 'reed_switch' && (
        <div className="flex items-center justify-between">
          <Label className="text-xs">Normally Open</Label>
          <Switch checked={props.normallyOpen ?? true} onCheckedChange={v => updateProp('normallyOpen', v)} />
        </div>
      )}
      {component.type === 'tilt_sensor' && <TextProp label="Trigger Angle (°)" value={props.angle || 45} type="number" onChange={v => updateProp('angle', Number(v) || 45)} />}
      {component.type === 'rotary_encoder' && <TextProp label="Position" value={props.position || 0} type="number" onChange={v => updateProp('position', Number(v) || 0)} />}
      {component.type === 'joystick' && (
        <>
          <TextProp label="X" value={props.xAxis || 512} type="number" onChange={v => updateProp('xAxis', Number(v) || 0)} />
          <TextProp label="Y" value={props.yAxis || 512} type="number" onChange={v => updateProp('yAxis', Number(v) || 0)} />
        </>
      )}
      {component.type === 'keypad_4x4' && <TextProp label="Pressed Key" value={props.key || '1'} onChange={v => updateProp('key', v)} />}
      {component.type === 'triac' && <TextProp label="Part Number" value={props.partNumber || 'BT136'} onChange={v => updateProp('partNumber', v)} />}
      {component.type === 'ssr' && <TextProp label="Load Voltage" value={props.loadVoltage || '24VAC'} onChange={v => updateProp('loadVoltage', v)} />}
      {component.type === 'op_amp' && <TextProp label="Part Number" value={props.partNumber || 'LM358'} onChange={v => updateProp('partNumber', v)} />}
      {component.type === 'logic_level_shifter' && <TextProp label="Channels" value={props.channels || 4} type="number" onChange={v => updateProp('channels', Number(v) || 4)} />}
      {component.type === 'boost_converter' && <TextProp label="Output Voltage (V)" value={props.vout || 5} type="number" onChange={v => updateProp('vout', Number(v) || 5)} />}
      {component.type === 'buck_converter' && <TextProp label="Output Voltage (V)" value={props.vout || 3.3} type="number" onChange={v => updateProp('vout', Number(v) || 3.3)} />}
      {component.type === 'hall_sensor' && <TextProp label="Threshold" value={props.threshold || 500} type="number" onChange={v => updateProp('threshold', Number(v) || 500)} />}
      {component.type === 'pir_sensor' && <TextProp label="Hold Time (s)" value={props.holdTime || 3} type="number" onChange={v => updateProp('holdTime', Number(v) || 3)} />}
      {component.type === 'ultrasonic' && <TextProp label="Distance (cm)" value={props.distance || 100} type="number" onChange={v => updateProp('distance', Number(v) || 100)} />}
      {component.type === 'flame_sensor' && <TextProp label="Intensity" value={props.intensity || 300} type="number" onChange={v => updateProp('intensity', Number(v) || 300)} />}
      {component.type === 'gas_sensor' && <TextProp label="Gas PPM" value={props.ppm || 400} type="number" onChange={v => updateProp('ppm', Number(v) || 400)} />}
      {component.type === 'sound_sensor' && <TextProp label="Level" value={props.level || 300} type="number" onChange={v => updateProp('level', Number(v) || 300)} />}
      {component.type === 'soil_sensor' && <TextProp label="Moisture" value={props.moisture || 50} type="number" onChange={v => updateProp('moisture', Number(v) || 50)} />}
      {component.type === 'rain_sensor' && <TextProp label="Wetness" value={props.wetness || 0} type="number" onChange={v => updateProp('wetness', Number(v) || 0)} />}
      {component.type === 'dht11' && <TextProp label="Humidity %" value={props.humidity || 50} type="number" onChange={v => updateProp('humidity', Number(v) || 50)} />}
      {component.type === 'dht22' && <TextProp label="Humidity %" value={props.humidity || 50} type="number" onChange={v => updateProp('humidity', Number(v) || 50)} />}
      {component.type === 'ds18b20' && <TextProp label="Temperature °C" value={props.temp || 25} type="number" onChange={v => updateProp('temp', Number(v) || 25)} />}
      {component.type === 'bme280' && <TextProp label="Pressure hPa" value={props.pressure || 1013} type="number" onChange={v => updateProp('pressure', Number(v) || 1013)} />}
      {component.type === 'mpu6050' && <TextProp label="Tilt °" value={props.tilt || 0} type="number" onChange={v => updateProp('tilt', Number(v) || 0)} />}
      {component.type === 'bh1750' && <TextProp label="Lux" value={props.lux || 120} type="number" onChange={v => updateProp('lux', Number(v) || 120)} />}
      {component.type === 'tof_sensor' && <TextProp label="Distance mm" value={props.distance || 250} type="number" onChange={v => updateProp('distance', Number(v) || 250)} />}
      {component.type === 'fingerprint_sensor' && <TextProp label="Template Count" value={props.templates || 0} type="number" onChange={v => updateProp('templates', Number(v) || 0)} />}
      {component.type === 'rfid_rc522' && <TextProp label="UID" value={props.uid || 'DE AD BE EF'} onChange={v => updateProp('uid', v)} />}
      {component.type === 'piezo' && <TextProp label="Frequency (Hz)" value={props.frequency || 2000} type="number" onChange={v => updateProp('frequency', Number(v) || 2000)} />}
      {component.type === 'stepper_motor' && <TextProp label="Steps/Rev" value={props.steps || 200} type="number" onChange={v => updateProp('steps', Number(v) || 200)} />}
      {component.type === 'dc_fan' && <TextProp label="Duty %" value={props.duty || 50} type="number" onChange={v => updateProp('duty', Number(v) || 50)} />}
      {component.type === 'oled_display' && <TextProp label="Text" value={props.text || 'OLED'} onChange={v => updateProp('text', v)} />}
      {component.type === 'tft_display' && <TextProp label="Text" value={props.text || 'TFT'} onChange={v => updateProp('text', v)} />}
      {component.type === 'ws2812_strip' && <TextProp label="LED Count" value={props.count || 8} type="number" onChange={v => updateProp('count', Number(v) || 1)} />}
      {component.type === 'neopixel_ring' && <TextProp label="LED Count" value={props.count || 16} type="number" onChange={v => updateProp('count', Number(v) || 1)} />}
      {component.type === 'eeprom' && <TextProp label="Size" value={props.size || '24LC256'} onChange={v => updateProp('size', v)} />}
      {component.type === 'rtc_module' && <TextProp label="Date/Time" value={props.datetime || '2026-01-01 12:00'} onChange={v => updateProp('datetime', v)} />}
      {component.type === 'load_cell_amp' && <TextProp label="Weight (g)" value={props.weight || 0} type="number" onChange={v => updateProp('weight', Number(v) || 0)} />}
      {component.type === 'stepper_driver' && <TextProp label="Microstep" value={props.microstep || '1/16'} onChange={v => updateProp('microstep', v)} />}
      {component.type === 'dac_module' && <TextProp label="Output (V)" value={props.output || 1.2} type="number" onChange={v => updateProp('output', Number(v) || 0)} />}
      {component.type === 'adc_module' && <TextProp label="Input (V)" value={props.input || 1.2} type="number" onChange={v => updateProp('input', Number(v) || 0)} />}
      {component.type === 'ir_receiver' && <TextProp label="Protocol" value={props.protocol || 'NEC'} onChange={v => updateProp('protocol', v)} />}
      {component.type === 'ir_emitter' && <TextProp label="Code" value={props.code || '0x20DF10EF'} onChange={v => updateProp('code', v)} />}
      {component.type === 'gps_module' && <TextProp label="Coordinates" value={props.coords || '37.7749,-122.4194'} onChange={v => updateProp('coords', v)} />}
      {component.type === 'gsm_module' && <TextProp label="Signal dBm" value={props.signal || -70} type="number" onChange={v => updateProp('signal', Number(v) || -70)} />}
      {component.type === 'wifi_module' && <TextProp label="SSID" value={props.ssid || 'MyWiFi'} onChange={v => updateProp('ssid', v)} />}
      {component.type === 'bluetooth_module' && <TextProp label="Device Name" value={props.name || 'HC-05'} onChange={v => updateProp('name', v)} />}
      {component.type === 'nrf24' && <TextProp label="Channel" value={props.channel || 76} type="number" onChange={v => updateProp('channel', Number(v) || 76)} />}
      {component.type === 'lora_module' && <TextProp label="Frequency MHz" value={props.frequency || 868} type="number" onChange={v => updateProp('frequency', Number(v) || 868)} />}
      {component.type === 'can_module' && <TextProp label="Bitrate" value={props.bitrate || '500k'} onChange={v => updateProp('bitrate', v)} />}
      {component.type === 'rs485_module' && <TextProp label="Baud" value={props.baud || 9600} type="number" onChange={v => updateProp('baud', Number(v) || 9600)} />}
      {component.type === 'usb_ttl' && <TextProp label="Baud" value={props.baud || 115200} type="number" onChange={v => updateProp('baud', Number(v) || 115200)} />}
      {component.type === 'ethernet_w5500' && <TextProp label="IP" value={props.ip || '192.168.1.100'} onChange={v => updateProp('ip', v)} />}
      {component.type === 'sd_card' && <TextProp label="Capacity" value={props.capacity || '16GB'} onChange={v => updateProp('capacity', v)} />}
      {component.type === 'barrel_jack' && <TextProp label="Input Voltage" value={props.vin || '9V'} onChange={v => updateProp('vin', v)} />}
      {component.type === 'terminal_block' && <TextProp label="Label" value={props.labelText || 'TB1'} onChange={v => updateProp('labelText', v)} />}
      {component.type === 'screw_terminal_2p' && <TextProp label="Label" value={props.labelText || 'J1'} onChange={v => updateProp('labelText', v)} />}
      {component.type === 'screw_terminal_3p' && <TextProp label="Label" value={props.labelText || 'J2'} onChange={v => updateProp('labelText', v)} />}
      {component.type === 'poe_module' && <TextProp label="Output Voltage" value={props.vout || '5V'} onChange={v => updateProp('vout', v)} />}
    </div>
  );
}
