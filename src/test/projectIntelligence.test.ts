import { describe, expect, it } from 'vitest';
import type { FileNode } from '@/types/ide';
import {
  analyzeProjectIntelligence,
  buildProjectIntelligenceSnapshot,
  compareProjectIntelligence,
  estimateChangeImpact,
  evaluateLayerViolations,
  findDuplicateFragments,
  parseExports,
  parseImports,
  suggestRefactorPlan,
  toMermaidDependencyGraph,
  type LayerRule,
  type ProjectFile,
} from '@/lib/projectIntelligence';

const projectTree: FileNode[] = [
  {
    id: 'root',
    name: 'src',
    type: 'folder',
    children: [
      {
        id: 'core-folder',
        name: 'core',
        type: 'folder',
        children: [
          {
            id: 'engine',
            name: 'engine.ts',
            type: 'file',
            language: 'typescript',
            content: `import { request } from '../shared/http';
import { normalize } from './normalizer';
import { logMetric } from '../shared/metrics';

export async function executePipeline(records: string[]) {
  let success = 0;
  let failed = 0;
  for (const item of records) {
    if (!item) {
      failed += 1;
      continue;
    }

    if (item.includes('skip')) {
      logMetric('pipeline.skipped');
      continue;
    }

    try {
      const normalized = normalize(item);
      const response = await request('/items', { value: normalized });
      if (response.ok) {
        success += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  if (failed > success) {
    return { status: 'degraded', success, failed };
  }

  return { status: 'ok', success, failed };
}
`,
          },
          {
            id: 'normalizer',
            name: 'normalizer.ts',
            type: 'file',
            language: 'typescript',
            content: `import { trimToAscii } from '../shared/text';

export function normalize(input: string) {
  const raw = trimToAscii(input);
  if (!raw) return 'empty';

  const tokens = raw.split(/\s+/g);
  const output: string[] = [];

  for (const token of tokens) {
    if (token.length > 12) {
      output.push(token.slice(0, 12));
      continue;
    }

    output.push(token);
  }

  return output.join('_').toLowerCase();
}
`,
          },
        ],
      },
      {
        id: 'features-folder',
        name: 'features',
        type: 'folder',
        children: [
          {
            id: 'dashboard',
            name: 'dashboard.ts',
            type: 'file',
            language: 'typescript',
            content: `import { executePipeline } from '../core/engine';
import { loadState } from '../state/store';

export async function renderDashboard() {
  const state = loadState();
  const result = await executePipeline(state.jobs);
  return { result, totalJobs: state.jobs.length };
}
`,
          },
        ],
      },
      {
        id: 'shared-folder',
        name: 'shared',
        type: 'folder',
        children: [
          {
            id: 'http',
            name: 'http.ts',
            type: 'file',
            language: 'typescript',
            content: `export async function request(url: string, body: unknown) {
  if (!url.startsWith('/')) {
    throw new Error('Url must start with slash');
  }

  return {
    ok: Boolean(body),
    payload: { url, body },
  };
}
`,
          },
          {
            id: 'metrics',
            name: 'metrics.ts',
            type: 'file',
            language: 'typescript',
            content: `const counters: Record<string, number> = {};

export function logMetric(name: string) {
  counters[name] = (counters[name] || 0) + 1;
}

export function readMetric(name: string) {
  return counters[name] || 0;
}
`,
          },
          {
            id: 'text',
            name: 'text.ts',
            type: 'file',
            language: 'typescript',
            content: `export function trimToAscii(input: string) {
  return input
    .replace(/[^\x00-\x7F]/g, '')
    .trim();
}

export const textVersion = '1.0.0';
`,
          },
        ],
      },
      {
        id: 'state-folder',
        name: 'state',
        type: 'folder',
        children: [
          {
            id: 'store',
            name: 'store.ts',
            type: 'file',
            language: 'typescript',
            content: `import { normalize } from '../core/normalizer';

export function loadState() {
  const jobs = [' A ', 'B', 'skip item', ''];
  const sanitized = jobs.map((job) => normalize(job));
  return { jobs: sanitized };
}
`,
          },
        ],
      },
      {
        id: 'bad-layer-folder',
        name: 'ui',
        type: 'folder',
        children: [
          {
            id: 'screen',
            name: 'screen.ts',
            type: 'file',
            language: 'typescript',
            content: `import { loadState } from '../state/store';
import { request } from '../shared/http';

export async function screenLoader() {
  const state = loadState();
  return request('/screen', state);
}
`,
          },
        ],
      },
      {
        id: 'dead-folder',
        name: 'unused',
        type: 'folder',
        children: [
          {
            id: 'dead',
            name: 'dead.ts',
            type: 'file',
            language: 'typescript',
            content: `export function neverCalled() {
  return 'dead';
}

function internalUnused() {
  return 9;
}
`,
          },
        ],
      },
      {
        id: 'dup-folder',
        name: 'dup',
        type: 'folder',
        children: [
          {
            id: 'dup-a',
            name: 'a.ts',
            type: 'file',
            language: 'typescript',
            content: `export function duplicateA(data: string[]) {
  const out: string[] = [];
  for (const item of data) {
    if (!item) {
      continue;
    }

    if (item.length > 10) {
      out.push(item.slice(0, 10));
    } else {
      out.push(item);
    }
  }

  return out.join(',');
}
`,
          },
          {
            id: 'dup-b',
            name: 'b.ts',
            type: 'file',
            language: 'typescript',
            content: `export function duplicateB(data: string[]) {
  const out: string[] = [];
  for (const item of data) {
    if (!item) {
      continue;
    }

    if (item.length > 10) {
      out.push(item.slice(0, 10));
    } else {
      out.push(item);
    }
  }

  return out.join(',');
}
`,
          },
        ],
      },
      {
        id: 'cycle-folder',
        name: 'cycle',
        type: 'folder',
        children: [
          {
            id: 'cycle-a',
            name: 'a.ts',
            type: 'file',
            language: 'typescript',
            content: `import { b } from './b';
export function a() {
  return b() + 1;
}
`,
          },
          {
            id: 'cycle-b',
            name: 'b.ts',
            type: 'file',
            language: 'typescript',
            content: `import { c } from './c';
export function b() {
  return c() + 1;
}
`,
          },
          {
            id: 'cycle-c',
            name: 'c.ts',
            type: 'file',
            language: 'typescript',
            content: `import { a } from './a';
export function c() {
  return a() + 1;
}
`,
          },
        ],
      },
    ],
  },
];

