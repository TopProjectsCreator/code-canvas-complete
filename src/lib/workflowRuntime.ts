export type WorkflowStepStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'blocked'
  | 'canceled';

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  command: string;
  needs: string[];
  if?: string;
  retry: number;
  continueOnError: boolean;
  timeoutMs?: number;
  shell?: string;
  cwd?: string;
  env: Record<string, string>;
}

export interface WorkflowRunContext {
  workflowId?: string;
  workflowName?: string;
  vars?: Record<string, string | number | boolean | null | undefined>;
}

export interface StepExecutionRequest {
  step: WorkflowStepDefinition;
  attempt: number;
  context: {
    vars: Record<string, string>;
    stepResults: Record<string, WorkflowStepRunResult>;
  };
}

export interface StepExecutionResult {
  output: string[];
  error: string | null;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStepRunResult {
  stepId: string;
  status: Exclude<WorkflowStepStatus, 'pending' | 'ready' | 'running'>;
  attemptCount: number;
  startedAt: string;
  finishedAt: string;
  output: string[];
  error: string | null;
  metadata?: Record<string, unknown>;
}

export interface WorkflowRunResult {
  workflowId?: string;
  workflowName?: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'failed' | 'canceled';
  steps: Record<string, WorkflowStepRunResult>;
  orderedStepIds: string[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    blocked: number;
    canceled: number;
  };
  output: string[];
}

export interface WorkflowEventBase {
  timestamp: string;
  stepId?: string;
  message: string;
}

export interface WorkflowEventMap {
  runStarted: WorkflowEventBase & { orderedStepIds: string[] };
  stepReady: WorkflowEventBase;
  stepStarted: WorkflowEventBase & { attempt: number };
  stepRetry: WorkflowEventBase & { attempt: number; reason: string };
  stepSucceeded: WorkflowEventBase & { attempt: number; outputLines: number };
  stepFailed: WorkflowEventBase & { attempt: number; reason: string };
  stepSkipped: WorkflowEventBase & { reason: string };
  stepBlocked: WorkflowEventBase & { reason: string };
  stepCanceled: WorkflowEventBase;
  runFinished: WorkflowEventBase & { status: WorkflowRunResult['status'] };
}

export interface WorkflowRunnerHooks {
  onRunStarted?: (event: WorkflowEventMap['runStarted']) => void;
  onStepReady?: (event: WorkflowEventMap['stepReady']) => void;
  onStepStarted?: (event: WorkflowEventMap['stepStarted']) => void;
  onStepRetry?: (event: WorkflowEventMap['stepRetry']) => void;
  onStepSucceeded?: (event: WorkflowEventMap['stepSucceeded']) => void;
  onStepFailed?: (event: WorkflowEventMap['stepFailed']) => void;
  onStepSkipped?: (event: WorkflowEventMap['stepSkipped']) => void;
  onStepBlocked?: (event: WorkflowEventMap['stepBlocked']) => void;
  onStepCanceled?: (event: WorkflowEventMap['stepCanceled']) => void;
  onRunFinished?: (event: WorkflowEventMap['runFinished']) => void;
}

export interface WorkflowRunOptions extends WorkflowRunnerHooks {
  maxParallel?: number;
  failFast?: boolean;
  signal?: AbortSignal;
}

export interface WorkflowRunnerAdapter {
  executeStep: (request: StepExecutionRequest) => Promise<StepExecutionResult>;
}

export class WorkflowDslError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowDslError';
  }
}

const DEFAULT_RETRY = 0;
const DEFAULT_FAIL_FAST = true;
const DEFAULT_MAX_PARALLEL = 1;
const RESERVED_ENV_PREFIX = 'RUNNER_';

interface InternalStepState {
  def: WorkflowStepDefinition;
  status: WorkflowStepStatus;
  attempts: number;
  startedAt?: string;
  finishedAt?: string;
  output: string[];
  error: string | null;
  metadata?: Record<string, unknown>;
}

const nowIso = () => new Date().toISOString();

