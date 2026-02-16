import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteRequest {
  code: string;
  language: string;
  stdin?: string;
}

const WANDBOX_COMPILE = 'https://wandbox.org/api/compile.json';
const WANDBOX_LIST = 'https://wandbox.org/api/list.json';

// Cache compiler list
let compilerCache: Record<string, string[]> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Map our language names to Wandbox language names
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
};

// Preferred compiler names (known working)
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
  'Swift': ['swift-5.8.1', 'swift-head'],
  'C#': ['mono-6.12.0.200', 'mono-head'],
  'PHP': ['php-8.3.0', 'php-head'],
  'Haskell': ['ghc-9.4.4', 'ghc-head'],
  'Scala': ['scala-3.2.2', 'scala-head'],
  'Lua': ['lua-5.4.4', 'lua-head'],
  'Perl': ['perl-5.38.0', 'perl-head'],
  'R': ['r-4.3.2', 'r-head'],
  'Zig': ['zig-0.11.0', 'zig-head'],
};

// Fetch and cache the available compiler names from Wandbox
async function getCompilerForLanguage(language: string): Promise<string | null> {
  const wandboxLang = languageToWandbox[language];
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
      // If fetch fails, try preferred compilers directly
      const preferred = preferredCompilers[wandboxLang];
      return preferred ? preferred[0] : null;
    }
  }

  const available = compilerCache![wandboxLang];
  if (!available || available.length === 0) return null;

  

  // Try preferred compilers first
  const preferred = preferredCompilers[wandboxLang];
  if (preferred) {
    for (const p of preferred) {
      if (available.includes(p)) return p;
    }
  }

  // Skip "head" compilers as they may be broken, try to find a versioned one
  const versioned = available.find(c => !c.includes('head'));
  if (versioned) return versioned;

  // Fallback to first available
  return available[0];
}

// Detect common sandbox limitation errors and return friendly messages
function friendlyError(error: string): string | null {
  if (error.includes('EOFError: EOF when reading a line') || error.includes("input()")) {
    return '⚠️ Interactive input (e.g. input(), scanf, stdin) is not supported in the sandbox. Use hardcoded values instead.\n\nExample:\n  # Instead of: name = input("Enter name: ")\n  name = "World"';
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

async function executeWithWandbox(code: string, language: string, stdin?: string): Promise<{ output: string[]; error: string | null }> {
  const compiler = await getCompilerForLanguage(language);
  
  
  if (!compiler) {
    return { output: [], error: `Unsupported language: ${language}. Supported: ${Object.keys(languageToWandbox).join(', ')}` };
  }

  try {
    const body: Record<string, string> = { code, compiler };
    if (stdin) body.stdin = stdin;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
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
        return { output: [], error: `⚠️ Execution timed out. Compiled languages like Zig, Rust, and C++ may take longer. Try simplifying your code.` };
      }
      const errorText = await response.text();
      return { output: [], error: `Execution failed (${response.status}): ${errorText}` };
    }

    const result = await response.json();
    const output: string[] = [];

    // Only include compiler messages if there's no program output (avoid noise from Nim, Haskell, etc.)
    if (result.compiler_message && !result.program_output?.trim()) {
      const lines = result.compiler_message.split('\n').filter((l: string) => l.trim());
      if (lines.length > 0) output.push(...lines);
    }

    if (result.program_output) {
      const lines = result.program_output.split('\n');
      while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      output.push(...lines);
    }

    // Only treat compiler_error as fatal if program didn't produce output
    if (result.compiler_error && (!result.program_output || !result.program_output.trim())) {
      const friendly = friendlyError(result.compiler_error);
      return { output, error: friendly || result.compiler_error };
    }

    if (result.status && result.status !== '0' && result.status !== 0) {
      const errorMsg = result.program_error || result.signal || `Process exited with code ${result.status}`;
      if (result.program_error) {
        const friendly = friendlyError(result.program_error);
        return { output, error: friendly || result.program_error };
      }
      if (output.length > 0 && !result.program_error) {
        return { output, error: null };
      }
      return { output, error: errorMsg };
    }

    return { output: output.length > 0 ? output : ['(no output)'], error: null };
  } catch (err) {
    return { output: [], error: err instanceof Error && err.name === 'AbortError' ? '⚠️ Execution timed out (30s limit). Try simplifying your code.' : `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function handleBuiltinCommand(command: string): { output: string[]; error: string | null; handled: boolean } {
  const cmd = command.trim().split(/\s+/)[0];
  switch (cmd) {
    case 'clear':
      return { output: ['\x1Bc'], error: null, handled: true };
    case 'help':
      return {
        output: [
          '🚀 Real Shell - Powered by Wandbox',
          '',
          'Commands are executed on remote servers.',
          '',
          'Examples:',
          '  echo "Hello World"',
          '  ls -la',
          '',
          'Limitations:',
          '  - No persistent filesystem between commands',
          '  - Timeout: ~10 seconds per command',
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
    const { code, language, stdin } = await req.json() as ExecuteRequest;

    if (!code || !code.trim()) {
      return new Response(
        JSON.stringify({ error: 'No code provided', output: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: { output: string[]; error: string | null };

    if (language === 'shell' || language === 'bash') {
      const builtin = handleBuiltinCommand(code.trim());
      if (builtin.handled) {
        result = { output: builtin.output, error: builtin.error };
      } else {
        result = await executeWithWandbox(code, 'bash', stdin);
      }
    } else {
      result = await executeWithWandbox(code, language, stdin);
    }

    return new Response(
      JSON.stringify({ output: result.output, error: result.error, executedAt: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Execution error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error', output: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
