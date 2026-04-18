import { FileNode } from '@/types/ide';
import { flattenFiles } from '@/lib/advancedWorkbench';

export type SymbolKind = 'function' | 'class' | 'type' | 'variable' | 'enum' | 'interface';

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
}

export interface ImportReference {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
  line: number;
  resolvedPath: string | null;
  isRelative: boolean;
  isExternal: boolean;
}

export interface ExportReference {
  symbol: string;
  kind: SymbolKind;
  line: number;
  isDefault: boolean;
}

export interface SymbolDefinition {
  symbol: string;
  kind: SymbolKind;
  filePath: string;
  line: number;
  exported: boolean;
  complexity: number;
  dependencySymbols: string[];
}

export interface FunctionComplexity {
  filePath: string;
  symbol: string;
  line: number;
  cyclomatic: number;
  cognitive: number;
  loc: number;
  risk: 'low' | 'medium' | 'high';
}

export interface DuplicateFragment {
  hash: string;
  normalized: string;
  occurrences: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
  }>;
  totalLines: number;
}

export interface DependencyNodeInsight {
  filePath: string;
  imports: string[];
  importedBy: string[];
  externalImports: string[];
  depth: number;
  inCycle: boolean;
  fanIn: number;
  fanOut: number;
}

export interface DependencyCycle {
  nodes: string[];
  length: number;
}

export interface DeadSymbol {
  symbol: string;
  filePath: string;
  line: number;
  reason: 'never_referenced' | 'only_self_referenced' | 'not_exported_and_unreferenced';
}

export interface LayerRule {
  name: string;
  from: RegExp;
  allowed: RegExp[];
}

export interface LayerViolation {
  filePath: string;
  importPath: string;
  line: number;
  violatedRule: string;
  details: string;
}

export interface ChangeImpact {
  changedFilePath: string;
  directlyImpacted: string[];
  transitivelyImpacted: string[];
  symbolsLikelyImpacted: string[];
  blastRadius: number;
}

export interface ProjectIntelligenceReport {
  files: ProjectFile[];
  importsByFile: Record<string, ImportReference[]>;
  exportsByFile: Record<string, ExportReference[]>;
  symbols: SymbolDefinition[];
  complexity: FunctionComplexity[];
  duplicateFragments: DuplicateFragment[];
  dependencyGraph: DependencyNodeInsight[];
  cycles: DependencyCycle[];
  deadSymbols: DeadSymbol[];
  layerViolations: LayerViolation[];
  summary: {
    totalFiles: number;
    totalSymbols: number;
    averageComplexity: number;
    highRiskFunctions: number;
    duplicateClusters: number;
    cycleCount: number;
    deadSymbols: number;
    layerViolations: number;
  };
}

const TS_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

const stripExtension = (value: string) => value.replace(/\.(ts|tsx|js|jsx|mjs|cjs|json)$/, '');

const normalizePath = (value: string) => {
  const cleaned = value.replace(/\\/g, '/').replace(/\/+/g, '/');
  const parts = cleaned.split('/');
  const stack: string[] = [];

  parts.forEach((part, index) => {
    if (part === '' && index === 0) {
      stack.push('');
      return;
    }

    if (!part || part === '.') return;
    if (part === '..') {
      if (stack.length > 1 || (stack.length === 1 && stack[0] !== '')) {
        stack.pop();
      }
      return;
    }

    stack.push(part);
  });

  if (stack.length === 0) return '';
  if (stack[0] === '') return `/${stack.slice(1).join('/')}`;
  return stack.join('/');
};

const dirname = (value: string) => {
  const normalized = normalizePath(value);
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return '';
  return normalized.slice(0, idx);
};

const joinPath = (base: string, relative: string) => {
  const seed = base ? `${base}/${relative}` : relative;
  return normalizePath(seed);
};

const getNodePath = (segments: string[]) => segments.filter(Boolean).join('/');

