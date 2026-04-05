export type InsertOp = { type: 'insert'; text: string };
export type DeleteOp = { type: 'delete'; count: number };
export type RetainOp = { type: 'retain'; count: number };

export type OperationComponent = InsertOp | DeleteOp | RetainOp;

export interface SerializedOperation {
  baseLength: number;
  targetLength: number;
  components: OperationComponent[];
}

export interface CursorPosition {
  index: number;
  selectionEnd?: number;
}

export interface FileVersionSnapshot {
  fileId: string;
  version: number;
  content: string;
  updatedBy: string;
  updatedAt: string;
}

export interface RemotePatchEnvelope {
  fileId: string;
  filePath: string;
  version: number;
  baseVersion: number;
  patch: SerializedOperation;
  checksum: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

export interface LocalPatchEnvelope {
  fileId: string;
  filePath: string;
  version: number;
  baseVersion: number;
  patch: SerializedOperation;
  checksum: string;
  updatedAt: string;
}

interface OperationValidationResult {
  valid: boolean;
  reason?: string;
}

const DEFAULT_HASH_SEED = 2166136261;

function assertNever(_: never): never {
  throw new Error('Unreachable branch encountered');
}

function isFiniteNonNegativeInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function hashString(input: string, seed = DEFAULT_HASH_SEED): string {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function normalizeComponent(component: OperationComponent): OperationComponent | null {
  switch (component.type) {
    case 'insert': {
      if (component.text.length === 0) return null;
      return component;
    }
    case 'delete': {
      if (component.count <= 0) return null;
      return component;
    }
    case 'retain': {
      if (component.count <= 0) return null;
      return component;
    }
    default:
      return assertNever(component);
  }
}

function cloneComponent(component: OperationComponent): OperationComponent {
  switch (component.type) {
    case 'insert':
      return { type: 'insert', text: component.text };
    case 'delete':
      return { type: 'delete', count: component.count };
    case 'retain':
      return { type: 'retain', count: component.count };
    default:
      return assertNever(component);
  }
}

function mergeAdjacent(components: OperationComponent[]): OperationComponent[] {
  const merged: OperationComponent[] = [];
  for (const raw of components) {
    const component = normalizeComponent(raw);
    if (!component) continue;

    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(cloneComponent(component));
      continue;
    }

    if (last.type === component.type) {
      if (component.type === 'insert' && last.type === 'insert') {
        last.text += component.text;
      } else if (component.type === 'delete' && last.type === 'delete') {
        last.count += component.count;
      } else if (component.type === 'retain' && last.type === 'retain') {
        last.count += component.count;
      }
      continue;
    }

    // Preserve canonical ordering in ambiguous spots by commuting insert before delete.
    if (last.type === 'delete' && component.type === 'insert') {
      merged[merged.length - 1] = cloneComponent(component);
      merged.push(last);
      continue;
    }

    merged.push(cloneComponent(component));
  }

  return merged;
}

function computeLengths(components: OperationComponent[]): { baseLength: number; targetLength: number } {
  let baseLength = 0;
  let targetLength = 0;

  for (const component of components) {
    if (component.type === 'retain') {
      baseLength += component.count;
      targetLength += component.count;
    } else if (component.type === 'insert') {
      targetLength += component.text.length;
    } else {
      baseLength += component.count;
    }
  }

  return { baseLength, targetLength };
}

function validateSerializedOperation(input: SerializedOperation): OperationValidationResult {
  if (!Array.isArray(input.components)) {
    return { valid: false, reason: 'components must be an array' };
  }

  const normalized = mergeAdjacent(input.components);
  const { baseLength, targetLength } = computeLengths(normalized);

  if (baseLength !== input.baseLength) {
    return { valid: false, reason: `baseLength mismatch (${input.baseLength} !== ${baseLength})` };
  }

  if (targetLength !== input.targetLength) {
    return { valid: false, reason: `targetLength mismatch (${input.targetLength} !== ${targetLength})` };
  }

  return { valid: true };
}

class ComponentCursor {
  private readonly components: OperationComponent[];

  private index = 0;

  private offset = 0;

  constructor(components: OperationComponent[]) {
    this.components = components.map((component) => cloneComponent(component));
  }

  peekType(): OperationComponent['type'] | null {
    const next = this.components[this.index];
    if (!next) return null;
    return next.type;
  }

  hasNext(): boolean {
    return this.index < this.components.length;
  }

  take(limit?: number): OperationComponent | null {
    const current = this.components[this.index];
    if (!current) return null;

    if (current.type === 'insert') {
      if (limit === undefined || limit >= current.text.length - this.offset) {
        this.index += 1;
        this.offset = 0;
        return { type: 'insert', text: current.text.slice(this.offset) };
      }

      const text = current.text.slice(this.offset, this.offset + limit);
      this.offset += limit;
      return { type: 'insert', text };
    }

    const available = current.count - this.offset;
    const count = limit === undefined ? available : Math.min(available, limit);
    const result: OperationComponent = current.type === 'retain'
      ? { type: 'retain', count }
      : { type: 'delete', count };

    if (count === available) {
      this.index += 1;
      this.offset = 0;
    } else {
      this.offset += count;
    }

    return result;
  }

