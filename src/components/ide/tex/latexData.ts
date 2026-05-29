export interface LatexCommand {
  command: string;
  label: string;
  insert: string;
  cursorOffset?: number;
}

export interface LatexCategory {
  label: string;
  items: LatexCommand[];
}

export const mathStructures: LatexCommand[] = [
  { command: "\\frac{}{}", label: "Fraction", insert: "\\frac{}{}", cursorOffset: 7 },
  { command: "\\sqrt{}", label: "Square Root", insert: "\\sqrt{", cursorOffset: 0 },
  { command: "\\sqrt[]{}", label: "Nth Root", insert: "\\sqrt[]{", cursorOffset: 7 },
  { command: "^{}", label: "Superscript", insert: "^{}", cursorOffset: 2 },
  { command: "_{}", label: "Subscript", insert: "_{}", cursorOffset: 2 },
  { command: "\\int_{}^{}", label: "Integral", insert: "\\int_{}^{}", cursorOffset: 6 },
  { command: "\\sum_{}^{}", label: "Summation", insert: "\\sum_{}^{}", cursorOffset: 6 },
  { command: "\\prod_{}^{}", label: "Product", insert: "\\prod_{}^{}", cursorOffset: 8 },
  { command: "\\lim_{}", label: "Limit", insert: "\\lim_{}", cursorOffset: 5 },
  { command: "\\to", label: "To", insert: "\\to" },
  { command: "\\infty", label: "Infinity", insert: "\\infty" },
  { command: "\\partial", label: "Partial", insert: "\\partial" },
  { command: "\\nabla", label: "Nabla", insert: "\\nabla" },
  { command: "\\pm", label: "Plus-Minus", insert: "\\pm" },
  { command: "\\mp", label: "Minus-Plus", insert: "\\mp" },
  { command: "\\times", label: "Times", insert: "\\times" },
  { command: "\\cdot", label: "Cdot", insert: "\\cdot" },
  { command: "\\div", label: "Divide", insert: "\\div" },
];

export const greekLetters: LatexCommand[] = [
  { command: "\\alpha", label: "α alpha", insert: "\\alpha" },
  { command: "\\beta", label: "β beta", insert: "\\beta" },
  { command: "\\gamma", label: "γ gamma", insert: "\\gamma" },
  { command: "\\delta", label: "δ delta", insert: "\\delta" },
  { command: "\\epsilon", label: "ϵ epsilon", insert: "\\epsilon" },
  { command: "\\varepsilon", label: "ε varepsilon", insert: "\\varepsilon" },
  { command: "\\zeta", label: "ζ zeta", insert: "\\zeta" },
  { command: "\\eta", label: "η eta", insert: "\\eta" },
  { command: "\\theta", label: "θ theta", insert: "\\theta" },
  { command: "\\vartheta", label: "ϑ vartheta", insert: "\\vartheta" },
  { command: "\\iota", label: "ι iota", insert: "\\iota" },
  { command: "\\kappa", label: "κ kappa", insert: "\\kappa" },
  { command: "\\lambda", label: "λ lambda", insert: "\\lambda" },
  { command: "\\mu", label: "μ mu", insert: "\\mu" },
  { command: "\\nu", label: "ν nu", insert: "\\nu" },
  { command: "\\xi", label: "ξ xi", insert: "\\xi" },
  { command: "\\pi", label: "π pi", insert: "\\pi" },
  { command: "\\varpi", label: "ϖ varpi", insert: "\\varpi" },
  { command: "\\rho", label: "ρ rho", insert: "\\rho" },
  { command: "\\varrho", label: "ϱ varrho", insert: "\\varrho" },
  { command: "\\sigma", label: "σ sigma", insert: "\\sigma" },
  { command: "\\varsigma", label: "ς varsigma", insert: "\\varsigma" },
  { command: "\\tau", label: "τ tau", insert: "\\tau" },
  { command: "\\upsilon", label: "υ upsilon", insert: "\\upsilon" },
  { command: "\\phi", label: "φ phi", insert: "\\phi" },
  { command: "\\varphi", label: "ϕ varphi", insert: "\\varphi" },
  { command: "\\chi", label: "χ chi", insert: "\\chi" },
  { command: "\\psi", label: "ψ psi", insert: "\\psi" },
  { command: "\\omega", label: "ω omega", insert: "\\omega" },
  { command: "\\Gamma", label: "Γ Gamma", insert: "\\Gamma" },
  { command: "\\Delta", label: "Δ Delta", insert: "\\Delta" },
  { command: "\\Theta", label: "Θ Theta", insert: "\\Theta" },
  { command: "\\Lambda", label: "Λ Lambda", insert: "\\Lambda" },
  { command: "\\Xi", label: "Ξ Xi", insert: "\\Xi" },
  { command: "\\Pi", label: "Π Pi", insert: "\\Pi" },
  { command: "\\Sigma", label: "Σ Sigma", insert: "\\Sigma" },
  { command: "\\Upsilon", label: "Υ Upsilon", insert: "\\Upsilon" },
  { command: "\\Phi", label: "Φ Phi", insert: "\\Phi" },
  { command: "\\Psi", label: "Ψ Psi", insert: "\\Psi" },
  { command: "\\Omega", label: "Ω Omega", insert: "\\Omega" },
];

