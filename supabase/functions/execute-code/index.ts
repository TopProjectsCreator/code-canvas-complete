import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteRequest {
  code: string;
  language: string;
}

// Piston API - Free code execution engine
const PISTON_API = 'https://emkc.org/api/v2/piston';

// Map our language names to Piston language identifiers
const languageMap: Record<string, { language: string; version: string; filename?: string }> = {
  // Core languages
  'javascript': { language: 'javascript', version: '18.15.0', filename: 'main.js' },
  'typescript': { language: 'typescript', version: '5.0.3', filename: 'main.ts' },
  'python': { language: 'python', version: '3.10.0', filename: 'main.py' },
  'java': { language: 'java', version: '15.0.2', filename: 'Main.java' },
  'cpp': { language: 'c++', version: '10.2.0', filename: 'main.cpp' },
  'c': { language: 'c', version: '10.2.0', filename: 'main.c' },
  'go': { language: 'go', version: '1.16.2', filename: 'main.go' },
  'rust': { language: 'rust', version: '1.68.2', filename: 'main.rs' },
  'ruby': { language: 'ruby', version: '3.0.1', filename: 'main.rb' },
  'php': { language: 'php', version: '8.2.3', filename: 'main.php' },
  'swift': { language: 'swift', version: '5.3.3', filename: 'main.swift' },
  'kotlin': { language: 'kotlin', version: '1.8.20', filename: 'Main.kt' },
  'csharp': { language: 'csharp', version: '6.12.0', filename: 'Main.cs' },
  'bash': { language: 'bash', version: '5.2.0', filename: 'script.sh' },
  'shell': { language: 'bash', version: '5.2.0', filename: 'script.sh' },
  'makefile': { language: 'bash', version: '5.2.0', filename: 'Makefile' },
  'make': { language: 'bash', version: '5.2.0', filename: 'Makefile' },
  // Additional languages
  'lua': { language: 'lua', version: '5.4.4', filename: 'main.lua' },
  'perl': { language: 'perl', version: '5.36.0', filename: 'main.pl' },
  'scala': { language: 'scala', version: '3.2.2', filename: 'Main.scala' },
  'r': { language: 'r', version: '4.1.1', filename: 'main.r' },
  'haskell': { language: 'haskell', version: '9.0.1', filename: 'Main.hs' },
  'elixir': { language: 'elixir', version: '1.11.3', filename: 'main.exs' },
  'clojure': { language: 'clojure', version: '1.10.3', filename: 'main.clj' },
  'dart': { language: 'dart', version: '2.19.6', filename: 'main.dart' },
  'julia': { language: 'julia', version: '1.8.5', filename: 'main.jl' },
  'nim': { language: 'nim', version: '1.6.2', filename: 'main.nim' },
  'zig': { language: 'zig', version: '0.10.1', filename: 'main.zig' },
  'fortran': { language: 'fortran', version: '10.2.0', filename: 'main.f90' },
  'cobol': { language: 'cobol', version: '3.1.2', filename: 'main.cob' },
  'fsharp': { language: 'fsharp', version: '5.0.201', filename: 'Main.fs' },
  'ocaml': { language: 'ocaml', version: '4.12.0', filename: 'main.ml' },
  'erlang': { language: 'erlang', version: '23.0.0', filename: 'main.erl' },
  'crystal': { language: 'crystal', version: '1.3.2', filename: 'main.cr' },
  'lisp': { language: 'lisp', version: '2.1.2', filename: 'main.lisp' },
  'prolog': { language: 'prolog', version: '8.2.4', filename: 'main.pl' },
  'racket': { language: 'racket', version: '8.3.0', filename: 'main.rkt' },
  'd': { language: 'd', version: '2.101.0', filename: 'main.d' },
  'groovy': { language: 'groovy', version: '3.0.7', filename: 'main.groovy' },
  'pascal': { language: 'pascal', version: '3.2.2', filename: 'main.pas' },
  'coffeescript': { language: 'coffeescript', version: '2.5.1', filename: 'main.coffee' },
  'assembly': { language: 'nasm', version: '2.15.5', filename: 'main.asm' },
  'nasm': { language: 'nasm', version: '2.15.5', filename: 'main.asm' },
};