  takeCount(limit?: number): { type: 'retain' | 'delete'; count: number } | null {
    const current = this.components[this.index];
    if (!current || current.type === 'insert') return null;

    const available = current.count - this.offset;
    const count = limit === undefined ? available : Math.min(available, limit);
    const result = { type: current.type, count };

    if (count === available) {
      this.index += 1;
      this.offset = 0;
    } else {
      this.offset += count;
    }

    return result;
  }

  takeInsert(limit?: number): InsertOp | null {
    const current = this.components[this.index];
    if (!current || current.type !== 'insert') return null;

    const available = current.text.length - this.offset;
    const count = limit === undefined ? available : Math.min(available, limit);
    const text = current.text.slice(this.offset, this.offset + count);

    if (count === available) {
      this.index += 1;
      this.offset = 0;
    } else {
      this.offset += count;
    }

    return { type: 'insert', text };
  }
}

export class TextOperation {
  private readonly components: OperationComponent[];

  readonly baseLength: number;

  readonly targetLength: number;

  constructor(components: OperationComponent[]) {
    this.components = mergeAdjacent(components);
    const lengths = computeLengths(this.components);
    this.baseLength = lengths.baseLength;
    this.targetLength = lengths.targetLength;
  }

  static empty(): TextOperation {
    return new TextOperation([]);
  }

  static retain(count: number): TextOperation {
    return new TextOperation([{ type: 'retain', count }]);
  }

  static insert(text: string): TextOperation {
    return new TextOperation([{ type: 'insert', text }]);
  }

  static delete(count: number): TextOperation {
    return new TextOperation([{ type: 'delete', count }]);
  }

  static fromJSON(input: SerializedOperation): TextOperation {
    const validation = validateSerializedOperation(input);
    if (!validation.valid) {
      throw new Error(`Invalid operation: ${validation.reason || 'unknown validation error'}`);
    }
    return new TextOperation(input.components);
  }

  static build(base: string, target: string): TextOperation {
    if (base === target) return new TextOperation([{ type: 'retain', count: base.length }]);

    const leading = longestCommonPrefix(base, target);
    const trailing = longestCommonSuffix(
      base.slice(leading),
      target.slice(leading),
    );

    const middleBase = base.slice(leading, base.length - trailing);
    const middleTarget = target.slice(leading, target.length - trailing);

    const components: OperationComponent[] = [];

    if (leading > 0) components.push({ type: 'retain', count: leading });

    const middleOps = buildMiddleOperation(middleBase, middleTarget);
    components.push(...middleOps);

    if (trailing > 0) components.push({ type: 'retain', count: trailing });

    return new TextOperation(components);
  }

  serialize(): SerializedOperation {
    return {
      baseLength: this.baseLength,
      targetLength: this.targetLength,
      components: this.components.map((component) => cloneComponent(component)),
    };
  }

  toString(): string {
    return this.components
      .map((component) => {
        if (component.type === 'insert') return `+${JSON.stringify(component.text)}`;
        if (component.type === 'delete') return `-${component.count}`;
        return `=${component.count}`;
      })
      .join(' ');
  }

  getComponents(): OperationComponent[] {
    return this.components.map((component) => cloneComponent(component));
  }

  apply(input: string): string {
    if (input.length !== this.baseLength) {
      throw new Error(`Cannot apply operation: expected base length ${this.baseLength}, got ${input.length}`);
    }

    let cursor = 0;
    let output = '';

    for (const component of this.components) {
      if (component.type === 'retain') {
        output += input.slice(cursor, cursor + component.count);
        cursor += component.count;
      } else if (component.type === 'delete') {
        cursor += component.count;
      } else {
        output += component.text;
      }
    }

    if (cursor !== input.length) {
      throw new Error(`Operation did not consume full input (${cursor}/${input.length})`);
    }

    return output;
  }

  invert(input: string): TextOperation {
    if (input.length !== this.baseLength) {
      throw new Error(`Cannot invert operation: expected input length ${this.baseLength}, got ${input.length}`);
    }

    const inverse: OperationComponent[] = [];
    let cursor = 0;

    for (const component of this.components) {
      if (component.type === 'retain') {
        inverse.push({ type: 'retain', count: component.count });
        cursor += component.count;
      } else if (component.type === 'delete') {
        const restored = input.slice(cursor, cursor + component.count);
        inverse.push({ type: 'insert', text: restored });
        cursor += component.count;
      } else {
        inverse.push({ type: 'delete', count: component.text.length });
      }
    }

    return new TextOperation(inverse);
  }

