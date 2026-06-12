import { useRef, useEffect } from 'react';
import { useMathJax } from './useMathJax';

interface TexPreviewProps {
  content: string;
}

function extractBraced(src: string, start: number, open: string, close: string): { content: string; end: number } {
  let depth = 1;
  let i = start;
  while (i < src.length && depth > 0) {
    if (src[i] === '\\' && (src[i + 1] === open || src[i + 1] === close)) {
      i += 2;
      continue;
    }
    if (src[i] === open) depth++;
    else if (src[i] === close) depth--;
    if (depth > 0) i++;
  }
  return { content: src.slice(start, i), end: i };
}

function extractArgs(src: string, start: number): { args: string[]; end: number } {
  const args: string[] = [];
  let i = start;
  while (i < src.length) {
    while (i < src.length && (src[i] === ' ' || src[i] === '\n' || src[i] === '\t' || src[i] === '\r')) i++;
    if (i >= src.length) break;
    if (src[i] === '{') {
      const r = extractBraced(src, i + 1, '{', '}');
      args.push(r.content);
      i = r.end + 1;
    } else if (src[i] === '[') {
      const r = extractBraced(src, i + 1, '[', ']');
      args.push(r.content);
      i = r.end + 1;
    } else {
      break;
    }
  }
  return { args, end: i };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function latexToHtml(src: string): string {
  const out: string[] = [];
  let i = 0;

  while (i < src.length) {
    if (src.startsWith('\\begin{', i)) {
      const nameEnd = src.indexOf('}', i + 7);
      if (nameEnd === -1) { out.push(src[i]); i++; continue; }
      const envName = src.slice(i + 7, nameEnd);
      const beginTag = `\\begin{${envName}}`;
      const endTag = `\\end{${envName}}`;
      const beginTagLen = beginTag.length;
      const endTagLen = endTag.length;
      let depth = 1;
      let j = nameEnd + 1;
      while (j < src.length && depth > 0) {
        if (src.startsWith(beginTag, j) && src[j + beginTagLen] !== '*') depth++;
        else if (src.startsWith(endTag, j) && src[j + endTagLen] !== '*') depth--;
        if (depth > 0) j++;
      }
      const rawContent = src.slice(nameEnd + 1, j);
      out.push(processEnv(envName, rawContent));
      i = j + endTagLen;
      continue;
    }

    if (src[i] === '\\') {
      if (src[i + 1] === '\\') {
        out.push('<br/>');
        i += 2;
        continue;
      }
      const m = src.slice(i).match(/^\\([A-Za-z]+)/);
      if (m) {
        const cmd = m[1];
        const afterCmd = i + m[0].length;
        const { args, end } = extractArgs(src, afterCmd);
        if (args.length > 0) {
          out.push(processCmd(cmd, args));
          i = end;
        } else {
          out.push(processStandalone(cmd));
          i = afterCmd;
        }
        continue;
      }
    }

    out.push(src[i]);
    i++;
  }

  return out.join('');
}

function processEnv(name: string, content: string): string {
  switch (name) {
    case 'document':
      return latexToHtml(content);

    case 'equation':
    case 'equation*':
      return `<div class="math-display my-4 text-center">$$${content.replace(/\n\s*/g, ' ').trim()}$$</div>`;

    case 'align':
    case 'align*':
    case 'flalign':
    case 'flalign*':
      return `<div class="math-display my-4 text-center">$$\\begin{aligned}${content.replace(/\n\s*/g, ' ').trim()}\\end{aligned}$$</div>`;

    case 'gather':
    case 'gather*':
    case 'multline':
    case 'multline*':
    case 'eqnarray':
    case 'eqnarray*':
      return `<div class="math-display my-4 text-center">$$${content.replace(/\n\s*/g, ' ').trim()}$$</div>`;

    case 'itemize':
      return `<ul class="list-disc pl-6 my-2 space-y-1">${processItems(content)}</ul>`;

    case 'enumerate':
      return `<ol class="list-decimal pl-6 my-2 space-y-1">${processItems(content)}</ol>`;

    case 'description':
      return `<dl class="my-2 space-y-1">${processDescriptionItems(content)}</dl>`;

    case 'quote':
      return `<blockquote class="border-l-2 border-primary/30 pl-4 my-2 italic text-muted-foreground">${latexToHtml(content)}</blockquote>`;

    case 'center':
      return `<div class="text-center my-2">${latexToHtml(content)}</div>`;

    case 'verbatim':
    case 'lstlisting':
      return `<pre class="my-2 p-3 rounded bg-muted font-mono text-sm overflow-x-auto">${escapeHtml(content)}</pre>`;

    case 'abstract':
      return `<div class="italic text-muted-foreground border-l-2 border-primary/30 pl-4 my-4"><p class="font-semibold not-italic mb-1">Abstract</p>${latexToHtml(content)}</div>`;

    case 'theorem':
    case 'lemma':
    case 'proposition':
    case 'corollary':
    case 'definition':
    case 'remark':
    case 'example':
    case 'note': {
      const label = name.charAt(0).toUpperCase() + name.slice(1) + '.';
      const colorMap: Record<string, string> = {
        theorem: 'border-blue-500', lemma: 'border-purple-500', proposition: 'border-indigo-500',
        corollary: 'border-teal-500', definition: 'border-green-500', remark: 'border-yellow-500',
        example: 'border-orange-500', note: 'border-gray-500',
      };
      return `<div class="border-l-4 ${colorMap[name] || 'border-blue-500'} pl-4 my-4"><strong>${label}</strong> ${latexToHtml(content)}</div>`;
    }

    case 'proof':
      return `<div class="border-l-4 border-green-500 pl-4 my-4">${latexToHtml(content)}<span class="float-right">\u25a1</span></div>`;

    case 'table':
      return `<div class="my-4">${latexToHtml(content)}</div>`;

    case 'figure':
      return processFigure(content);

    case 'tabular':
      return processTabular(extractTabularContent(content));

    case 'minipage':
      return `<div class="inline-block align-top my-2 w-full">${latexToHtml(content)}</div>`;

    default:
      return latexToHtml(content);
  }
}

function extractTabularContent(content: string): { colspec: string; body: string } {
  let colspec = '';
  let body = content;
  const trimmed = content.trimStart();
  if (trimmed.startsWith('{')) {
    const r = extractBraced(trimmed, 1, '{', '}');
    colspec = r.content;
    body = trimmed.slice(r.end + 1);
  }
  return { colspec, body };
}

function processTabular({ colspec, body }: { colspec: string; body: string }): string {
  const alignments = colspec.replace(/[^lcr]/g, '').split('');
  const rows = splitTabularRows(body);
  const htmlRows: string[] = [];

  for (const row of rows) {
    const trimmed = row.trim();
    if (trimmed.startsWith('\\hline')) {
      htmlRows.push('<tr class="border-t border-border"></tr>');
      continue;
    }
    if (!trimmed || trimmed === '\\\\') {
      htmlRows.push('<tr><td colspan="99" class="py-1"></td></tr>');
      continue;
    }
    const cells = splitCells(trimmed.replace(/\\\\$/, '').trim());
    const htmlCells = cells.map((cell, ci) => {
      const align = alignments[ci] || 'l';
      const textAlign = align === 'r' ? 'text-right' : align === 'c' ? 'text-center' : 'text-left';
      return `<td class="border border-border px-3 py-1 ${textAlign}">${latexToHtml(cell.trim())}</td>`;
    });
    htmlRows.push(`<tr class="border-b border-border">${htmlCells.join('')}</tr>`);
  }

  if (htmlRows.length === 0) return '';

  return `<div class="my-4 overflow-x-auto"><table class="w-full border-collapse border border-border">${htmlRows.join('\n')}</table></div>`;
}

function splitTabularRows(body: string): string[] {
  const rows: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    if (body[i] === '{' || body[i] === '[') depth++;
    else if (body[i] === '}' || body[i] === ']') depth--;
    if (depth === 0 && body.startsWith('\\hline', i)) {
      if (current.trim()) rows.push(current);
      rows.push('\\hline');
      current = '';
      i += 6;
      continue;
    }
    if (depth === 0 && body[i] === '\\' && body[i + 1] === '\\') {
      if (current.trim()) rows.push(current);
      current = '';
      i += 2;
      continue;
    }
    current += body[i];
    i++;
  }
  if (current.trim()) rows.push(current);
  return rows;
}

