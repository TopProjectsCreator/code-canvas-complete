import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEMPLATES } from '@/data/templateRegistry';
import { getFileLanguage, getTemplateFiles } from '@/data/defaultFiles';

const getRootChildren = (templateId: Parameters<typeof getTemplateFiles>[0]) => {
  const root = getTemplateFiles(templateId)[0];
  return root.children ?? [];
};

describe('wandbox language templates', () => {
  it('keeps swift and removes cobol from template metadata', () => {
    const ids = new Set<string>(TEMPLATES.map((t) => t.id));
    expect(ids.has('swift')).toBe(true);
    expect(ids.has('cobol')).toBe(false);
  });

  it('adds starter templates for additional wandbox languages', () => {
    const expectedMainFiles: Array<[Parameters<typeof getTemplateFiles>[0], string]> = [
      ['crystal', 'main.cr'],
      ['elixir', 'main.exs'],
      ['erlang', 'main.erl'],
      ['julia', 'main.jl'],
      ['ocaml', 'main.ml'],
      ['pony', 'main.pony'],
      ['scala', 'main.scala'],
      ['vim', 'main.vim'],
      ['lazyk', 'main.lazy'],
    ];

    for (const [template, fileName] of expectedMainFiles) {
      const files = getRootChildren(template);
      expect(files.some((f) => f.name === fileName)).toBe(true);
    }
  });


  it('keeps execute-code language map in sync with new wandbox templates', () => {
    const executeCodeSource = readFileSync(
      resolve(process.cwd(), 'supabase/functions/execute-code/index.ts'),
      'utf-8',
    );

    for (const language of ['swift', 'crystal', 'elixir', 'erlang', 'julia', 'ocaml', 'pony', 'scala', 'vim', 'lazyk']) {
      expect(executeCodeSource).toContain(`'${language}':`);
    }
  });

  it('detects extensions for newly added wandbox languages', () => {
    expect(getFileLanguage('main.swift')).toBe('swift');
    expect(getFileLanguage('main.cr')).toBe('crystal');
    expect(getFileLanguage('script.exs')).toBe('elixir');
    expect(getFileLanguage('main.erl')).toBe('erlang');
    expect(getFileLanguage('analysis.jl')).toBe('julia');
    expect(getFileLanguage('main.ml')).toBe('ocaml');
    expect(getFileLanguage('app.pony')).toBe('pony');
    expect(getFileLanguage('Main.scala')).toBe('scala');
    expect(getFileLanguage('plugin.vim')).toBe('vim');
    expect(getFileLanguage('main.lazy')).toBe('lazyk');
  });
});
