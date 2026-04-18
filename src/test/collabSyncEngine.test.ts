import { describe, it, expect } from 'vitest';
import {
  CollaborationSyncEngine,
  TextOperation,
  coalesceSequentialPatches,
  patchEnvelopeFromLocal,
  reconcileContent,
  summarizePatch,
} from '@/services/collabSyncEngine';

describe('TextOperation', () => {
  it('builds and applies a mixed operation', () => {
    const base = 'hello world';
    const target = 'hello brave world!';

    const op = TextOperation.build(base, target);
    const result = op.apply(base);

    expect(result).toBe(target);
    expect(op.baseLength).toBe(base.length);
    expect(op.targetLength).toBe(target.length);
  });

  it('inverts operation correctly', () => {
    const base = 'abcdef';
    const target = 'abXYef!';

    const op = TextOperation.build(base, target);
    const inverse = op.invert(base);

    const rolledBack = inverse.apply(target);
    expect(rolledBack).toBe(base);
  });

  it('composes two operations', () => {
    const base = '0123456789';
    const once = '01ab3456789';
    const twice = '01ab3456Z89';

    const op1 = TextOperation.build(base, once);
    const op2 = TextOperation.build(once, twice);
    const composed = op1.compose(op2);

    expect(composed.apply(base)).toBe(twice);
  });

  it('transforms concurrent operations', () => {
    const base = 'robotics';
    const left = TextOperation.build(base, 'team-robotics');
    const right = TextOperation.build(base, 'robotics-lab');

    const [leftPrime, rightPrime] = left.transform(right, 'left');

    const leftThenRight = rightPrime.apply(left.apply(base));
    const rightThenLeft = leftPrime.apply(right.apply(base));

    expect(leftThenRight).toBe(rightThenLeft);
    expect(leftThenRight).toContain('team-');
    expect(leftThenRight).toContain('-lab');
  });

  it('transforms cursor positions through edits', () => {
    const base = 'const speed = 10;';
    const target = 'const maxSpeed = 100;';
    const op = TextOperation.build(base, target);

    const cursor = { index: 6, selectionEnd: 11 };
    const transformed = op.transformCursor(cursor);

    expect(transformed.index).toBeGreaterThanOrEqual(6);
    expect(transformed.selectionEnd).toBeGreaterThanOrEqual(transformed.index);
  });

  it('serializes and deserializes', () => {
    const op = TextOperation.build('abc', 'axbyc');
    const serialized = op.serialize();
    const hydrated = TextOperation.fromJSON(serialized);

    expect(hydrated.equals(op)).toBe(true);
  });

  it('summarizes patch stats', () => {
    const op = TextOperation.build('aaa', 'aBBBBa');
    const summary = summarizePatch(op);

    expect(summary).toContain('ins=');
    expect(summary).toContain('del=');
    expect(summary).toContain('churn=');
  });
});

describe('CollaborationSyncEngine', () => {
  it('creates and applies local patch through remote envelope', () => {
    const alice = new CollaborationSyncEngine();
    const bob = new CollaborationSyncEngine();

    alice.initializeFile('file-1', 'main.ts', 'let count = 0;\n');
    bob.initializeFile('file-1', 'main.ts', 'let count = 0;\n');

    const local = alice.createOutgoingPatch('file-1', 'let count = 1;\n');
    expect(local).not.toBeNull();

    const remote = patchEnvelopeFromLocal(local!, 'alice', 'Alice');
    const update = bob.materializeUpdate(remote);

    expect(update).not.toBeNull();
    expect(update?.content).toBe('let count = 1;\n');
    expect(update?.version).toBe(1);
  });

  it('rebases stale patch after remote change', () => {
    const alice = new CollaborationSyncEngine();
    const bob = new CollaborationSyncEngine();

    const base = 'function add(a, b) {\n  return a + b;\n}\n';
    alice.initializeFile('file-2', 'math.js', base);
    bob.initializeFile('file-2', 'math.js', base);

    const alicePatch = alice.createOutgoingPatch('file-2', 'function add(a, b) {\n  return a + b + 1;\n}\n');
    const bobPatch = bob.createOutgoingPatch('file-2', 'function sum(a, b) {\n  return a + b;\n}\n');

    const toBob = patchEnvelopeFromLocal(alicePatch!, 'alice', 'Alice');
    const toAlice = patchEnvelopeFromLocal(bobPatch!, 'bob', 'Bob');

    const bobApplied = bob.materializeUpdate(toBob);
    const aliceApplied = alice.materializeUpdate(toAlice);

    expect(bobApplied).not.toBeNull();
    expect(aliceApplied).not.toBeNull();
    expect(alice.getContent('file-2')).toBe(bob.getContent('file-2'));
  });

  it('coalesces sequential patches', () => {
    const engine = new CollaborationSyncEngine();
    engine.initializeFile('file-3', 'test.txt', 'abc');

    const p1 = engine.createOutgoingPatch('file-3', 'abcd');
    const p2 = engine.createOutgoingPatch('file-3', 'abcde');

    const merged = coalesceSequentialPatches([
      patchEnvelopeFromLocal(p1!, 'u', 'U'),
      patchEnvelopeFromLocal(p2!, 'u', 'U'),
    ]);

    expect(merged).toHaveLength(1);
  });

  it('reconciles diverged buffers', () => {
    const local = 'alpha\nbeta\ngamma\n';
    const remote = 'alpha\nbeta 2\ngamma\n';

    const result = reconcileContent(local, remote);
    expect(result.merged).toContain('beta');
    expect(result.localOp.baseLength).toBeGreaterThanOrEqual(0);
    expect(result.remoteOp.baseLength).toBeGreaterThanOrEqual(0);
  });
});
