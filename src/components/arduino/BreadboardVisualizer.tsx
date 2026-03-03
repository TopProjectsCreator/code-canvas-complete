import { useRef, useEffect, useState } from 'react';
import { ArduinoComponent, BreadboardCircuit } from '@/types/ide';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface BreadboardVisualizerProps {
  circuit: BreadboardCircuit;
  onCircuitChange: (circuit: BreadboardCircuit) => void;
  isReadOnly?: boolean;
}

const COMPONENT_TEMPLATES: Record<string, { width: number; height: number; color: string; pins: string[] }> = {
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
  const PIN_COLS = 60;
  const PIN_ROWS = 30;

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
  const drawComponent = (
    ctx: CanvasRenderingContext2D,
    component: ArduinoComponent,
    isSelected: boolean,
    isHovered: boolean
  ) => {
    const template = COMPONENT_TEMPLATES[component.type];
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
    ctx.fillText(component.label, component.x + template.width / 2, component.y + template.height / 2 + 4);

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
      drawComponent(ctx, component, component.id === selectedComponent, component.id === hoveredComponent);
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
      const hovered = circuit.components.find((c) => {
        const template = COMPONENT_TEMPLATES[c.type];
        if (!template) return false;
        return (
          x >= c.x &&
          x <= c.x + template.width &&
          y >= c.y &&
          y <= c.y + template.height
        );
      });
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

    const clicked = circuit.components.find((c) => {
      const template = COMPONENT_TEMPLATES[c.type];
      if (!template) return false;
      return (
        x >= c.x &&
        x <= c.x + template.width &&
        y >= c.y &&
        y <= c.y + template.height
      );
    });

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
        <Button size="sm" variant="destructive" onClick={deleteSelected} disabled={!selectedComponent}>
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