  compose(next: TextOperation): TextOperation {
    if (this.targetLength !== next.baseLength) {
      throw new Error(`Cannot compose operations: ${this.targetLength} !== ${next.baseLength}`);
    }

    const left = new ComponentCursor(this.components);
    const right = new ComponentCursor(next.components);
    const result: OperationComponent[] = [];

    while (left.hasNext() || right.hasNext()) {
      if (right.peekType() === 'insert') {
        const ins = right.takeInsert();
        if (ins) result.push(ins);
        continue;
      }

      if (left.peekType() === 'delete') {
        const del = left.takeCount();
        if (del) result.push(del);
        continue;
      }

      const leftComp = left.take();
      const rightComp = right.take();

      if (!leftComp && !rightComp) break;
      if (!leftComp || !rightComp) {
        throw new Error('Operation composition reached inconsistent state');
      }

      if (leftComp.type === 'retain' && rightComp.type === 'retain') {
        const count = Math.min(leftComp.count, rightComp.count);
        result.push({ type: 'retain', count });

        if (leftComp.count > count) {
          pushBack(left, { type: 'retain', count: leftComp.count - count });
        }
        if (rightComp.count > count) {
          pushBack(right, { type: 'retain', count: rightComp.count - count });
        }
      } else if (leftComp.type === 'insert' && rightComp.type === 'delete') {
        const overlap = Math.min(leftComp.text.length, rightComp.count);
        if (leftComp.text.length > overlap) {
          pushBack(left, { type: 'insert', text: leftComp.text.slice(overlap) });
        }
        if (rightComp.count > overlap) {
          pushBack(right, { type: 'delete', count: rightComp.count - overlap });
        }
      } else if (leftComp.type === 'insert' && rightComp.type === 'retain') {
        const count = Math.min(leftComp.text.length, rightComp.count);
        result.push({ type: 'insert', text: leftComp.text.slice(0, count) });

        if (leftComp.text.length > count) {
          pushBack(left, { type: 'insert', text: leftComp.text.slice(count) });
        }
        if (rightComp.count > count) {
          pushBack(right, { type: 'retain', count: rightComp.count - count });
        }
      } else if (leftComp.type === 'retain' && rightComp.type === 'delete') {
        const count = Math.min(leftComp.count, rightComp.count);
        result.push({ type: 'delete', count });

        if (leftComp.count > count) {
          pushBack(left, { type: 'retain', count: leftComp.count - count });
        }
        if (rightComp.count > count) {
          pushBack(right, { type: 'delete', count: rightComp.count - count });
        }
      } else {
        throw new Error(`Unexpected compose pair: ${leftComp.type} + ${rightComp.type}`);
      }
    }

    return new TextOperation(result);
  }

  transform(other: TextOperation, side: 'left' | 'right' = 'left'): [TextOperation, TextOperation] {
    if (this.baseLength !== other.baseLength) {
      throw new Error(`Cannot transform operations with different base lengths: ${this.baseLength} !== ${other.baseLength}`);
    }

    const leftCursor = new ComponentCursor(this.components);
    const rightCursor = new ComponentCursor(other.components);

    const leftPrime: OperationComponent[] = [];
    const rightPrime: OperationComponent[] = [];

    while (leftCursor.hasNext() || rightCursor.hasNext()) {
      const leftType = leftCursor.peekType();
      const rightType = rightCursor.peekType();

      if (leftType === 'insert' && (rightType !== 'insert' || side === 'left')) {
        const ins = leftCursor.takeInsert();
        if (!ins) throw new Error('Invalid left insert while transforming');
        leftPrime.push(ins);
        rightPrime.push({ type: 'retain', count: ins.text.length });
        continue;
      }

      if (rightType === 'insert') {
        const ins = rightCursor.takeInsert();
        if (!ins) throw new Error('Invalid right insert while transforming');
        leftPrime.push({ type: 'retain', count: ins.text.length });
        rightPrime.push(ins);
        continue;
      }

      const leftComp = leftCursor.takeCount();
      const rightComp = rightCursor.takeCount();

      if (!leftComp && !rightComp) break;

      if (!leftComp || !rightComp) {
        throw new Error('Transform reached inconsistent non-insert component state');
      }

      const count = Math.min(leftComp.count, rightComp.count);

      if (leftComp.type === 'delete' && rightComp.type === 'delete') {
        // Both delete same segment; skip output.
      } else if (leftComp.type === 'delete' && rightComp.type === 'retain') {
        leftPrime.push({ type: 'delete', count });
      } else if (leftComp.type === 'retain' && rightComp.type === 'delete') {
        rightPrime.push({ type: 'delete', count });
      } else {
        leftPrime.push({ type: 'retain', count });
        rightPrime.push({ type: 'retain', count });
      }

      if (leftComp.count > count) {
        pushBack(leftCursor, { type: leftComp.type, count: leftComp.count - count });
      }
      if (rightComp.count > count) {
        pushBack(rightCursor, { type: rightComp.type, count: rightComp.count - count });
      }
    }

    return [new TextOperation(leftPrime), new TextOperation(rightPrime)];
  }

