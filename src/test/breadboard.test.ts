import { describe, it, expect } from 'vitest';
import { COMPONENT_TEMPLATES, COMPONENT_LABELS } from '@/components/arduino/breadboard/componentTemplates';
import { arduinoBoards, getArduinoTemplateFiles } from '@/data/arduinoTemplates';

// jsdom does not implement canvas; tests that mount the visualizer may access
// a canvas element. Provide a dummy implementation so errors are avoided.
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = function (_: string) {
    const noOp = () => {};
    const dummyContext: Partial<CanvasRenderingContext2D> = {
      clearRect: noOp,
      beginPath: noOp,
      moveTo: noOp,
      lineTo: noOp,
      stroke: noOp,
      fill: noOp,
      arc: noOp,
      rect: noOp,
      fillRect: noOp,
      strokeRect: noOp,
      setLineDash: noOp,
      fillText: noOp,
      strokeText: noOp,
      createLinearGradient: () => {
        return { addColorStop: noOp } as unknown as CanvasGradient;
      },
      createRadialGradient: () => {
        return { addColorStop: noOp } as unknown as CanvasGradient;
      },
      // fallback: any other property returns noop
    };
    return new Proxy(dummyContext, {
      get(target, prop) {
        if (prop in target) return (target as any)[prop];
        return noOp;
      },
    }) as CanvasRenderingContext2D;
  };
});

describe('breadboard utilities', () => {
  it('includes expanded component library with 50+ additions', () => {
    expect(COMPONENT_TEMPLATES).toHaveProperty('diode');
    expect(COMPONENT_TEMPLATES).toHaveProperty('transistor_npn');
    expect(COMPONENT_TEMPLATES).toHaveProperty('rgb_led');
    expect(COMPONENT_TEMPLATES).toHaveProperty('ic');
    expect(COMPONENT_TEMPLATES).toHaveProperty('mpu6050');
    expect(COMPONENT_TEMPLATES).toHaveProperty('lora_module');
    expect(COMPONENT_TEMPLATES).toHaveProperty('boost_converter');
    expect(Object.keys(COMPONENT_TEMPLATES).length).toBeGreaterThanOrEqual(80);
    // labels should be human friendly
    expect(COMPONENT_LABELS.diode).toBe('Diode');
    expect(COMPONENT_LABELS.transistor_npn).toMatch(/Transistor/);
    expect(COMPONENT_LABELS.mpu6050).toMatch(/IMU/);
  });



  it('contains a broader board catalog for deployment planning', () => {
    expect(Object.keys(arduinoBoards).length).toBeGreaterThanOrEqual(15);
    expect(arduinoBoards.nano_33_iot).toBeDefined();
    expect(arduinoBoards.giga_r1?.wifi).toBe(true);
    expect(arduinoBoards.leonardo?.cpu).toMatch(/ATmega32u4/);
  });

  it('arduino template files include an empty wires array', () => {
    const files = getArduinoTemplateFiles('uno');
    const findFile = (nodes: any[]): any | null => {
      for (const node of nodes) {
        if (node.name === 'circuit.json') return node;
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    const circuitFile = findFile(files);
    expect(circuitFile).toBeDefined();
    if (circuitFile) {
      const parsed = JSON.parse(circuitFile.content);
      expect(parsed.wires).toBeDefined();
      expect(Array.isArray(parsed.wires)).toBe(true);
      expect(parsed.wires.length).toBe(0);
    }
  });
});

// basic interaction test verifying component search filtering
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { BreadboardVisualizer } from '@/components/arduino/BreadboardVisualizer';
import { vi } from 'vitest';

describe('BreadboardVisualizer UI', () => {
  it('filters component buttons when typing in search box', () => {
    const circuit = { id: 'c', boardId: 'uno', components: [], connections: [], wires: [], code: '' };
    const onCircuitChange = vi.fn();

    const { getByPlaceholderText, queryByText } = render(
      React.createElement(BreadboardVisualizer, { circuit, onCircuitChange })
    );
    const input = getByPlaceholderText('Search components...') as HTMLInputElement;
    // resistor should initially be visible
    expect(queryByText('Resistor')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'transistor' } });
    expect(queryByText('Resistor')).not.toBeInTheDocument();
    expect(queryByText('NPN Transistor')).toBeInTheDocument();
  });
});