export const sectionCommands: LatexCommand[] = [
  { command: "\\section{}", label: "Section", insert: "\\section{", cursorOffset: 0 },
  { command: "\\subsection{}", label: "Subsection", insert: "\\subsection{", cursorOffset: 0 },
  { command: "\\subsubsection{}", label: "Subsubsection", insert: "\\subsubsection{", cursorOffset: 0 },
  { command: "\\paragraph{}", label: "Paragraph", insert: "\\paragraph{", cursorOffset: 0 },
  { command: "\\part{}", label: "Part", insert: "\\part{", cursorOffset: 0 },
  { command: "\\chapter{}", label: "Chapter", insert: "\\chapter{", cursorOffset: 0 },
  { command: "\\title{}", label: "Title", insert: "\\title{", cursorOffset: 0 },
  { command: "\\author{}", label: "Author", insert: "\\author{", cursorOffset: 0 },
  { command: "\\date{}", label: "Date", insert: "\\date{", cursorOffset: 0 },
  { command: "\\maketitle", label: "Make Title", insert: "\\maketitle" },
  { command: "\\tableofcontents", label: "Table of Contents", insert: "\\tableofcontents" },
];

export const environments: LatexCommand[] = [
  { command: "equation", label: "Equation", insert: "\\begin{equation}\n  \n\\end{equation}", cursorOffset: 19 },
  { command: "align", label: "Align", insert: "\\begin{align}\n  \n\\end{align}", cursorOffset: 14 },
  { command: "gather", label: "Gather", insert: "\\begin{gather}\n  \n\\end{gather}", cursorOffset: 15 },
  { command: "itemize", label: "Itemize", insert: "\\begin{itemize}\n  \\item \n\\end{itemize}", cursorOffset: 18 },
  { command: "enumerate", label: "Enumerate", insert: "\\begin{enumerate}\n  \\item \n\\end{enumerate}", cursorOffset: 20 },
  { command: "description", label: "Description", insert: "\\begin{description}\n  \\item[] \n\\end{description}", cursorOffset: 21 },
  { command: "tabular", label: "Tabular", insert: "\\begin{tabular}{}\n  \n\\end{tabular}", cursorOffset: 17 },
  { command: "verbatim", label: "Verbatim", insert: "\\begin{verbatim}\n  \n\\end{verbatim}", cursorOffset: 17 },
  { command: "center", label: "Center", insert: "\\begin{center}\n  \n\\end{center}", cursorOffset: 15 },
  { command: "abstract", label: "Abstract", insert: "\\begin{abstract}\n  \n\\end{abstract}", cursorOffset: 17 },
  { command: "quote", label: "Quote", insert: "\\begin{quote}\n  \n\\end{quote}", cursorOffset: 14 },
  { command: "cases", label: "Cases", insert: "\\begin{cases}\n  \n\\end{cases}", cursorOffset: 14 },
];