describe('project intelligence parser helpers', () => {
  it('parses imports including static, side-effect and dynamic imports', () => {
    const file: ProjectFile = {
      id: 'example',
      name: 'example.ts',
      path: 'src/example.ts',
      language: 'typescript',
      content: `import type { Config } from './config';
import { alpha, beta as gamma } from './alpha';
import './register';
const data = import('./lazy');
`,
    };

    const available = new Set(['src/config.ts', 'src/alpha.ts', 'src/register.ts', 'src/lazy.ts']);
    const parsed = parseImports(file, available);

    expect(parsed).toHaveLength(4);
    expect(parsed[0].isTypeOnly).toBe(true);
    expect(parsed[1].specifiers).toContain('gamma');
    expect(parsed[2].specifiers).toHaveLength(0);
    expect(parsed[3].specifiers).toContain('<dynamic>');
  });

  it('parses diverse export forms', () => {
    const file: ProjectFile = {
      id: 'exports',
      name: 'exports.ts',
      path: 'src/exports.ts',
      language: 'typescript',
      content: `export function one() { return 1; }
export const two = 2;
class Three {}
export default Three;
export { two as aliasTwo };
`,
    };

    const parsed = parseExports(file);
    expect(parsed.some((entry) => entry.symbol === 'one')).toBe(true);
    expect(parsed.some((entry) => entry.symbol === 'two')).toBe(true);
    expect(parsed.some((entry) => entry.isDefault)).toBe(true);
    expect(parsed.some((entry) => entry.symbol === 'aliasTwo')).toBe(true);
  });

  it('finds duplicate fragments across files', () => {
    const files: ProjectFile[] = [
      {
        id: '1',
        name: 'a.ts',
        path: 'src/a.ts',
        language: 'typescript',
        content: `function same(items: string[]) {
  const out: string[] = [];
  for (const item of items) {
    if (!item) {
      continue;
    }

    if (item.length > 10) {
      out.push(item.slice(0, 10));
    } else {
      out.push(item);
    }
  }

  return out;
}`,
      },
      {
        id: '2',
        name: 'b.ts',
        path: 'src/b.ts',
        language: 'typescript',
        content: `function sameAgain(items: string[]) {
  const out: string[] = [];
  for (const item of items) {
    if (!item) {
      continue;
    }

    if (item.length > 10) {
      out.push(item.slice(0, 10));
    } else {
      out.push(item);
    }
  }

  return out;
}`,
      },
    ];

    const duplicates = findDuplicateFragments(files, 6);
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0].occurrences.length).toBeGreaterThanOrEqual(2);
  });
});

