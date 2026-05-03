import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteRequest {
  code: string;
  language: string;
  stdin?: string;
  sessionId?: string;
  platformHint?: 'replit' | 'lovable' | 'generic';
}

interface ExecuteResult {
  output: string[];
  error: string | null;
  sessionId?: string;
  executor?: 'wandbox' | 'container';
}

const WANDBOX_COMPILE = 'https://wandbox.org/api/compile.json';
const WANDBOX_LIST = 'https://wandbox.org/api/list.json';

const EXECUTOR_MODE = (Deno.env.get('EXECUTOR_MODE') || 'wandbox').toLowerCase();
const CONTAINER_BASE_URL = Deno.env.get('EXECUTOR_CONTAINER_BASE_URL') || '';
const CONTAINER_API_KEY = Deno.env.get('EXECUTOR_CONTAINER_API_KEY') || '';

const containerFirstLanguages = new Set(['shell', 'bash', 'python']);

let compilerCache: Record<string, string[]> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

const languageToWandbox: Record<string, string> = {
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'python': 'Python',
  'java': 'Java',
  'cpp': 'C++',
  'c': 'C',
  'go': 'Go',
  'rust': 'Rust',
  'ruby': 'Ruby',
  'php': 'PHP',
  'csharp': 'C#',
  'bash': 'Bash script',
  'shell': 'Bash script',
  'lua': 'Lua',
  'perl': 'Perl',
  'r': 'R',
  'haskell': 'Haskell',
  'nim': 'Nim',
  'lisp': 'Lisp',
  'd': 'D',
  'groovy': 'Groovy',
  'pascal': 'Pascal',
  'sql': 'SQL',
  'sqlite': 'SQL',
  'zig': 'Zig',
  'swift': 'Swift',
  'crystal': 'Crystal',
  'elixir': 'Elixir',
  'erlang': 'Erlang',
  'julia': 'Julia',
  'ocaml': 'OCaml',
  'pony': 'Pony',
  'scala': 'Scala',
  'vim': 'Vim script',
  'lazyk': 'Lazy K',
};

const languageAliases: Record<string, string> = {
  sh: 'bash',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  cs: 'csharp',
  cc: 'cpp',
  cxx: 'cpp',
  cr: 'crystal',
  exs: 'elixir',
  erl: 'erlang',
  jl: 'julia',
  ml: 'ocaml',
  mli: 'ocaml',
  sc: 'scala',
  lazy: 'lazyk',
};

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  return languageAliases[normalized] || normalized;
}

const preferredCompilers: Record<string, string[]> = {
  'Python': ['cpython-3.12.0', 'cpython-3.11.0', 'cpython-3.10.0'],
  'JavaScript': ['nodejs-20.11.0', 'nodejs-18.15.0', 'nodejs-head'],
  'TypeScript': ['typescript-5.0.4', 'typescript-4.9.4'],
  'C++': ['gcc-13.2.0', 'gcc-12.2.0', 'gcc-head'],
  'C': ['gcc-13.2.0-c', 'gcc-12.2.0-c', 'gcc-head-c'],
  'Go': ['go-1.21.6', 'go-1.20.4', 'go-head'],
  'Rust': ['rust-1.75.0', 'rust-head'],
  'Ruby': ['ruby-3.3.0', 'ruby-3.2.0', 'ruby-head'],
  'Java': ['openjdk-jdk-21+35', 'openjdk-head'],
  'C#': ['mono-6.12.0.200', 'mono-head'],
  'PHP': ['php-8.3.0', 'php-head'],
  'Haskell': ['ghc-9.4.4', 'ghc-head'],
  'Lua': ['lua-5.4.4', 'lua-head'],
  'Perl': ['perl-5.38.0', 'perl-head'],
  'R': ['r-4.3.2', 'r-head'],
  'Zig': ['zig-0.11.0', 'zig-head'],
  'Swift': ['swift-6.0.1', 'swift-5.10.1', 'swift-5.8.1', 'swift-head'],
  'Crystal': ['crystal-1.11.2', 'crystal-head'],
  'Elixir': ['elixir-1.18.3', 'elixir-1.17.3'],
  'Erlang': ['erlang-27.2.4'],
  'Julia': ['julia-1.11.4', 'julia-1.10.9'],
  'OCaml': ['ocaml-5.3.0', 'ocaml-head'],
  'Pony': ['pony-0.59.0'],
  'Scala': ['scala-3.7.1', 'scala-3.2.2', 'scala-head'],
  'Vim script': ['vim-9.1.1332'],
  'Lazy K': ['lazyk-2016.08.21'],
};

