import { describe, expect, it } from 'vitest';
import { applySuggestion, buildRegexPreview, extractColorPalette, extractDependencyGraph, generateReviewSuggestions, generateUnitTestFile } from '@/lib/advancedWorkbench';
import type { FileNode } from '@/types/ide';

const files: FileNode[] = [
  {
    id: 'root',
    name: 'src',
    type: 'folder',
    children: [
      {
        id: '1',
        name: 'demo.ts',
        type: 'file',
        language: 'typescript',
        content: "import { helper } from './helper';\nconst accent = '#7c3aed';\nexport function greet(name: string) {\n  console.log(name);\n  return helper(name);\n}",
      },
      {
        id: '2',
        name: 'helper.ts',
        type: 'file',
        language: 'typescript',
        content: 'export function helper(value: string) { return value; }',
      },
    ],
  },
];

describe('advancedWorkbench helpers', () => {
  it('generates actionable review suggestions and applies them', () => {
    const suggestions = generateReviewSuggestions(files[0].children?.[0].content || '');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(applySuggestion(files[0].children?.[0].content || '', suggestions[0])).toContain('logger.debug');
  });

  it('creates a generated test file for exported functions', () => {
    const generated = generateUnitTestFile('demo.ts', files[0].children?.[0].content || '');
    expect(generated.fileName).toBe('demo.generated.test.ts');
    expect(generated.content).toContain("describe('greet'");
  });

  it('builds regex previews and dependency graphs', () => {
    const preview = buildRegexPreview(files, 'helper', 'utility');
    const graph = extractDependencyGraph(files);
    expect(preview[0].matches[0].preview).toContain('utility');
    expect(graph[0].imports).toContain('./helper');
  });

  it('extracts color palette tokens across files', () => {
    expect(extractColorPalette(files)).toContain('#7c3aed');
  });
});
