export interface Point {
  x: number;
  y: number;
}

export interface WirePoint {
  componentId?: string;
  pinIndex?: number;
  boardRow?: number;
  boardCol?: number;
  x: number;
  y: number;
}

export interface Wire {
  id: string;
  from: WirePoint;
  to: WirePoint;
  color: string;
}

export interface ComponentTemplate {
  width: number;
  height: number;
  pins: { name: string; x: number; y: number; side: 'top' | 'bottom' | 'left' | 'right' }[];
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => void;
}

export type ToolMode = 'select' | 'wire' | 'delete';

export interface SimulationState {
  running: boolean;
  tick: number;
  pinStates: Record<string, Record<string, number>>; // componentId -> pinName -> value
  ledStates: Record<string, boolean>;
  buzzerStates: Record<string, boolean>;
}