async function getCompilerForLanguage(language: string): Promise<string | null> {
  const normalizedLanguage = normalizeLanguage(language);
  const wandboxLang = languageToWandbox[normalizedLanguage];
  if (!wandboxLang) return null;

  const now = Date.now();
  if (!compilerCache || (now - cacheTime) >= CACHE_TTL) {
    try {
      const res = await fetch(WANDBOX_LIST);
      if (!res.ok) return null;
      const list = await res.json();
      const cache: Record<string, string[]> = {};
      for (const entry of list) {
        const lang = entry.language;
        if (lang) {
          if (!cache[lang]) cache[lang] = [];
          cache[lang].push(entry.name);
        }
      }
      compilerCache = cache;
      cacheTime = now;
    } catch {
      const preferred = preferredCompilers[wandboxLang];
      return preferred ? preferred[0] : null;
    }
  }

  const available = compilerCache![wandboxLang];
  if (!available || available.length === 0) return null;

  const preferred = preferredCompilers[wandboxLang];
  if (preferred) {
    for (const p of preferred) {
      if (available.includes(p)) return p;
    }
  }

  const versioned = available.find(c => !c.includes('head'));
  if (versioned) return versioned;

  return available[0];
}

function friendlyError(error: string): string | null {
  if (error.includes('EOFError: EOF when reading a line') || error.includes('input()')) {
    return '⚠️ Interactive input (e.g. input(), scanf, stdin) is not supported in the sandbox. Use hardcoded values instead.';
  }
  if (error.includes('Cannot find module') || error.includes('MODULE_NOT_FOUND')) {
    const match = error.match(/Cannot find module '([^']+)'/);
    const mod = match ? match[1] : 'the module';
    return `⚠️ External package '${mod}' is not available in the sandbox. Only standard library modules are supported.`;
  }
  if (error.includes('ModuleNotFoundError') || error.includes('No module named')) {
    const match = error.match(/No module named '([^']+)'/);
    const mod = match ? match[1] : 'the module';
    return `⚠️ Python package '${mod}' is not available in the sandbox. Only standard library modules are supported.`;
  }
  return null;
}

async function executeWithWandbox(code: string, language: string, stdin?: string): Promise<ExecuteResult> {
  const normalizedLanguage = normalizeLanguage(language);
  const compiler = await getCompilerForLanguage(normalizedLanguage);
  if (!compiler) {
    return { output: [], error: `Unsupported language: ${language}. Supported: ${Object.keys(languageToWandbox).join(', ')}`, executor: 'wandbox' };
  }

  try {
    const body: Record<string, string> = { code, compiler };
    if (stdin) body.stdin = stdin;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(WANDBOX_COMPILE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 504) {
        return { output: [], error: '⚠️ Execution timed out. Try simplifying your code.', executor: 'wandbox' };
      }
      const errorText = await response.text();
      return { output: [], error: `Execution failed (${response.status}): ${errorText}`, executor: 'wandbox' };
    }

    const result = await response.json();
    const output: string[] = [];

    if (result.compiler_message && !result.program_output?.trim()) {
      output.push(...result.compiler_message.split('\n').filter((l: string) => l.trim()));
    }

    if (result.program_output) {
      const lines = result.program_output.split('\n');
      while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      output.push(...lines);
    }

    if (result.compiler_error && (!result.program_output || !result.program_output.trim())) {
      const friendly = friendlyError(result.compiler_error);
      return { output, error: friendly || result.compiler_error, executor: 'wandbox' };
    }

    if (result.status && result.status !== '0' && result.status !== 0) {
      if (result.program_error) {
        const friendly = friendlyError(result.program_error);
        return { output, error: friendly || result.program_error, executor: 'wandbox' };
      }
      return { output, error: output.length > 0 ? null : (result.signal || `Process exited with code ${result.status}`), executor: 'wandbox' };
    }

    return { output: output.length > 0 ? output : ['(no output)'], error: null, executor: 'wandbox' };
  } catch (err) {
    return {
      output: [],
      error: err instanceof Error && err.name === 'AbortError'
        ? '⚠️ Execution timed out (30s limit). Try simplifying your code.'
        : `Network error: ${err instanceof Error ? err.message : String(err)}`,
      executor: 'wandbox',
    };
  }
}

function normalizeOutput(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v));
  if (typeof value === 'string') return value.split('\n');
  return ['(no output)'];
}