// Execute code using Piston API
async function executeWithPiston(code: string, language: string): Promise<{ output: string[]; error: string | null }> {
  const langConfig = languageMap[language];
  
  if (!langConfig) {
    return { output: [], error: `Unsupported language: ${language}. Supported: ${Object.keys(languageMap).join(', ')}` };
  }

  try {
    const response = await fetch(`${PISTON_API}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ 
          name: langConfig.filename,
          content: code 
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { output: [], error: `Execution failed: ${errorText}` };
    }

    const result = await response.json();
    
    const output: string[] = [];
    
    // Compile output (for compiled languages)
    if (result.compile?.output) {
      const compileLines = result.compile.output.split('\n').filter((l: string) => l.trim());
      if (compileLines.length > 0) {
        output.push(...compileLines);
      }
    }
    
    // Runtime output
    if (result.run?.output) {
      output.push(...result.run.output.split('\n'));
    }
    
    // Remove trailing empty lines
    while (output.length > 0 && output[output.length - 1] === '') {
      output.pop();
    }
    
    // Check for runtime errors
    if (result.run?.stderr && result.run.stderr.trim()) {
      // Some stderr output might be warnings, not errors
      const stderr = result.run.stderr.trim();
      if (result.run.code !== 0) {
        return { output, error: stderr };
      } else {
        // Add stderr as output (it might be warnings)
        output.push(...stderr.split('\n'));
      }
    }
    
    // Check for compile errors
    if (result.compile?.stderr && result.compile.stderr.trim()) {
      return { output: [], error: result.compile.stderr };
    }

    return { output: output.length > 0 ? output : ['(no output)'], error: null };
  } catch (err) {
    return { output: [], error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Built-in commands that run locally (for speed)
function handleBuiltinCommand(command: string): { output: string[]; error: string | null; handled: boolean } {
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);
  
  switch (cmd) {
    case 'clear':
      return { output: ['\x1Bc'], error: null, handled: true };
      
    case 'help':
      return { 
        output: [
          '🚀 Real Shell - Powered by Piston Execution Engine',
          '',
          'This is a real bash shell! Commands are executed on remote servers.',
          '',
          'Examples:',
          '  echo "Hello World"',
          '  ls -la',
          '  cat /etc/os-release',
          '  python3 -c "print(2**10)"',
          '  node -e "console.log(Math.PI)"',
          '  curl -s https://api.github.com | head -5',
          '',
          'Limitations:',
          '  - No persistent filesystem between commands',
          '  - No network access to localhost',
          '  - Timeout: 10 seconds per command',
          '',
          'Tip: Use the editor to write longer scripts!',
        ], 
        error: null, 
        handled: true 
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
    const { code, language } = await req.json() as ExecuteRequest;

    if (!code || !code.trim()) {
      return new Response(
        JSON.stringify({ error: 'No code provided', output: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: { output: string[]; error: string | null };

    if (language === 'shell' || language === 'bash') {
      // Check for built-in commands first (for speed)
      const builtin = handleBuiltinCommand(code.trim());
      if (builtin.handled) {
        result = { output: builtin.output, error: builtin.error };
      } else {
        // Execute real bash command via Piston
        result = await executeWithPiston(code, 'bash');
      }
    } else {
      // Execute code with Piston
      result = await executeWithPiston(code, language);
    }

    return new Response(
      JSON.stringify({ 
        output: result.output, 
        error: result.error,
        executedAt: new Date().toISOString()
      }),
      { 
        status: result.error ? 400 : 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (err) {
    console.error('Execution error:', err);
    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : 'Unknown error',
        output: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