function splitCells(row: string): string[] {
  const cells: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '{' || row[i] === '[') depth++;
    else if (row[i] === '}' || row[i] === ']') depth--;
    if (depth === 0 && row[i] === '&') {
      cells.push(current);
      current = '';
    } else {
      current += row[i];
    }
  }
  cells.push(current);
  return cells;
}

function processFigure(content: string): string {
  const inner = latexToHtml(content);
  return `<div class="my-4">${inner}</div>`;
}

function processItems(content: string): string {
  const parts = content.split(/(?<!\\)\\item\b/);
  if (parts.length <= 1) return latexToHtml(content);
  const items = parts.slice(1);
  return items.map(item => `<li>${latexToHtml(item.trim())}</li>`).join('\n');
}

function processDescriptionItems(content: string): string {
  const parts = content.split(/(?<!\\)\\item\b/);
  if (parts.length <= 1) return latexToHtml(content);
  const items = parts.slice(1);
  return items.map(item => {
    const trimmed = item.trim();
    const labelMatch = trimmed.match(/^\[([^\]]*)\]/);
    if (labelMatch) {
      const label = labelMatch[1];
      const rest = trimmed.slice(labelMatch[0].length);
      return `<dt class="font-semibold">${latexToHtml(label)}</dt><dd>${latexToHtml(rest)}</dd>`;
    }
    return `<dd>${latexToHtml(trimmed)}</dd>`;
  }).join('\n');
}