export const collectProjectFiles = (nodes: FileNode[]): ProjectFile[] => {
  const out: ProjectFile[] = [];

  const walk = (items: FileNode[], parents: string[]) => {
    items.forEach((item) => {
      const nextParents = [...parents, item.name];
      if (item.type === 'folder') {
        walk(item.children || [], nextParents);
        return;
      }

      const path = getNodePath(nextParents);
      out.push({
        id: item.id,
        name: item.name,
        path,
        language: item.language || '',
        content: item.content || '',
      });
    });
  };

  walk(nodes, []);
  return out;
};

const extractLineNumber = (content: string, index: number) => content.slice(0, index).split('\n').length;

const parseImportSpecifiers = (raw: string): string[] => {
  if (!raw.trim()) return [];

  const cleaned = raw.replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const withoutType = item.replace(/^type\s+/, '').trim();
      const aliasParts = withoutType.split(/\s+as\s+/i).map((part) => part.trim()).filter(Boolean);
      return aliasParts.length > 0 ? aliasParts : [withoutType];
    });
};

const inferKindFromDeclaration = (line: string): SymbolKind => {
  if (/\bclass\b/.test(line)) return 'class';
  if (/\benum\b/.test(line)) return 'enum';
  if (/\binterface\b/.test(line)) return 'interface';
  if (/\btype\b/.test(line)) return 'type';
  if (/\bfunction\b/.test(line)) return 'function';
  return 'variable';
};

const resolveImportPath = (filePath: string, source: string, availablePaths: Set<string>): string | null => {
  const normalizedSource = source.trim();
  if (!normalizedSource.startsWith('.')) return null;

  const fileDir = dirname(filePath);
  const candidateBase = joinPath(fileDir, normalizedSource);
  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    `${candidateBase}.js`,
    `${candidateBase}.jsx`,
    `${candidateBase}.mjs`,
    `${candidateBase}.cjs`,
    `${candidateBase}/index.ts`,
    `${candidateBase}/index.tsx`,
    `${candidateBase}/index.js`,
    `${candidateBase}/index.jsx`,
    `${candidateBase}/index.mjs`,
    `${candidateBase}/index.cjs`,
  ].map((entry) => normalizePath(entry));

  for (const candidate of candidates) {
    if (availablePaths.has(candidate)) return candidate;
  }

  return normalizePath(candidateBase);
};

export const parseImports = (file: ProjectFile, availablePaths: Set<string>): ImportReference[] => {
  const content = file.content;
  const refs: ImportReference[] = [];

  const importWithFrom = /import\s+([^;\n]+?)\s+from\s+['"]([^'"\n]+)['"]/g;
  const sideEffectImport = /import\s+['"]([^'"\n]+)['"]/g;
  const dynamicImport = /import\(\s*['"]([^'"\n]+)['"]\s*\)/g;

  for (const match of content.matchAll(importWithFrom)) {
    const rawSpecifiers = match[1] || '';
    const source = match[2] || '';
    const line = extractLineNumber(content, match.index || 0);
    const isTypeOnly = /^type\b/.test(rawSpecifiers.trim());

    refs.push({
      source,
      specifiers: parseImportSpecifiers(rawSpecifiers),
      isTypeOnly,
      line,
      resolvedPath: resolveImportPath(file.path, source, availablePaths),
      isRelative: source.startsWith('.'),
      isExternal: !source.startsWith('.'),
    });
  }

  for (const match of content.matchAll(sideEffectImport)) {
    const source = match[1] || '';
    const full = match[0] || '';
    if (/\s+from\s+/.test(full)) continue;

    refs.push({
      source,
      specifiers: [],
      isTypeOnly: false,
      line: extractLineNumber(content, match.index || 0),
      resolvedPath: resolveImportPath(file.path, source, availablePaths),
      isRelative: source.startsWith('.'),
      isExternal: !source.startsWith('.'),
    });
  }

  for (const match of content.matchAll(dynamicImport)) {
    const source = match[1] || '';
    refs.push({
      source,
      specifiers: ['<dynamic>'],
      isTypeOnly: false,
      line: extractLineNumber(content, match.index || 0),
      resolvedPath: resolveImportPath(file.path, source, availablePaths),
      isRelative: source.startsWith('.'),
      isExternal: !source.startsWith('.'),
    });
  }

  return refs;
};

