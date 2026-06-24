import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { xml } from "@codemirror/lang-xml";
import { sql } from "@codemirror/lang-sql";
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
  cpp: [],
  c: [],
  h: [],
  hpp: [],
  sh: [],
  bash: [],
  yaml: [],
  yml: [],
  toml: [],
  tex: [],
  latex: [],
  rst: [],
  go: [],
  rs: [],
  ruby: [],
  rb: [],
  php: [],
  swift: [],
  kt: [],
  kotlin: [],
  scala: [],
  dart: [],
  lua: [],
  r: [],
  pl: [],
  pm: [],
  hs: [],
  graphql: [],
  gql: [],
  proto: [],
  sol: [],
  tf: [],
  dockerfile: [],
  makefile: [],
  cmake: [],
  ini: [],
  cfg: [],
  conf: [],
  env: [],
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
  shell: [],
  bash: [],
  yaml: [],
  toml: [],
  tex: [],
  latex: [],
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