const normalizeVar = (value: string | number | boolean | null | undefined): string => {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
};

export const normalizeWorkflowCommand = (command: string): string => {
  return command
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
};

const parseBool = (raw: string): boolean => {
  const value = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  throw new WorkflowDslError(`Invalid boolean value: ${raw}`);
};

const parseInteger = (raw: string, field: string, min = 0): number => {
  if (!/^\d+$/.test(raw.trim())) {
    throw new WorkflowDslError(`Invalid ${field} value: ${raw}`);
  }
  const value = Number.parseInt(raw, 10);
  if (value < min) {
    throw new WorkflowDslError(`${field} must be >= ${min}, got ${value}`);
  }
  return value;
};

const stripQuotes = (value: string): string => {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1);
  }
  return value;
};

const parseNeeds = (value: string): string[] => {
  if (!value.trim()) return [];
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
};

const tokenizeMeta = (input: string): Array<{ key: string; value: string }> => {
  const tokens: Array<{ key: string; value: string }> = [];
  const matcher = /([\w.]+)\s*=\s*("[^"]*"|'[^']*'|[^|]+)/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(input)) !== null) {
    tokens.push({ key: match[1], value: stripQuotes(match[2].trim()) });
  }

  const reconstructed = tokens.map(({ key, value }) => `${key}=${value}`).join('|');
  if (!tokens.length && input.trim()) {
    throw new WorkflowDslError(`Could not parse step metadata: ${input}`);
  }

  if (tokens.length > 0 && reconstructed.length === 0) {
    throw new WorkflowDslError(`Invalid step metadata: ${input}`);
  }

  return tokens;
};

const defaultStepFromCommand = (command: string): WorkflowStepDefinition => ({
  id: 'step_1',
  name: 'Run command',
  command: command.trim(),
  needs: [],
  retry: DEFAULT_RETRY,
  continueOnError: false,
  env: {},
});

const tokenizeStepLine = (line: string): { rawName: string; command: string; meta: string[] } => {
  const parts: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const prev = i > 0 ? line[i - 1] : '';

    if (char === "'" && prev !== '\\' && !inDouble) {
      inSingle = !inSingle;
    } else if (char === '"' && prev !== '\\' && !inSingle) {
      inDouble = !inDouble;
    }

    if (char === '|' && !inSingle && !inDouble) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());

  const first = parts[0] ?? '';
  const colonIndex = first.indexOf(':');
  if (colonIndex <= 0) {
    return {
      rawName: '',
      command: line.trim(),
      meta: [],
    };
  }

  const rawName = first.slice(0, colonIndex).trim();
  const command = first.slice(colonIndex + 1).trim();
  return {
    rawName,
    command,
    meta: parts.slice(1),
  };
};

const parseStepMeta = (fragments: string[]): Partial<WorkflowStepDefinition> => {
  const config: Partial<WorkflowStepDefinition> = { env: {} };

  for (const fragment of fragments) {
    const tokens = tokenizeMeta(fragment);

    for (const token of tokens) {
      const key = token.key.toLowerCase();
      const value = token.value;

      if (key === 'needs' || key === 'depends') {
        config.needs = parseNeeds(value);
        continue;
      }

      if (key === 'if' || key === 'when') {
        config.if = value;
        continue;
      }

      if (key === 'retry' || key === 'retries') {
        config.retry = parseInteger(value, 'retry', 0);
        continue;
      }

      if (key === 'continueonerror' || key === 'allowfailure') {
        config.continueOnError = parseBool(value);
        continue;
      }

      if (key === 'timeout' || key === 'timeoutms') {
        config.timeoutMs = parseInteger(value, 'timeout', 1);
        continue;
      }

      if (key === 'shell') {
        config.shell = value;
        continue;
      }

      if (key === 'cwd') {
        config.cwd = value;
        continue;
      }

      if (key.startsWith('env.')) {
        const envKey = key.slice(4).toUpperCase();
        if (!envKey) {
          throw new WorkflowDslError('env key cannot be empty');
        }
        if (envKey.startsWith(RESERVED_ENV_PREFIX)) {
          throw new WorkflowDslError(`env key ${envKey} is reserved`);
        }
        config.env = {
          ...config.env,
          [envKey]: value,
        };
        continue;
      }

      throw new WorkflowDslError(`Unknown step metadata key: ${token.key}`);
    }
  }

  return config;
};