export const parseExports = (file: ProjectFile): ExportReference[] => {
  const exports: ExportReference[] = [];
  const content = file.content;

  const namedDeclaration = /export\s+(?:default\s+)?(class|function|const|let|var|enum|interface|type)\s+([A-Za-z_$][\w$]*)/g;
  const namedList = /export\s*\{([^}]+)\}/g;
  const defaultNamed = /export\s+default\s+([A-Za-z_$][\w$]*)/g;

  for (const match of content.matchAll(namedDeclaration)) {
    const declaration = match[1] || '';
    const symbol = match[2] || '';
    const line = extractLineNumber(content, match.index || 0);

    exports.push({
      symbol,
      kind: inferKindFromDeclaration(declaration),
      line,
      isDefault: /export\s+default/.test(match[0] || ''),
    });
  }

  for (const match of content.matchAll(namedList)) {
    const inside = match[1] || '';
    const line = extractLineNumber(content, match.index || 0);
    parseImportSpecifiers(inside).forEach((symbol) => {
      if (symbol === 'default') return;
      exports.push({
        symbol,
        kind: 'variable',
        line,
        isDefault: false,
      });
    });
  }

  for (const match of content.matchAll(defaultNamed)) {
    const symbol = match[1] || '';
    const line = extractLineNumber(content, match.index || 0);

    if (exports.some((entry) => entry.symbol === symbol && entry.isDefault)) continue;

    exports.push({
      symbol,
      kind: 'variable',
      line,
      isDefault: true,
    });
  }

  return exports;
};

const DECISION_TOKENS = [
  /\bif\b/g,
  /\belse\s+if\b/g,
  /\bfor\b/g,
  /\bwhile\b/g,
  /\bcatch\b/g,
  /\bcase\b/g,
  /\?\s*[^:]+\s*:/g,
  /&&/g,
  /\|\|/g,
];

const COGNITIVE_TOKENS = [/\bif\b/g, /\bfor\b/g, /\bwhile\b/g, /\bswitch\b/g, /\bcatch\b/g];

const countMatches = (input: string, pattern: RegExp) => {
  let count = 0;
  const clone = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  while (clone.exec(input)) count += 1;
  return count;
};

const calculateCyclomaticComplexity = (body: string) => {
  let complexity = 1;
  DECISION_TOKENS.forEach((token) => {
    complexity += countMatches(body, token);
  });
  return complexity;
};

const calculateCognitiveComplexity = (body: string) => {
  const lines = body.split('\n');
  let score = 0;
  let nesting = 0;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const open = (trimmed.match(/\{/g) || []).length;
    const close = (trimmed.match(/\}/g) || []).length;

    let lineContribution = 0;
    COGNITIVE_TOKENS.forEach((token) => {
      lineContribution += countMatches(trimmed, token);
    });

    if (lineContribution > 0) {
      score += lineContribution + nesting;
    }

    nesting += open - close;
    if (nesting < 0) nesting = 0;
  });

  return score;
};

const classifyComplexityRisk = (cyclomatic: number, cognitive: number): 'low' | 'medium' | 'high' => {
  const weighted = cyclomatic + cognitive * 0.6;
  if (weighted >= 25) return 'high';
  if (weighted >= 12) return 'medium';
  return 'low';
};

