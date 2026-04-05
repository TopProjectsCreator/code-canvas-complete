import { describe, expect, it } from 'vitest';
import {
  WorkflowDslError,
  evaluateStepCondition,
  parseWorkflowDsl,
  runWorkflow,
  createShellWorkflowAdapter,
  type StepExecutionRequest,
} from '@/lib/workflowRuntime';

describe('workflowRuntime.parseWorkflowDsl', () => {
  it('parses a single legacy command into one step', () => {
    const steps = parseWorkflowDsl('npm run build');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      id: 'step_1',
      command: 'npm run build',
      retry: 0,
      continueOnError: false,
      needs: [],
    });
  });

  it('parses a multi-step workflow with metadata', () => {
    const steps = parseWorkflowDsl(`
      build: npm run build
      test: npm test | needs=build | retry=2 | timeout=2500
      deploy: npm run deploy | needs=test | if="${'${branch}'} == main"
    `);

    expect(steps).toHaveLength(3);
    expect(steps[0].id).toBe('build');
    expect(steps[1]).toMatchObject({
      id: 'test',
      needs: ['build'],
      retry: 2,
      timeoutMs: 2500,
    });
    expect(steps[2]).toMatchObject({
      id: 'deploy',
      needs: ['test'],
      if: '${branch} == main',
    });
  });

  it('throws when dependency is missing', () => {
    expect(() =>
      parseWorkflowDsl(`
        build: npm run build
        deploy: npm run deploy | needs=test
      `),
    ).toThrowError(WorkflowDslError);
  });

  it('throws on cyclic dependencies', () => {
    expect(() =>
      parseWorkflowDsl(`
        a: echo a | needs=c
        b: echo b | needs=a
        c: echo c | needs=b
      `),
    ).toThrowError(/cycle/i);
  });

  it('parses env vars and shell/cwd metadata', () => {
    const [step] = parseWorkflowDsl(`
      run: node index.js | env.NODE_ENV=production | env.API_URL=https://api.example.com | shell=bash | cwd=/repo
    `);

    expect(step.env).toEqual({
      NODE_ENV: 'production',
      API_URL: 'https://api.example.com',
    });
    expect(step.shell).toBe('bash');
    expect(step.cwd).toBe('/repo');
  });
});

describe('workflowRuntime.evaluateStepCondition', () => {
  const vars = {
    branch: 'main',
    retries: '3',
    featureEnabled: 'true',
    empty: '',
  };

  it('supports equality and inequality', () => {
    expect(evaluateStepCondition('${branch} == main', vars)).toBe(true);
    expect(evaluateStepCondition('${branch} != release', vars)).toBe(true);
    expect(evaluateStepCondition('${branch} == release', vars)).toBe(false);
  });

  it('supports numeric comparisons', () => {
    expect(evaluateStepCondition('${retries} >= 3', vars)).toBe(true);
    expect(evaluateStepCondition('${retries} > 4', vars)).toBe(false);
  });

  it('supports boolean-style conditions', () => {
    expect(evaluateStepCondition('${featureEnabled}', vars)).toBe(true);
    expect(evaluateStepCondition('${empty}', vars)).toBe(false);
  });
});

