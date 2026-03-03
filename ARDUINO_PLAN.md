# Arduino Template Implementation Plan

## Overview
Add full Arduino support to Code Canvas with a custom breadboard visualizer, library manager, circuit designer, and Web Serial API upload system.

**Tech Stack:**
- React 18 + TypeScript
- Canvas 2D for breadboard visualization
- Web Serial API for uploads
- Supabase for backend arduino-cli execution
- Existing Shadcn UI components

---

## Phase 1: Core Template System & File Structure

### 1.1 Add Arduino Template Type
**File:** `src/components/ide/LanguagePicker.tsx`

```typescript
// Add to LanguageTemplate type
export type LanguageTemplate = 
  | '...' // existing
  | 'arduino';  // ADD THIS

// Add to TEMPLATE_IDS array
const TEMPLATE_IDS: LanguageTemplate[] = [
  // existing...
  'arduino'
];

// Add to languages array
const languages: LanguageOption[] = [
  // existing...
  {
    id: 'arduino',
    name: 'Arduino',
    icon: <Cpu className="w-8 h-8" />,
    description: 'Embedded systems with Arduino boards',
    color: 'from-cyan-500 to-blue-600',
  },
];
```

**File:** `src/types/ide.ts`
```typescript
// Add Arduino-specific types
export interface ArduinoBoard {
  id: string;
  name: string;
  cpu: string;
  flash: number; // KB
  ram: number; // KB
  pins: number;
  voltage: number; // volts
  serial: boolean;
  wifi: boolean;
  bluetooth: boolean;
}

export interface ArduinoPin {
  number: number;
  name: string;
  mode: 'digital' | 'analog' | 'pwm' | 'i2c' | 'spi' | 'uart';
  state: 'high' | 'low' | number; // 0-255 for PWM/analog
}

export interface ArduinoComponent {
  id: string;
  type: string; // 'led', 'resistor', 'button', 'sensor', 'servo', etc.
  label: string;
  pins: { [key: string]: number }; // e.g., { positive: 5, negative: 0 }
  properties: Record<string, any>;
  x: number;
  y: number;
}

export interface BreadboardCircuit {
  id: string;
  boardId: string;
  components: ArduinoComponent[];
  connections: Array<{
    from: { componentId: string; pin: string };
    to: { componentId: string | 'board'; pin: string | number };
  }>;
  code: string;
}
```

### 1.2 Create Arduino Template Files
**File:** `src/data/arduinoTemplates.ts`

```typescript
import { FileNode } from '@/types/ide';
import { ArduinoBoard } from '@/types/ide';

export const arduinoBoards: Record<string, ArduinoBoard> = {
  uno: {
    id: 'uno',
    name: 'Arduino Uno',
    cpu: 'ATmega328P',
    flash: 32,
    ram: 2,
    pins: 14,
    voltage: 5,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  nano: {
    id: 'nano',
    name: 'Arduino Nano',
    cpu: 'ATmega328P',
    flash: 32,
    ram: 2,
    pins: 22,
    voltage: 5,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  mega: {
    id: 'mega',
    name: 'Arduino Mega 2560',
    cpu: 'ATmega2560',
    flash: 256,
    ram: 8,
    pins: 54,
    voltage: 5,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  esp32: {
    id: 'esp32',
    name: 'ESP32',
    cpu: 'ESP-WROOM-32',
    flash: 4096,
    ram: 520,
    pins: 36,
    voltage: 3.3,
    serial: true,
    wifi: true,
    bluetooth: true,
  },
};

export const arduinoLibraries: Record<string, { name: string; include: string; description: string }> = {
  servo: {
    name: 'Servo',
    include: '#include <Servo.h>',
    description: 'Control servo motors',
  },
  wire: {
    name: 'Wire (I2C)',
    include: '#include <Wire.h>',
    description: 'I2C/TWI communication',
  },
  spi: {
    name: 'SPI',
    include: '#include <SPI.h>',
    description: 'SPI communication',
  },
  softserial: {
    name: 'SoftwareSerial',
    include: '#include <SoftwareSerial.h>',
    description: 'Serial communication on any pins',
  },
  lcd: {
    name: 'LiquidCrystal',
    include: '#include <LiquidCrystal.h>',
    description: 'Control LCD displays',
  },
};

export const getArduinoTemplateFiles = (board: string = 'uno'): FileNode[] => {
  const boardName = arduinoBoards[board]?.name || 'Arduino Uno';
  
  return [
    {
      id: 'arduino-root',
      name: 'arduino-project',
      type: 'folder',
      children: [
        {
          id: 'arduino-sketch',
          name: 'sketch.ino',
          type: 'file',
          language: 'cpp',
          content: `// ${boardName} Sketch
