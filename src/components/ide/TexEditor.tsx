import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FileNode } from '@/types/ide';
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Code } from 'lucide-react';
import { tokenize, getTokenClass, escapeHtml } from '@/lib/syntax';
import { TexToolbar } from './tex/TexToolbar';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface TexEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
  allFiles?: FileNode[];
}

/* ─── File lookup helper ─── */

function findFileContent(files: FileNode[] | undefined, name: string): string | null {
  if (!files) return null;
  const searchName = name.endsWith('.tex') || name.includes('.') ? name : `${name}.tex`;
  for (const node of files) {
    if (node.type === 'file' && (node.name === searchName || node.name === name)) {
      return node.content ?? null;
    }
    if (node.children) {
      const found = findFileContent(node.children, name);
      if (found) return found;
    }
  }
  return null;
}

/* ─── LaTeX → KaTeX preview ─── */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripComments(latex: string): string {
  return latex.replace(/^[ \t]*%.*$/gm, '').replace(/(?<!\\)%/g, '\\%');
}

function preprocessLatexForKatex(text: string): string {
  return text
    .replace(/\\(begin|end)\{([^}]*)\}/g, () => '')
    .replace(/\\(?:label|tag)\{([^}]*)\}/g, '')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .trim();
}

const MATH_TAGS = ['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*'];

function envToHtml(env: string, body: string): string {
  const e = env.replace(/\*$/, '');
  if (MATH_TAGS.some((t) => t === env)) {
    try {
      const katex = katex;
      return katex.renderToString(body, { displayMode: true, throwOnError: false });
    } catch {
      return `<div class="text-red-400 font-mono text-xs">[LaTeX error in ${env}]</div>`;
    }
  }
  if (e === 'itemize') {
    return `<ul class="list-disc pl-6 my-2 space-y-1">${wrapItems(body, 'itemize')}</ul>`;
  }
  if (e === 'enumerate') {
    return `<ol class="list-decimal pl-6 my-2 space-y-1">${wrapItems(body, 'enumerate')}</ol>`;
  }
  if (e === 'description') {
    return `<dl class="my-2 space-y-1">${body}</dl>`;
  }
  if (e === 'abstract') {
    return `<div class="my-4 px-4 py-3 border-l-2 border-primary/40 bg-muted/30 italic text-sm text-muted-foreground"><strong class="not-italic text-foreground">Abstract</strong><br/>${body}</div>`;
  }
  if (e === 'verbatim') {
    return `<pre class="my-2 p-3 rounded bg-muted font-mono text-sm overflow-x-auto">${escapeHtml(body)}</pre>`;
  }
  if (e === 'quote' || e === 'quotation') {
    return `<blockquote class="border-l-2 border-primary/30 pl-4 my-2 italic text-muted-foreground">${body}</blockquote>`;
  }
  if (e === 'center') {
    return `<div class="text-center my-2">${body}</div>`;
  }
  if (e === 'flushleft') {
    return `<div class="text-left my-2">${body}</div>`;
  }
  if (e === 'flushright') {
    return `<div class="text-right my-2">${body}</div>`;
  }
  if (e === 'tabular' || e === 'array') {
    return latexTableToHtml(body);
  }
  if (e === 'minipage') {
    return `<div class="my-2">${body}</div>`;
  }
  if (e === 'figure') {
    return `<div class="my-4 text-center">${inlineCommands(body)}</div>`;
  }
  if (e === 'table') {
    return `<div class="my-4">${inlineCommands(body)}</div>`;
  }
  if (e === 'lstlisting' || e === 'minted') {
    return `<pre class="my-2 p-3 rounded bg-muted font-mono text-sm overflow-x-auto">${escapeHtml(body)}</pre>`;
  }
  const theoremEnvs = ['theorem', 'lemma', 'corollary', 'proposition', 'conjecture', 'claim'];
  if (theoremEnvs.includes(e)) {
    return `<div class="my-3 p-3 border-l-2 border-blue-500/50 bg-blue-50/5 italic"><strong class="not-italic text-blue-600 capitalize">${e}.</strong> ${inlineCommands(body)}</div>`;
  }
  if (e === 'proof') {
    return `<div class="my-3 p-3 border-l-2 border-green-500/50 bg-green-50/5">${inlineCommands(body)}<span class="ml-1">∎</span></div>`;
  }
  if (e === 'definition') {
    return `<div class="my-3 p-3 border-l-2 border-orange-500/50 bg-orange-50/5"><strong class="not-italic text-orange-600 capitalize">Definition.</strong> ${inlineCommands(body)}</div>`;
  }
  if (e === 'example') {
    return `<div class="my-3 p-3 border-l-2 border-purple-500/50 bg-purple-50/5"><strong class="not-italic text-purple-600 capitalize">Example.</strong> ${inlineCommands(body)}</div>`;
  }
  if (e === 'remark') {
    return `<div class="my-3 p-3 border-l-2 border-gray-400/50 bg-gray-50/5 text-sm"><strong class="not-italic text-gray-500 capitalize">Remark.</strong> ${inlineCommands(body)}</div>`;
  }
  if (e === 'note') {
    return `<div class="my-3 p-3 border-l-2 border-yellow-500/50 bg-yellow-50/5"><strong class="not-italic text-yellow-700 capitalize">Note.</strong> ${inlineCommands(body)}</div>`;
  }
  return body;
}