describe('project intelligence report', () => {
  const rules: LayerRule[] = [
    {
      name: 'ui-restrictions',
      from: /^src\/ui\//,
      allowed: [/^src\/ui\//, /^src\/shared\//],
    },
  ];

  it('builds comprehensive report with cycles, dead symbols and complexity hotspots', () => {
    const report = analyzeProjectIntelligence(projectTree, {
      layerRules: rules,
      duplicationWindowSize: 6,
    });

    expect(report.summary.totalFiles).toBeGreaterThanOrEqual(12);
    expect(report.summary.totalSymbols).toBeGreaterThan(10);
    expect(report.summary.cycleCount).toBeGreaterThan(0);
    expect(report.cycles.some((cycle) => cycle.nodes.some((node) => node.includes('src/cycle/a.ts')))).toBe(true);
    expect(report.summary.deadSymbols).toBeGreaterThan(0);
    expect(report.deadSymbols.some((symbol) => symbol.symbol === 'neverCalled')).toBe(true);
    expect(report.summary.layerViolations).toBeGreaterThan(0);
    expect(report.layerViolations.some((violation) => violation.filePath.includes('src/ui/screen.ts'))).toBe(true);

    const risky = report.complexity.find((entry) => entry.filePath.includes('src/core/engine.ts'));
    expect(risky).toBeDefined();
    expect(risky?.cyclomatic).toBeGreaterThan(5);

    const node = report.dependencyGraph.find((entry) => entry.filePath === 'src/core/engine.ts');
    expect(node).toBeDefined();
    expect(node?.imports.some((item) => item.includes('src/core/normalizer.ts'))).toBe(true);

    expect(report.duplicateFragments.length).toBeGreaterThan(0);
  });

  it('computes change impact correctly from reverse dependency graph', () => {
    const report = analyzeProjectIntelligence(projectTree, {
      layerRules: rules,
    });

    const impact = estimateChangeImpact(report, 'src/shared/http.ts');

    expect(impact.changedFilePath).toBe('src/shared/http.ts');
    expect(impact.directlyImpacted).toContain('src/core/engine.ts');
    expect(impact.directlyImpacted).toContain('src/ui/screen.ts');
    expect(impact.transitivelyImpacted).toContain('src/features/dashboard.ts');
    expect(impact.blastRadius).toBeGreaterThan(0);
    expect(impact.symbolsLikelyImpacted.length).toBeGreaterThan(0);
  });

  it('generates actionable refactor suggestions based on risk signals', () => {
    const report = analyzeProjectIntelligence(projectTree, {
      layerRules: rules,
    });

    const suggestions = suggestRefactorPlan(report);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((message) => message.includes('Reduce complexity'))).toBe(true);
    expect(suggestions.some((message) => message.includes('Break dependency cycle'))).toBe(true);
  });

  it('builds mermaid graph output for dependency visualization', () => {
    const report = analyzeProjectIntelligence(projectTree);
    const graph = toMermaidDependencyGraph(report);

    expect(graph.startsWith('graph TD')).toBe(true);
    expect(graph).toContain('src/core/engine');
    expect(graph).toContain('src/shared/http');
  });

  it('creates lightweight snapshot with distribution and hotspots', () => {
    const snapshot = buildProjectIntelligenceSnapshot(projectTree);

    expect(snapshot.totalFiles).toBeGreaterThan(10);
    expect(snapshot.totalLines).toBeGreaterThan(50);
    expect(snapshot.totalBytes).toBeGreaterThan(500);
    expect(snapshot.languageDistribution.ts).toBeGreaterThan(5);
    expect(snapshot.topHotspots.length).toBeGreaterThan(0);
  });

  it('compares two project reports and highlights regressions', () => {
    const baseline = analyzeProjectIntelligence(projectTree);

    const modified: FileNode[] = JSON.parse(JSON.stringify(projectTree));
    const src = modified[0];
    if (src.type === 'folder' && src.children) {
      const cycleFolder = src.children.find((child) => child.type === 'folder' && child.name === 'cycle');
      if (cycleFolder?.type === 'folder' && cycleFolder.children) {
        const cFile = cycleFolder.children.find((child) => child.type === 'file' && child.name === 'c.ts');
        if (cFile?.type === 'file') {
          cFile.content = `export function c() { return 1; }`;
        }
      }

      const coreFolder = src.children.find((child) => child.type === 'folder' && child.name === 'core');
      if (coreFolder?.type === 'folder' && coreFolder.children) {
        const engine = coreFolder.children.find((child) => child.type === 'file' && child.name === 'engine.ts');
        if (engine?.type === 'file' && engine.content) {
          engine.content += `\nexport function megaBranching(input: number) {
  let score = 0;
  for (let i = 0; i < input; i += 1) {
    if (i % 2 === 0) score += 1;
    else if (i % 3 === 0) score += 2;
    else if (i % 5 === 0) score += 3;
    else if (i % 7 === 0) score += 4;
    else score += 5;

    switch (i % 4) {
      case 0:
        score += 1;
        break;
      case 1:
        score += 2;
        break;
      case 2:
        score += 3;
        break;
      default:
        score += 4;
    }
  }

  return score > 100 ? 'high' : 'low';
}
`;
        }
      }
    }

    const candidate = analyzeProjectIntelligence(modified);
    const delta = compareProjectIntelligence(baseline, candidate);

    expect(delta.summaryDelta.cycleCount).toBeLessThanOrEqual(0);
    expect(delta.summaryDelta.highRiskFunctions).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(delta.newlyRiskyFunctions)).toBe(true);
    expect(Array.isArray(delta.removedCycles)).toBe(true);
  });
});