// This is your main sketch file

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  
  // Set pin modes
  pinMode(LED_BUILTIN, OUTPUT);
  
  Serial.println("Setup complete!");
}

void loop() {
  // Main program logic
  digitalWrite(LED_BUILTIN, HIGH);   // Turn on LED
  delay(1000);                        // Wait 1 second
  digitalWrite(LED_BUILTIN, LOW);    // Turn off LED
  delay(1000);                        // Wait 1 second
}
`,
        },
        {
          id: 'arduino-circuit',
          name: 'circuit.json',
          type: 'file',
          language: 'json',
          content: JSON.stringify({
            boardId: board,
            components: [],
            connections: [],
          }, null, 2),
        },
        {
          id: 'arduino-readme',
          name: 'README.md',
          type: 'file',
          language: 'markdown',
          content: `# Arduino Project

Board: ${boardName}

## Getting Started

1. Connect your ${boardName} via USB
2. Select the correct board and port in the upload settings
3. Write your code in \`sketch.ino\`
4. Use the breadboard visualizer to design your circuit
5. Click "Upload to Board" when ready

## Useful Resources

- [Arduino Documentation](https://www.arduino.cc/reference/)
- [Arduino Libraries](https://www.arduino.cc/en/reference/libraries/)
- [Pin Reference for ${boardName}](https://www.arduino.cc/en/Guide/ArduinoUno)
`,
        },
        {
          id: 'arduino-tutorial',
          name: '.tutorial',
          type: 'folder',
          children: [
            {
              id: 'arduino-start-here',
              name: 'START_HERE.md',
              type: 'file',
              language: 'markdown',
              content: `# Arduino ${boardName} Starter Guide

## Project Structure

- \`sketch.ino\` - Your main Arduino sketch
- \`circuit.json\` - Visual circuit design (use breadboard editor)
- \`README.md\` - Project documentation

## Step 1: Write Your First Sketch

Modify \`sketch.ino\` to control the built-in LED:

\`\`\`cpp
void setup() {
  pinMode(13, OUTPUT); // LED pin
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
\`\`\`

## Step 2: Design Your Circuit

1. Open the Breadboard Visualizer
2. Drag components from the library
3. Connect pins with virtual wires
4. Add labels for clarity

## Step 3: Upload to Board

1. Connect your board via USB
2. Click "Upload Settings" to select port & board
3. Click "Upload to Board"
4. Watch the Serial Monitor for output

## Common Issues

- **Port not found:** Install CH340 drivers (Nano/Mega)
- **Upload timeout:** Try different baud rate
- **No connection:** Check USB cable

## Next Steps

- Add sensors and actuators
- Use Serial communication for debugging
- Implement interrupt handlers
- Learn about PWM and analog reads
`,
            },
          ],
        },
      ],
    },
  ];
};
```

### 1.3 Update defaultFiles.ts
**File:** `src/data/defaultFiles.ts`

Add Arduino template handling:

```typescript
import { getArduinoTemplateFiles } from './arduinoTemplates';

export const getTemplateFiles = (template: LanguageTemplate): FileNode[] => {
  // ... existing code ...
  
  if (template === 'arduino') {
    return withTutorialFolder(template, getArduinoTemplateFiles('uno'));
  }
  
  // ... rest of existing code ...
};
```

---

## Phase 2: Breadboard Visualizer Component

### 2.1 Create Breadboard Canvas Component
**File:** `src/components/arduino/BreadboardVisualizer.tsx`

```typescript
import { useRef, useEffect, useState, useCallback } from 'react';
import { ArduinoComponent, ArduinoPin, BreadboardCircuit } from '@/types/ide';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Download } from 'lucide-react';

interface BreadboardVisualizerProps {
  circuit: BreadboardCircuit;
  onCircuitChange: (circuit: BreadboardCircuit) => void;
  isReadOnly?: boolean;
}