export const textStyles: LatexCommand[] = [
  { command: "\\textbf{}", label: "Bold", insert: "\\textbf{", cursorOffset: 0 },
  { command: "\\textit{}", label: "Italic", insert: "\\textit{", cursorOffset: 0 },
  { command: "\\underline{}", label: "Underline", insert: "\\underline{", cursorOffset: 0 },
  { command: "\\texttt{}", label: "Monospace", insert: "\\texttt{", cursorOffset: 0 },
  { command: "\\textsc{}", label: "Small Caps", insert: "\\textsc{", cursorOffset: 0 },
  { command: "\\textsf{}", label: "Sans Serif", insert: "\\textsf{", cursorOffset: 0 },
  { command: "\\textrm{}", label: "Roman", insert: "\\textrm{", cursorOffset: 0 },
  { command: "\\emph{}", label: "Emphasis", insert: "\\emph{", cursorOffset: 0 },
];

export const symbols: LatexCommand[] = [
  { command: "\\rightarrow", label: "→ Right Arrow", insert: "\\rightarrow" },
  { command: "\\Rightarrow", label: "⇒ Right Double Arrow", insert: "\\Rightarrow" },
  { command: "\\leftarrow", label: "← Left Arrow", insert: "\\leftarrow" },
  { command: "\\Leftarrow", label: "⇐ Left Double Arrow", insert: "\\Leftarrow" },
  { command: "\\leftrightarrow", label: "↔ Left Right Arrow", insert: "\\leftrightarrow" },
  { command: "\\mapsto", label: "↦ Mapsto", insert: "\\mapsto" },
  { command: "\\implies", label: "⟹ Implies", insert: "\\implies" },
  { command: "\\iff", label: "⟺ Iff", insert: "\\iff" },
  { command: "\\forall", label: "∀ For All", insert: "\\forall" },
  { command: "\\exists", label: "∃ Exists", insert: "\\exists" },
  { command: "\\in", label: "∈ In", insert: "\\in" },
  { command: "\\notin", label: "∉ Not In", insert: "\\notin" },
  { command: "\\subset", label: "⊂ Subset", insert: "\\subset" },
  { command: "\\supset", label: "⊃ Superset", insert: "\\supset" },
  { command: "\\subseteq", label: "⊆ Subseteq", insert: "\\subseteq" },
  { command: "\\supseteq", label: "⊇ Supseteq", insert: "\\supseteq" },
  { command: "\\cup", label: "∪ Union", insert: "\\cup" },
  { command: "\\cap", label: "∩ Intersection", insert: "\\cap" },
  { command: "\\emptyset", label: "∅ Empty Set", insert: "\\emptyset" },
  { command: "\\mathbb{}", label: "Blackboard Bold", insert: "\\mathbb{", cursorOffset: 0 },
  { command: "\\mathcal{}", label: "Calligraphic", insert: "\\mathcal{", cursorOffset: 0 },
  { command: "\\cdots", label: "⋯ Dots", insert: "\\cdots" },
  { command: "\\vdots", label: "⋮ Vertical Dots", insert: "\\vdots" },
  { command: "\\ddots", label: "⋱ Diagonal Dots", insert: "\\ddots" },
];

export const insertCommands: LatexCommand[] = [
  { command: "\\label{}", label: "Label", insert: "\\label{", cursorOffset: 0 },
  { command: "\\ref{}", label: "Reference", insert: "\\ref{", cursorOffset: 0 },
  { command: "\\eqref{}", label: "Equation Reference", insert: "\\eqref{", cursorOffset: 0 },
  { command: "\\cite{}", label: "Citation", insert: "\\cite{", cursorOffset: 0 },
  { command: "\\href{}{}", label: "Hyperlink", insert: "\\href{}{}", cursorOffset: 6 },
  { command: "\\url{}", label: "URL", insert: "\\url{", cursorOffset: 0 },
  { command: "\\footnote{}", label: "Footnote", insert: "\\footnote{", cursorOffset: 0 },
  { command: "\\includegraphics{}", label: "Image", insert: "\\includegraphics{", cursorOffset: 0 },
  { command: "\\input{}", label: "Input File", insert: "\\input{", cursorOffset: 0 },
  { command: "\\include{}", label: "Include File", insert: "\\include{", cursorOffset: 0 },
];
