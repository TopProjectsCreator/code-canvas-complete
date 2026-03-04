import { useRef, useEffect, useState, useCallback } from 'react';
import { ArduinoComponent, BreadboardCircuit } from '@/types/ide';
import { COMPONENT_TEMPLATES, WIRE_COLORS } from './componentTemplates';
import { Wire, WirePoint, ToolMode, SimulationState } from './types';

interface BreadboardCanvasProps {
  circuit: BreadboardCircuit;
  wires: Wire[];
  onCircuitChange: (circuit: BreadboardCircuit) => void;
  onWiresChange: (wires: Wire[]) => void;
  selectedComponent: string | null;
  onSelectComponent: (id: string | null) => void;
  toolMode: ToolMode;
  wireColor: string;
  simulation: SimulationState;
  isReadOnly?: boolean;
}

const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 520;
const BB_X = 60;
const BB_Y = 40;
const BB_W = 700;
const BB_H = 420;
const COLS = 63;
const TOP_ROWS = 5;
const BOT_ROWS = 5;
const GAP = 30;

// y positions of the four power rails (plus/minus top and bottom)
function getRailY(rail: 'top+' | 'top-' | 'bot+' | 'bot-'): number {
  if (rail === 'top+') return BB_Y + 12;
  if (rail === 'top-') return BB_Y + 22;
  if (rail === 'bot+') return BB_Y + BB_H - 22;
  if (rail === 'bot-') return BB_Y + BB_H - 12;
  return BB_Y;
}

function getPinHolePos(col: number, row: number) {
  const cellW = BB_W / COLS;
  const x = BB_X + (col + 0.5) * cellW;
  let y: number;
  if (row < TOP_ROWS) {
    y = BB_Y + 50 + row * 16;
  } else {
    y = BB_Y + 50 + TOP_ROWS * 16 + GAP + (row - TOP_ROWS) * 16;
  }
  return { x, y };
}

