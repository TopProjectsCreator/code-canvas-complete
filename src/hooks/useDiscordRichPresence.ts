import { useEffect, useRef } from 'react';
import { useDiscord } from '@/contexts/DiscordContext';
import { getActivityStartTime } from '@/lib/discord';

const languageDisplayNames: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  bash: 'Bash',
  lua: 'Lua',
  html: 'HTML',
  css: 'CSS',
  react: 'React',
  nodejs: 'Node.js',
  arduino: 'Arduino',
  ftc: 'FTC Robotics',
  scratch: 'Scratch',
  sqlite: 'SQLite',
  database: 'Database',
  cad: 'CAD',
  latex: 'LaTeX',
  mermaid: 'Mermaid',
  jupyter: 'Jupyter',
  swift: 'Swift',
  kotlin: 'Kotlin',
  r: 'R',
  haskell: 'Haskell',
  elixir: 'Elixir',
  erlang: 'Erlang',
  julia: 'Julia',
  scala: 'Scala',
  vim: 'Vim',
  perl: 'Perl',
  zig: 'Zig',
  nim: 'Nim',
  lisp: 'Lisp',
  groovy: 'Groovy',
  pascal: 'Pascal',
  crystal: 'Crystal',
  ocaml: 'OCaml',
  pony: 'Pony',
  d: 'D',
  c: 'C',
};

export function useDiscordRichPresence(opts: {
  activeFileName?: string | null;
  language?: string | null;
  projectName?: string | null;
  isRunning?: boolean;
}) {
  const { isDiscordActivity, setActivity } = useDiscord();
  const prevRef = useRef<string>('');

  useEffect(() => {
    if (!isDiscordActivity) return;

    const fileName = opts.activeFileName || opts.projectName || 'Canvas IDE';
    const lang = opts.language ? (languageDisplayNames[opts.language] || opts.language) : null;

    let details: string;
    let state: string;

    if (opts.isRunning) {
      details = `Running ${fileName}`;
      state = lang ? `${lang} — Executing` : 'Executing';
    } else if (opts.activeFileName) {
      details = `Editing ${fileName}`;
      state = lang ? `Working in ${lang}` : 'Coding';
    } else if (opts.projectName) {
      details = `In project: ${fileName}`;
      state = lang ? `Using ${lang}` : 'Browsing files';
    } else {
      details = 'Canvas IDE';
      state = 'Getting started';
    }

    const key = `${details}|${state}`;
    if (key === prevRef.current) return;
    prevRef.current = key;

    setActivity({
      type: 0,
      details,
      state,
      timestamps: { start: getActivityStartTime() },
    });
  }, [isDiscordActivity, setActivity, opts.activeFileName, opts.language, opts.projectName, opts.isRunning]);
}