  transformCursor(cursor: CursorPosition): CursorPosition {
    const originalAnchor = cursor.index;
    const originalFocus = cursor.selectionEnd ?? cursor.index;
    const transformedAnchor = this.transformIndex(originalAnchor);
    const transformedFocus = this.transformIndex(originalFocus);

    return {
      index: transformedAnchor,
      selectionEnd: transformedFocus,
    };
  }

  transformIndex(index: number): number {
    if (!isFiniteNonNegativeInteger(index)) {
      throw new Error('Cursor index must be a non-negative integer');
    }

    let oldPos = 0;
    let newPos = 0;

    for (const component of this.components) {
      if (component.type === 'retain') {
        if (index <= oldPos + component.count) {
          return newPos + (index - oldPos);
        }
        oldPos += component.count;
        newPos += component.count;
      } else if (component.type === 'insert') {
        newPos += component.text.length;
      } else {
        if (index <= oldPos + component.count) {
          return newPos;
        }
        oldPos += component.count;
      }
    }

    return newPos;
  }

  equals(other: TextOperation): boolean {
    if (this.baseLength !== other.baseLength || this.targetLength !== other.targetLength) {
      return false;
    }

    if (this.components.length !== other.components.length) return false;

    for (let i = 0; i < this.components.length; i += 1) {
      const a = this.components[i];
      const b = other.components[i];
      if (a.type !== b.type) return false;

      if (a.type === 'insert' && b.type === 'insert') {
        if (a.text !== b.text) return false;
      } else if (a.type !== 'insert' && b.type !== 'insert') {
        if (a.count !== b.count) return false;
      }
    }

    return true;
  }
}

function pushBack(cursor: ComponentCursor, component: OperationComponent): void {
  const c = cursor as unknown as { components: OperationComponent[]; index: number; offset: number };
  c.components.splice(c.index, 0, component);
  c.offset = 0;
}

function longestCommonPrefix(a: string, b: string): number {
  const min = Math.min(a.length, b.length);
  let i = 0;
  while (i < min && a.charCodeAt(i) === b.charCodeAt(i)) {
    i += 1;
  }
  return i;
}

function longestCommonSuffix(a: string, b: string): number {
  const min = Math.min(a.length, b.length);
  let i = 0;
  while (
    i < min &&
    a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)
  ) {
    i += 1;
  }
  return i;
}

interface DiffCell {
  cost: number;
  prev: 'diag' | 'up' | 'left' | null;
}

function buildMiddleOperation(source: string, target: string): OperationComponent[] {
  if (source.length === 0 && target.length === 0) return [];
  if (source.length === 0) return [{ type: 'insert', text: target }];
  if (target.length === 0) return [{ type: 'delete', count: source.length }];

  if (source.length * target.length <= 6400) {
    return charLevelDynamicDiff(source, target);
  }

  const sourceLines = splitIntoLines(source);
  const targetLines = splitIntoLines(target);

  if (sourceLines.length * targetLines.length <= 12000) {
    return lineAwareDiff(source, target, sourceLines, targetLines);
  }

  return heuristicChunkDiff(source, target);
}

function splitIntoLines(text: string): string[] {
  if (text.length === 0) return [''];
  const lines = text.split(/(\n)/);
  const result: string[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const line = lines[i] ?? '';
    const newline = lines[i + 1] ?? '';
    result.push(line + newline);
  }
  return result;
}

function charLevelDynamicDiff(source: string, target: string): OperationComponent[] {
  const m = source.length;
  const n = target.length;

  const matrix: DiffCell[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => ({ cost: 0, prev: null as DiffCell['prev'] })),
  );

  for (let i = 1; i <= m; i += 1) {
    matrix[i][0] = { cost: i, prev: 'up' };
  }
  for (let j = 1; j <= n; j += 1) {
    matrix[0][j] = { cost: j, prev: 'left' };
  }

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (source.charCodeAt(i - 1) === target.charCodeAt(j - 1)) {
        matrix[i][j] = { cost: matrix[i - 1][j - 1].cost, prev: 'diag' };
      } else {
        const del = matrix[i - 1][j].cost + 1;
        const ins = matrix[i][j - 1].cost + 1;
        if (del <= ins) {
          matrix[i][j] = { cost: del, prev: 'up' };
        } else {
          matrix[i][j] = { cost: ins, prev: 'left' };
        }
      }
    }
  }

  const reverse: OperationComponent[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    const cell = matrix[i][j];
    if (cell.prev === 'diag') {
      reverse.push({ type: 'retain', count: 1 });
      i -= 1;
      j -= 1;
    } else if (cell.prev === 'up') {
      reverse.push({ type: 'delete', count: 1 });
      i -= 1;
    } else if (cell.prev === 'left') {
      reverse.push({ type: 'insert', text: target[j - 1] });
      j -= 1;
    } else {
      break;
    }
  }

  reverse.reverse();
  return compactInserts(reverse);
}