async function executeWithContainerBackend(
  code: string,
  language: string,
  stdin?: string,
  sessionId?: string,
): Promise<ExecuteResult> {
  if (!CONTAINER_BASE_URL) {
    return {
      output: [],
      error: 'Container executor not configured (missing EXECUTOR_CONTAINER_BASE_URL).',
      executor: 'container',
    };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (CONTAINER_API_KEY) headers.Authorization = `Bearer ${CONTAINER_API_KEY}`;

  let activeSessionId = sessionId;

  try {
    if (!activeSessionId) {
      const createResponse = await fetch(`${CONTAINER_BASE_URL}/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ language }),
      });

      if (!createResponse.ok) {
        const text = await createResponse.text();
        return { output: [], error: `Failed to create execution session: ${text || createResponse.statusText}`, executor: 'container' };
      }

      const createData = await createResponse.json();
      activeSessionId = createData?.sessionId;
      if (!activeSessionId) {
        return { output: [], error: 'Container backend did not return a sessionId.', executor: 'container' };
      }
    }

    const executeResponse = await fetch(`${CONTAINER_BASE_URL}/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId: activeSessionId, language, code, stdin }),
    });

    if (!executeResponse.ok) {
      const text = await executeResponse.text();
      return { output: [], error: `Container execution failed: ${text || executeResponse.statusText}`, sessionId: activeSessionId, executor: 'container' };
    }

    const data = await executeResponse.json();
    return {
      output: normalizeOutput(data?.output),
      error: data?.error ? String(data.error) : null,
      sessionId: activeSessionId,
      executor: 'container',
    };
  } catch (error) {
    return { output: [], error: `Container backend error: ${error instanceof Error ? error.message : String(error)}`, sessionId: activeSessionId, executor: 'container' };
  }
}

function shouldUseContainer(language: string): boolean {
  if (EXECUTOR_MODE === 'container') return true;
  if (EXECUTOR_MODE === 'hybrid') return containerFirstLanguages.has(language.toLowerCase());
  return false;
}

function handleBuiltinCommand(command: string, executorName: string): { output: string[]; error: string | null; handled: boolean } {
  const cmd = command.trim().split(/\s+/)[0];
  switch (cmd) {
    case 'clear':
      return { output: ['\x1Bc'], error: null, handled: true };
    case 'help':
      return {
        output: [
          `🚀 Shell Executor - ${executorName}`,
          '',
          'Commands run on a remote executor.',
          'Python/shell can use persistent sessions when container mode is enabled.',
          '',
          'Examples:',
          '  python -m venv .venv',
          '  source .venv/bin/activate',
          '  pip install requests',
          '  python script.py',
        ],
        error: null,
        handled: true,
      };
    default:
      return { output: [], error: null, handled: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language, stdin, sessionId, platformHint } = await req.json() as ExecuteRequest;

    if (!code || !code.trim()) {
      return new Response(
        JSON.stringify({ error: 'No code provided', output: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!language || !language.trim()) {
      return new Response(
        JSON.stringify({ error: 'No language provided', output: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const normalizedLanguage = normalizeLanguage(language);
    const forceContainer = platformHint === 'replit';
    const useContainer = forceContainer || shouldUseContainer(normalizedLanguage);
    const executorName = useContainer ? 'Container (session-capable)' : 'Wandbox';

    if (normalizedLanguage === 'shell' || normalizedLanguage === 'bash') {
      const builtin = handleBuiltinCommand(code.trim(), executorName);
      if (builtin.handled) {
        return new Response(
          JSON.stringify({ output: builtin.output, error: builtin.error, executedAt: new Date().toISOString(), sessionId, executor: useContainer ? 'container' : 'wandbox' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    let result: ExecuteResult;
    if (useContainer) {
      result = await executeWithContainerBackend(code, normalizedLanguage, stdin, sessionId);
      if (result.error && EXECUTOR_MODE === 'hybrid') {
        const fallbackLanguage = normalizedLanguage === 'shell' ? 'bash' : normalizedLanguage;
        const fallback = await executeWithWandbox(code, fallbackLanguage, stdin);
        result = {
          ...fallback,
          error: `${result.error}\n\n↩️ Fell back to Wandbox executor.`,
          sessionId: result.sessionId,
        };
      }
    } else {
      const fallbackLanguage = normalizedLanguage === 'shell' ? 'bash' : normalizedLanguage;
      result = await executeWithWandbox(code, fallbackLanguage, stdin);
    }

    return new Response(
      JSON.stringify({ output: result.output, error: result.error, executedAt: new Date().toISOString(), sessionId: result.sessionId, executor: result.executor || (useContainer ? 'container' : 'wandbox') }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Execution error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error', output: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