function wrapItems(body: string, type: string): string {
  const items = body.split(/(?<!\\)\\item\b/).filter(Boolean);
  return items.map((item) => `<li class="ml-0">${inlineCommands(cleanItem(item))}</li>`).join('\n');
}

function cleanItem(item: string): string {
  return item.replace(/\[([^\]]*)\]/g, '').trim();
}

function latexTableToHtml(body: string): string {
  const rows = body.split('\\\\').filter(Boolean);
  const parts: string[] = [];
  for (const row of rows) {
    const cols = row.split('&').map((c) => inlineCommands(c.trim()));
    parts.push(`<tr>${cols.map((c) => `<td class="px-3 py-1 border border-border">${c}</td>`).join('')}</tr>`);
  }
  return `<table class="my-2 border-collapse"><tbody>${parts.join('')}</tbody></table>`;
}

function inlineCommands(text: string): string {
  let result = text;
  result = result.replace(/---/g, '\u2014');
  result = result.replace(/--/g, '\u2013');
  result = result.replace(/``/g, '\u201c');
  result = result.replace(/''/g, '\u201d');
  result = result.replace(/\\(?:text)?tilde\{\}/g, '~');
  result = result.replace(/\\(?:text)?asciitilde\{\}/g, '~');
  result = result.replace(/\\(?:text)?backslash\{\}/g, '\\');
  result = result.replace(/\\(?:text)?asciicircum\{\}/g, '^');
  result = result.replace(/\\(?:text)?degree\{\}/g, '\u00b0');
  result = result.replace(/\\(?:text)?copyright\{\}/g, '\u00a9');
  result = result.replace(/\\(?:text)?registered\{\}/g, '\u00ae');
  result = result.replace(/\\(?:text)?trademark\{\}/g, '\u2122');
  result = result.replace(/\\#/g, '#');
  result = result.replace(/\\\$/g, '$');
  result = result.replace(/\\%/g, '%');
  result = result.replace(/\\&/g, '&');
  result = result.replace(/\\_/g, '_');
  result = result.replace(/\\\{/g, '{');
  result = result.replace(/\\\}/g, '}');
  result = result.replace(/\\(?:text)?backslash/g, '\\');
  result = result.replace(/\\textbackslash\s+/g, '\\');
  result = result.replace(/~+/g, '\u00a0');
  result = result.replace(/\\glqq/g, '\u201e');
  result = result.replace(/\\grqq/g, '\u201c');
  result = result.replace(/\\glq/g, '\u201a');
  result = result.replace(/\\grq/g, '\u2018');
  result = result.replace(/\\(?:emph|textit)\{([^}]*)\}/g, '<em>$1</em>');
  result = result.replace(/\\(?:textbf|mathbf)\{([^}]*)\}/g, '<strong>$1</strong>');
  result = result.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  result = result.replace(/\\texttt\{([^}]*)\}/g, '<code>$1</code>');
  result = result.replace(/\\textsc\{([^}]*)\}/g, '<span class="uppercase tracking-wider text-xs">$1</span>');
  result = result.replace(/\\textsf\{([^}]*)\}/g, '<span class="font-sans">$1</span>');
  result = result.replace(/\\textrm\{([^}]*)\}/g, '<span class="font-serif">$1</span>');
  result = result.replace(/\\textnormal\{([^}]*)\}/g, '$1');
  result = result.replace(/\\textup\{([^}]*)\}/g, '$1');
  result = result.replace(/\\textsl\{([^}]*)\}/g, '<span class="italic">$1</span>');
  result = result.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '<a href="$1" class="text-primary underline underline-offset-2 hover:text-primary/80" target="_blank" rel="noopener noreferrer">$2</a>');
  result = result.replace(/\\url\{([^}]*)\}/g, '<a href="$1" class="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">$1</a>');
  result = result.replace(/\\today\b/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  result = result.replace(/\\TeX\b/g, 'T<sub>E</sub>X');
  result = result.replace(/\\LaTeXe\b/g, 'L<sub>A</sub>T<sub>E</sub>X 2<sub>\u03b5</sub>');
  result = result.replace(/\\LaTeX\b/g, 'L<sub>A</sub>T<sub>E</sub>X');
  result = result.replace(/\\includegraphics(?:\[([^\]]*)\])?\{([^}]*)\}/g, (_, opts, path) => {
    return `<span class="inline-flex items-center gap-1 text-xs text-muted-foreground border border-dashed border-border rounded px-2 py-1 my-1"><svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 16 5-5 3 3 4-4 6 6"/></svg> ${escapeHtml(path)}</span>`;
  });

  const toCssColor = (model: string | undefined, color: string) => {
    if (!model) return escapeHtml(color);
    if (model === 'rgb') return `rgb(${escapeHtml(color)})`;
    if (model === 'gray') {
      const grayVal = Math.round(parseFloat(color) * 255);
      return `rgb(${grayVal},${grayVal},${grayVal})`;
    }
    return escapeHtml(color);
  };
  result = result.replace(/\\textcolor(?:\[([^\]]*)\])?\{([^}]*)\}\{([^}]*)\}/g, (_, model, color, text) => {
    return `<span style="color:${toCssColor(model, color)}">${inlineCommands(text)}</span>`;
  });
  result = result.replace(/\\colorbox(?:\[([^\]]*)\])?\{([^}]*)\}\{([^}]*)\}/g, (_, model, color, text) => {
    return `<span style="background:${toCssColor(model, color)};padding:1px 4px;border-radius:2px">${inlineCommands(text)}</span>`;
  });
  result = result.replace(/\\fcolorbox\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g, (_, border, fill, text) => {
    return `<span style="border:1px solid ${escapeHtml(border)};background:${escapeHtml(fill)};padding:1px 4px;border-radius:2px;display:inline-block">${inlineCommands(text)}</span>`;
  });
  result = result.replace(/\\fbox\{([^}]*)\}/g, (_, text) => {
    return `<span class="inline-block border border-border rounded px-1.5 py-0.5">${inlineCommands(text)}</span>`;
  });
  result = result.replace(/\\framebox(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?\{([^}]*)\}/g, (_, _w, _p, text) => {
    return `<span class="inline-block border border-border rounded px-1.5 py-0.5">${inlineCommands(text)}</span>`;
  });
  result = result.replace(/\\sout\{([^}]*)\}/g, '<s>$1</s>');
  result = result.replace(/\\rotatebox(?:\[([^\]]*)\])?\{([^}]*)\}\{([^}]*)\}/g, (_, _opts, angle, text) => {
    return `<span style="display:inline-block;transform:rotate(${angle}deg);transform-origin:center">${inlineCommands(text)}</span>`;
  });
  result = result.replace(/\\scalebox\{([^}]*)\}\{([^}]*)\}/g, (_, factor, text) => {
    return `<span style="display:inline-block;transform:scale(${factor});transform-origin:top left">${inlineCommands(text)}</span>`;
  });
  result = result.replace(/\\raisebox(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?\{([^}]*)\}\{([^}]*)\}/g, (_, _h, _d, distance, text) => {
    return `<span style="position:relative;top:${distance.startsWith('-') ? distance.slice(1) : '-' + distance};display:inline-block">${inlineCommands(text)}</span>`;
  });
  result = result.replace(/\\parbox(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?\{([^}]*)\}\{([^}]*)\}/g, (_, align, _h, _i, width, text) => {
    const va = align === 'b' ? 'bottom' : align === 'c' ? 'middle' : 'top';
    return `<div style="display:inline-block;width:${escapeHtml(width)};vertical-align:${va}">${inlineCommands(text)}</div>`;
  });
  result = result.replace(/\\rule(?:\[([^\]]*)\])?\{([^}]*)\}\{([^}]*)\}/g, (_, raise, width, height) => {
    return `<span style="display:inline-block;width:${escapeHtml(width)};height:${escapeHtml(height)};background:currentColor;${raise ? `vertical-align:${parseFloat(raise) > 0 ? 'top' : 'bottom'};` : 'vertical-align:middle;'}"></span>`;
  });
  result = result.replace(/\\caption(?:\[([^\]]*)\])?\{([^}]*)\}/g, (_, _short, text) => {
    return `<div class="text-sm text-muted-foreground mt-1">${inlineCommands(text)}</div>`;
  });

  result = result.replace(/\\begin\{([^}]*)\}([\s\S]*?)\\end\{\1\}/g, (_, env, body) => {
    const e = env.replace(/\*$/, '');
    if (MATH_TAGS.some((t) => t === env)) {
      try {
        const katex = katex;
        return katex.renderToString(preprocessLatexForKatex(body), { displayMode: true, throwOnError: false });
      } catch {
        return `<span class="text-red-400">[${env} error]</span>`;
      }
    }
    if (e === 'itemize' || e === 'enumerate') {
      const items = body.split(/(?<!\\)\\item\b/).filter(Boolean);
      const tag = e === 'itemize' ? 'ul' : 'ol';
      return `<${tag} class="list-${e === 'itemize' ? 'disc' : 'decimal'} pl-6 my-2 space-y-1">${items.map((it) => `<li>${inlineCommands(cleanItem(it))}</li>`).join('')}</${tag}>`;
    }
    if (e === 'description') {
      const items = body.split(/(?<!\\)\\item\b/).filter(Boolean);
      return `<dl class="my-2 space-y-1">${items.map((it) => {
        const m = it.match(/^\[([^\]]*)\]/);
        const label = m ? m[1] : '';
        const content = it.replace(/\[([^\]]*)\]/, '').trim();
        return `<dt class="font-semibold">${inlineCommands(label)}</dt><dd class="ml-4">${inlineCommands(content)}</dd>`;
      }).join('')}</dl>`;
    }
    return envToHtml(env, body);
  });

  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      const katex = katex;
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="text-red-400">[math error]</span>`;
    }
  });

  result = result.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    if (math.trim().length === 0) return `$${math}$`;
    try {
      const katex = katex;
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `$${math}$`;
    }
  });

  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    try {
      const katex = katex;
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `\\(${math}\\)`;
    }
  });

  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    try {
      const katex = katex;
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `\\[${math}\\]`;
    }
  });

  return result;
}

function extractPreamble(latex: string): { title: string; author: string; date: string } {
  const preambleMatch = latex.match(/\\(?:begin\{document\})/);
  const preamble = preambleMatch ? latex.slice(0, preambleMatch.index) : latex;
  const title = preamble.match(/\\(?:title)\{([^}]*)\}/)?.[1] || '';
  const author = preamble.match(/\\(?:author)\{([^}]*)\}/)?.[1] || '';
  const date = (preamble.match(/\\(?:date)\{([^}]*)\}/)?.[1] || '').replace(/\\today\b/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  return { title: title.replace(/\\thanks\{[^}]*\}/g, ''), author, date };
}

function extractBody(latex: string): string {
  const bodyMatch = latex.match(/\\(?:begin\{document\})([\s\S]*?)\\(?:end\{document\})/);
  if (bodyMatch) return bodyMatch[1].trim();
  const docEnd = latex.indexOf('\\end{document}');
  if (docEnd >= 0) return latex.slice(0, docEnd).trim();
  return latex
    .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, '')
    .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g, '')
    .replace(/\\usepackage\[[^\]]*\]\{[^}]*\}/g, '')
    .replace(/\\\w+/, '')
    .trim();
}

function sectionLevel(level: number): string {
  const classes = [
    'text-2xl font-bold mt-6 mb-3',
    'text-xl font-semibold mt-5 mb-2',
    'text-lg font-medium mt-4 mb-2',
    'text-base font-medium mt-3 mb-1',
  ];
  return classes[Math.min(level - 1, classes.length - 1)] || classes[classes.length - 1];
}

function startsWithTag(line: string, tag: string): boolean {
  return line.startsWith(tag);
}

/* ─── Label / cross-reference registry ─── */

function buildLabelRegistry(text: string, allFiles?: FileNode[], visited?: Set<string>): Map<string, string> {
  const registry = new Map<string, string>();
  const seen = visited ?? new Set<string>();

  if (allFiles) {
    text = text.replace(/\\(?:include|input)\{([^}]*)\}/g, (_, file) => {
      if (seen.has(file)) return '';
      seen.add(file);
      const content = findFileContent(allFiles, file);
      if (content) {
        const sub = buildLabelRegistry(content, allFiles, seen);
        sub.forEach((v, k) => registry.set(k, v));
      }
      return '';
    });
  }

  const sec = [0, 0, 0, 0, 0];
  const secLevel: Record<string, number> = {
    chapter: 0, section: 0, subsection: 1, subsubsection: 2, paragraph: 3, subparagraph: 4,
  };
  let eq = 0, fig = 0, tbl = 0;
  let cx = '';

  const re = /\\begin\{([^}]*)\}|\\end\{([^}]*)\}|\\label\{([^}]*)\}|\\(chapter|section|subsection|subsubsection|paragraph|subparagraph)(\*?)(?:\[([^\]]*)\])?\{([^}]*)\}|\\appendix\b/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m[1]) {
      const env = m[1].replace(/\*$/, '');
      if (MATH_TAGS.includes(m[1])) { eq++; cx = 'eq'; }
      else if (env === 'figure') { fig++; cx = 'fig'; }
      else if (env === 'table') { tbl++; cx = 'tbl'; }
    } else if (m[2]) {
      const env = m[2].replace(/\*$/, '');
      if (MATH_TAGS.includes(m[2]) || env === 'figure' || env === 'table') cx = '';
    } else if (m[3]) {
      if (cx === 'eq') registry.set(m[3], String(eq));
      else if (cx === 'fig') registry.set(m[3], String(fig));
      else if (cx === 'tbl') registry.set(m[3], String(tbl));
      else registry.set(m[3], cx || '0');
    } else if (m[4]) {
      if (!m[5]) {
        const idx = secLevel[m[4]];
        sec[idx]++;
        for (let i = idx + 1; i < sec.length; i++) sec[i] = 0;
        cx = sec.filter(s => s > 0).join('.');
      }
    } else if (m[0] === '\\appendix') {
      sec.fill(0);
    }
  }

  return registry;
}

function convertBody(body: string, allFiles?: FileNode[], labelRegistry?: Map<string, string>, visited?: Set<string>): string {
  let result = body;
  const registry = labelRegistry ?? buildLabelRegistry(body, allFiles);

  /* ─── TOC generation ─── */
  const tocEntries: { level: number; title: string }[] = [];
  const tocSectionRe = /\\(?:section|subsection|subsubsection|chapter)\*?(?:\[([^\]]*)\])?\{([^}]*)\}/g;
  let tocMatch: RegExpExecArray | null;
  while ((tocMatch = tocSectionRe.exec(result)) !== null) {
    const cmd = tocMatch[0].startsWith('\\chapter') ? 1
      : tocMatch[0].startsWith('\\section') ? 1
      : tocMatch[0].startsWith('\\subsection') ? 2
      : tocMatch[0].startsWith('\\subsubsection') ? 3 : 1;
    tocEntries.push({ level: cmd, title: tocMatch[2] });
  }
  if (tocEntries.length > 0) {
    const tocHtml = `<div class="my-4 p-4 border border-border rounded"><h2 class="text-xl font-bold mb-3">Contents</h2><nav>${tocEntries.map(e =>
      `<div class="${e.level === 1 ? 'font-medium' : e.level === 2 ? 'ml-4 text-sm' : 'ml-8 text-sm text-muted-foreground'} py-0.5">${inlineCommands(e.title)}</div>`
    ).join('')}</nav></div>`;
    result = result.replace(/\\tableofcontents\b/g, tocHtml);
  } else {
    result = result.replace(/\\tableofcontents\b/g, '');
  }

  result = result.replace(/\\(?:part)\*?(?:\[([^\]]*)\])?\{([^}]*)\}/g,
    '<div class="text-3xl font-bold mt-8 mb-4 text-center">$2</div>');

  const sectionLevels = [
    { cmd: 'chapter', level: 1 },
    { cmd: 'section', level: 1 },
    { cmd: 'subsection', level: 2 },
    { cmd: 'subsubsection', level: 3 },
    { cmd: 'paragraph', level: 4 },
    { cmd: 'subparagraph', level: 5 },
  ];

  for (const { cmd, level } of sectionLevels) {
    const re = new RegExp(`\\\\${cmd}\\*?(?:\\[([^\\]]*)\\])?\\{([^}]*)\\}`, 'g');
    result = result.replace(re, (_, alt, title) => {
      return `</div><div class="${sectionLevel(level)}">${inlineCommands(alt || title)}</div><div class="mb-1">`;
    });
  }

  result = result.replace(/\\(?:appendix)\b/g, '<div class="text-2xl font-bold mt-8 mb-4 border-t pt-4">Appendix</div>');
  result = result.replace(/\\(?:maketitle)\b/g, '');
  result = result.replace(/\\(?:begin\{document\})/, '');
  result = result.replace(/\\(?:end\{document\})/, '');
  result = result.replace(/\\(?:vspace|hspace)\*?\{[^}]*\}/g, '');
  result = result.replace(/\\(?:smallskip|medskip|bigskip|noindent|indent|newline|newpage|clearpage|pagebreak|linebreak|hfill|vfill|hrulefill|dotfill)/g, '');
  result = result.replace(/\\(?:label)\{([^}]*)\}/g, '');
  result = result.replace(/\\(?:ref)\{([^}]*)\}/g, (_, key) => registry.get(key) || '??');
  result = result.replace(/\\(?:eqref)\{([^}]*)\}/g, (_, key) => `(${registry.get(key) || '??'})`);
  result = result.replace(/\\(?:pageref)\{([^}]*)\}/g, '1');
  result = result.replace(/\\(?:cite)\{([^}]*)\}/g, '[?]');
  result = result.replace(/\\(?:nocite|bibliographystyle)\{([^}]*)\}/g, '');
  result = result.replace(/\\(?:footnote)\{([^}]*)\}/g, '<sup class="text-xs text-muted-foreground">[$1]</sup>');

  /* ─── File-based commands ─── */
  result = result.replace(/\\(?:include|input)\{([^}]*)\}/g, (_, file) => {
    const seen = visited ?? new Set<string>();
    if (seen.has(file)) return '';
    seen.add(file);
    const content = findFileContent(allFiles, file);
    return content ? convertBody(content, allFiles, registry, seen) : '';
  });
  result = result.replace(/\\bibliography\{([^}]*)\}/g, (_, file) => {
    return `<div class="my-4"><h2 class="text-xl font-bold mb-3">References</h2><p class="text-muted-foreground italic text-sm">Bibliography from: ${escapeHtml(file)}</p></div>`;
  });
  result = result.replace(/\\lstinputlisting(?:\[([^\]]*)\])?\{([^}]*)\}/g, (_, opts, file) => {
    const content = findFileContent(allFiles, file);
    return content
      ? `<pre class="my-2 p-3 rounded bg-muted font-mono text-sm overflow-x-auto">${escapeHtml(content)}</pre>`
      : '';
  });

  result = result.replace(/\\(?:today|TeX|LaTeX|LaTeXe)\b/g, (m) => {
    const map: Record<string, string> = {
      '\\today': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      '\\TeX': 'T<sub>E</sub>X',
      '\\LaTeX': 'L<sub>A</sub>T<sub>E</sub>X',
      '\\LaTeXe': 'L<sub>A</sub>T<sub>E</sub>X 2<sub>\u03b5</sub>',
    };
    return map[m] || m;
  });

  const envBlocks: string[] = [];
  let envIndex = 0;
  result = result.replace(/\\begin\{([^}]*)\}([\s\S]*?)\\end\{\1\}/g, (_, env, bodyContent) => {
    const html = inlineCommands(`\\begin{${env}}${bodyContent}\\end{${env}}`);
    const placeholder = `\u0000ENV${envIndex}\u0000`;
    envBlocks[envIndex] = html;
    envIndex++;
    return placeholder;
  });

  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const placeholder = `\u0000ENV${envIndex}\u0000`;
    envBlocks[envIndex] = inlineCommands(`$$${math}$$`);
    envIndex++;
    return placeholder;
  });

  const lines = result.split('\n');
  const output: string[] = [];
  let inParagraph = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (inParagraph) {
        output.push('</p>');
        inParagraph = false;
      }
      continue;
    }

    const isDivStart = startsWithTag(line, '<div');
    const isDivEnd = startsWithTag(line, '</div>');
    const isUl = startsWithTag(line, '<ul');
    const isOl = startsWithTag(line, '<ol');
    const isDl = startsWithTag(line, '<dl');
    const isTable = startsWithTag(line, '<table');
    const isBlockquote = startsWithTag(line, '<blockquote');
    const isPre = startsWithTag(line, '<pre');
    const isH = startsWithTag(line, '<h');
    const isBlock = isDivStart || isDivEnd || isUl || isOl || isDl || isTable || isBlockquote || isPre || isH;
    const isEnvPlaceholder = line.startsWith('\u0000ENV');

    if (isEnvPlaceholder) {
      if (inParagraph) { output.push('</p>'); inParagraph = false; }
      output.push(line);
      continue;
    }

    if (isBlock || (startsWithTag(line, '<') && (line.includes('class="text-') || line.includes('class="my-')))) {
      if (inParagraph) { output.push('</p>'); inParagraph = false; }
      output.push(line);
      continue;
    }

    if (startsWithTag(line, '<') && !startsWithTag(line, '<span')) {
      if (inParagraph) { output.push('</p>'); inParagraph = false; }
      output.push(line);
      continue;
    }

    if (!inParagraph) {
      output.push('<p class="my-2 leading-relaxed">');
      inParagraph = true;
    } else {
      output.push('<br/>');
    }
    output.push(inlineCommands(line));
  }

  if (inParagraph) { output.push('</p>'); }

  let final = output.join('\n');
  for (let i = 0; i < envBlocks.length; i++) {
    final = final.replace(`\u0000ENV${i}\u0000`, envBlocks[i]);
  }

  return final;
}

function convertLaTeX(latex: string, allFiles?: FileNode[]): string {
  const cleaned = stripComments(latex);
  const preamble = extractPreamble(cleaned);
  const body = extractBody(cleaned);

  const parts: string[] = [];
  if (preamble.title || preamble.author || preamble.date) {
    parts.push('<div class="text-center mb-6 pb-4 border-b border-border">');
    if (preamble.title) parts.push(`<h1 class="text-3xl font-bold mb-2">${escapeHtml(preamble.title)}</h1>`);
    if (preamble.author) parts.push(`<p class="text-lg text-muted-foreground">${escapeHtml(preamble.author)}</p>`);
    if (preamble.date) parts.push(`<p class="text-sm text-muted-foreground">${escapeHtml(preamble.date)}</p>`);
    parts.push('</div>');
  }
  parts.push(convertBody(body, allFiles));
  return parts.join('\n');
}

/* ─── Editor Component ─── */

export const TexEditor = ({ file, onContentChange, allFiles }: TexEditorProps) => {
  const [content, setContent] = useState(file.content || '');
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setContent(file.content || '');
  }, [file.id, file.content]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange(file.id, newContent);
  }, [file.id, onContentChange]);

  const tokenizedLines = useMemo(() => {
    return tokenize(content, "latex");
  }, [content]);

  const buildHighlightedHtml = useCallback(() => {
    return tokenizedLines
      .map((lineTokens) => {
        const tokensHtml = lineTokens
          .map((token) => {
            return `<span class="${getTokenClass(token.type)}">${escapeHtml(token.value)}</span>`;
          })
          .join("");
        return `<div class="code-line">${tokensHtml.length === 0 ? "<br>" : tokensHtml}</div>`;
      })
      .join("");
  }, [tokenizedLines]);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    const el = editorRef.current;
    if (!el) return;
    const cursorPos = saveCursorPosition();
    const nextContent = el.innerText.replace(/\r\n/g, "\n").replace(/\n$/, "");
    handleContentChange(nextContent);
    requestAnimationFrame(() => {
      restoreCursorPosition(cursorPos);
    });
  }, [handleContentChange, saveCursorPosition, restoreCursorPosition]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
      handleInput();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.preventDefault();
      document.execCommand("insertText", false, "\\textbf{");
      handleInput();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "i") {
      e.preventDefault();
      document.execCommand("insertText", false, "\\textit{");
      handleInput();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "u") {
      e.preventDefault();
      document.execCommand("insertText", false, "\\underline{");
      handleInput();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
      e.preventDefault();
      document.execCommand("insertText", false, "\\frac{}{}");
      handleInput();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "R") {
      e.preventDefault();
      document.execCommand("insertText", false, "\\sqrt{");
      handleInput();
      return;
    }
  }, [handleInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    handleInput();
  }, [handleInput]);

  const saveCursorPosition = useCallback((): number => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) return 0;
    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(editorRef.current);
    preRange.setEndBefore(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }, []);

  const restoreCursorPosition = useCallback((offset: number) => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let charCount = 0;
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const len = node.textContent?.length || 0;
      if (charCount + len >= offset) {
        const pos = offset - charCount;
        try {
          const range = document.createRange();
          range.setStart(node, pos);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch { /* ignore */ }
        return;
      }
      charCount += len;
    }
  }, []);

  const handleInsert = useCallback((text: string, cursorOffset?: number) => {
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    document.execCommand("insertText", false, text);
    handleInput();

    if (cursorOffset !== undefined) {
      requestAnimationFrame(() => {
        const pos = saveCursorPosition();
        restoreCursorPosition(pos - cursorOffset);
      });
    }
  }, [handleInput, saveCursorPosition, restoreCursorPosition]);

  const parsedHtml = useMemo(() => {
    if (!content) return '<p class="text-muted-foreground italic">Empty file</p>';
    try {
      return convertLaTeX(content, allFiles);
    } catch (err) {
      return `<p class="text-red-400">Error rendering LaTeX: ${err instanceof Error ? err.message : 'Unknown error'}</p>`;
    }
  }, [content, allFiles]);

  return (
    <div className="flex flex-1 flex-col bg-editor">
      <TexToolbar onInsert={handleInsert} editorRef={editorRef} />
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Source</span>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="relative min-h-full p-4 font-mono text-sm leading-6">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onCompositionStart={() => { isComposingRef.current = true; }}
                  onCompositionEnd={() => { isComposingRef.current = false; handleInput(); }}
                  className="min-h-full outline-none caret-foreground whitespace-pre-wrap"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  dangerouslySetInnerHTML={{ __html: buildHighlightedHtml() }}
                />
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={55} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Preview</span>
            </div>
            <ScrollArea className="flex-1">
              <div
                className="mx-auto max-w-3xl p-8"
                style={{
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: 'var(--latex-text, inherit)',
                }}
                dangerouslySetInnerHTML={{ __html: parsedHtml }}
              />
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
