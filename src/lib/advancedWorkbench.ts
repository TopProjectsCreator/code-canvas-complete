import { FileNode } from '@/types/ide';

export interface ScopeHeader {
  name: string;
  line: number;
  endLine: number;
  depth: number;
  kind: 'function' | 'class' | 'block';
}

export interface ReviewSuggestion {
  id: string;
  line: number;
  title: string;
  reason: string;
  before: string;
  after: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RegexPreview {
  fileId: string;
  fileName: string;
  matches: Array<{
    line: number;
    original: string;
    preview: string;
  }>;
}

export interface DependencyNode {
  fileName: string;
  imports: string[];
}

export interface SymbolInsight {
  symbol: string;
  kind: 'function' | 'class' | 'variable';
  line: number;
  explanation: string;
}

export const flattenFiles = (nodes: FileNode[]): FileNode[] => {
  const out: FileNode[] = [];
  const walk = (items: FileNode[]) => {
    items.forEach((item) => {
      if (item.type === 'file') out.push(item);
      if (item.children) walk(item.children);
    });
  };
  walk(nodes);
  return out;
};

export const getLine = (content: string, line: number) => content.split('\n')[line - 1] || '';

export const extractScopeHeaders = (content: string): ScopeHeader[] => {
  const lines = content.split('\n');
  const scopes: ScopeHeader[] = [];
  const stack: Array<{ index: number; braceDepth: number }> = [];
  let braceDepth = 0;

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const trimmed = line.trim();
    const functionMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|^([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
    const classMatch = trimmed.match(/^export\s+class\s+([A-Za-z_$][\w$]*)|^class\s+([A-Za-z_$][\w$]*)/);

    if (functionMatch || classMatch) {
      const name = functionMatch?.[1] || functionMatch?.[2] || functionMatch?.[3] || classMatch?.[1] || classMatch?.[2] || 'scope';
      const kind = classMatch ? 'class' : 'function';
      scopes.push({ name, line: lineNo, endLine: lines.length, depth: braceDepth, kind });
      stack.push({ index: scopes.length - 1, braceDepth });
    }

    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    braceDepth += opens - closes;

    while (stack.length > 0 && braceDepth <= stack[stack.length - 1].braceDepth) {
      const openScope = stack.pop();
      if (openScope) scopes[openScope.index].endLine = lineNo;
    }
  });

  return scopes;
};

export const getScopeForLine = (content: string, line: number): ScopeHeader | null => {
  const scopes = extractScopeHeaders(content);
  return scopes.find((scope) => line >= scope.line && line <= scope.endLine) || scopes[0] || null;
};

const createSuggestion = (
  id: string,
  line: number,
  title: string,
  reason: string,
  before: string,
  after: string,
  severity: ReviewSuggestion['severity'],
): ReviewSuggestion => ({ id, line, title, reason, before, after, severity });

export const generateReviewSuggestions = (content: string): ReviewSuggestion[] => {
  const suggestions: ReviewSuggestion[] = [];
  content.split('\n').forEach((lineText, index) => {
    const line = index + 1;
    if (lineText.includes('console.log')) {
      suggestions.push(
        createSuggestion(
          `console-${line}`,
          line,
          'Swap console.log for structured debug logging',
          'This keeps production bundles cleaner and makes logs easier to filter.',
          lineText,
          lineText.replace('console.log', 'logger.debug'),
          'medium',
        ),
      );
    }

    if (/\bvar\b/.test(lineText)) {
      suggestions.push(
        createSuggestion(
          `var-${line}`,
          line,
          'Upgrade var to const',
          'Prefer block scoping and immutability by default.',
          lineText,
          lineText.replace(/\bvar\b/, 'const'),
          'high',
        ),
      );
    }

    if (/TODO|FIXME/.test(lineText)) {
      suggestions.push(
        createSuggestion(
          `todo-${line}`,
          line,
          'Convert TODO into an actionable guard',
          'Leaving placeholders in the hot path hides unfinished behavior.',
          lineText,
          `${lineText}\nthrow new Error('Pending implementation');`,
          'low',
        ),
      );
    }
  });

  return suggestions;
};

export const applySuggestion = (content: string, suggestion: ReviewSuggestion) => {
  const lines = content.split('\n');
  lines[suggestion.line - 1] = suggestion.after;
  return lines.join('\n');
};

export const extractSymbols = (content: string): SymbolInsight[] => {
  const lines = content.split('\n');
  const insights: SymbolInsight[] = [];

  lines.forEach((line, index) => {
    const functionMatch = line.match(/function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/);
    const classMatch = line.match(/class\s+([A-Za-z_$][\w$]*)/);
    const variableMatch = line.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
    const symbol = functionMatch?.[1] || functionMatch?.[2] || classMatch?.[1] || variableMatch?.[1];
    if (!symbol) return;
    const kind = classMatch ? 'class' : functionMatch ? 'function' : 'variable';
    insights.push({
      symbol,
      kind,
      line: index + 1,
      explanation:
        kind === 'function'
          ? `${symbol} looks like a reusable operation entry point. It likely coordinates inputs, transforms state, and returns a computed result.`
          : kind === 'class'
            ? `${symbol} appears to model a stateful domain object or service boundary with methods grouped by responsibility.`
            : `${symbol} stores derived state or a configuration value that other logic depends on.`,
    });
  });

  return insights;
};

export const generateUnitTestFile = (fileName: string, content: string) => {
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const exportedFunctions = Array.from(content.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)).map((match) => match[1]);
  const fallbackFunctions = Array.from(content.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)).map((match) => match[1]);
  const targets = Array.from(new Set(exportedFunctions.length > 0 ? exportedFunctions : fallbackFunctions)).slice(0, 4);

  const cases = (targets.length > 0 ? targets : ['subject']).map((target) => `describe('${target}', () => {\n  it('handles the happy path', () => {\n    expect(${target}).toBeDefined();\n  });\n\n  it('guards edge cases', () => {\n    expect(() => ${target}).not.toThrow();\n  });\n});`).join('\n\n');

  const imports = targets.length > 0 ? `{ ${targets.join(', ')} }` : '* as subject';

  return {
    fileName: `${baseName}.generated.test.ts`,
    content: `import { describe, expect, it } from 'vitest';\nimport ${imports} from './${baseName}';\n\n${cases}\n`,
  };
};