describe('workflowRuntime.runWorkflow', () => {
  const createAdapter = (executor: (req: StepExecutionRequest) => Promise<{ output: string[]; error: string | null }>) => ({
    executeStep: executor,
  });

  it('runs dependent steps in order', async () => {
    const seen: string[] = [];

    const result = await runWorkflow(
      `
        build: echo build
        test: echo test | needs=build
        deploy: echo deploy | needs=test
      `,
      createAdapter(async (req) => {
        seen.push(req.step.id);
        return { output: [`ran-${req.step.id}`], error: null };
      }),
    );

    expect(result.status).toBe('success');
    expect(seen).toEqual(['build', 'test', 'deploy']);
    expect(result.summary).toMatchObject({
      total: 3,
      succeeded: 3,
      failed: 0,
      blocked: 0,
    });
  });

  it('supports retries before succeeding', async () => {
    const attempts = new Map<string, number>();

    const result = await runWorkflow(
      `
        unstable: npm test | retry=2
      `,
      createAdapter(async (req) => {
        const count = (attempts.get(req.step.id) ?? 0) + 1;
        attempts.set(req.step.id, count);

        if (count < 3) {
          return { output: [`attempt-${count}`], error: 'transient' };
        }

        return { output: [`attempt-${count}`], error: null };
      }),
    );

    expect(result.status).toBe('success');
    expect(result.steps.unstable.attemptCount).toBe(3);
  });

  it('marks downstream steps blocked in fail-fast mode', async () => {
    const result = await runWorkflow(
      `
        compile: npm run build
        test: npm test | needs=compile
        package: npm pack | needs=test
      `,
      createAdapter(async (req) => {
        if (req.step.id === 'compile') {
          return { output: ['boom'], error: 'compile failed' };
        }
        return { output: ['ok'], error: null };
      }),
      {},
      { failFast: true },
    );

    expect(result.status).toBe('failed');
    expect(result.steps.compile.status).toBe('failed');
    expect(result.steps.test.status).toBe('blocked');
    expect(result.steps.package.status).toBe('blocked');
  });

  it('can continue scheduling when failFast is disabled', async () => {
    const result = await runWorkflow(
      `
        a: echo a
        b: echo b
        c: echo c | needs=a
      `,
      createAdapter(async (req) => {
        if (req.step.id === 'a') {
          return { output: ['a'], error: 'a failed' };
        }
        return { output: [req.step.id], error: null };
      }),
      {},
      { failFast: false, maxParallel: 2 },
    );

    expect(result.steps.a.status).toBe('failed');
    expect(result.steps.b.status).toBe('succeeded');
    expect(result.steps.c.status).toBe('blocked');
  });

  it('skips step when condition is false', async () => {
    const called: string[] = [];

    const result = await runWorkflow(
      `
        lint: npm run lint | if=${'${branch} == main'}
        deploy: npm run deploy | if=${'${branch} == release'}
      `,
      createAdapter(async (req) => {
        called.push(req.step.id);
        return { output: [], error: null };
      }),
      {
        vars: { branch: 'main' },
      },
      {
        maxParallel: 2,
      },
    );

    expect(called).toEqual(['lint']);
    expect(result.steps.lint.status).toBe('succeeded');
    expect(result.steps.deploy.status).toBe('skipped');
  });

  it('supports continueOnError behavior', async () => {
    const result = await runWorkflow(
      `
        best_effort: flaky | continueOnError=true
        always: echo ok
      `,
      createAdapter(async (req) => {
        if (req.step.id === 'best_effort') {
          return { output: ['warn'], error: 'not critical' };
        }
        return { output: ['ok'], error: null };
      }),
      {},
      {
        failFast: false,
      },
    );

    expect(result.steps.best_effort.status).toBe('skipped');
    expect(result.steps.always.status).toBe('succeeded');
  });

  it('aborts when signal is canceled before scheduling', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runWorkflow(
      `
        one: echo 1
        two: echo 2
      `,
      createAdapter(async () => ({ output: ['never'], error: null })),
      {},
      { signal: controller.signal },
    );

    expect(result.status).toBe('canceled');
    expect(result.steps.one.status).toBe('canceled');
    expect(result.steps.two.status).toBe('canceled');
  });

  it('enforces timeout for long running steps', async () => {
    const result = await runWorkflow(
      `
        sleep: sleep 10 | timeout=10
      `,
      createAdapter(
        async () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ output: ['done'], error: null }), 25);
          }),
      ),
    );

    expect(result.status).toBe('failed');
    expect(result.steps.sleep.status).toBe('failed');
    expect(result.steps.sleep.error).toMatch(/timed out/i);
  });

  it('runs via shell adapter facade', async () => {
    const calls: string[] = [];
    const adapter = createShellWorkflowAdapter(async (command, shell) => {
      calls.push(`${shell ?? 'default'}:${command}`);
      return { output: ['ok'], error: null };
    });

    const result = await runWorkflow(
      `
        run: echo hi | shell=bash
      `,
      adapter,
    );

    expect(result.status).toBe('success');
    expect(calls).toEqual(['bash:echo hi']);
  });
});
