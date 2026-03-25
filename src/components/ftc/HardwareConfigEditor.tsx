import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  Cpu,
  RotateCcw,
  Settings2,
} from 'lucide-react';

export interface HardwareDevice {
  id: string;
  name: string;
  type: DeviceType;
  port: number;
  bus: number;
  controller: 'control_hub' | 'expansion_hub';
}

type DeviceType =
  | 'dc_motor'
  | 'servo'
  | 'crservo'
  | 'digital'
  | 'analog'
  | 'i2c'
  | 'webcam';

interface PortSlot {
  label: string;
  type: DeviceType;
  maxPorts: number;
  portStart: number;
}

const CONTROLLER_PORTS: PortSlot[] = [
  { label: 'DC Motors', type: 'dc_motor', maxPorts: 4, portStart: 0 },
  { label: 'Servos', type: 'servo', maxPorts: 6, portStart: 0 },
  { label: 'CR Servos', type: 'crservo', maxPorts: 6, portStart: 0 },
  { label: 'Digital I/O', type: 'digital', maxPorts: 8, portStart: 0 },
  { label: 'Analog Input', type: 'analog', maxPorts: 4, portStart: 0 },
  { label: 'I2C Bus', type: 'i2c', maxPorts: 4, portStart: 0 },
];

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  dc_motor: 'DC Motor',
  servo: 'Servo',
  crservo: 'CR Servo',
  digital: 'Digital I/O',
  analog: 'Analog Input',
  i2c: 'I2C Device',
  webcam: 'Webcam',
};