const parseFunctions = (file: ProjectFile): Array<{ symbol: string; line: number; body: string }> => {
  const functions: Array<{ symbol: string; line: number; body: string }> = [];
  const content = file.content;

  const pattern = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;

  for (const match of content.matchAll(pattern)) {
    const name = match[1] || match[2] || 'anonymous';
    const startIndex = (match.index || 0) + (match[0]?.lastIndexOf('{') ?? 0);
    let i = startIndex;
    let depth = 0;

    while (i < content.length) {
      const char = content[i];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          const body = content.slice(startIndex + 1, i);
          functions.push({
            symbol: name,
            line: extractLineNumber(content, match.index || 0),
            body,
          });
          break;
        }
      }
      i += 1;
    }
  }

  return functions;
};

const normalizeForDuplication = (segment: string) => segment
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '"<str>"')
  .replace(/\b\d+(?:\.\d+)?\b/g, '<num>')
  .replace(/[\t ]+/g, ' ')
  .trim();

const simpleHash = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
};

export const findDuplicateFragments = (files: ProjectFile[], windowSize = 6): DuplicateFragment[] => {
  const fragments = new Map<string, DuplicateFragment>();

  files.forEach((file) => {
    const lines = file.content.split('\n');
    if (lines.length < windowSize) return;

    for (let i = 0; i <= lines.length - windowSize; i += 1) {
      const chunk = lines.slice(i, i + windowSize).join('\n');
      const normalized = normalizeForDuplication(chunk);
      if (normalized.length < 40) continue;

      const hash = simpleHash(normalized);
      const existing = fragments.get(hash);

      const occurrence = {
        filePath: file.path,
        startLine: i + 1,
        endLine: i + windowSize,
      };

      if (!existing) {
        fragments.set(hash, {
          hash,
          normalized,
          occurrences: [occurrence],
          totalLines: windowSize,
        });
      } else {
        existing.occurrences.push(occurrence);
      }
    }
  });

  return Array.from(fragments.values())
    .filter((entry) => entry.occurrences.length > 1)
    .sort((a, b) => b.occurrences.length * b.totalLines - a.occurrences.length * a.totalLines)
    .slice(0, 50);
};

const buildAdjacency = (importsByFile: Record<string, ImportReference[]>) => {
  const adjacency: Record<string, string[]> = {};

  Object.entries(importsByFile).forEach(([filePath, refs]) => {
    adjacency[filePath] = refs
      .map((ref) => ref.resolvedPath)
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizePath(value));
  });

  return adjacency;
};

const reverseAdjacency = (adjacency: Record<string, string[]>) => {
  const reverse: Record<string, string[]> = {};
  Object.keys(adjacency).forEach((node) => {
    if (!reverse[node]) reverse[node] = [];
  });

  Object.entries(adjacency).forEach(([from, list]) => {
    list.forEach((to) => {
      if (!reverse[to]) reverse[to] = [];
      reverse[to].push(from);
    });
  });

  return reverse;
};

const computeDepths = (adjacency: Record<string, string[]>) => {
  const inDegree: Record<string, number> = {};
  Object.keys(adjacency).forEach((node) => {
    inDegree[node] = 0;
  });

  Object.values(adjacency).forEach((edges) => {
    edges.forEach((to) => {
      if (!(to in inDegree)) inDegree[to] = 0;
      inDegree[to] += 1;
    });
  });

  const queue = Object.entries(inDegree)
    .filter(([, degree]) => degree === 0)
    .map(([node]) => node);

  const depth: Record<string, number> = {};
  queue.forEach((node) => {
    depth[node] = 0;
  });

  while (queue.length > 0) {
    const node = queue.shift() as string;
    const children = adjacency[node] || [];
    children.forEach((child) => {
      const nextDepth = (depth[node] || 0) + 1;
      depth[child] = Math.max(depth[child] || 0, nextDepth);
      inDegree[child] -= 1;
      if (inDegree[child] === 0) queue.push(child);
    });
  }

  Object.keys(adjacency).forEach((node) => {
    if (!(node in depth)) depth[node] = 0;
  });

  return depth;
};

