/**
 * Redaction engine — detects secrets and PII, replaces with stable tokens,
 * and supports rehydration of the model's response.
 *
 * Pure JS, no Node deps — safe to import anywhere.
 */

export interface RedactionMatch {
  type: string;
  token: string; // e.g. [EMAIL_1]
  original: string;
  start: number;
  end: number;
}

export interface RedactionResult {
  text: string;
  map: Record<string, string>; // token -> original
  matches: RedactionMatch[];
  counts: Record<string, number>;
}

interface PatternDef {
  type: string;
  label: string; // EMAIL, NAME, SECRET, etc.
  regex: RegExp;
  validate?: (m: string) => boolean;
}

// Order matters — more specific patterns first.
const BUILTIN_PATTERNS: PatternDef[] = [
  // ---- Private key blocks ----
  {
    type: "private_key",
    label: "PRIVATE_KEY",
    regex:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  // ---- Provider API keys ----
  { type: "openai_key", label: "SECRET", regex: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g },
  { type: "anthropic_key", label: "SECRET", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { type: "openai_key", label: "SECRET", regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { type: "google_api_key", label: "SECRET", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { type: "xai_key", label: "SECRET", regex: /\bxai-[A-Za-z0-9]{20,}\b/g },
  { type: "groq_key", label: "SECRET", regex: /\bgsk_[A-Za-z0-9]{20,}\b/g },
  { type: "perplexity_key", label: "SECRET", regex: /\bpplx-[A-Za-z0-9]{20,}\b/g },
  { type: "replicate_key", label: "SECRET", regex: /\br8_[A-Za-z0-9]{30,}\b/g },
  { type: "openrouter_key", label: "SECRET", regex: /\bsk-or-[A-Za-z0-9-]{20,}\b/g },
  { type: "mistral_key", label: "SECRET", regex: /(?:(?<=mistral[\s.:=_-]{0,3})\b[A-Za-z0-9]{32}\b|\b[A-Za-z0-9]{32}\b(?=[\s.:=_-]{0,3}mistral))/gi },
  { type: "cohere_key", label: "SECRET", regex: /\bco-[A-Za-z0-9]{30,}\b/g },
  // ---- Cloud / service keys ----
  { type: "aws_access_key", label: "SECRET", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { type: "github_token", label: "SECRET", regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { type: "slack_token", label: "SECRET", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  {
    type: "stripe_key",
    label: "SECRET",
    regex: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g,
  },
  {
    type: "jwt",
    label: "SECRET",
    regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]{3,}\b/g,
  },
  // ---- URLs with embedded credentials ----
  {
    type: "url_with_creds",
    label: "URL",
    regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@[^\s]+/gi,
  },
  // ---- PII ----
  {
    type: "email",
    label: "EMAIL",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    type: "ipv4",
    label: "IP",
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|\d?\d)\b/g,
  },
  {
    type: "ipv6",
    label: "IP",
    regex: /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g,
  },
  {
    type: "mac",
    label: "MAC",
    regex: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
  },
  {
    type: "credit_card",
    label: "CARD",
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    validate: luhnValid,
  },
  // Formatted card-shaped groups (4-4-4-4 or 4-6-5 amex). Catches test/fake
  // cards that fail Luhn but are clearly intended as card numbers — and
  // prevents the phone regex below from eating part of them.
  {
    type: "credit_card",
    label: "CARD",
    regex: /\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{3,4}\b/g,
  },
  {
    type: "credit_card",
    label: "CARD",
    regex: /\b\d{4}[ -]\d{6}[ -]\d{5}\b/g,
  },
  {
    type: "ssn",
    label: "SSN",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    type: "iban",
    label: "IBAN",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
  },
  {
    type: "phone",
    label: "PHONE",
    regex: /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
    validate: (s) => {
      const d = s.replace(/\D/g, "").length;
      if (d < 8 || d > 15) return false;
      // Require either a leading + or at least one separator. Pure digit
      // runs are almost never phones — usually IDs or card numbers.
      if (!/^\+/.test(s) && !/[\s.\-()]/.test(s)) return false;
      return true;
    },
  },
  // ---- Env var assignments (output guard) ----
  // Match true .env / shell-style assignments only: must be at the start of
  // a line (optionally after `export `), and the value must not be a JS
  // keyword like `new`, `function`, etc. This avoids matching JS like
  // `const NON_SOLID_BLOCKS=new Set(...)`.
  {
    type: "env_assignment",
    label: "ENV",
    regex:
      /^(?:export[ \t]+)?[A-Z][A-Z0-9_]{2,}=(?:"[^"\n]+"|'[^'\n]+'|[A-Za-z0-9_\-/:@+=.]{3,})(?=\s|$)/gm,
    validate: (s) => {
      const value = s.replace(/^export[ \t]+/, "").split("=").slice(1).join("=").trim();
      // Reject JS/TS keywords on the right-hand side
      if (
        /^(?:new|function|class|async|await|return|typeof|instanceof|void|delete|true|false|null|undefined|if|else|for|while|do|switch|case|break|continue|throw|try|catch|finally|import|export|from|as|of|in|let|const|var)\b/.test(
          value,
        )
      ) {
        return false;
      }
      return !/[\[\](){},. ]/.test(value);
    },
  },
  // ---- Generic high-entropy tokens (catch-all, last) ----
  {
    type: "high_entropy_token",
    label: "SECRET",
    regex: /\b[A-Za-z0-9_-]{40,}\b/g,
    validate: (s) => shannonEntropy(s) > 4.0 && !/^[a-f0-9]+$/i.test(s.slice(0, 40)),
  },
];

function luhnValid(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const c of str) freq[c] = (freq[c] ?? 0) + 1;
  let e = 0;
  const len = str.length;
  for (const k in freq) {
    const p = freq[k] / len;
    e -= p * Math.log2(p);
  }
  return e;
}

export interface RedactOptions {
  customPatterns?: { pattern: string; label: string }[];
  detectNames?: boolean; // basic capitalized-word heuristic
}

interface Range {
  start: number;
  end: number;
  type: string;
  label: string;
  text: string;
}

function collectMatches(input: string, opts: RedactOptions): Range[] {
  const ranges: Range[] = [];
  const patterns = [...BUILTIN_PATTERNS];

  if (opts.customPatterns) {
    for (const cp of opts.customPatterns) {
      try {
        patterns.unshift({
          type: "custom",
          label: cp.label || "REDACTED",
          regex: new RegExp(cp.pattern, "g"),
        });
      } catch {
        // skip invalid regex
      }
    }
  }

  for (const p of patterns) {
    const re = new RegExp(p.regex.source, p.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      const text = m[0];
      if (p.validate && !p.validate(text)) continue;
      ranges.push({
        start: m.index,
        end: m.index + text.length,
        type: p.type,
        label: p.label,
        text,
      });
    }
  }

  if (opts.detectNames) {
    // Very conservative: two consecutive capitalized words, not at line start preceded by punctuation only
    const nameRe = /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b/g;
    let m: RegExpExecArray | null;
    while ((m = nameRe.exec(input)) !== null) {
      // Skip common non-name capitalizations
      if (/^(?:The|This|That|And|But|For|With|From|Hello|Hi)\b/.test(m[0])) continue;
      ranges.push({
        start: m.index,
        end: m.index + m[0].length,
        type: "name",
        label: "NAME",
        text: m[0],
      });
    }
  }

  // Sort by start, then resolve overlaps (keep earlier/longer)
  ranges.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const resolved: Range[] = [];
  let lastEnd = -1;
  for (const r of ranges) {
    if (r.start < lastEnd) continue;
    resolved.push(r);
    lastEnd = r.end;
  }
  return resolved;
}

export function redact(input: string, opts: RedactOptions = {}): RedactionResult {
  const ranges = collectMatches(input, opts);
  const map: Record<string, string> = {};
  const reverseMap: Record<string, string> = {};
  const counts: Record<string, number> = {};
  const matches: RedactionMatch[] = [];

  let out = "";
  let cursor = 0;
  for (const r of ranges) {
    out += input.slice(cursor, r.start);
    // Reuse same token if the exact value already appeared
    let token = reverseMap[r.text];
    if (!token) {
      counts[r.label] = (counts[r.label] ?? 0) + 1;
      token = `[${r.label}_${counts[r.label]}]`;
      map[token] = r.text;
      reverseMap[r.text] = token;
    }
    out += token;
    matches.push({
      type: r.type,
      token,
      original: r.text,
      start: r.start,
      end: r.end,
    });
    cursor = r.end;
  }
  out += input.slice(cursor);

  return { text: out, map, matches, counts };
}

/** Rehydrate redacted tokens in a string using the original map. */
export function rehydrate(input: string, map: Record<string, string>): string {
  if (!input || Object.keys(map).length === 0) return input;
  // Replace longest tokens first to avoid prefix collisions
  const tokens = Object.keys(map).sort((a, b) => b.length - a.length);
  let out = input;
  for (const t of tokens) {
    // Escape regex special chars in token
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), map[t]);
  }
  return out;
}

/** Walk a JSON value and apply a transform to all string leaves. */
export function transformJsonStrings(
  value: unknown,
  fn: (s: string) => string,
): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => transformJsonStrings(v, fn));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = transformJsonStrings(v, fn);
    }
    return out;
  }
  return value;
}