const validateStepId = (id: string): string => {
  if (!id.trim()) {
    throw new WorkflowDslError('Step id cannot be empty');
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
    throw new WorkflowDslError(`Invalid step id: ${id}`);
  }
  return id;
};

const validateGraph = (steps: WorkflowStepDefinition[]): void => {
  const byId = new Map<string, WorkflowStepDefinition>();

  for (const step of steps) {
    if (byId.has(step.id)) {
      throw new WorkflowDslError(`Duplicate step id: ${step.id}`);
    }
    byId.set(step.id, step);
  }

  for (const step of steps) {
    for (const dep of step.needs) {
      if (!byId.has(dep)) {
        throw new WorkflowDslError(`Step ${step.id} depends on missing step ${dep}`);
      }
      if (dep === step.id) {
        throw new WorkflowDslError(`Step ${step.id} cannot depend on itself`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string, trail: string[]) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const cyclePath = [...trail, id].join(' -> ');
      throw new WorkflowDslError(`Detected dependency cycle: ${cyclePath}`);
    }

    visiting.add(id);
    const step = byId.get(id);
    if (step) {
      for (const dep of step.needs) {
        visit(dep, [...trail, id]);
      }
    }

    visiting.delete(id);
    visited.add(id);
  };

  for (const step of steps) {
    visit(step.id, []);
  }
};

const topologicalOrder = (steps: WorkflowStepDefinition[]): string[] => {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const step of steps) {
    incoming.set(step.id, step.needs.length);
    for (const dep of step.needs) {
      const arr = outgoing.get(dep) ?? [];
      arr.push(step.id);
      outgoing.set(dep, arr);
    }
  }

  const queue = steps
    .filter((step) => (incoming.get(step.id) ?? 0) === 0)
    .map((step) => step.id)
    .sort();

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);

    for (const next of outgoing.get(id) ?? []) {
      const remaining = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, remaining);
      if (remaining === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  if (order.length !== steps.length) {
    throw new WorkflowDslError('Failed to compute topological order for workflow steps');
  }

  return order;
};

const compileTemplate = (template: string, vars: Record<string, string>): string => {
  return template.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, key: string) => {
    return vars[key] ?? '';
  });
};

const parseConditionLiteral = (input: string): string | number | boolean => {
  const raw = input.trim();
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.toLowerCase() === 'true') return true;
  if (raw.toLowerCase() === 'false') return false;
  return raw;
};

const compareValues = (left: string | number | boolean, right: string | number | boolean, op: string): boolean => {
  if (op === '==') return left === right;
  if (op === '!=') return left !== right;

  const leftNum = typeof left === 'number' ? left : Number(left);
  const rightNum = typeof right === 'number' ? right : Number(right);

  if (Number.isNaN(leftNum) || Number.isNaN(rightNum)) {
    throw new WorkflowDslError(`Operator ${op} requires numeric operands`);
  }

  if (op === '>') return leftNum > rightNum;
  if (op === '>=') return leftNum >= rightNum;
  if (op === '<') return leftNum < rightNum;
  if (op === '<=') return leftNum <= rightNum;

  throw new WorkflowDslError(`Unsupported operator: ${op}`);
};

