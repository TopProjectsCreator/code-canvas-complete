import { useRef, useEffect } from 'react';
import { useMathJax } from './useMathJax';

interface TexPreviewProps {
  content: string;
}

export function TexPreview({ content }: TexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { typeset } = useMathJax();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Convert basic LaTeX to HTML for MathJax to process
    let html = content;

    // Strip preamble commands that MathJax doesn't handle in preview
    html = html.replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, '');
    html = html.replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g, '');

    // Handle \begin{document} / \end{document}
    html = html.replace(/\\begin\{document\}/g, '');
    html = html.replace(/\\end\{document\}/g, '');

    // Handle title/author/date in preamble
    html = html.replace(/\\title\{([^}]*)\}/g, '<h1 class="text-3xl font-bold text-center mb-4">$1</h1>');
    html = html.replace(/\\author\{([^}]*)\}/g, '<p class="text-center text-muted-foreground mb-2">$1</p>');
    html = html.replace(/\\date\{([^}]*)\}/g, '<p class="text-center text-muted-foreground text-sm mb-6">$1</p>');
    html = html.replace(/\\maketitle\b/g, '');

    // Sections
    html = html.replace(/\\chapter\*?\{([^}]*)\}/g, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');
    html = html.replace(/\\section\*?\{([^}]*)\}/g, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
    html = html.replace(/\\subsection\*?\{([^}]*)\}/g, '<h3 class="text-lg font-semibold mt-5 mb-2">$1</h3>');
    html = html.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<h4 class="text-base font-medium mt-4 mb-2">$1</h4>');

    // Text formatting
    html = html.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
    html = html.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
    html = html.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
    html = html.replace(/\\texttt\{([^}]*)\}/g, '<code class="bg-muted px-1 rounded text-sm">$1</code>');
    html = html.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
    html = html.replace(/\\textsc\{([^}]*)\}/g, '<span class="uppercase tracking-wider text-xs">$1</span>');
    html = html.replace(/\\textsf\{([^}]*)\}/g, '<span class="font-sans">$1</span>');
    html = html.replace(/\\textrm\{([^}]*)\}/g, '<span class="font-serif">$1</span>');

    // Lists
    html = html.replace(/\\begin\{itemize\}/g, '<ul class="list-disc pl-6 my-2 space-y-1">');
    html = html.replace(/\\end\{itemize\}/g, '</ul>');
    html = html.replace(/\\begin\{enumerate\}/g, '<ol class="list-decimal pl-6 my-2 space-y-1">');
    html = html.replace(/\\end\{enumerate\}/g, '</ol>');
    html = html.replace(/\\begin\{description\}/g, '<dl class="my-2 space-y-1">');
    html = html.replace(/\\end\{description\}/g, '</dl>');
    html = html.replace(/\\item\b/g, '<li>');

    // Quotes and blocks
    html = html.replace(/\\begin\{quote\}/g, '<blockquote class="border-l-2 border-primary/30 pl-4 my-2 italic text-muted-foreground">');
    html = html.replace(/\\end\{quote\}/g, '</blockquote>');
    html = html.replace(/\\begin\{center\}/g, '<div class="text-center my-2">');
    html = html.replace(/\\end\{center\}/g, '</div>');

    // Verbatim
    html = html.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, '<pre class="my-2 p-3 rounded bg-muted font-mono text-sm overflow-x-auto">$1</pre>');

    // References (leave MathJax to handle \ref, \eqref)
    html = html.replace(/\\label\{[^}]*\}/g, '');
    html = html.replace(/\\bibliography\{([^}]*)\}/g, '<div class="my-4"><h2 class="text-xl font-bold mb-3">References</h2><p class="text-muted-foreground italic text-sm">Bibliography: $1</p></div>');
    html = html.replace(/\\cite\{([^}]*)\}/g, '[$1]');

    // Footnotes
    html = html.replace(/\\footnote\{([^}]*)\}/g, '<sup class="text-xs text-muted-foreground">[$1]</sup>');

    // Spacing / layout commands (remove)
    html = html.replace(/\\(?:vspace|hspace)\*?\{[^}]*\}/g, '');
    html = html.replace(/\\(?:smallskip|medskip|bigskip|noindent|indent|newline|newpage|clearpage|pagebreak|linebreak|hfill|vfill)/g, '');

    // Special text
    html = html.replace(/\\today\b/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    html = html.replace(/\\TeX\b/g, 'T<sub>E</sub>X');
    html = html.replace(/\\LaTeXe\b/g, 'L<sub>A</sub>T<sub>E</sub>X 2<sub>\u03b5</sub>');
    html = html.replace(/\\LaTeX\b/g, 'L<sub>A</sub>T<sub>E</sub>X');

    // Paragraphs: wrap loose lines
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

    // Let MathJax typeset any math in the content
    typeset(el);
  }, [content, typeset]);

  return (
    <div className="mx-auto max-w-3xl p-8" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: '15px', lineHeight: '1.6' }}>
      {!content && <p className="text-muted-foreground italic">Empty file</p>}
      <div ref={containerRef} />
    </div>
  );
}