const findDependencyCycles = (adjacency: Record<string, string[]>): DependencyCycle[] => {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles = new Map<string, DependencyCycle>();

  const dfs = (node: string) => {
    visiting.add(node);
    stack.push(node);

    (adjacency[node] || []).forEach((neighbor) => {
      if (!adjacency[neighbor]) return;

      if (!visited.has(neighbor) && !visiting.has(neighbor)) {
        dfs(neighbor);
        return;
      }

      if (visiting.has(neighbor)) {
        const idx = stack.lastIndexOf(neighbor);
        if (idx >= 0) {
          const cycleNodes = [...stack.slice(idx), neighbor];
          const canonical = cycleNodes.slice(0, -1).sort().join('|');
          if (!cycles.has(canonical)) {
            cycles.set(canonical, {
              nodes: cycleNodes,
              length: cycleNodes.length - 1,
            });
          }
        }
      }
    });

    stack.pop();
    visiting.delete(node);
    visited.add(node);
  };

  Object.keys(adjacency).forEach((node) => {
    if (!visited.has(node)) dfs(node);
  });

  return Array.from(cycles.values()).sort((a, b) => b.length - a.length);
};

const buildSymbolIndex = (files: ProjectFile[], exportsByFile: Record<string, ExportReference[]>, complexityBySymbol: Map<string, number>): SymbolDefinition[] => {
  const index: SymbolDefinition[] = [];

  files.forEach((file) => {
    const lines = file.content.split('\n');
    const exports = exportsByFile[file.path] || [];

    lines.forEach((lineText, idx) => {
      const declarationMatch = lineText.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:export\s+)?class\s+([A-Za-z_$][\w$]*)|(?:export\s+)?(?:const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/);
      const symbol = declarationMatch?.[1] || declarationMatch?.[2] || declarationMatch?.[3];
      if (!symbol) return;

      const kind = inferKindFromDeclaration(lineText);
      const exported = exports.some((entry) => entry.symbol === symbol);
      const key = `${file.path}::${symbol}`;

      const dependencySymbols = Array.from(lineText.matchAll(/\b([A-Za-z_$][\w$]*)\b/g))
        .map((match) => match[1])
        .filter((token) => token !== symbol)
        .slice(0, 20);

      index.push({
        symbol,
        kind,
        filePath: file.path,
        line: idx + 1,
        exported,
        complexity: complexityBySymbol.get(key) || 1,
        dependencySymbols,
      });
    });
  });

  return index;
};

const findDeadSymbols = (
  symbols: SymbolDefinition[],
  files: ProjectFile[],
  importsByFile: Record<string, ImportReference[]>,
): DeadSymbol[] => {
  const joinedContent = files.map((file) => file.content).join('\n');
  const importMentions = new Map<string, number>();

  Object.values(importsByFile).forEach((refs) => {
    refs.forEach((ref) => {
      ref.specifiers.forEach((specifier) => {
        importMentions.set(specifier, (importMentions.get(specifier) || 0) + 1);
      });
    });
  });

  return symbols
    .filter((symbol) => symbol.kind !== 'type' && symbol.kind !== 'interface')
    .filter((symbol) => {
      const regex = new RegExp(`\\b${symbol.symbol}\\b`, 'g');
      const globalCount = countMatches(joinedContent, regex);
      const importedCount = importMentions.get(symbol.symbol) || 0;
      const selfOnly = globalCount <= 1;

      if (symbol.exported) {
        return importedCount === 0 && selfOnly;
      }

      return selfOnly;
    })
    .map((symbol) => {
      const importCount = importMentions.get(symbol.symbol) || 0;
      const reason: DeadSymbol['reason'] = symbol.exported
        ? importCount === 0
          ? 'never_referenced'
          : 'only_self_referenced'
        : 'not_exported_and_unreferenced';

      return {
        symbol: symbol.symbol,
        filePath: symbol.filePath,
        line: symbol.line,
        reason,
      };
    })
    .slice(0, 200);
};

