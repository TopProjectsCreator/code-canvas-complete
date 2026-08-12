import { describe, expect, it, beforeEach } from 'vitest';
import { useCADStore } from '@/components/cad/store';

beforeEach(() => {
  useCADStore.getState().loadDoc(JSON.parse(JSON.stringify(useCADStore.getState().doc)), null);
});

describe('CAD store dirty tracking', () => {
  it('marks the document dirty when a body is added', () => {
    const store = useCADStore.getState();
    expect(store.dirty).toBe(false);
    store.addBody({
      id: 'body_test',
      name: 'Test',
      features: [],
      appearance: { color: '#fff', opacity: 1, roughness: 0.5, metalness: 0.3, visible: true, transparency: 0 },
    });
    expect(useCADStore.getState().dirty).toBe(true);
  });

  it('marks the document dirty when a transform is updated', () => {
    const store = useCADStore.getState();
    store.updateTransform(store.doc.scene[0].id, { position: [1, 2, 3] });
    expect(useCADStore.getState().dirty).toBe(true);
  });

  it('keeps the document dirty after undo and redo', () => {
    const store = useCADStore.getState();
    const nodeId = store.doc.scene[0].id;
    store.updateTransform(nodeId, { position: [1, 2, 3] });
    useCADStore.getState().undo();
    expect(useCADStore.getState().dirty).toBe(true);
    useCADStore.getState().redo();
    expect(useCADStore.getState().dirty).toBe(true);
  });

  it('marks the document dirty for sketch edits', () => {
    const store = useCADStore.getState();
    store.beginSketch({ type: 'standard', plane: 'xy' });
    const sketchId = useCADStore.getState().activeSketch!;
    useCADStore.getState().addSketchEntity(sketchId, {
      id: 'entity_1',
      type: 'line',
      start: [0, 0, 0],
      end: [10, 10, 0],
      constraints: [],
    } as never);
    expect(useCADStore.getState().dirty).toBe(true);
  });

  it('clears dirty only when markClean is called', () => {
    const store = useCADStore.getState();
    store.addBody({
      id: 'body_test2',
      name: 'Test 2',
      features: [],
      appearance: { color: '#fff', opacity: 1, roughness: 0.5, metalness: 0.3, visible: true, transparency: 0 },
    });
    expect(useCADStore.getState().dirty).toBe(true);
    useCADStore.getState().markClean();
    expect(useCADStore.getState().dirty).toBe(false);
  });
});