export const evaluateStepCondition = (condition: string | undefined, vars: Record<string, string>): boolean => {
  if (!condition || !condition.trim()) return true;

  const expression = compileTemplate(condition.trim(), vars).trim();
  if (!expression) return false;

  if (expression === 'true') return true;
  if (expression === 'false') return false;

  const comparator = expression.match(/^(.*?)\s*(==|!=|>=|<=|>|<)\s*(.*?)$/);
  if (comparator) {
    const [, leftRaw, operator, rightRaw] = comparator;
    const left = parseConditionLiteral(leftRaw);
    const right = parseConditionLiteral(rightRaw);
    return compareValues(left, right, operator);
  }

  const literal = parseConditionLiteral(expression);
  if (typeof literal === 'boolean') return literal;
  if (typeof literal === 'number') return literal !== 0;
  return literal.length > 0;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs?: number): Promise<T> => {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

export const parseWorkflowDsl = (command: string): WorkflowStepDefinition[] => {
  const normalized = normalizeWorkflowCommand(command);
  if (!normalized) {
    throw new WorkflowDslError('Workflow command cannot be empty');
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (lines.length === 0) {
    throw new WorkflowDslError('Workflow command must define at least one step');
  }

  const maybeDsl = lines.some((line) => line.includes(':'));
  if (!maybeDsl || (lines.length === 1 && !lines[0].match(/^[a-zA-Z][a-zA-Z0-9_-]*\s*:/))) {
    return [defaultStepFromCommand(normalized)];
  }

  const steps = lines.map((line, index) => {
    const { rawName, command: rawCommand, meta } = tokenizeStepLine(line);
    if (!rawName) {
      throw new WorkflowDslError(`Invalid DSL step format on line ${index + 1}: ${line}`);
    }

    const id = validateStepId(rawName);
    const command = rawCommand.trim();
    if (!command) {
      throw new WorkflowDslError(`Step ${id} command cannot be empty`);
    }

    const parsedMeta = parseStepMeta(meta);
    const step: WorkflowStepDefinition = {
      id,
      name: id
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase()),
      command,
      needs: parsedMeta.needs ?? [],
      if: parsedMeta.if,
      retry: parsedMeta.retry ?? DEFAULT_RETRY,
      continueOnError: parsedMeta.continueOnError ?? false,
      timeoutMs: parsedMeta.timeoutMs,
      shell: parsedMeta.shell,
      cwd: parsedMeta.cwd,
      env: parsedMeta.env ?? {},
    };
    return step;
  });

  validateGraph(steps);
  return steps;
};

const mergeVariables = (
  context: WorkflowRunContext | undefined,
  stepState: Map<string, InternalStepState>,
): Record<string, string> => {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(context?.vars ?? {})) {
    vars[key] = normalizeVar(value);
  }

  for (const [id, state] of stepState.entries()) {
    vars[`step_${id}_status`] = state.status;
    vars[`step_${id}_attempts`] = String(state.attempts);
    vars[`step_${id}_error`] = state.error ?? '';
  }

  return vars;
};

const emit = <T extends keyof WorkflowEventMap>(hooks: WorkflowRunnerHooks, type: T, event: WorkflowEventMap[T]) => {
  switch (type) {
    case 'runStarted':
      hooks.onRunStarted?.(event as WorkflowEventMap['runStarted']);
      return;
    case 'stepReady':
      hooks.onStepReady?.(event as WorkflowEventMap['stepReady']);
      return;
    case 'stepStarted':
      hooks.onStepStarted?.(event as WorkflowEventMap['stepStarted']);
      return;
    case 'stepRetry':
      hooks.onStepRetry?.(event as WorkflowEventMap['stepRetry']);
      return;
    case 'stepSucceeded':
      hooks.onStepSucceeded?.(event as WorkflowEventMap['stepSucceeded']);
      return;
    case 'stepFailed':
      hooks.onStepFailed?.(event as WorkflowEventMap['stepFailed']);
      return;
    case 'stepSkipped':
      hooks.onStepSkipped?.(event as WorkflowEventMap['stepSkipped']);
      return;
    case 'stepBlocked':
      hooks.onStepBlocked?.(event as WorkflowEventMap['stepBlocked']);
      return;
    case 'stepCanceled':
      hooks.onStepCanceled?.(event as WorkflowEventMap['stepCanceled']);
      return;
    case 'runFinished':
      hooks.onRunFinished?.(event as WorkflowEventMap['runFinished']);
      return;
    default:
      return;
  }
};