export const evaluateLayerViolations = (
  importsByFile: Record<string, ImportReference[]>,
  rules: LayerRule[],
): LayerViolation[] => {
  const violations: LayerViolation[] = [];

  Object.entries(importsByFile).forEach(([filePath, refs]) => {
    const matchingRule = rules.find((rule) => rule.from.test(filePath));
    if (!matchingRule) return;

    refs.forEach((ref) => {
      const target = ref.resolvedPath || ref.source;
      if (!ref.isRelative || !target) return;

      const allowedByAny = matchingRule.allowed.some((allowed) => allowed.test(target));
      if (allowedByAny) return;

      violations.push({
        filePath,
        importPath: ref.source,
        line: ref.line,
        violatedRule: matchingRule.name,
        details: `File ${filePath} violates layer rule ${matchingRule.name} by importing ${target}.`,
      });
    });
  });

  return violations;
};

const computeDependencyInsights = (importsByFile: Record<string, ImportReference[]>): { nodes: DependencyNodeInsight[]; cycles: DependencyCycle[] } => {
  const adjacency = buildAdjacency(importsByFile);
  const reverse = reverseAdjacency(adjacency);
  const depth = computeDepths(adjacency);
  const cycles = findDependencyCycles(adjacency);
  const cycleSet = new Set(cycles.flatMap((cycle) => cycle.nodes));

  const nodes = Object.keys(adjacency)
    .sort()
    .map((filePath) => {
      const refs = importsByFile[filePath] || [];
      return {
        filePath,
        imports: refs
          .map((ref) => ref.resolvedPath)
          .filter((value): value is string => Boolean(value)),
        importedBy: reverse[filePath] || [],
        externalImports: refs.filter((ref) => ref.isExternal).map((ref) => ref.source),
        depth: depth[filePath] || 0,
        inCycle: cycleSet.has(filePath),
        fanIn: (reverse[filePath] || []).length,
        fanOut: refs.filter((ref) => Boolean(ref.resolvedPath)).length,
      };
    });

  return { nodes, cycles };
};

const buildComplexityReport = (files: ProjectFile[]): FunctionComplexity[] => {
  const report: FunctionComplexity[] = [];

  files.forEach((file) => {
    parseFunctions(file).forEach((fn) => {
      const cyclomatic = calculateCyclomaticComplexity(fn.body);
      const cognitive = calculateCognitiveComplexity(fn.body);
      const loc = fn.body.split('\n').filter((line) => line.trim().length > 0).length;
      const risk = classifyComplexityRisk(cyclomatic, cognitive);
      report.push({
        filePath: file.path,
        symbol: fn.symbol,
        line: fn.line,
        cyclomatic,
        cognitive,
        loc,
        risk,
      });
    });
  });

  return report.sort((a, b) => b.cyclomatic + b.cognitive - (a.cyclomatic + a.cognitive));
};

