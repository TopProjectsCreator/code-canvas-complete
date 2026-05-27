import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FileNode } from '@/types/ide';
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Eye, Code, FileText } from 'lucide-react';
import { escapeHtml } from '@/lib/syntax';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface TexEditorProps {
  file: FileNode;
  onContentChange: (fileId: string, content: string) => void;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripComments(latex: string): string {
  return latex.replace(/^[ \t]*%.*$/gm, '').replace(/(?<!\\)%/g, '\\%');
}

function preprocessLatexForKatex(text: string): string {
  return text
    .replace(/\\(begin|end)\{([^}]*)\}/g, (_, cmd, env) => {
      if (['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*', 'split', 'cases'].includes(env)) {
        return '';
      }
      return '';
    })
    .replace(/\\(?:label|tag|ref|eqref)\{([^}]*)\}/g, '')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .trim();
}

const MATH_TAGS = ['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*'];

function envToHtml(env: string, body: string): string {
  const e = env.replace(/\*$/, '');
  if (MATH_TAGS.some((t) => t === env)) {
    try {
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
  return body;
}

function wrapItems(body: string, type: string): string {
  const items = body.split(/(?<!\\)\\item\b/).filter(Boolean);
  return items.map((item) => `<li class="ml-0">${inlineCommands(cleanItem(item))}</li>`).join('\n');
}

function cleanItem(item: string): string {
  return item
    .replace(/\[([^\]]*)\]/g, '')
    .trim();
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

  result = result.replace(/\\includegraphics(?:\[([^\]]*)\])?\{([^}]*)\}/g, (_, opts, path) => {
    return `<span class="inline-flex items-center gap-1 text-xs text-muted-foreground border border-dashed border-border rounded px-2 py-1 my-1"><svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 16 5-5 3 3 4-4 6 6"/></svg> ${escapeHtml(path)}</span>`;
  });

  result = result.replace(/\\begin\{([^}]*)\}([\s\S]*?)\\end\{\1\}/g, (_, env, body) => {
    const e = env.replace(/\*$/, '');
    if (MATH_TAGS.some((t) => t === env)) {
      try {
        return katex.renderToString(preprocessLatexForKatex(body), { displayMode: true, throwOnError: false });
      } catch {
        return `<span class="text-red-400">[${env} error]</span>`;
      }
    }
    if (e === 'itemize' || e === 'enumerate') {
      const items = body.split(/(?<!\\)\\item\b/).filter(Boolean);
      const tag = e === 'itemize' ? 'ul' : 'ol';
      const listType = e === 'itemize' ? 'disc' : 'decimal';
      return `<${tag} class="list-${listType === 'decimal' ? 'decimal' : 'disc'} pl-6 my-2 space-y-1">${items.map((it) => `<li>${inlineCommands(cleanItem(it))}</li>`).join('')}</${tag}>`;
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
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="text-red-400">[math error]</span>`;
    }
  });

  result = result.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    if (math.trim().length === 0) return `$${math}$`;
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `$${math}$`;
    }
  });

  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `\\(${math}\\)`;
    }
  });

  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `\\[${math}\\]`;
    }
  });

  return result;
}

const titleCommands = ['title', 'author', 'date', 'thanks'];

function extractPreamble(latex: string): { title: string; author: string; date: string } {
  const preambleMatch = latex.match(/\\(?:begin\{document\})/);
  const preamble = preambleMatch ? latex.slice(0, preambleMatch.index) : latex;

  const title = preamble.match(/\\(?:title)\{([^}]*)\}/)?.[1] || '';
  const author = preamble.match(/\\(?:author)\{([^}]*)\}/)?.[1] || '';
  const date = preamble.match(/\\(?:date)\{([^}]*)\}/)?.[1] || '';

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

function convertBody(body: string): string {
  let result = body;

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

  result = result.replace(/\\(?:begin\{document\})/, '');
  result = result.replace(/\\(?:end\{document\})/, '');

  result = result.replace(/\\(?:vspace|hspace)\*?\{[^}]*\}/g, '');
  result = result.replace(/\\(?:smallskip|medskip|bigskip|noindent|indent|newline|newpage|clearpage|pagebreak|linebreak|hfill|vfill|hrulefill|dotfill)/g, '');
  result = result.replace(/\\(?:label|ref|eqref|pageref|cite|nocite|bibliographystyle)\{([^}]*)\}/g, '');
  result = result.replace(/\\(?:footnote)\{([^}]*)\}/g, '<sup class="text-xs text-muted-foreground">[$1]</sup>');

  result = result.replace(/\\(?:today|TeX|LaTeX|LaTeXe)\b/g, (m) => {
    const map: Record<string, string> = {
      '\\today': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      '\\TeX': 'T<sub>E</sub>X',
      '\\LaTeX': 'L<sub>A</sub>T<sub>E</sub>X',
      '\\LaTeXe': 'L<sub>A</sub>T<sub>E</sub>X 2<sub>\u03b5</sub>',
    };
    return map[m] || m;
  });

  // Extract multi-line environments into placeholders before line processing
  const envBlocks: string[] = [];
  let envIndex = 0;
  result = result.replace(/\\begin\{([^}]*)\}([\s\S]*?)\\end\{\1\}/g, (_, env, bodyContent) => {
    const html = inlineCommands(`\\begin{${env}}${bodyContent}\\end{${env}}`);
    const placeholder = `\u0000ENV${envIndex}\u0000`;
    envBlocks[envIndex] = html;
    envIndex++;
    return placeholder;
  });

  // Extract display math placeholders too
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
      if (inParagraph) {
        output.push('</p>');
        inParagraph = false;
      }
      output.push(line);
      continue;
    }

    if (isBlock || (startsWithTag(line, '<') && (line.includes('class="text-') || line.includes('class="my-')))) {
      if (inParagraph) {
        output.push('</p>');
        inParagraph = false;
      }
      output.push(line);
      continue;
    }

    if (startsWithTag(line, '<') && !startsWithTag(line, '<span')) {
      if (inParagraph) {
        output.push('</p>');
        inParagraph = false;
      }
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

  if (inParagraph) {
    output.push('</p>');
  }

  let final = output.join('\n');
  for (let i = 0; i < envBlocks.length; i++) {
    final = final.replace(`\u0000ENV${i}\u0000`, envBlocks[i]);
  }

  return final;
}

function convertLaTeX(latex: string): string {
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

  parts.push(convertBody(body));

  return parts.join('\n');
}

export const TexEditor = ({ file, onContentChange }: TexEditorProps) => {
  const [content, setContent] = useState(file.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isExternalChange = useRef(false);

  useEffect(() => {
    setContent(file.content || '');
  }, [file.id, file.content]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onContentChange(file.id, newContent);
  }, [file.id, onContentChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = content.slice(0, start);
      const after = content.slice(end);
      const newContent = `${before}  ${after}`;
      setContent(newContent);
      onContentChange(file.id, newContent);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [content, file.id, onContentChange]);

  const parsedHtml = useMemo(() => {
    if (!content) return '<p class="text-muted-foreground italic">Empty file</p>';
    try {
      return convertLaTeX(content);
    } catch (err) {
      return `<p class="text-red-400">Error rendering LaTeX: ${err instanceof Error ? err.message : 'Unknown error'}</p>`;
    }
  }, [content]);

  return (
    <div className="flex flex-1 flex-col bg-editor">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Source</span>
              <span className="ml-auto text-[10px] text-muted-foreground">.tex</span>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className="flex-1 resize-none border-0 bg-editor p-4 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40"
              placeholder="% Enter LaTeX here..."
              spellCheck={false}
            />
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
