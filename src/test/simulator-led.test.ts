import { describe, expect, it } from 'vitest';
import { createRuntime, stepSimulation } from '@/components/arduino/simulator';
import type { BreadboardCircuit } from '@/types/ide';
import type { Wire } from '@/components/arduino/breadboard/types';

const D13_INDEX = 13;
const GND_INDEX = 22;

const makeCircuit = (resistance: string, reverse = false): BreadboardCircuit => {
  const led = { id: 'led-1', type: 'led', label: 'LED', pins: {}, properties: { color: '#FF0000' }, x: 0, y: 0 };
  const resistor = { id: 'r-1', type: 'resistor', label: 'R', pins: {}, properties: { resistance }, x: 0, y: 0 };

  const wires: Wire[] = reverse
    ? [
        { id: 'w1', color: '#f00', from: { componentId: 'board', pinIndex: D13_INDEX, x: 0, y: 0 }, to: { componentId: 'r-1', pinIndex: 0, x: 0, y: 0 } },
        { id: 'w2', color: '#f00', from: { componentId: 'r-1', pinIndex: 1, x: 0, y: 0 }, to: { componentId: 'led-1', pinIndex: 1, x: 0, y: 0 } },
        { id: 'w3', color: '#000', from: { componentId: 'led-1', pinIndex: 0, x: 0, y: 0 }, to: { componentId: 'board', pinIndex: GND_INDEX, x: 0, y: 0 } },
      ]
    : [
        { id: 'w1', color: '#f00', from: { componentId: 'board', pinIndex: D13_INDEX, x: 0, y: 0 }, to: { componentId: 'r-1', pinIndex: 0, x: 0, y: 0 } },
        { id: 'w2', color: '#f00', from: { componentId: 'r-1', pinIndex: 1, x: 0, y: 0 }, to: { componentId: 'led-1', pinIndex: 0, x: 0, y: 0 } },
        { id: 'w3', color: '#000', from: { componentId: 'led-1', pinIndex: 1, x: 0, y: 0 }, to: { componentId: 'board', pinIndex: GND_INDEX, x: 0, y: 0 } },
      ];

  return {
    id: 'c1',
    boardId: 'uno',
    components: [led, resistor],
    wires,
    code: `
void setup() {
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
}
void loop() {}
`,
  };
};

describe('LED simulation', () => {
  it('dims when resistance is increased', () => {
    const runtimeA = createRuntime(makeCircuit('220').code);
    const runtimeB = createRuntime(makeCircuit('10K').code);

    const lowR = stepSimulation(runtimeA, 16, makeCircuit('220'), makeCircuit('220').wires || []);
    const highR = stepSimulation(runtimeB, 16, makeCircuit('10K'), makeCircuit('10K').wires || []);

    expect(lowR.ledBrightness['led-1']).toBeGreaterThan(0);
    expect(highR.ledBrightness['led-1']).toBeLessThan(lowR.ledBrightness['led-1']);
  });

  it('stays off when reverse-biased', () => {
    const c = makeCircuit('220', true);
    const runtime = createRuntime(c.code);
    const tick = stepSimulation(runtime, 16, c, c.wires || []);

    expect(tick.ledBrightness['led-1']).toBe(0);
  });
});