/**
 * Redact every string leaf in a JSON value using a single shared map so the
 * same secret across multiple fields gets the same token. Returns the new
 * value plus the cumulative result.
 */
export function redactJson(
  value: unknown,
  opts: RedactOptions & {
    /** Pre-seed the token map so repeat PII gets the same token across images & text. */
    seedMap?: Record<string, string>;
    /** Pre-seed the per-label counter. */
    seedCounts?: Record<string, number>;
  } = {},
): { value: unknown; map: Record<string, string>; counts: Record<string, number> } {
  const sharedMap: Record<string, string> = { ...opts.seedMap };
  const reverseMap: Record<string, string> = {};
  const counts: Record<string, number> = { ...opts.seedCounts };

  for (const [token, original] of Object.entries(sharedMap)) {
    reverseMap[original] = token;
  }

  function redactStr(s: string): string {
    const r = redact(s, opts);
    let out = s;
    // Re-walk matches and remap tokens to shared namespace
    if (r.matches.length === 0) return s;
    // Use the per-call result but renumber against shared counts
    out = "";
    let cursor = 0;
    for (const m of r.matches) {
      out += s.slice(cursor, m.start);
      let token = reverseMap[m.original];
      if (!token) {
        const label = m.token.slice(1, m.token.lastIndexOf("_"));
        counts[label] = (counts[label] ?? 0) + 1;
        token = `[${label}_${counts[label]}]`;
        sharedMap[token] = m.original;
        reverseMap[m.original] = token;
      }
      out += token;
      cursor = m.end;
    }
    out += s.slice(cursor);
    return out;
  }

  const newValue = transformJsonStrings(value, redactStr);
  return { value: newValue, map: sharedMap, counts };
}