const toResultRecord = (state: InternalStepState): WorkflowStepRunResult => ({
  stepId: state.def.id,
  status: state.status === 'succeeded'
    ? 'succeeded'
    : state.status === 'failed'
      ? 'failed'
      : state.status === 'skipped'
        ? 'skipped'
        : state.status === 'blocked'
          ? 'blocked'
          : 'canceled',
  attemptCount: state.attempts,
  startedAt: state.startedAt ?? state.finishedAt ?? nowIso(),
  finishedAt: state.finishedAt ?? nowIso(),
  output: [...state.output],
  error: state.error,
  metadata: state.metadata,
});

const canRunStep = (
  step: WorkflowStepDefinition,
  states: Map<string, InternalStepState>,
): { ok: boolean; blockedReason?: string } => {
  for (const depId of step.needs) {
    const dep = states.get(depId);
    if (!dep) {
      return { ok: false, blockedReason: `Missing dependency ${depId}` };
    }

    if (dep.status === 'pending' || dep.status === 'ready' || dep.status === 'running') {
      return { ok: false };
    }

    if (dep.status === 'failed' || dep.status === 'blocked' || dep.status === 'canceled') {
      return { ok: false, blockedReason: `Dependency ${depId} is ${dep.status}` };
    }

    if (dep.status === 'skipped') {
      return { ok: false, blockedReason: `Dependency ${depId} was skipped` };
    }
  }

  return { ok: true };
};

const markState = (
  state: InternalStepState,
  status: WorkflowStepStatus,
  message?: string,
  appendOutput?: string,
) => {
  state.status = status;
  if (appendOutput) {
    state.output.push(appendOutput);
  }
  if (message) {
    state.error = message;
  }
  if (['succeeded', 'failed', 'skipped', 'blocked', 'canceled'].includes(status)) {
    state.finishedAt = nowIso();
  }
};

const makeSummary = (results: Record<string, WorkflowStepRunResult>) => {
  const summary = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    blocked: 0,
    canceled: 0,
  };

  for (const entry of Object.values(results)) {
    summary.total += 1;
    if (entry.status === 'succeeded') summary.succeeded += 1;
    if (entry.status === 'failed') summary.failed += 1;
    if (entry.status === 'skipped') summary.skipped += 1;
    if (entry.status === 'blocked') summary.blocked += 1;
    if (entry.status === 'canceled') summary.canceled += 1;
  }

  return summary;
};

const computeFinalStatus = (
  summary: ReturnType<typeof makeSummary>,
): WorkflowRunResult['status'] => {
  if (summary.failed > 0) return 'failed';
  if (summary.canceled > 0) return 'canceled';
  return 'success';
};

const terminalStatuses = new Set<WorkflowStepStatus>(['succeeded', 'failed', 'skipped', 'blocked', 'canceled']);