function compactInserts(components: OperationComponent[]): OperationComponent[] {
  const output: OperationComponent[] = [];
  for (const component of components) {
    const last = output[output.length - 1];
    if (!last) {
      output.push(component);
      continue;
    }

    if (component.type === 'insert' && last.type === 'insert') {
      last.text += component.text;
    } else if (component.type === 'retain' && last.type === 'retain') {
      last.count += component.count;
    } else if (component.type === 'delete' && last.type === 'delete') {
      last.count += component.count;
    } else {
      output.push(component);
    }
  }
  return output;
}

function lineAwareDiff(
  source: string,
  target: string,
  sourceLines: string[],
  targetLines: string[],
): OperationComponent[] {
  const sourceHashes = sourceLines.map((line) => hashString(line));
  const targetHashes = targetLines.map((line) => hashString(line));

  const lcs = longestCommonSubsequence(sourceHashes, targetHashes);
  if (lcs.length === 0) {
    return [{ type: 'delete', count: source.length }, { type: 'insert', text: target }];
  }

  let srcIdx = 0;
  let tgtIdx = 0;
  const result: OperationComponent[] = [];

  for (const match of lcs) {
    const { sourceIndex, targetIndex } = match;

    const sourceSegment = sourceLines.slice(srcIdx, sourceIndex).join('');
    const targetSegment = targetLines.slice(tgtIdx, targetIndex).join('');

    if (sourceSegment.length > 0 || targetSegment.length > 0) {
      result.push(...buildMiddleOperation(sourceSegment, targetSegment));
    }

    const shared = sourceLines[sourceIndex] ?? '';
    if (shared.length > 0) {
      result.push({ type: 'retain', count: shared.length });
    }

    srcIdx = sourceIndex + 1;
    tgtIdx = targetIndex + 1;
  }

  const finalSource = sourceLines.slice(srcIdx).join('');
  const finalTarget = targetLines.slice(tgtIdx).join('');
  if (finalSource.length > 0 || finalTarget.length > 0) {
    result.push(...buildMiddleOperation(finalSource, finalTarget));
  }

  return compactInserts(result);
}

function heuristicChunkDiff(source: string, target: string): OperationComponent[] {
  const window = 64;
  let i = 0;
  let j = 0;
  const result: OperationComponent[] = [];

  while (i < source.length && j < target.length) {
    if (source.charCodeAt(i) === target.charCodeAt(j)) {
      let retainCount = 0;
      while (
        i + retainCount < source.length &&
        j + retainCount < target.length &&
        source.charCodeAt(i + retainCount) === target.charCodeAt(j + retainCount)
      ) {
        retainCount += 1;
      }
      result.push({ type: 'retain', count: retainCount });
      i += retainCount;
      j += retainCount;
      continue;
    }

    const sourceWindow = source.slice(i, i + window);
    const targetWindow = target.slice(j, j + window);

    const inSource = targetWindow.length > 0 ? sourceWindow.indexOf(targetWindow[0]) : -1;
    const inTarget = sourceWindow.length > 0 ? targetWindow.indexOf(sourceWindow[0]) : -1;

    if (inSource >= 0 && inSource < window / 2) {
      result.push({ type: 'delete', count: Math.max(1, inSource) });
      i += Math.max(1, inSource);
      continue;
    }

    if (inTarget >= 0 && inTarget < window / 2) {
      result.push({ type: 'insert', text: target.slice(j, j + Math.max(1, inTarget)) });
      j += Math.max(1, inTarget);
      continue;
    }

    result.push({ type: 'delete', count: 1 });
    result.push({ type: 'insert', text: target[j] });
    i += 1;
    j += 1;
  }

  if (i < source.length) {
    result.push({ type: 'delete', count: source.length - i });
  }
  if (j < target.length) {
    result.push({ type: 'insert', text: target.slice(j) });
  }

  return compactInserts(result);
}

interface LcsMatch {
  sourceIndex: number;
  targetIndex: number;
}

