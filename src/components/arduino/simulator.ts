import { BreadboardCircuit } from '@/types/ide';
import { COMPONENT_TEMPLATES } from './breadboard/componentTemplates';
import { Wire } from './breadboard/types';

const ARDUINO_PIN_LABELS = [
  ...Array.from({ length: 14 }, (_, i) => `D${i}`),
  ...Array.from({ length: 6 }, (_, i) => `A${i}`),
  '5V', '3.3V', 'GND', 'VIN',
];

type Runtime = {
  setupLines: string[];
  loopLines: string[];
  section: 'setup' | 'loop';
  index: number;
  waitMs: number;
  pinLevels: Record<string, number>;
  pinModes: Record<string, string>;
  toneByPin: Record<string, number>;
  serial: string[];
  maxSerial: number;
};

export type SimTick = {
  pinLevels: Record<string, number>;
  ledBrightness: Record<string, number>;
  buzzerLevels: Record<string, number>;
  buzzerFreq: Record<string, number>;
  serialLines: string[];
};

const toPinLabel = (raw: string): string => {
  const pin = raw.trim();
  if (/^\d+$/.test(pin)) return `D${pin}`;
  if (/^[DA]\d+$/i.test(pin)) return pin.toUpperCase();
  return pin;
};

const sanitize = (code: string) => code
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, '').trim())
  .filter(Boolean);

const extractBlock = (lines: string[], fnName: 'setup' | 'loop'): string[] => {
  const out: string[] = [];
  let inBlock = false;
  let depth = 0;
  for (const line of lines) {
    if (!inBlock && new RegExp(`\\b${fnName}\\s*\\(`).test(line)) {
      inBlock = true;
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      continue;
    }
    if (!inBlock) continue;
    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;
    if (depth <= 0) {
      inBlock = false;
      continue;
    }
    out.push(line);
  }
  return out;
};

export const createRuntime = (sketchCode: string): Runtime => {
  const lines = sanitize(sketchCode);
  return {
    setupLines: extractBlock(lines, 'setup'),
    loopLines: extractBlock(lines, 'loop'),
    section: 'setup',
    index: 0,
    waitMs: 0,
    pinLevels: { '5V': 1, '3.3V': 0.66, GND: 0, VIN: 1 },
    pinModes: {},
    toneByPin: {},
    serial: [],
    maxSerial: 250,
  };
};

const parseArgList = (line: string): string[] => {
  const inner = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'));
  return inner.split(',').map((a) => a.trim());
};