const COMPONENT_TEMPLATES = {
  led: { width: 30, height: 50, color: '#FF0000', pins: ['positive', 'negative'] },
  resistor: { width: 60, height: 15, color: '#8B4513', pins: ['left', 'right'] },
  button: { width: 40, height: 40, color: '#999999', pins: ['1', '2', '3', '4'] },
  servo: { width: 45, height: 40, color: '#FFD700', pins: ['signal', 'vcc', 'gnd'] },
  sensor_temp: { width: 35, height: 35, color: '#00BFFF', pins: ['vcc', 'gnd', 'out'] },
  sensor_light: { width: 30, height: 30, color: '#FFD700', pins: ['vcc', 'gnd', 'out'] },
};

export function BreadboardVisualizer({
  circuit,
  onCircuitChange,
  isReadOnly = false,
}: BreadboardVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [draggingComponent, setDraggingComponent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const BREADBOARD_X = 50;
  const BREADBOARD_Y = 50;
  const BREADBOARD_WIDTH = 700;
  const BREADBOARD_HEIGHT = 500;
  const PIN_ROWS = 30;
  const PIN_COLS = 60;

  // Draw breadboard grid
  const drawBreadboard = (ctx: CanvasRenderingContext2D) => {
    // Background
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(BREADBOARD_X, BREADBOARD_Y, BREADBOARD_WIDTH, BREADBOARD_HEIGHT);

    // Border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(BREADBOARD_X, BREADBOARD_Y, BREADBOARD_WIDTH, BREADBOARD_HEIGHT);

    // Grid
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 0.5;
    const cellWidth = BREADBOARD_WIDTH / PIN_COLS;
    const cellHeight = BREADBOARD_HEIGHT / PIN_ROWS;

    for (let i = 0; i <= PIN_COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(BREADBOARD_X + i * cellWidth, BREADBOARD_Y);
      ctx.lineTo(BREADBOARD_X + i * cellWidth, BREADBOARD_Y + BREADBOARD_HEIGHT);
      ctx.stroke();
    }

    for (let i = 0; i <= PIN_ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(BREADBOARD_X, BREADBOARD_Y + i * cellHeight);
      ctx.lineTo(BREADBOARD_X + BREADBOARD_WIDTH, BREADBOARD_Y + i * cellHeight);
      ctx.stroke();
    }

    // Pin holes (small circles)
    ctx.fillStyle = '#CCC';
    for (let i = 0; i < PIN_COLS; i++) {
      for (let j = 0; j < PIN_ROWS; j++) {
        const x = BREADBOARD_X + (i + 0.5) * cellWidth;
        const y = BREADBOARD_Y + (j + 0.5) * cellHeight;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // Draw components
  const drawComponent = (ctx: CanvasRenderingContext2D, component: ArduinoComponent, isSelected: boolean, isHovered: boolean) => {
    const template = COMPONENT_TEMPLATES[component.type as keyof typeof COMPONENT_TEMPLATES];
    if (!template) return;

    ctx.save();

    // Highlight if selected or hovered
    if (isSelected) {
      ctx.shadowColor = '#00FF00';
      ctx.shadowBlur = 10;
    } else if (isHovered) {
      ctx.shadowColor = '#0080FF';
      ctx.shadowBlur = 5;
    }

    // Draw component body
    ctx.fillStyle = template.color;
    ctx.fillRect(component.x, component.y, template.width, template.height);

    ctx.strokeStyle = isSelected ? '#00FF00' : '#000';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(component.x, component.y, template.width, template.height);

    // Draw label
    ctx.fillStyle = '#000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      component.label,
      component.x + template.width / 2,
      component.y + template.height / 2 + 4
    );

    // Draw pin dots
    ctx.fillStyle = '#FFD700';
    const pinSpacing = template.width / (template.pins.length + 1);
    template.pins.forEach((pin, index) => {
      const x = component.x + (index + 1) * pinSpacing;
      const y = component.y + template.height;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  };

  // Draw all connections
  const drawConnections = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    circuit.connections.forEach((conn) => {
      const fromComponent = circuit.components.find((c) => c.id === conn.from.componentId);
      if (!fromComponent) return;

      let toX = 0,
        toY = 0;
      if (conn.to.componentId === 'board') {
        // Draw to board connector
        toX = BREADBOARD_X + 20;
        toY = BREADBOARD_Y + BREADBOARD_HEIGHT + 20;
      } else {
        const toComponent = circuit.components.find((c) => c.id === conn.to.componentId);
        if (!toComponent) return;
        toX = toComponent.x + 15;
        toY = toComponent.y + 25;
      }

      const fromX = fromComponent.x + 15;
      const fromY = fromComponent.y + 25;

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.bezierCurveTo(fromX, fromY + 50, toX, toY - 50, toX, toY);
      ctx.stroke();
    });

    ctx.setLineDash([]);
  };

  // Main render
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBreadboard(ctx);

    circuit.components.forEach((component) => {
      drawComponent(
        ctx,
        component,
        component.id === selectedComponent,
        component.id === hoveredComponent
      );
    });

    drawConnections(ctx);
  };

  useEffect(() => {
    render();
  }, [circuit, selectedComponent, hoveredComponent]);

  // Mouse handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggingComponent) {
      const newComponents = circuit.components.map((c) =>
        c.id === draggingComponent ? { ...c, x: x - dragOffset.x, y: y - dragOffset.y } : c
      );
      onCircuitChange({ ...circuit, components: newComponents });
    } else {
      const hovered = circuit.components.find(
        (c) =>
          x >= c.x &&
          x <= c.x + (COMPONENT_TEMPLATES[c.type as keyof typeof COMPONENT_TEMPLATES]?.width || 0) &&
          y >= c.y &&
          y <= c.y + (COMPONENT_TEMPLATES[c.type as keyof typeof COMPONENT_TEMPLATES]?.height || 0)
      );
      setHoveredComponent(hovered?.id || null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReadOnly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = circuit.components.find(
      (c) =>
        x >= c.x &&
        x <= c.x + (COMPONENT_TEMPLATES[c.type as keyof typeof COMPONENT_TEMPLATES]?.width || 0) &&
        y >= c.y &&
        y <= c.y + (COMPONENT_TEMPLATES[c.type as keyof typeof COMPONENT_TEMPLATES]?.height || 0)
    );

    if (clicked) {
      setSelectedComponent(clicked.id);
      setDraggingComponent(clicked.id);
      setDragOffset({ x: x - clicked.x, y: y - clicked.y });
    }
  };

  const handleMouseUp = () => {
    setDraggingComponent(null);
  };

  const addComponent = (type: string) => {
    const newComponent: ArduinoComponent = {
      id: `component-${Date.now()}`,
      type,
      label: type.toUpperCase(),
      pins: {},
      properties: {},
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    };
    onCircuitChange({
      ...circuit,
      components: [...circuit.components, newComponent],
    });
  };

  const deleteSelected = () => {
    if (!selectedComponent) return;
    onCircuitChange({
      ...circuit,
      components: circuit.components.filter((c) => c.id !== selectedComponent),
    });
    setSelectedComponent(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-950 rounded-lg">
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => addComponent('led')}>
          <Plus className="w-4 h-4 mr-1" /> LED
        </Button>
        <Button size="sm" variant="outline" onClick={() => addComponent('resistor')}>
          <Plus className="w-4 h-4 mr-1" /> Resistor
        </Button>
        <Button size="sm" variant="outline" onClick={() => addComponent('button')}>
          <Plus className="w-4 h-4 mr-1" /> Button
        </Button>
        <Button size="sm" variant="outline" onClick={() => addComponent('servo')}>
          <Plus className="w-4 h-4 mr-1" /> Servo
        </Button>
        <Button size="sm" variant="outline" onClick={() => addComponent('sensor_temp')}>
          <Plus className="w-4 h-4 mr-1" /> Temp Sensor
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={deleteSelected}
          disabled={!selectedComponent}
        >
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="border border-gray-600 cursor-move bg-slate-900 rounded"
      />

      <div className="text-xs text-gray-400">
        {selectedComponent && (
          <p>Selected: {circuit.components.find((c) => c.id === selectedComponent)?.label}</p>
        )}
      </div>
    </div>
  );
}
```

---

## Phase 3: Library Manager

### 3.1 Create Library Manager Component
**File:** `src/components/arduino/LibraryManager.tsx`

```typescript
import { useState } from 'react';
import { arduinoLibraries } from '@/data/arduinoTemplates';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LibraryManagerProps {
  selectedLibraries: string[];
  onLibrariesChange: (libraries: string[]) => void;
}

export function LibraryManager({ selectedLibraries, onLibrariesChange }: LibraryManagerProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleLibrary = (libId: string) => {
    if (selectedLibraries.includes(libId)) {
      onLibrariesChange(selectedLibraries.filter((l) => l !== libId));
    } else {
      onLibrariesChange([...selectedLibraries, libId]);
    }
  };

  const getLibraryIncludes = (): string => {
    return selectedLibraries
      .map((libId) => arduinoLibraries[libId]?.include || '')
      .filter(Boolean)
      .join('\n');
  };

  return (
    <Card className="p-4 bg-slate-900 border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full font-semibold text-white hover:text-gray-200"
      >
        <span>Libraries ({selectedLibraries.length})</span>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {Object.entries(arduinoLibraries).map(([id, lib]) => (
            <div key={id} className="flex items-start gap-3">
              <Checkbox
                id={id}
                checked={selectedLibraries.includes(id)}
                onCheckedChange={() => toggleLibrary(id)}
              />
              <label htmlFor={id} className="flex-1 cursor-pointer">
                <div className="font-medium text-white">{lib.name}</div>
                <div className="text-xs text-gray-400">{lib.description}</div>
              </label>
            </div>
          ))}

          {selectedLibraries.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="text-sm text-gray-300 mb-2">Include statements:</div>
              <pre className="bg-slate-950 p-2 rounded text-xs text-gray-300 overflow-auto">
                {getLibraryIncludes()}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

---

## Phase 4: Upload & Serial Communication

### 4.1 Create Upload Settings Dialog
**File:** `src/components/arduino/ArduinoUploadDialog.tsx`

```typescript
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArduinoBoard, arduinoBoards } from '@/data/arduinoTemplates';
import { Loader2 } from 'lucide-react';

interface ArduinoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (config: UploadConfig) => Promise<void>;
  sketchCode: string;
}

export interface UploadConfig {
  boardId: string;
  portName: string;
  baudRate: number;
  uploadMethod: 'serial' | 'wifi' | 'bluetooth';
}

export function ArduinoUploadDialog({
  open,
  onOpenChange,
  onUpload,
  sketchCode,
}: ArduinoUploadDialogProps) {
  const [config, setConfig] = useState<UploadConfig>({
    boardId: 'uno',
    portName: 'COM3',
    baudRate: 115200,
    uploadMethod: 'serial',
  });

  const [ports, setPorts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (open) {
      detectSerialPorts();
    }
  }, [open]);

  const detectSerialPorts = async () => {
    try {
      if (!navigator.serial) {
        setError('Web Serial API not supported in this browser');
        return;
      }

      const availablePorts = await navigator.serial.getPorts();
      setPorts(availablePorts.map((port) => port.getInfo().usbProductId?.toString() || 'Unknown'));
    } catch (err) {
      setError('Failed to detect serial ports');
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    setError('');

    try {
      await onUpload(config);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle>Upload to Arduino Board</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="board">Board Type</Label>
            <Select
              value={config.boardId}
              onValueChange={(value) => setConfig({ ...config, boardId: value })}
            >
              <SelectTrigger id="board">
                <SelectValue />
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
            <Label htmlFor="method">Upload Method</Label>
            <Select
              value={config.uploadMethod}
              onValueChange={(value) =>
                setConfig({ ...config, uploadMethod: value as UploadConfig['uploadMethod'] })
              }
            >
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="serial">USB Serial</SelectItem>
                <SelectItem value="wifi">WiFi (OTA)</SelectItem>
                <SelectItem value="bluetooth">Bluetooth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.uploadMethod === 'serial' && (
            <>
              <div>
                <Label htmlFor="port">Serial Port</Label>
                <Select value={config.portName} onValueChange={(value) => setConfig({ ...config, portName: value })}>
                  <SelectTrigger id="port">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ports.length > 0 ? (
                      ports.map((port) => (
                        <SelectItem key={port} value={port}>
                          {port}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No ports detected
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="baudrate">Baud Rate</Label>
                <Select
                  value={String(config.baudRate)}
                  onValueChange={(value) => setConfig({ ...config, baudRate: parseInt(value) })}
                >
                  <SelectTrigger id="baudrate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9600">9600</SelectItem>
                    <SelectItem value="115200">115200</SelectItem>
                    <SelectItem value="230400">230400</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {config.uploadMethod === 'wifi' && (
            <div>
              <Label htmlFor="ipaddress">Board IP Address</Label>
              <Input
                id="ipaddress"
                placeholder="192.168.1.100"
                value={config.portName}
                onChange={(e) => setConfig({ ...config, portName: e.target.value })}
              />
            </div>
          )}

          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
              </>
            ) : (
              'Upload Sketch'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.2 Create Upload Service
**File:** `src/services/arduinoUploadService.ts`

```typescript
import { UploadConfig } from '@/components/arduino/ArduinoUploadDialog';

export class ArduinoUploadService {
  /**
   * Upload sketch via Web Serial API (browser-native)
   */
  static async uploadViaSerial(
    sketch: string,
    config: UploadConfig,
    onProgress?: (message: string) => void
  ): Promise<void> {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported');
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: config.baudRate });

      onProgress?.('Connected to board');

      const writer = port.writable?.getWriter();
      if (!writer) throw new Error('Could not get port writer');

      // Send sketch in chunks
      const encoder = new TextEncoder();
      const data = encoder.encode(sketch);
      const chunkSize = 64;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await writer.write(chunk);
        onProgress?.(`Uploading: ${Math.round((i / data.length) * 100)}%`);
      }

      writer.releaseLock();
      onProgress?.('Upload complete');

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await port.close();
    } catch (err) {
      throw new Error(`Serial upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload sketch via backend arduino-cli
   */
  static async uploadViaBackend(
    sketch: string,
    config: UploadConfig,
    onProgress?: (message: string) => void
  ): Promise<void> {
    try {
      onProgress?.('Compiling sketch...');

      const response = await fetch('/api/arduino/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sketch,
          board: config.boardId,
          port: config.portName,
          baudRate: config.baudRate,
          method: config.uploadMethod,
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      onProgress?.('Upload complete');
    } catch (err) {
      throw new Error(`Backend upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Open serial monitor for debugging
   */
  static async openSerialMonitor(
    port: string,
    baudRate: number,
    onData?: (data: string) => void
  ): Promise<void> {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported');
    }

    const serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate });

    const reader = serialPort.readable?.getReader();
    if (!reader) throw new Error('Could not get port reader');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        lines.forEach((line) => onData?.(line));
      }
    } finally {
      reader.releaseLock();
      await serialPort.close();
    }
  }
}
```

---

## Phase 5: Integration into IDE

### 5.1 Create Arduino Panel Component
**File:** `src/components/arduino/ArduinoPanel.tsx`

```typescript
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BreadboardVisualizer } from './BreadboardVisualizer';
import { LibraryManager } from './LibraryManager';
import { ArduinoUploadDialog } from './ArduinoUploadDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileNode, BreadboardCircuit } from '@/types/ide';
import { Upload, Zap } from 'lucide-react';

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

  const getSketchWithLibraries = (): string => {
    const libraryIncludes = selectedLibraries
      .map((libId) => {
        const lib = require('@/data/arduinoTemplates').arduinoLibraries[libId];
        return lib?.include || '';
      })
      .filter(Boolean)
      .join('\n');

    return libraryIncludes ? `${libraryIncludes}\n\n${sketchFile?.content || ''}` : sketchFile?.content || '';
  };

  return (
    <div className="space-y-4 p-4 bg-slate-950">
      <div className="flex gap-2">
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
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
              onFileUpdate(circuitFile?.id || '', JSON.stringify(newCircuit, null, 2));
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
```

### 5.2 Integrate into IDELayout
**File:** `src/components/ide/IDELayout.tsx`

Add Arduino panel to the sidebar/tabs:

```typescript
import { ArduinoPanel } from './arduino/ArduinoPanel';

// In the render, add conditional rendering:
{currentTemplate === 'arduino' && (
  <ArduinoPanel
    files={fileTree}
    onFileUpdate={updateFile}
    currentTemplate={currentTemplate}
  />
)}
```

---

## Phase 6: Backend Arduino CLI Service

### 6.1 Create Supabase Edge Function
**File:** `supabase/functions/arduino-upload/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UploadRequest {
  sketch: string;
  board: string;
  port: string;
  baudRate: number;
  method: "serial" | "wifi" | "bluetooth";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: UploadRequest = await req.json();

    // Validate inputs
    if (!body.sketch || !body.board) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save sketch to temp file
    const sketchPath = `/tmp/sketch_${Date.now()}.ino`;
    await Deno.writeTextFile(sketchPath, body.sketch);

    // Run arduino-cli
    const boardFqbn = getBoardFQBN(body.board);
    const compileProcess = Deno.run({
      cmd: [
        "arduino-cli",
        "compile",
        "--fqbn",
        boardFqbn,
        "-o",
        `/tmp/sketch_${Date.now()}.hex`,
        sketchPath,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const compileStatus = await compileProcess.status();

    if (!compileStatus.success) {
      const stderr = await Deno.readTextFile(`/tmp/error_${Date.now()}.log`);
      return new Response(JSON.stringify({ error: `Compile failed: ${stderr}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to board
    if (body.method === "serial") {
      const uploadProcess = Deno.run({
        cmd: [
          "arduino-cli",
          "upload",
          "-p",
          body.port,
          "--fqbn",
          boardFqbn,
          "-i",
          `/tmp/sketch_${Date.now()}.hex`,
        ],
        stdout: "piped",
        stderr: "piped",
      });

      const uploadStatus = await uploadProcess.status();

      if (!uploadStatus.success) {
        return new Response(JSON.stringify({ error: "Upload failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Upload complete" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getBoardFQBN(board: string): string {
  const fqbnMap: Record<string, string> = {
    uno: "arduino:avr:uno",
    nano: "arduino:avr:nano",
    mega: "arduino:avr:mega",
    esp32: "esp32:esp32:esp32",
  };
  return fqbnMap[board] || "arduino:avr:uno";
}
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Add `arduino` to `LanguageTemplate` type
- [ ] Create `src/types/ide.ts` Arduino types
- [ ] Create `src/data/arduinoTemplates.ts` with boards and libraries
- [ ] Update `defaultFiles.ts` to handle Arduino template
- [ ] Test template loading in IDE

### Week 2: Breadboard Visualizer
- [ ] Create `BreadboardVisualizer.tsx` component
- [ ] Implement canvas rendering (grid, components, connections)
- [ ] Add component drag-and-drop
- [ ] Add component library (LED, resistor, button, etc.)
- [ ] Test visualization and interactions

### Week 3: Libraries & UI Polish
- [ ] Create `LibraryManager.tsx` component
- [ ] Create `ArduinoPanel.tsx` main component
- [ ] Integrate into IDE layout
- [ ] Add board/library info display
- [ ] Create settings UI

### Week 4: Upload System
- [ ] Create `ArduinoUploadDialog.tsx`
- [ ] Implement Web Serial API service
- [ ] Create `arduinoUploadService.ts`
- [ ] Add serial port detection
- [ ] Test Web Serial uploads

### Week 5: Backend Integration
- [ ] Create Supabase edge function for arduino-cli
- [ ] Implement sketch compilation
- [ ] Implement board upload via CLI
- [ ] Add error handling and logging
- [ ] Test WiFi/OTA upload fallback

### Week 6: Refinement & Testing
- [ ] Add Serial Monitor component
- [ ] Implement circuit export/import
- [ ] Add code generation from circuit
- [ ] Polish UI and UX
- [ ] Write documentation and tests

---

## Dependencies to Add

```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "typescript": "^5.x",
  "lucide-react": "^0.263.x"
}
```

For backend (Supabase):
- `arduino-cli` (must be installed in edge function environment)

---

## Testing Checklist

- [ ] Can select Arduino template from language picker
- [ ] Sketch file creates with correct boilerplate
- [ ] Can add/remove components on breadboard
- [ ] Component drag-and-drop works smoothly
- [ ] Libraries can be selected and prepended to sketch
- [ ] Web Serial API detects connected boards
- [ ] Sketch uploads successfully via USB
- [ ] Serial monitor reads data from board
- [ ] Circuit configurations persist when switching files
- [ ] Works in Chrome/Edge (Web Serial API requirement)

---

## Future Enhancements

1. **Advanced Circuit Features**
   - Wire routing algorithm
   - Component rotation
   - Schematic view mode
   - Gerber export for PCB manufacturing

2. **Virtual Board Simulator**
   - Wokwi.com integration
   - Browser-based simulator
   - Real-time circuit simulation

3. **Collaborative Features**
   - Share circuits/sketches
   - Real-time collaboration
   - Code comments for debugging

4. **Extended Board Support**
   - STM32, PIC microcontrollers
   - FPGA boards
   - Custom board definitions

5. **AI-Powered Features**
   - Generate circuit from requirements
   - Automatic code generation from circuit
   - Pin conflict detection

6. **Documentation & Tutorials**
   - Interactive tutorials
   - Video guides
   - Project templates