function longestCommonSubsequence(source: string[], target: string[]): LcsMatch[] {
  const m = source.length;
  const n = target.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (source[i] === target[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const matches: LcsMatch[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (source[i] === target[j]) {
      matches.push({ sourceIndex: i, targetIndex: j });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return matches;
}

export interface VersionChainEntry {
  version: number;
  op: TextOperation;
  authorId: string;
  timestamp: string;
  checksum: string;
}

export interface PatchConflict {
  reason: string;
  localVersion: number;
  incomingBaseVersion: number;
}

export interface PatchApplyResult {
  accepted: boolean;
  conflict?: PatchConflict;
  content: string;
  version: number;
  transformedPatch?: TextOperation;
}

export class CollaborativeFileState {
  readonly fileId: string;

  private version = 0;

  private content = '';

  private checksum = hashString('');

  private readonly chain: VersionChainEntry[] = [];

  constructor(fileId: string, initialContent: string = '') {
    this.fileId = fileId;
    this.content = initialContent;
    this.checksum = hashString(initialContent);
  }

  getVersion(): number {
    return this.version;
  }

  getContent(): string {
    return this.content;
  }

  getChecksum(): string {
    return this.checksum;
  }

  getHistory(): VersionChainEntry[] {
    return this.chain.map((entry) => ({
      ...entry,
      op: new TextOperation(entry.op.getComponents()),
    }));
  }

  createLocalPatch(filePath: string, nextContent: string): LocalPatchEnvelope | null {
    if (nextContent === this.content) return null;

    const op = TextOperation.build(this.content, nextContent);
    const patch: LocalPatchEnvelope = {
      fileId: this.fileId,
      filePath,
      version: this.version + 1,
      baseVersion: this.version,
      patch: op.serialize(),
      checksum: hashString(nextContent),
      updatedAt: new Date().toISOString(),
    };

    this.acceptLocalOperation(op, patch.updatedAt);

    return patch;
  }

  applyRemotePatch(patch: RemotePatchEnvelope): PatchApplyResult {
    if (patch.fileId !== this.fileId) {
      return {
        accepted: false,
        conflict: {
          reason: `Patch file mismatch (${patch.fileId} !== ${this.fileId})`,
          localVersion: this.version,
          incomingBaseVersion: patch.baseVersion,
        },
        content: this.content,
        version: this.version,
      };
    }

    const validation = validateSerializedOperation(patch.patch);
    if (!validation.valid) {
      return {
        accepted: false,
        conflict: {
          reason: validation.reason || 'invalid operation payload',
          localVersion: this.version,
          incomingBaseVersion: patch.baseVersion,
        },
        content: this.content,
        version: this.version,
      };
    }

    let incoming = TextOperation.fromJSON(patch.patch);

    if (patch.baseVersion > this.version) {
      return {
        accepted: false,
        conflict: {
          reason: 'Incoming patch references a future base version',
          localVersion: this.version,
          incomingBaseVersion: patch.baseVersion,
        },
        content: this.content,
        version: this.version,
      };
    }

    if (patch.baseVersion < this.version) {
      for (const entry of this.chain) {
        if (entry.version <= patch.baseVersion) continue;
        const [, transformedIncoming] = entry.op.transform(incoming, 'right');
        incoming = transformedIncoming;
      }
    }

    let nextContent: string;
    try {
      nextContent = incoming.apply(this.content);
    } catch (error) {
      return {
        accepted: false,
        conflict: {
          reason: `Patch failed to apply: ${(error as Error).message}`,
          localVersion: this.version,
          incomingBaseVersion: patch.baseVersion,
        },
        content: this.content,
        version: this.version,
      };
    }

    this.version += 1;
    this.content = nextContent;
    this.checksum = hashString(this.content);
    this.chain.push({
      version: this.version,
      op: incoming,
      authorId: patch.updatedBy,
      timestamp: patch.updatedAt,
      checksum: this.checksum,
    });

    return {
      accepted: true,
      content: this.content,
      version: this.version,
      transformedPatch: incoming,
    };
  }

  private acceptLocalOperation(op: TextOperation, timestamp: string): void {
    const nextContent = op.apply(this.content);
    this.version += 1;
    this.content = nextContent;
    this.checksum = hashString(nextContent);
    this.chain.push({
      version: this.version,
      op,
      authorId: 'local',
      timestamp,
      checksum: this.checksum,
    });
  }

  replaceFromSnapshot(snapshot: FileVersionSnapshot): void {
    if (snapshot.fileId !== this.fileId) {
      throw new Error(`Snapshot file mismatch (${snapshot.fileId} !== ${this.fileId})`);
    }

    this.version = snapshot.version;
    this.content = snapshot.content;
    this.checksum = hashString(snapshot.content);
    this.chain.length = 0;
  }

  toSnapshot(updatedBy: string): FileVersionSnapshot {
    return {
      fileId: this.fileId,
      version: this.version,
      content: this.content,
      updatedBy,
      updatedAt: new Date().toISOString(),
    };
  }
}

export interface FileTrackerState {
  fileId: string;
  filePath: string;
  version: number;
  checksum: string;
}

export interface CollabDocumentUpdate {
  fileId: string;
  filePath: string;
  content: string;
  version: number;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

export class CollaborationSyncEngine {
  private readonly files = new Map<string, CollaborativeFileState>();

  private readonly pathByFileId = new Map<string, string>();

  initializeFile(fileId: string, filePath: string, content: string): void {
    this.files.set(fileId, new CollaborativeFileState(fileId, content));
    this.pathByFileId.set(fileId, filePath);
  }

  hasFile(fileId: string): boolean {
    return this.files.has(fileId);
  }

  updateFilePath(fileId: string, filePath: string): void {
    this.pathByFileId.set(fileId, filePath);
  }

  getFileState(fileId: string): FileTrackerState | null {
    const state = this.files.get(fileId);
    if (!state) return null;

    return {
      fileId,
      filePath: this.pathByFileId.get(fileId) || fileId,
      version: state.getVersion(),
      checksum: state.getChecksum(),
    };
  }

  getContent(fileId: string): string | null {
    const state = this.files.get(fileId);
    return state ? state.getContent() : null;
  }

  createOutgoingPatch(
    fileId: string,
    nextContent: string,
  ): LocalPatchEnvelope | null {
    const state = this.files.get(fileId);
    if (!state) {
      throw new Error(`Unknown file: ${fileId}`);
    }

    const filePath = this.pathByFileId.get(fileId) || fileId;
    return state.createLocalPatch(filePath, nextContent);
  }

  applyIncomingPatch(patch: RemotePatchEnvelope): PatchApplyResult {
    const state = this.files.get(patch.fileId);
    if (!state) {
      this.initializeFile(patch.fileId, patch.filePath, '');
      const created = this.files.get(patch.fileId);
      if (!created) {
        throw new Error('Failed to initialize incoming file state');
      }
      return created.applyRemotePatch(patch);
    }

    return state.applyRemotePatch(patch);
  }

  materializeUpdate(patch: RemotePatchEnvelope, authorNameFallback = 'Collaborator'): CollabDocumentUpdate | null {
    const result = this.applyIncomingPatch(patch);
    if (!result.accepted) return null;

    return {
      fileId: patch.fileId,
      filePath: patch.filePath,
      content: result.content,
      version: result.version,
      updatedBy: patch.updatedBy,
      updatedByName: patch.updatedByName || authorNameFallback,
      updatedAt: patch.updatedAt,
    };
  }

  replaceFileSnapshot(snapshot: FileVersionSnapshot): void {
    const state = this.files.get(snapshot.fileId) || new CollaborativeFileState(snapshot.fileId, '');
    state.replaceFromSnapshot(snapshot);
    this.files.set(snapshot.fileId, state);
  }

  exportSnapshots(updatedBy: string): FileVersionSnapshot[] {
    return Array.from(this.files.values()).map((state) => state.toSnapshot(updatedBy));
  }

  reset(): void {
    this.files.clear();
    this.pathByFileId.clear();
  }
}

export function isRemotePatchEnvelope(payload: unknown): payload is RemotePatchEnvelope {
  if (!payload || typeof payload !== 'object') return false;

  const maybe = payload as Partial<RemotePatchEnvelope>;

  if (typeof maybe.fileId !== 'string') return false;
  if (typeof maybe.filePath !== 'string') return false;
  if (!isFiniteNonNegativeInteger(maybe.version ?? NaN)) return false;
  if (!isFiniteNonNegativeInteger(maybe.baseVersion ?? NaN)) return false;
  if (typeof maybe.updatedBy !== 'string') return false;
  if (typeof maybe.updatedByName !== 'string') return false;
  if (typeof maybe.updatedAt !== 'string') return false;
  if (typeof maybe.checksum !== 'string') return false;
  if (!maybe.patch) return false;

  const patch = maybe.patch as SerializedOperation;
  if (!isFiniteNonNegativeInteger(patch.baseLength)) return false;
  if (!isFiniteNonNegativeInteger(patch.targetLength)) return false;
  if (!Array.isArray(patch.components)) return false;

  for (const component of patch.components) {
    if (!component || typeof component !== 'object') return false;
    const kind = (component as OperationComponent).type;

    if (kind === 'insert') {
      if (typeof (component as InsertOp).text !== 'string') return false;
    } else if (kind === 'delete' || kind === 'retain') {
      if (!isFiniteNonNegativeInteger((component as DeleteOp | RetainOp).count)) return false;
    } else {
      return false;
    }
  }

  return true;
}

export function patchEnvelopeFromLocal(
  local: LocalPatchEnvelope,
  updatedBy: string,
  updatedByName: string,
): RemotePatchEnvelope {
  return {
    fileId: local.fileId,
    filePath: local.filePath,
    version: local.version,
    baseVersion: local.baseVersion,
    patch: local.patch,
    checksum: local.checksum,
    updatedBy,
    updatedByName,
    updatedAt: local.updatedAt,
  };
}

export function reconcileContent(
  localContent: string,
  remoteContent: string,
): { merged: string; localOp: TextOperation; remoteOp: TextOperation } {
  if (localContent === remoteContent) {
    const noop = TextOperation.retain(localContent.length);
    return { merged: localContent, localOp: noop, remoteOp: noop };
  }

  const base = longestCommonAnchor(localContent, remoteContent);
  const localOp = TextOperation.build(base, localContent);
  const remoteOp = TextOperation.build(base, remoteContent);

  const [localPrime, remotePrime] = localOp.transform(remoteOp, 'left');
  const merged = remotePrime.apply(localOp.apply(base));

  return {
    merged,
    localOp: localPrime,
    remoteOp: remotePrime,
  };
}

function longestCommonAnchor(a: string, b: string): string {
  if (!a || !b) return '';

  const prefix = longestCommonPrefix(a, b);
  if (prefix >= 32) {
    return a.slice(0, prefix);
  }

  const suffix = longestCommonSuffix(a, b);
  if (suffix >= 32) {
    return a.slice(a.length - suffix);
  }

  const chunksA = findStableChunks(a, 24);
  const chunksB = new Set(findStableChunks(b, 24));

  for (const chunk of chunksA) {
    if (chunksB.has(chunk)) {
      return chunk;
    }
  }

  return '';
}

function findStableChunks(input: string, size: number): string[] {
  const result: string[] = [];
  if (input.length < size) return result;

  for (let i = 0; i <= input.length - size; i += Math.max(1, Math.floor(size / 2))) {
    const chunk = input.slice(i, i + size);
    const entropy = estimateEntropy(chunk);
    if (entropy > 2.2) {
      result.push(chunk);
    }
  }

  return result;
}

function estimateEntropy(input: string): number {
  if (input.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const ch of input) {
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / input.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function compareOperations(a: TextOperation, b: TextOperation): number {
  if (a.baseLength !== b.baseLength) return a.baseLength - b.baseLength;
  if (a.targetLength !== b.targetLength) return a.targetLength - b.targetLength;

  const aComponents = a.getComponents();
  const bComponents = b.getComponents();
  const len = Math.min(aComponents.length, bComponents.length);

  for (let i = 0; i < len; i += 1) {
    const left = aComponents[i];
    const right = bComponents[i];
    if (left.type !== right.type) {
      return left.type < right.type ? -1 : 1;
    }

    if (left.type === 'insert' && right.type === 'insert') {
      if (left.text !== right.text) return left.text < right.text ? -1 : 1;
    } else if (left.type !== 'insert' && right.type !== 'insert') {
      if (left.count !== right.count) return left.count - right.count;
    }
  }

  return aComponents.length - bComponents.length;
}

export function squashOperations(operations: TextOperation[]): TextOperation {
  if (operations.length === 0) return TextOperation.empty();
  if (operations.length === 1) return operations[0];

  let current = operations[0];
  for (let i = 1; i < operations.length; i += 1) {
    current = current.compose(operations[i]);
  }
  return current;
}

export function pruneHistory(
  history: VersionChainEntry[],
  maxEntries = 100,
): VersionChainEntry[] {
  if (history.length <= maxEntries) return history;

  const keepTail = Math.floor(maxEntries * 0.7);
  const keepHead = maxEntries - keepTail;

  const head = history.slice(0, keepHead);
  const tail = history.slice(history.length - keepTail);

  return [...head, ...tail];
}

export function coalesceSequentialPatches(
  patches: RemotePatchEnvelope[],
): RemotePatchEnvelope[] {
  if (patches.length <= 1) return patches;

  const sorted = [...patches].sort((a, b) => {
    if (a.fileId !== b.fileId) return a.fileId < b.fileId ? -1 : 1;
    if (a.baseVersion !== b.baseVersion) return a.baseVersion - b.baseVersion;
    return a.version - b.version;
  });

  const result: RemotePatchEnvelope[] = [];

  for (const patch of sorted) {
    const prev = result[result.length - 1];
    if (
      prev &&
      prev.fileId === patch.fileId &&
      prev.version === patch.baseVersion
    ) {
      const composed = TextOperation.fromJSON(prev.patch).compose(TextOperation.fromJSON(patch.patch));
      const merged: RemotePatchEnvelope = {
        ...patch,
        baseVersion: prev.baseVersion,
        patch: composed.serialize(),
      };
      result[result.length - 1] = merged;
    } else {
      result.push(patch);
    }
  }

  return result;
}

export function buildPatchStats(operation: TextOperation): {
  insertedChars: number;
  deletedChars: number;
  retainedChars: number;
  componentCount: number;
  churn: number;
} {
  let insertedChars = 0;
  let deletedChars = 0;
  let retainedChars = 0;

  const components = operation.getComponents();
  for (const component of components) {
    if (component.type === 'insert') insertedChars += component.text.length;
    if (component.type === 'delete') deletedChars += component.count;
    if (component.type === 'retain') retainedChars += component.count;
  }

  const churnBase = Math.max(1, retainedChars + deletedChars);
  const churn = (insertedChars + deletedChars) / churnBase;

  return {
    insertedChars,
    deletedChars,
    retainedChars,
    componentCount: components.length,
    churn,
  };
}

export function summarizePatch(operation: TextOperation): string {
  const stats = buildPatchStats(operation);
  return `ins=${stats.insertedChars}, del=${stats.deletedChars}, keep=${stats.retainedChars}, churn=${stats.churn.toFixed(2)}`;
}