export const runWorkflow = async (
  command: string,
  adapter: WorkflowRunnerAdapter,
  context: WorkflowRunContext = {},
  options: WorkflowRunOptions = {},
): Promise<WorkflowRunResult> => {
  const startedAt = nowIso();
  const steps = parseWorkflowDsl(command);
  const order = topologicalOrder(steps);

  const failFast = options.failFast ?? DEFAULT_FAIL_FAST;
  const maxParallel = Math.max(1, options.maxParallel ?? DEFAULT_MAX_PARALLEL);

  const states = new Map<string, InternalStepState>();
  for (const step of steps) {
    states.set(step.id, {
      def: step,
      status: 'pending',
      attempts: 0,
      output: [],
      error: null,
    });
  }

  emit(options, 'runStarted', {
    timestamp: nowIso(),
    message: `Workflow started with ${steps.length} step(s)`,
    orderedStepIds: order,
  });

  let active = 0;
  let failFastTripped = false;
  let resolved = false;

  const settleableIds = () => order.filter((id) => !terminalStatuses.has(states.get(id)?.status ?? 'pending'));

  const finalize = (): WorkflowRunResult => {
    const record: Record<string, WorkflowStepRunResult> = {};
    const output: string[] = [];

    for (const id of order) {
      const state = states.get(id);
      if (!state) continue;
      const row = toResultRecord(state);
      record[id] = row;
      output.push(`[${id}] status=${row.status} attempts=${row.attemptCount}`);
      for (const line of row.output) {
        output.push(`[${id}] ${line}`);
      }
      if (row.error) {
        output.push(`[${id}] ERROR: ${row.error}`);
      }
    }

    const summary = makeSummary(record);
    const status = computeFinalStatus(summary);
    const finishedAt = nowIso();

    emit(options, 'runFinished', {
      timestamp: finishedAt,
      message: `Workflow finished with status ${status}`,
      status,
    });

    return {
      workflowId: context.workflowId,
      workflowName: context.workflowName,
      startedAt,
      finishedAt,
      status,
      steps: record,
      orderedStepIds: order,
      summary,
      output,
    };
  };

  const trySchedule = async (): Promise<WorkflowRunResult> => {
    if (resolved) return finalize();

    if (options.signal?.aborted) {
      for (const id of settleableIds()) {
        const state = states.get(id)!;
        if (!terminalStatuses.has(state.status)) {
          markState(state, 'canceled', 'Workflow run aborted');
          emit(options, 'stepCanceled', {
            timestamp: nowIso(),
            stepId: id,
            message: `Step ${id} canceled because signal was aborted`,
          });
        }
      }
      resolved = true;
      return finalize();
    }

    const candidates = order
      .map((id) => states.get(id)!)
      .filter((state) => state.status === 'pending' || state.status === 'ready');

    for (const state of candidates) {
      const readiness = canRunStep(state.def, states);
      if (readiness.ok && state.status !== 'ready') {
        state.status = 'ready';
        emit(options, 'stepReady', {
          timestamp: nowIso(),
          stepId: state.def.id,
          message: `Step ${state.def.id} is ready`,
        });
      }

      if (!readiness.ok && readiness.blockedReason && state.status !== 'blocked') {
        if (failFastTripped || readiness.blockedReason.includes('failed') || readiness.blockedReason.includes('blocked')) {
          markState(state, 'blocked', readiness.blockedReason);
          emit(options, 'stepBlocked', {
            timestamp: nowIso(),
            stepId: state.def.id,
            message: `Step ${state.def.id} blocked`,
            reason: readiness.blockedReason,
          });
        }
      }
    }

    const runnable = order
      .map((id) => states.get(id)!)
      .filter((state) => state.status === 'ready')
      .slice(0, Math.max(0, maxParallel - active));

    if (runnable.length === 0 && active === 0) {
      for (const id of settleableIds()) {
        const state = states.get(id)!;
        if (!terminalStatuses.has(state.status)) {
          markState(state, failFastTripped ? 'blocked' : 'canceled', failFastTripped ? 'Blocked by fail-fast mode' : 'Workflow did not schedule this step');
        }
      }
      resolved = true;
      return finalize();
    }

    await Promise.all(
      runnable.map(async (state) => {
        active += 1;
        state.status = 'running';
        state.attempts += 1;
        if (!state.startedAt) state.startedAt = nowIso();

        emit(options, 'stepStarted', {
          timestamp: nowIso(),
          stepId: state.def.id,
          message: `Step ${state.def.id} started`,
          attempt: state.attempts,
        });

        const vars = mergeVariables(context, states);
        vars.RUNNER_WORKFLOW_ID = context.workflowId ?? '';
        vars.RUNNER_WORKFLOW_NAME = context.workflowName ?? '';
        vars.RUNNER_STEP_ID = state.def.id;
        vars.RUNNER_STEP_NAME = state.def.name;

        const conditionOk = evaluateStepCondition(state.def.if, vars);

        if (!conditionOk) {
          markState(state, 'skipped', 'Condition evaluated to false');
          emit(options, 'stepSkipped', {
            timestamp: nowIso(),
            stepId: state.def.id,
            message: `Step ${state.def.id} skipped`,
            reason: 'Condition evaluated to false',
          });
          active -= 1;
          return;
        }

        const interpolatedCommand = compileTemplate(state.def.command, {
          ...vars,
          ...Object.fromEntries(Object.entries(state.def.env).map(([key, value]) => [key, compileTemplate(value, vars)])),
        });

        const request: StepExecutionRequest = {
          step: {
            ...state.def,
            command: interpolatedCommand,
            env: {
              ...state.def.env,
              RUNNER_WORKFLOW_ID: context.workflowId ?? '',
              RUNNER_WORKFLOW_NAME: context.workflowName ?? '',
              RUNNER_STEP_ID: state.def.id,
              RUNNER_STEP_NAME: state.def.name,
            },
          },
          attempt: state.attempts,
          context: {
            vars,
            stepResults: Object.fromEntries(
              Array.from(states.entries())
                .filter(([, s]) => terminalStatuses.has(s.status))
                .map(([id, s]) => [id, toResultRecord(s)]),
            ),
          },
        };

        try {
          const execution = await withTimeout(adapter.executeStep(request), state.def.timeoutMs);
          if (execution.output.length > 0) {
            state.output.push(...execution.output);
          }
          state.metadata = execution.metadata;

          if (execution.error) {
            throw new Error(execution.error);
          }

          markState(state, 'succeeded');
          emit(options, 'stepSucceeded', {
            timestamp: nowIso(),
            stepId: state.def.id,
            message: `Step ${state.def.id} succeeded`,
            attempt: state.attempts,
            outputLines: execution.output.length,
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unknown step failure';
          const retriesRemaining = state.def.retry - (state.attempts - 1);

          if (retriesRemaining > 0) {
            state.status = 'ready';
            state.error = reason;
            emit(options, 'stepRetry', {
              timestamp: nowIso(),
              stepId: state.def.id,
              message: `Retrying step ${state.def.id}`,
              attempt: state.attempts + 1,
              reason,
            });
          } else if (state.def.continueOnError) {
            markState(state, 'skipped', reason, `continueOnError=true; treating failure as skipped`);
            emit(options, 'stepSkipped', {
              timestamp: nowIso(),
              stepId: state.def.id,
              message: `Step ${state.def.id} skipped after failure`,
              reason,
            });
          } else {
            markState(state, 'failed', reason);
            emit(options, 'stepFailed', {
              timestamp: nowIso(),
              stepId: state.def.id,
              message: `Step ${state.def.id} failed`,
              attempt: state.attempts,
              reason,
            });

            if (failFast) {
              failFastTripped = true;
            }
          }
        } finally {
          active -= 1;
        }
      }),
    );

    if (order.every((id) => terminalStatuses.has(states.get(id)?.status ?? 'pending'))) {
      resolved = true;
      return finalize();
    }

    if (failFastTripped && active === 0) {
      for (const id of settleableIds()) {
        const state = states.get(id)!;
        if (!terminalStatuses.has(state.status)) {
          markState(state, 'blocked', 'Blocked by fail-fast mode');
          emit(options, 'stepBlocked', {
            timestamp: nowIso(),
            stepId: id,
            message: `Step ${id} blocked by fail-fast`,
            reason: 'Blocked by fail-fast mode',
          });
        }
      }
      resolved = true;
      return finalize();
    }

    return trySchedule();
  };

  return trySchedule();
};

export const createShellWorkflowAdapter = (
  runner: (command: string, shell?: string) => Promise<{ output: string[]; error: string | null }>,
): WorkflowRunnerAdapter => {
  return {
    executeStep: async (request) => {
      const result = await runner(request.step.command, request.step.shell);
      return {
        output: result.output,
        error: result.error,
      };
    },
  };
};
