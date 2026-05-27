export interface SyntaxToken {
  type:
    | "keyword"
    | "string"
    | "number"
    | "function"
    | "comment"
    | "operator"
    | "variable"
    | "tag"
    | "attribute"
    | "property"
    | "text";
  value: string;
}

const jsKeywords = [
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "class", "import", "export", "default", "from", "async", "await", "try",
  "catch", "throw", "new", "this", "true", "false", "null", "undefined",
];

const cssKeywords = ["@import", "@media", "@keyframes", "@font-face"];

const pythonKeywords = [
  "False", "None", "True", "and", "as", "assert", "async", "await",
  "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is",
  "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try",
  "while", "with", "yield",
];

export const tokenize = (code: string, language: string): SyntaxToken[][] => {
  const lines = code.split("\n");
  const normalizedLanguage = (language || "text").toLowerCase();
  const isPython = ["py", "python"].includes(normalizedLanguage);

  let activePythonTripleQuote: `"""` | `'''` | null = null;

  return lines.map((line) => {
    const tokens: SyntaxToken[] = [];
    let remaining = line;

    if (isPython && activePythonTripleQuote) {
      const endIdx = remaining.indexOf(activePythonTripleQuote);
      if (endIdx >= 0) {
        const stringChunk = remaining.slice(0, endIdx + 3);
        tokens.push({ type: "string", value: stringChunk });
        remaining = remaining.slice(endIdx + 3);
        activePythonTripleQuote = null;
      } else {
        tokens.push({ type: "string", value: remaining });
        return tokens;
      }
    }

    while (remaining.length > 0) {
      let matched = false;

      if (isPython && remaining.startsWith("#")) {
        tokens.push({ type: "comment", value: remaining });
        break;
      }

      if (remaining.startsWith("//") || remaining.startsWith("/*") || remaining.startsWith("<!--")) {
        tokens.push({ type: "comment", value: remaining });
        break;
      }

      if (isPython && (remaining.startsWith(`"""`) || remaining.startsWith(`'''`))) {
        const quote = remaining.startsWith(`"""`) ? `"""` : `'''`;
        const closingIdx = remaining.indexOf(quote, 3);

        if (closingIdx >= 0) {
          const tripleQuoted = remaining.slice(0, closingIdx + 3);
          tokens.push({ type: "string", value: tripleQuoted });
          remaining = remaining.slice(closingIdx + 3);
        } else {
          tokens.push({ type: "string", value: remaining });
          activePythonTripleQuote = quote;
          break;
        }

        matched = true;
        continue;
      }

      const stringMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
      if (stringMatch) {
        tokens.push({ type: "string", value: stringMatch[0] });
        remaining = remaining.slice(stringMatch[0].length);
        matched = true;
        continue;
      }

      if (language === "html") {
        const tagMatch = remaining.match(/^<\/?[a-zA-Z][a-zA-Z0-9-]*|^>/);
        if (tagMatch) {
          tokens.push({ type: "tag", value: tagMatch[0] });
          remaining = remaining.slice(tagMatch[0].length);
          matched = true;
          continue;
        }

        const attrMatch = remaining.match(/^[a-zA-Z-]+(?==)/);
        if (attrMatch) {
          tokens.push({ type: "attribute", value: attrMatch[0] });
          remaining = remaining.slice(attrMatch[0].length);
          matched = true;
          continue;
        }
      }

      if (language === "css") {
        const propMatch = remaining.match(/^[a-zA-Z-]+(?=\s*:)/);
        if (propMatch) {
          tokens.push({ type: "property", value: propMatch[0] });
          remaining = remaining.slice(propMatch[0].length);
          matched = true;
          continue;
        }

        const selectorMatch = remaining.match(/^[.#]?[a-zA-Z_][a-zA-Z0-9_-]*(?=\s*[{,])/);
        if (selectorMatch) {
          tokens.push({ type: "function", value: selectorMatch[0] });
          remaining = remaining.slice(selectorMatch[0].length);
          matched = true;
          continue;
        }
      }

      const numMatch = remaining.match(/^-?\d+\.?\d*(px|em|rem|%|vh|vw|deg|s|ms)?/);
      if (numMatch) {
        tokens.push({ type: "number", value: numMatch[0] });
        remaining = remaining.slice(numMatch[0].length);
        matched = true;
        continue;
      }

      const wordMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
      if (wordMatch) {
        const word = wordMatch[0];

        if (isPython && pythonKeywords.includes(word)) {
          tokens.push({ type: "keyword", value: word });
        } else if (!isPython) {
          const keywords = language === "css" ? cssKeywords : jsKeywords;
          if (keywords.includes(word)) {
            tokens.push({ type: "keyword", value: word });
          } else if (remaining.slice(word.length).match(/^\s*\(/)) {
            tokens.push({ type: "function", value: word });
          } else {
            tokens.push({ type: "variable", value: word });
          }
        } else if (remaining.slice(word.length).match(/^\s*\(/)) {
          tokens.push({ type: "function", value: word });
        } else {
          tokens.push({ type: "variable", value: word });
        }
        remaining = remaining.slice(word.length);
        matched = true;
        continue;
      }

      const opMatch = remaining.match(/^[=+\-*/<>!&|:;.,{}()\[\]]+/);
      if (opMatch) {
        tokens.push({ type: "operator", value: opMatch[0] });
        remaining = remaining.slice(opMatch[0].length);
        matched = true;
        continue;
      }

      if (!matched) {
        tokens.push({ type: "text", value: remaining[0] });
        remaining = remaining.slice(1);
      }
    }

    return tokens;
  });
};

export const getTokenClass = (type: SyntaxToken["type"]): string => {
  const classMap: Record<SyntaxToken["type"], string> = {
    keyword: "text-syntax-keyword",
    string: "text-syntax-string",
    number: "text-syntax-number",
    function: "text-syntax-function",
    comment: "text-syntax-comment italic",
    operator: "text-syntax-operator",
    variable: "text-syntax-variable",
    tag: "text-syntax-keyword",
    attribute: "text-syntax-function",
    property: "text-syntax-variable",
    text: "text-foreground",
  };
  return classMap[type];
};

export const escapeHtml = (str: string): string =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