export const buildRegexPreview = (files: FileNode[], pattern: string, replacement: string) => {
  if (!pattern.trim()) return [] as RegexPreview[];

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'g');
  } catch {
    return [] as RegexPreview[];
  }

  return flattenFiles(files)
    .map((file) => {
      const content = file.content || '';
      const matches = content.split('\n').flatMap((lineText, index) => {
        regex.lastIndex = 0;
        return regex.test(lineText)
          ? [{ line: index + 1, original: lineText, preview: lineText.replace(new RegExp(pattern, 'g'), replacement) }]
          : [];
      });
      return { fileId: file.id, fileName: file.name, matches };
    })
    .filter((entry) => entry.matches.length > 0);
};

export const extractDependencyGraph = (files: FileNode[]): DependencyNode[] => flattenFiles(files)
  .filter((file) => /\.(t|j)sx?$|\.mjs$|\.cjs$/.test(file.name))
  .map((file) => ({
    fileName: file.name,
    imports: Array.from((file.content || '').matchAll(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)).map((match) => match[1] || match[2]),
  }));

export const extractColorPalette = (files: FileNode[]) => {
  const colors = new Set<string>();
  flattenFiles(files).forEach((file) => {
    const content = file.content || '';
    Array.from(content.matchAll(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6,8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)).forEach((match) => {
      colors.add(match[0]);
    });
  });
  return Array.from(colors).slice(0, 24);
};
