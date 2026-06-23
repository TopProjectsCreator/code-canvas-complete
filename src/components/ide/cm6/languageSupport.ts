import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { xml } from "@codemirror/lang-xml";
import { sql } from "@codemirror/lang-sql";
import { StreamLanguage } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

const EXTENSION_MAP: Record<string, Extension> = {
  js: javascript(),
  jsx: javascript({ jsx: true }),
  mjs: javascript(),
  cjs: javascript(),
  ts: javascript({ typescript: true }),
  tsx: javascript({ jsx: true, typescript: true }),
  mts: javascript({ typescript: true }),
  cts: javascript({ typescript: true }),
  py: python(),
  css: css(),
  html: html(),
  htm: html(),
  json: json(),
  md: markdown({ base: markdownLanguage }),
  markdown: markdown({ base: markdownLanguage }),
  xml: xml(),
  svg: xml(),
  sql: sql(),
  java: javascript({ typescript: true }),
  cpp: StreamLanguage.define(null as any),
  c: StreamLanguage.define(null as any),
  h: StreamLanguage.define(null as any),
  hpp: StreamLanguage.define(null as any),
  sh: StreamLanguage.define(null as any),
  bash: StreamLanguage.define(null as any),
  yaml: StreamLanguage.define(null as any),
  yml: StreamLanguage.define(null as any),
  toml: StreamLanguage.define(null as any),
  tex: StreamLanguage.define(null as any),
  latex: StreamLanguage.define(null as any),
  rst: StreamLanguage.define(null as any),
  go: StreamLanguage.define(null as any),
  rs: StreamLanguage.define(null as any),
  ruby: StreamLanguage.define(null as any),
  rb: StreamLanguage.define(null as any),
  php: StreamLanguage.define(null as any),
  swift: StreamLanguage.define(null as any),
  kt: StreamLanguage.define(null as any),
  kotlin: StreamLanguage.define(null as any),
  scala: StreamLanguage.define(null as any),
  dart: StreamLanguage.define(null as any),
  lua: StreamLanguage.define(null as any),
  r: StreamLanguage.define(null as any),
  pl: StreamLanguage.define(null as any),
  pm: StreamLanguage.define(null as any),
  hs: StreamLanguage.define(null as any),
  graphql: StreamLanguage.define(null as any),
  gql: StreamLanguage.define(null as any),
  proto: StreamLanguage.define(null as any),
  sol: StreamLanguage.define(null as any),
  tf: StreamLanguage.define(null as any),
  dockerfile: StreamLanguage.define(null as any),
  makefile: StreamLanguage.define(null as any),
  cmake: StreamLanguage.define(null as any),
  ini: StreamLanguage.define(null as any),
  cfg: StreamLanguage.define(null as any),
  conf: StreamLanguage.define(null as any),
  env: StreamLanguage.define(null as any),
};

const LANGUAGE_MAP: Record<string, Extension> = {
  javascript: javascript(),
  "javascriptreact": javascript({ jsx: true }),
  typescript: javascript({ typescript: true }),
  "typescriptreact": javascript({ jsx: true, typescript: true }),
  python: python(),
  css: css(),
  html: html(),
  json: json(),
  markdown: markdown({ base: markdownLanguage }),
  xml: xml(),
  sql: sql(),
  shell: StreamLanguage.define(null as any),
  bash: StreamLanguage.define(null as any),
  yaml: StreamLanguage.define(null as any),
  toml: StreamLanguage.define(null as any),
  tex: StreamLanguage.define(null as any),
  latex: StreamLanguage.define(null as any),
  text: [],
};

export function getLanguageExtension(fileName: string, language?: string): Extension[] {
  if (language && LANGUAGE_MAP[language.toLowerCase()]) {
    return [LANGUAGE_MAP[language.toLowerCase()]];
  }
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext && EXTENSION_MAP[ext]) {
    return [EXTENSION_MAP[ext]];
  }
  return [];
}