const cmdHandlers: Record<string, (args: string[]) => string> = {
  textbf: ([a]) => `<strong>${latexToHtml(a)}</strong>`,
  textit: ([a]) => `<em>${latexToHtml(a)}</em>`,
  underline: ([a]) => `<u>${latexToHtml(a)}</u>`,
  texttt: ([a]) => `<code class="bg-muted px-1 rounded text-sm">${latexToHtml(a)}</code>`,
  emph: ([a]) => `<em>${latexToHtml(a)}</em>`,
  textsc: ([a]) => `<span class="uppercase tracking-wider text-xs">${latexToHtml(a)}</span>`,
  textsf: ([a]) => `<span class="font-sans">${latexToHtml(a)}</span>`,
  textrm: ([a]) => `<span class="font-serif">${latexToHtml(a)}</span>`,
  textsubscript: ([a]) => `<sub>${latexToHtml(a)}</sub>`,
  textsuperscript: ([a]) => `<sup>${latexToHtml(a)}</sup>`,
  textcolor: ([color, text]) => `<span style="color:${color}">${latexToHtml(text)}</span>`,
  colorbox: ([color, text]) => `<span style="background:${color}">${latexToHtml(text)}</span>`,
  fbox: ([a]) => `<span class="border border-gray-400 px-1">${latexToHtml(a)}</span>`,
  framebox: ([a]) => `<span class="border border-gray-400 px-2 py-1">${latexToHtml(a)}</span>`,
  parbox: ([, text]) => `<div>${latexToHtml(text)}</div>`,
  makebox: ([, text]) => `<span>${latexToHtml(text)}</span>`,
  href: ([url, text]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${latexToHtml(text)}</a>`,
  url: ([url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  includegraphics: (args) => {
    const path = args[args.length - 1] || '';
    return `<img src="${path}" alt="Figure" class="my-4 max-w-full" />`;
  },
  title: ([a]) => `<h1 class="text-3xl font-bold text-center mb-4">${latexToHtml(a)}</h1>`,
  author: ([a]) => `<p class="text-center text-muted-foreground mb-2">${latexToHtml(a)}</p>`,
  date: ([a]) => `<p class="text-center text-muted-foreground text-sm mb-6">${latexToHtml(a)}</p>`,
  chapter: ([a]) => `<h1 class="text-2xl font-bold mt-8 mb-4">${latexToHtml(a)}</h1>`,
  section: ([a]) => `<h2 class="text-xl font-bold mt-6 mb-3">${latexToHtml(a)}</h2>`,
  subsection: ([a]) => `<h3 class="text-lg font-semibold mt-5 mb-2">${latexToHtml(a)}</h3>`,
  subsubsection: ([a]) => `<h4 class="text-base font-medium mt-4 mb-2">${latexToHtml(a)}</h4>`,
  paragraph: ([a]) => `<h5 class="text-base font-semibold mt-3 mb-1">${latexToHtml(a)}</h5>`,
  subparagraph: ([a]) => `<h6 class="text-sm font-medium mt-2 mb-1">${latexToHtml(a)}</h6>`,
  footnote: ([a]) => `<sup class="text-xs text-muted-foreground">[${latexToHtml(a)}]</sup>`,
  cite: ([a]) => `[${a}]`,
  label: () => '',
  ref: () => '',
  eqref: () => '',
  vspace: () => '',
  hspace: () => '',
};

const standaloneHandlers: Record<string, string> = {
  maketitle: '',
  today: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  TeX: 'T<sub>E</sub>X',
  LaTeXe: 'L<sub>A</sub>T<sub>E</sub>X 2<sub>\u03b5</sub>',
  LaTeX: 'L<sub>A</sub>T<sub>E</sub>X',
  item: '<li>',
  hline: '<hr class="border-t my-1" />',
  tableofcontents: '<div class="text-muted-foreground italic text-sm my-4">[Table of Contents]</div>',
  listoffigures: '<div class="text-muted-foreground italic text-sm my-4">[List of Figures]</div>',
  listoftables: '<div class="text-muted-foreground italic text-sm my-4">[List of Tables]</div>',
  bibliography: '<div class="my-4"><h2 class="text-xl font-bold mb-3">References</h2></div>',
  bibliographystyle: '',
  nocite: '',
  newpage: '',
  cleardoublepage: '',
  clearpage: '',
  indent: '',
  noindent: '',
  linebreak: '',
  pagebreak: '',
  newline: '',
  smallskip: '',
  medskip: '',
  bigskip: '',
  hfill: '',
  vfill: '',
};

function processCmd(name: string, args: string[]): string {
  const handler = cmdHandlers[name];
  if (handler) return handler(args);
  return '';
}

function processStandalone(name: string): string {
  if (name in standaloneHandlers) return standaloneHandlers[name];
  return `\\${name}`;
}

export function TexPreview({ content }: TexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { typeset } = useMathJax();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let html = latexToHtml(content);

    const lines = html.split('\n');
    const output: string[] = [];
    let inParagraph = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inParagraph) { output.push('</p>'); inParagraph = false; }
        continue;
      }
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') ||
          trimmed.startsWith('<dl') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<pre') ||
          trimmed.startsWith('<div') || trimmed.startsWith('<table') || trimmed.startsWith('</')) {
        if (inParagraph) { output.push('</p>'); inParagraph = false; }
        output.push(trimmed);
        continue;
      }
      if (!inParagraph) { output.push('<p class="my-2 leading-relaxed">'); inParagraph = true; }
      else { output.push('<br/>'); }
      output.push(trimmed);
    }
    if (inParagraph) output.push('</p>');

    el.innerHTML = output.join('\n');

    typeset(el);
  }, [content, typeset]);

  return (
    <div className="mx-auto max-w-3xl p-8" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: '15px', lineHeight: '1.6' }}>
      {!content && <p className="text-muted-foreground italic">Empty file</p>}
      <div ref={containerRef} />
    </div>
  );
}