describe('evaluateLayerViolations', () => {
  it('returns empty list when rules pass', () => {
    const violations = evaluateLayerViolations(
      {
        'src/ui/loader.ts': [
          {
            source: '../shared/http',
            specifiers: ['request'],
            isTypeOnly: false,
            line: 1,
            resolvedPath: 'src/shared/http.ts',
            isRelative: true,
            isExternal: false,
          },
        ],
      },
      [
        {
          name: 'ui-only-shared',
          from: /^src\/ui\//,
          allowed: [/^src\/ui\//, /^src\/shared\//],
        },
      ],
    );

    expect(violations).toHaveLength(0);
  });

  it('returns explicit violation details when rules fail', () => {
    const violations = evaluateLayerViolations(
      {
        'src/ui/loader.ts': [
          {
            source: '../state/store',
            specifiers: ['loadState'],
            isTypeOnly: false,
            line: 2,
            resolvedPath: 'src/state/store.ts',
            isRelative: true,
            isExternal: false,
          },
        ],
      },
      [
        {
          name: 'ui-only-shared',
          from: /^src\/ui\//,
          allowed: [/^src\/ui\//, /^src\/shared\//],
        },
      ],
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].violatedRule).toBe('ui-only-shared');
    expect(violations[0].details).toContain('violates layer rule');
  });
});