export const analyzeProjectIntelligence = (
  nodes: FileNode[],
  options?: {
    includeNonCodeFiles?: boolean;
    duplicationWindowSize?: number;
    layerRules?: LayerRule[];
  },
): ProjectIntelligenceReport => {
  const files = collectProjectFiles(nodes).filter((file) => (options?.includeNonCodeFiles ? true : TS_FILE.test(file.name)));
  const availablePaths = new Set(files.map((file) => normalizePath(file.path)));

  const importsByFile: Record<string, ImportReference[]> = {};
  const exportsByFile: Record<string, ExportReference[]> = {};

  files.forEach((file) => {
    importsByFile[file.path] = parseImports(file, availablePaths);
    exportsByFile[file.path] = parseExports(file);
  });

  const complexity = buildComplexityReport(files);
  const complexityBySymbol = new Map<string, number>();
  complexity.forEach((entry) => {
    complexityBySymbol.set(`${entry.filePath}::${entry.symbol}`, entry.cyclomatic + entry.cognitive);
  });

  const symbols = buildSymbolIndex(files, exportsByFile, complexityBySymbol);
  const duplicateFragments = findDuplicateFragments(files, options?.duplicationWindowSize || 6);
  const { nodes: dependencyGraph, cycles } = computeDependencyInsights(importsByFile);
  const deadSymbols = findDeadSymbols(symbols, files, importsByFile);
  const layerViolations = evaluateLayerViolations(importsByFile, options?.layerRules || []);

  const averageComplexity = complexity.length === 0
    ? 0
    : complexity.reduce((sum, entry) => sum + entry.cyclomatic, 0) / complexity.length;

  return {
    files,
    importsByFile,
    exportsByFile,
    symbols,
    complexity,
    duplicateFragments,
    dependencyGraph,
    cycles,
    deadSymbols,
    layerViolations,
    summary: {
      totalFiles: files.length,
      totalSymbols: symbols.length,
      averageComplexity: Number(averageComplexity.toFixed(2)),
      highRiskFunctions: complexity.filter((entry) => entry.risk === 'high').length,
      duplicateClusters: duplicateFragments.length,
      cycleCount: cycles.length,
      deadSymbols: deadSymbols.length,
      layerViolations: layerViolations.length,
    },
  };
};

const walkImpactedFiles = (starting: string[], reverseAdjacencyMap: Record<string, string[]>) => {
  const queue = [...starting];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift() as string;
    if (seen.has(node)) continue;
    seen.add(node);

    (reverseAdjacencyMap[node] || []).forEach((parent) => {
      if (!seen.has(parent)) queue.push(parent);
    });
  }

  return Array.from(seen);
};

export const estimateChangeImpact = (
  report: ProjectIntelligenceReport,
  changedFilePath: string,
): ChangeImpact => {
  const importsByFile = report.importsByFile;
  const adjacency = buildAdjacency(importsByFile);
  const reverse = reverseAdjacency(adjacency);
  const normalized = normalizePath(changedFilePath);

  const directlyImpacted = reverse[normalized] || [];
  const transitivelyImpacted = walkImpactedFiles(directlyImpacted, reverse).filter((path) => path !== normalized);

  const likelySymbols = report.symbols
    .filter((symbol) => transitivelyImpacted.includes(symbol.filePath) || directlyImpacted.includes(symbol.filePath))
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 20)
    .map((symbol) => `${symbol.filePath}:${symbol.symbol}`);

  const blastRadius = Math.min(100, Math.round(((directlyImpacted.length + transitivelyImpacted.length) / Math.max(1, report.files.length)) * 100));

  return {
    changedFilePath: normalized,
    directlyImpacted,
    transitivelyImpacted,
    symbolsLikelyImpacted: likelySymbols,
    blastRadius,
  };
};

export const suggestRefactorPlan = (report: ProjectIntelligenceReport): string[] => {
  const recommendations: string[] = [];

  const risky = report.complexity.filter((item) => item.risk === 'high').slice(0, 5);
  const mediumRisk = report.complexity.filter((item) => item.risk === 'medium').slice(0, 5);
  const targets = risky.length > 0 ? risky : mediumRisk;
  targets.forEach((entry) => {
    recommendations.push(
      `Reduce complexity in ${entry.filePath}:${entry.symbol} (cyclomatic=${entry.cyclomatic}, cognitive=${entry.cognitive}).`,
    );
  });

  report.cycles.slice(0, 5).forEach((cycle) => {
    recommendations.push(`Break dependency cycle: ${cycle.nodes.join(' -> ')}.`);
  });

  report.deadSymbols.slice(0, 10).forEach((symbol) => {
    recommendations.push(`Remove or integrate dead symbol ${symbol.filePath}:${symbol.symbol} (${symbol.reason}).`);
  });

  report.duplicateFragments.slice(0, 5).forEach((fragment) => {
    const sample = fragment.occurrences
      .slice(0, 3)
      .map((occurrence) => `${occurrence.filePath}:${occurrence.startLine}-${occurrence.endLine}`)
      .join(', ');
    recommendations.push(`Extract duplicate logic found in ${sample}.`);
  });

  report.layerViolations.slice(0, 10).forEach((violation) => {
    recommendations.push(
      `Fix architecture violation in ${violation.filePath}:${violation.line}; ${violation.details}`,
    );
  });

  if (recommendations.length === 0) {
    recommendations.push('No urgent structural issues detected. Focus on adding performance baselines and regression coverage.');
  }

  return recommendations;
};