const DEVICE_TYPE_COLORS: Record<DeviceType, string> = {
  dc_motor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  servo: 'bg-green-500/20 text-green-400 border-green-500/30',
  crservo: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  digital: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  analog: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  i2c: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  webcam: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

const generateId = () => Math.random().toString(36).substring(2, 9);

interface HardwareConfigEditorProps {
  onExportConfig: (xmlContent: string, javaContent: string) => void;
}

export function HardwareConfigEditor({ onExportConfig }: HardwareConfigEditorProps) {
  const [devices, setDevices] = useState<HardwareDevice[]>([
    { id: generateId(), name: 'leftFront', type: 'dc_motor', port: 0, bus: 0, controller: 'control_hub' },
    { id: generateId(), name: 'rightFront', type: 'dc_motor', port: 1, bus: 0, controller: 'control_hub' },
    { id: generateId(), name: 'leftBack', type: 'dc_motor', port: 2, bus: 0, controller: 'control_hub' },
    { id: generateId(), name: 'rightBack', type: 'dc_motor', port: 3, bus: 0, controller: 'control_hub' },
  ]);
  const [activeController, setActiveController] = useState<'control_hub' | 'expansion_hub'>('control_hub');

  const addDevice = useCallback((type: DeviceType) => {
    const slot = CONTROLLER_PORTS.find(s => s.type === type);
    const existing = devices.filter(d => d.type === type && d.controller === activeController);
    const nextPort = existing.length;
    if (slot && nextPort >= slot.maxPorts) return;

    setDevices(prev => [...prev, {
      id: generateId(),
      name: `${type}${nextPort}`,
      type,
      port: nextPort,
      bus: 0,
      controller: activeController,
    }]);
  }, [devices, activeController]);

  const removeDevice = useCallback((id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
  }, []);

  const updateDevice = useCallback((id: string, updates: Partial<HardwareDevice>) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const generateXml = useCallback(() => {
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<Robot type="FirstInspires-FTC">'];
    
    for (const ctrl of ['control_hub', 'expansion_hub'] as const) {
      const ctrlDevices = devices.filter(d => d.controller === ctrl);
      if (ctrlDevices.length === 0 && ctrl === 'expansion_hub') continue;

      const hubName = ctrl === 'control_hub' ? 'Control Hub' : 'Expansion Hub';
      lines.push(`  <LynxModule name="${hubName}" port="${ctrl === 'control_hub' ? 173 : 2}">`);

      for (const device of ctrlDevices) {
        const xmlType = getXmlDeviceType(device.type);
        lines.push(`    <${xmlType} name="${device.name}" port="${device.port}" />`);
      }

      lines.push('  </LynxModule>');
    }

    lines.push('</Robot>');
    return lines.join('\n');
  }, [devices]);

  const generateJavaMapping = useCallback(() => {
    const lines = [
      '// Auto-generated hardware mapping',
      '// Paste into your RobotHardware.init() method',
      '',
    ];

    for (const device of devices) {
      const javaType = getJavaType(device.type);
      lines.push(`${javaType} ${device.name} = hardwareMap.get(${javaType}.class, "${device.name}");`);
    }

    return lines.join('\n');
  }, [devices]);

  const handleExport = useCallback(() => {
    onExportConfig(generateXml(), generateJavaMapping());
  }, [onExportConfig, generateXml, generateJavaMapping]);

  const controllerDevices = devices.filter(d => d.controller === activeController);

  return (
    <div className="space-y-3">
      {/* Controller selector */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={activeController === 'control_hub' ? 'default' : 'outline'}
          onClick={() => setActiveController('control_hub')}
          className="text-xs"
        >
          <Cpu className="w-3 h-3 mr-1" /> Control Hub
        </Button>
        <Button
          size="sm"
          variant={activeController === 'expansion_hub' ? 'default' : 'outline'}
          onClick={() => setActiveController('expansion_hub')}
          className="text-xs"
        >
          <Cpu className="w-3 h-3 mr-1" /> Expansion Hub
        </Button>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="outline" onClick={handleExport} className="text-xs">
            <Download className="w-3 h-3 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Visual port layout */}
      <Card className="p-3 bg-slate-900 border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-foreground">
            {activeController === 'control_hub' ? 'Control Hub' : 'Expansion Hub'} — Port Map
          </span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {controllerDevices.length} devices
          </Badge>
        </div>

        <ScrollArea className="max-h-[320px]">
          <div className="space-y-3">
            {CONTROLLER_PORTS.map(slot => {
              const slotDevices = controllerDevices.filter(d => d.type === slot.type);
              return (
                <div key={slot.type} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{slot.label}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1 text-xs"
                      onClick={() => addDevice(slot.type)}
                      disabled={slotDevices.length >= slot.maxPorts}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {Array.from({ length: slot.maxPorts }, (_, i) => {
                      const device = slotDevices.find(d => d.port === i);
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs border ${
                            device
                              ? DEVICE_TYPE_COLORS[device.type]
                              : 'bg-slate-800/50 border-slate-700/50 text-muted-foreground'
                          }`}
                        >
                          <span className="text-[10px] opacity-60 w-4">P{i}</span>
                          {device ? (
                            <>
                              <Input
                                value={device.name}
                                onChange={e => updateDevice(device.id, { name: e.target.value })}
                                className="h-5 text-xs bg-transparent border-none p-0 focus-visible:ring-0 flex-1 min-w-0"
                              />
                              <button
                                onClick={() => removeDevice(device.id)}
                                className="p-0.5 rounded hover:bg-red-500/20 text-red-400/60 hover:text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] italic">Empty</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Webcam slot */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">USB Webcam</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1 text-xs"
                  onClick={() => addDevice('webcam')}
                  disabled={controllerDevices.filter(d => d.type === 'webcam').length >= 2}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {controllerDevices.filter(d => d.type === 'webcam').map(device => (
                  <div key={device.id} className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs border ${DEVICE_TYPE_COLORS.webcam}`}>
                    <Input
                      value={device.name}
                      onChange={e => updateDevice(device.id, { name: e.target.value })}
                      className="h-5 text-xs bg-transparent border-none p-0 focus-visible:ring-0 flex-1 min-w-0"
                    />
                    <button onClick={() => removeDevice(device.id)} className="p-0.5 rounded hover:bg-red-500/20 text-red-400/60 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </Card>

      {/* Generated Java preview */}
      <Card className="p-3 bg-slate-900 border-slate-700">
        <span className="text-xs font-medium text-muted-foreground mb-2 block">Java Hardware Map Preview</span>
        <pre className="text-[10px] font-mono text-green-300 bg-black/50 p-2 rounded overflow-auto max-h-[120px]">
          {generateJavaMapping()}
        </pre>
      </Card>
    </div>
  );
}

function getXmlDeviceType(type: DeviceType): string {
  switch (type) {
    case 'dc_motor': return 'Motor';
    case 'servo': return 'Servo';
    case 'crservo': return 'ContinuousRotationServo';
    case 'digital': return 'DigitalDevice';
    case 'analog': return 'AnalogInput';
    case 'i2c': return 'I2cDevice';
    case 'webcam': return 'Webcam';
  }
}

function getJavaType(type: DeviceType): string {
  switch (type) {
    case 'dc_motor': return 'DcMotor';
    case 'servo': return 'Servo';
    case 'crservo': return 'CRServo';
    case 'digital': return 'DigitalChannel';
    case 'analog': return 'AnalogInput';
    case 'i2c': return 'I2cDevice';
    case 'webcam': return 'WebcamName';
  }
}