export function BreadboardCanvas({
  circuit, wires, onCircuitChange, onWiresChange,
  selectedComponent, onSelectComponent,
  toolMode, wireColor, simulation, isReadOnly,
}: BreadboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [wireStart, setWireStart] = useState<WirePoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);

  const drawBreadboard = useCallback((ctx: CanvasRenderingContext2D) => {
    // Board background
    const bgGrad = ctx.createLinearGradient(BB_X, BB_Y, BB_X, BB_Y + BB_H);
    bgGrad.addColorStop(0, '#F5F0E0');
    bgGrad.addColorStop(1, '#E8E0C8');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(BB_X, BB_Y, BB_W, BB_H, 8);
    ctx.fill();
    ctx.strokeStyle = '#AAA';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Power rails
    const railColors = ['#FF3333', '#3333FF'];
    (['top+', 'top-', 'bot+', 'bot-'] as const).forEach((rail, idx) => {
      const ry = getRailY(rail);
      const color = rail.startsWith('top')
        ? (rail.endsWith('+') ? '#FF3333' : '#3333FF')
        : (rail.endsWith('+') ? '#FF3333' : '#3333FF');
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(BB_X + 20, ry);
      ctx.lineTo(BB_X + BB_W - 20, ry);
      ctx.stroke();
      ctx.setLineDash([]);
      // + and - labels for top rails only (bottom rails implied)
      if (rail.startsWith('top')) {
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = rail.endsWith('+') ? '#FF3333' : '#3333FF';
        ctx.fillText(rail.endsWith('+') ? '+' : '−', BB_X + 8, ry + (rail.endsWith('+') ? 5 : 15));
      }
    });
    // draw holes along rails so users can click them
    const holeInterval = 10;
    (['top+', 'top-', 'bot+', 'bot-'] as const).forEach(rail => {
      const ry = getRailY(rail);
      for (let x = BB_X + 20; x <= BB_X + BB_W - 20; x += holeInterval) {
        ctx.fillStyle = '#B8B0A0';
        ctx.beginPath();
        ctx.arc(x, ry, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9A9080';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    });

    // Center divider
    const dividerY = BB_Y + 50 + TOP_ROWS * 16 + GAP / 2 - 4;
    ctx.fillStyle = '#D5CDB8';
    ctx.fillRect(BB_X + 10, dividerY, BB_W - 20, 8);

    // Pin holes
    const cellW = BB_W / COLS;
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < TOP_ROWS + BOT_ROWS; row++) {
        const { x, y } = getPinHolePos(col, row);
        ctx.fillStyle = '#B8B0A0';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9A9080';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Column labels (every 5)
    ctx.fillStyle = '#888';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    for (let c = 0; c < COLS; c += 5) {
      const { x } = getPinHolePos(c, 0);
      ctx.fillText(`${c + 1}`, x, BB_Y + 44);
    }

    // Row labels
    const rowLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    ctx.textAlign = 'right';
    for (let r = 0; r < TOP_ROWS + BOT_ROWS; r++) {
      const { y } = getPinHolePos(0, r);
      ctx.fillText(rowLabels[r], BB_X - 4, y + 3);
    }
  }, []);

  const getComponentPinPos = (comp: ArduinoComponent, pinIndex: number) => {
    const tmpl = COMPONENT_TEMPLATES[comp.type];
    if (!tmpl || !tmpl.pins[pinIndex]) return null;
    const pin = tmpl.pins[pinIndex];
    return {
      x: comp.x + pin.x * tmpl.width,
      y: comp.y + pin.y * tmpl.height,
    };
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBreadboard(ctx);

    // Draw wires
    wires.forEach(wire => {
      ctx.strokeStyle = wire.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wire.from.x, wire.from.y);
      // Simple curve
      const midY = (wire.from.y + wire.to.y) / 2;
      ctx.bezierCurveTo(wire.from.x, midY, wire.to.x, midY, wire.to.x, wire.to.y);
      ctx.stroke();
      // Endpoints
      [wire.from, wire.to].forEach(pt => {
        ctx.fillStyle = wire.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Draw in-progress wire
    if (wireStart && toolMode === 'wire') {
      ctx.strokeStyle = wireColor + '88';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(wireStart.x, wireStart.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw components
    circuit.components.forEach(comp => {
      const tmpl = COMPONENT_TEMPLATES[comp.type];
      if (!tmpl) return;

      ctx.save();
      const isSelected = comp.id === selectedComponent;
      const isHov = comp.id === hovered;

      if (isSelected) {
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 12;
      } else if (isHov) {
        ctx.shadowColor = '#4488FF';
        ctx.shadowBlur = 8;
      }

      const simProps = { ...comp.properties };
      if (simulation.running) {
        if (simulation.ledStates[comp.id]) simProps.on = true;
        if (simulation.buzzerStates[comp.id]) simProps.on = true;
      }

      tmpl.draw(ctx, comp.x, comp.y, tmpl.width, tmpl.height, simProps, simulation.running);

      // Selection box
      if (isSelected) {
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(comp.x - 4, comp.y - 4, tmpl.width + 8, tmpl.height + 8);
        ctx.setLineDash([]);
      }

      ctx.restore();

      // Pin hover dots in wire mode
      if (toolMode === 'wire') {
        tmpl.pins.forEach((pin, i) => {
          const px = comp.x + pin.x * tmpl.width;
          const py = comp.y + pin.y * tmpl.height;
          ctx.fillStyle = '#00FF8866';
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#00FF88';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }
    });
  }, [circuit, wires, selectedComponent, hovered, toolMode, wireColor, wireStart, mousePos, simulation, drawBreadboard]);

  useEffect(() => { render(); }, [render]);

  const findComponentAt = (x: number, y: number) => {
    return circuit.components.find(c => {
      const t = COMPONENT_TEMPLATES[c.type];
      if (!t) return false;
      return x >= c.x - 4 && x <= c.x + t.width + 4 && y >= c.y - 4 && y <= c.y + t.height + 4;
    });
  };

  const findPinAt = (x: number, y: number): WirePoint | null => {
    // first look for component pins
    for (const comp of circuit.components) {
      const tmpl = COMPONENT_TEMPLATES[comp.type];
      if (!tmpl) continue;
      for (let i = 0; i < tmpl.pins.length; i++) {
        const pin = tmpl.pins[i];
        const px = comp.x + pin.x * tmpl.width;
        const py = comp.y + pin.y * tmpl.height;
        if (Math.hypot(x - px, y - py) < 8) {
          return { componentId: comp.id, pinIndex: i, x: px, y: py };
        }
      }
    }
    // board holes
    const cellW = BB_W / COLS;
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < TOP_ROWS + BOT_ROWS; row++) {
        const pos = getPinHolePos(col, row);
        if (Math.hypot(x - pos.x, y - pos.y) < 6) {
          return { boardRow: row, boardCol: col, x: pos.x, y: pos.y };
        }
      }
    }
    // rails
    const railTolerance = 6;
    (['top+','top-','bot+','bot-'] as const).forEach(rail => {}); // just to ensure TS type
    for (const rail of ['top+','top-','bot+','bot-'] as const) {
      const ry = getRailY(rail);
      if (y >= ry - railTolerance && y <= ry + railTolerance && x >= BB_X + 20 && x <= BB_X + BB_W - 20) {
        return { rail, x, y: ry };
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);

    if (toolMode === 'wire') {
      const pin = findPinAt(x, y);
      if (pin) {
        if (!wireStart) {
          setWireStart(pin);
        } else {
          const newWire: Wire = {
            id: `wire-${Date.now()}`,
            from: wireStart,
            to: pin,
            color: wireColor,
          };
          onWiresChange([...wires, newWire]);
          setWireStart(null);
        }
      }
      return;
    }

    if (toolMode === 'delete') {
      // Delete wire near click
      const clickedWire = wires.find(w => {
        const d1 = Math.hypot(x - w.from.x, y - w.from.y);
        const d2 = Math.hypot(x - w.to.x, y - w.to.y);
        return d1 < 8 || d2 < 8;
      });
      if (clickedWire) {
        onWiresChange(wires.filter(w => w.id !== clickedWire.id));
        return;
      }
      const comp = findComponentAt(x, y);
      if (comp) {
        onCircuitChange({
          ...circuit,
          components: circuit.components.filter(c => c.id !== comp.id),
        });
        return;
      }
      return;
    }

    // Select mode
    const comp = findComponentAt(x, y);
    if (comp) {
      onSelectComponent(comp.id);
      setDragging(comp.id);
      setDragOffset({ x: x - comp.x, y: y - comp.y });
    } else {
      onSelectComponent(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
    setMousePos({ x, y });

    if (dragging) {
      const updatedCircuit = {
        ...circuit,
        components: circuit.components.map(c =>
          c.id === dragging ? { ...c, x: x - dragOffset.x, y: y - dragOffset.y } : c
        ),
      };
      onCircuitChange(updatedCircuit);

      // also shift any wires that reference this component
      const updatedWires = wires.map(w => {
        const newWire = { ...w };
        const updatePoint = (pt: WirePoint) => {
          if (pt.componentId === dragging && pt.pinIndex !== undefined) {
            const pos = getComponentPinPos(
              updatedCircuit.components.find(c => c.id === dragging)!,
              pt.pinIndex
            );
            if (pos) {
              pt.x = pos.x;
              pt.y = pos.y;
            }
          }
        };
        updatePoint(newWire.from);
        updatePoint(newWire.to);
        return newWire;
      });
      onWiresChange(updatedWires);
    } else {
      const h = findComponentAt(x, y);
      setHovered(h?.id || null);
    }
  };

  const handleMouseUp = () => setDragging(null);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { handleMouseUp(); setWireStart(null); }}
      className="w-full border border-border rounded-lg cursor-crosshair"
      style={{ maxWidth: CANVAS_WIDTH, aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
    />
  );
}