export const compareProjectIntelligence = (
  baseline: ProjectIntelligenceReport,
  candidate: ProjectIntelligenceReport,
) => {
  const summaryDelta = {
    files: candidate.summary.totalFiles - baseline.summary.totalFiles,
    symbols: candidate.summary.totalSymbols - baseline.summary.totalSymbols,
    averageComplexity: Number((candidate.summary.averageComplexity - baseline.summary.averageComplexity).toFixed(2)),
    highRiskFunctions: candidate.summary.highRiskFunctions - baseline.summary.highRiskFunctions,
    duplicateClusters: candidate.summary.duplicateClusters - baseline.summary.duplicateClusters,
    cycleCount: candidate.summary.cycleCount - baseline.summary.cycleCount,
    deadSymbols: candidate.summary.deadSymbols - baseline.summary.deadSymbols,
    layerViolations: candidate.summary.layerViolations - baseline.summary.layerViolations,
  };

  const addedCycles = candidate.cycles
    .map((cycle) => cycle.nodes.join('|'))
    .filter((cycle) => !baseline.cycles.some((entry) => entry.nodes.join('|') === cycle));

  const removedCycles = baseline.cycles
    .map((cycle) => cycle.nodes.join('|'))
    .filter((cycle) => !candidate.cycles.some((entry) => entry.nodes.join('|') === cycle));

  const newlyRiskyFunctions = candidate.complexity
    .filter((entry) => entry.risk === 'high')
    .filter((entry) => !baseline.complexity.some((base) => base.filePath === entry.filePath && base.symbol === entry.symbol && base.risk === 'high'))
    .map((entry) => `${entry.filePath}:${entry.symbol}`);

  return {
    summaryDelta,
    addedCycles,
    removedCycles,
    newlyRiskyFunctions,
  };
};

export const buildProjectIntelligenceSnapshot = (nodes: FileNode[]) => {
  const flat = flattenFiles(nodes);
  const totalLines = flat.reduce((sum, file) => sum + (file.content || '').split('\n').length, 0);
  const totalBytes = flat.reduce((sum, file) => sum + (file.content || '').length, 0);

  const languageDistribution = flat.reduce<Record<string, number>>((acc, file) => {
    const ext = file.name.split('.').pop() || 'unknown';
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});

  const report = analyzeProjectIntelligence(nodes);

  return {
    createdAt: new Date().toISOString(),
    totalFiles: flat.length,
    totalLines,
    totalBytes,
    languageDistribution,
    summary: report.summary,
    topHotspots: report.complexity.slice(0, 10).map((item) => ({
      filePath: item.filePath,
      symbol: item.symbol,
      score: item.cyclomatic + item.cognitive,
    })),
  };
};

export const toMermaidDependencyGraph = (report: ProjectIntelligenceReport, maxEdges = 120) => {
  const edges: string[] = [];
  const seen = new Set<string>();

  report.dependencyGraph.forEach((node) => {
    node.imports.forEach((target) => {
      const id = `${node.filePath}->${target}`;
      if (seen.has(id)) return;
      seen.add(id);
      edges.push(`  \"${stripExtension(node.filePath)}\" --> \"${stripExtension(target)}\"`);
    });
  });

  const clipped = edges.slice(0, maxEdges);
  return ['graph TD', ...clipped].join('\n');
};