const executeLine = (line: string, rt: Runtime) => {
  if (/^pinMode\s*\(/.test(line)) {
    const [pin, mode] = parseArgList(line);
    rt.pinModes[toPinLabel(pin)] = mode;
    return;
  }
  if (/^digitalWrite\s*\(/.test(line)) {
    const [pin, val] = parseArgList(line);
    rt.pinLevels[toPinLabel(pin)] = /HIGH|1/.test(val) ? 1 : 0;
    return;
  }
  if (/^analogWrite\s*\(/.test(line)) {
    const [pin, val] = parseArgList(line);
    const n = Number(val);
    rt.pinLevels[toPinLabel(pin)] = Number.isFinite(n) ? Math.max(0, Math.min(255, n)) / 255 : 0;
    return;
  }
  if (/^tone\s*\(/.test(line)) {
    const [pin, freq] = parseArgList(line);
    const p = toPinLabel(pin);
    const f = Number(freq);
    if (Number.isFinite(f) && f > 0) {
      rt.toneByPin[p] = f;
      rt.pinLevels[p] = 1;
    }
    return;
  }
  if (/^noTone\s*\(/.test(line)) {
    const [pin] = parseArgList(line);
    delete rt.toneByPin[toPinLabel(pin)];
    return;
  }
  if (/^delay\s*\(/.test(line)) {
    const [ms] = parseArgList(line);
    rt.waitMs = Math.max(0, Number(ms) || 0);
    return;
  }
  if (/^Serial\.(print|println)\s*\(/.test(line)) {
    const isLn = /^Serial\.println/.test(line);
    const [msg] = parseArgList(line);
    const out = (msg || '')
      .replace(/^"|"$/g, '')
      .replace(/^'|'$/g, '');
    rt.serial.push(isLn ? out : `${out}`);
    if (rt.serial.length > rt.maxSerial) rt.serial.shift();
  }
};

const nodeId = (point: { componentId?: string; pinIndex?: number }) => {
  if (point.componentId === 'board') {
    return `board:${ARDUINO_PIN_LABELS[point.pinIndex ?? 0] || `D${point.pinIndex ?? 0}`}`;
  }
  return `${point.componentId ?? 'free'}:${point.pinIndex ?? 0}`;
};

const resistorFactor = (resistance: string) => {
  const m = resistance.trim().toUpperCase().match(/([\d.]+)\s*([KMR]?)/);
  if (!m) return 0.5;
  let ohms = Number(m[1]);
  if (m[2] === 'K') ohms *= 1_000;
  if (m[2] === 'M') ohms *= 1_000_000;
  const raw = 220 / (220 + ohms);
  return Math.max(0.02, Math.min(1, raw));
};

const buildGraph = (circuit: BreadboardCircuit, wires: Wire[]) => {
  const graph = new Map<string, Array<{ to: string; factor: number }>>();
  const push = (a: string, b: string, factor: number) => {
    if (!graph.has(a)) graph.set(a, []);
    graph.get(a)!.push({ to: b, factor });
  };

  wires.forEach((w) => {
    const a = nodeId(w.from);
    const b = nodeId(w.to);
    push(a, b, 1);
    push(b, a, 1);
  });

  circuit.components.forEach((comp) => {
    const tmpl = COMPONENT_TEMPLATES[comp.type];
    if (!tmpl || tmpl.pins.length < 2) return;
    if (comp.type !== 'resistor') return;
    const a = `${comp.id}:0`;
    const b = `${comp.id}:1`;
    const factor = resistorFactor(comp.properties.resistance || '1K');
    push(a, b, factor);
    push(b, a, factor);
  });

  return graph;
};

const propagate = (graph: Map<string, Array<{ to: string; factor: number }>>, start: string, startValue: number) => {
  const values: Record<string, number> = { [start]: startValue };
  const q: string[] = [start];
  while (q.length) {
    const cur = q.shift()!;
    const curVal = values[cur];
    for (const edge of graph.get(cur) || []) {
      const nextVal = curVal * edge.factor;
      if (nextVal <= 0.01) continue;
      if ((values[edge.to] ?? -1) >= nextVal) continue;
      values[edge.to] = nextVal;
      q.push(edge.to);
    }
  }
  return values;
};

const evaluateCircuit = (rt: Runtime, circuit: BreadboardCircuit, wires: Wire[]) => {
  const graph = buildGraph(circuit, wires);
  const propagated: Record<string, number> = {};

  Object.entries(rt.pinLevels).forEach(([pin, level]) => {
    const node = `board:${pin}`;
    const vals = propagate(graph, node, level);
    Object.entries(vals).forEach(([k, v]) => {
      propagated[k] = Math.max(propagated[k] ?? 0, v);
    });
  });

  const ledBrightness: Record<string, number> = {};
  const buzzerLevels: Record<string, number> = {};
  const buzzerFreq: Record<string, number> = {};

  circuit.components.forEach((comp) => {
    const pinA = propagated[`${comp.id}:0`] ?? 0;
    const pinB = propagated[`${comp.id}:1`] ?? 0;
    const voltage = Math.abs(pinA - pinB);
    if (comp.type === 'led' || comp.type === 'rgb_led') ledBrightness[comp.id] = Math.max(0, Math.min(1, voltage));
    if (comp.type === 'buzzer' || comp.type === 'piezo') {
      buzzerLevels[comp.id] = Math.max(0, Math.min(1, voltage));
      const attachedPin = Object.keys(rt.toneByPin).find((pin) => (propagated[`${comp.id}:0`] ?? 0) > 0.1 && propagated[`board:${pin}`] !== undefined);
      if (attachedPin) buzzerFreq[comp.id] = rt.toneByPin[attachedPin];
      if (!buzzerFreq[comp.id]) buzzerFreq[comp.id] = Number(comp.properties.frequency || 1800);
    }
  });

  return { ledBrightness, buzzerLevels, buzzerFreq, propagated };
};

export const stepSimulation = (runtime: Runtime, elapsedMs: number, circuit: BreadboardCircuit, wires: Wire[]): SimTick => {
  runtime.waitMs = Math.max(0, runtime.waitMs - elapsedMs);
  let guard = 0;
  while (runtime.waitMs <= 0 && guard < 12) {
    const lines = runtime.section === 'setup' ? runtime.setupLines : runtime.loopLines;
    if (!lines.length) break;
    if (runtime.index >= lines.length) {
      if (runtime.section === 'setup') {
        runtime.section = 'loop';
      }
      runtime.index = 0;
      continue;
    }
    const line = lines[runtime.index++];
    executeLine(line, runtime);
    guard += 1;
  }

  const { ledBrightness, buzzerLevels, buzzerFreq } = evaluateCircuit(runtime, circuit, wires);

  return {
    pinLevels: runtime.pinLevels,
    ledBrightness,
    buzzerLevels,
    buzzerFreq,
    serialLines: runtime.serial,
  };
};
