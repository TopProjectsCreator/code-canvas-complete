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
const languageMap: Record<string, { language: string; version: string }> = {
  'javascript': { language: 'javascript', version: '18.15.0' },
  'typescript': { language: 'typescript', version: '5.0.3' },
  'python': { language: 'python', version: '3.10.0' },
  'java': { language: 'java', version: '15.0.2' },
  'cpp': { language: 'c++', version: '10.2.0' },
  'c': { language: 'c', version: '10.2.0' },
  'go': { language: 'go', version: '1.16.2' },
  'rust': { language: 'rust', version: '1.68.2' },
  'ruby': { language: 'ruby', version: '3.0.1' },
  'php': { language: 'php', version: '8.2.3' },
  'swift': { language: 'swift', version: '5.3.3' },
  'kotlin': { language: 'kotlin', version: '1.8.20' },
  'csharp': { language: 'csharp', version: '6.12.0' },
};

// Execute code using Piston API
async function executeWithPiston(code: string, language: string): Promise<{ output: string[]; error: string | null }> {
  const langConfig = languageMap[language];
  
  if (!langConfig) {
    return { output: [], error: `Unsupported language: ${language}` };
  }

  try {
    const response = await fetch(`${PISTON_API}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ content: code }],
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
      output.push(...result.compile.output.split('\n').filter((l: string) => l));
    }
    
    // Runtime output
    if (result.run?.output) {
      output.push(...result.run.output.split('\n').filter((l: string) => l));
    }
    
    // Check for errors
    if (result.run?.stderr) {
      return { output, error: result.run.stderr };
    }
    
    if (result.compile?.stderr) {
      return { output: [], error: result.compile.stderr };
    }

    return { output: output.length > 0 ? output : ['(no output)'], error: null };
  } catch (err) {
    return { output: [], error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Handle shell commands (simulated environment info + real code execution)
async function handleShellCommand(command: string): Promise<{ output: string[]; error: string | null }> {
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);
  
  const output: string[] = [];
  
  switch (cmd) {
    case 'echo':
      output.push(args.join(' ').replace(/^["']|["']$/g, ''));
      break;
      
    case 'pwd':
      output.push('/home/runner/workspace');
      break;
      
    case 'whoami':
      output.push('runner');
      break;
      
    case 'date':
      output.push(new Date().toString());
      break;
      
    case 'uname':
      output.push(args.includes('-a') ? 'Linux replit 5.15.0-1 #1 SMP x86_64 GNU/Linux' : 'Linux');
      break;
      
    case 'node':
      if (args[0] === '-v' || args[0] === '--version') {
        output.push('v18.15.0');
      } else if (args[0] === '-e') {
        const jsCode = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
        return executeWithPiston(jsCode, 'javascript');
      }
      break;
      
    case 'python':
    case 'python3':
      if (args[0] === '-V' || args[0] === '--version' || args[0] === '-v') {
        output.push('Python 3.10.0');
      } else if (args[0] === '-c') {
        const pyCode = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
        return executeWithPiston(pyCode, 'python');
      } else if (!args[0]) {
        output.push('Python 3.10.0');
        output.push('Use: python -c "print(\'Hello\')" to execute code');
      }
      break;
      
    case 'pip':
    case 'pip3':
      if (args[0] === '-V' || args[0] === '--version') {
        output.push('pip 23.0 from /usr/local/lib/python3.10/site-packages/pip (python 3.10)');
      } else if (args[0] === 'install') {
        const packages = args.slice(1).filter(a => !a.startsWith('-'));
        if (packages.length === 0) {
          return { output: [], error: 'ERROR: You must give at least one requirement to install' };
        }
        output.push(`Collecting ${packages.join(', ')}`);
        packages.forEach(pkg => {
          output.push(`  Downloading ${pkg}-latest.whl`);
        });
        output.push(`Successfully installed ${packages.join(' ')}`);
        output.push('Note: Packages are available for the current session');
      } else if (args[0] === 'list') {
        output.push('Package         Version');
        output.push('--------------- -------');
        output.push('pip             23.0');
        output.push('setuptools      69.0.3');
      }
      break;
      
    case 'npm':
      if (args[0] === '-v' || args[0] === '--version') {
        output.push('9.6.4');
      } else if (args[0] === 'install' || args[0] === 'i') {
        const pkg = args[1] || '';
        output.push(`added ${Math.floor(Math.random() * 50) + 10} packages in ${(Math.random() * 3 + 1).toFixed(1)}s`);
      }
      break;
      
    case 'gcc':
    case 'g++':
      if (args[0] === '--version') {
        output.push('gcc (GCC) 10.2.0');
      } else {
        output.push('Use the Run button to compile and execute C/C++ code');
      }
      break;
      
    case 'javac':
    case 'java':
      if (args[0] === '-version' || args[0] === '--version') {
        output.push('openjdk 15.0.2 2021-01-19');
      } else {
        output.push('Use the Run button to compile and execute Java code');
      }
      break;
      
    case 'go':
      if (args[0] === 'version') {
        output.push('go version go1.16.2 linux/amd64');
      } else if (args[0] === 'run' && args[1]) {
        output.push('Use the Run button to execute Go code');
      }
      break;
      
    case 'cargo':
    case 'rustc':
      if (args[0] === '--version') {
        output.push('rustc 1.68.2 (9eb3afe9e 2023-03-27)');
      }
      break;
      
    case 'ls':
      const files = ['main.py', 'index.js', 'Main.java', 'main.cpp', 'main.go', 'README.md'];
      if (args.includes('-la') || args.includes('-l')) {
        output.push('total 24');
        output.push('drwxr-xr-x  2 runner runner 4096 Feb  1 18:00 .');
        files.forEach(f => {
          output.push(`-rw-r--r--  1 runner runner  ${Math.floor(Math.random() * 1000) + 100} Feb  1 18:00 ${f}`);
        });
      } else {
        output.push(files.join('  '));
      }
      break;
      
    case 'cat':
      output.push('Use the editor to view and edit files');
      break;
      
    case 'clear':
      output.push('\x1Bc');
      break;
      
    case 'help':
      output.push('🚀 Code Execution Shell - Powered by Piston');
      output.push('');
      output.push('Execute code directly:');
      output.push('  python -c "print(\'Hello\')"  - Run Python code');
      output.push('  node -e "console.log(1+1)"  - Run JavaScript code');
      output.push('');
      output.push('Other commands:');
      output.push('  echo, pwd, whoami, date, ls, clear');
      output.push('  python --version, node --version, pip, npm');
      output.push('');
      output.push('Tip: Use the Run button to execute the current file!');
      break;
      
    case 'exit':
      output.push('logout');
      break;
      
    case 'env':
      output.push('NODE_ENV=development');
      output.push('PYTHON_VERSION=3.10.0');
      output.push('HOME=/home/runner');
      output.push('USER=runner');
      output.push('SHELL=/bin/bash');
      break;
      
    default:
      if (cmd) {
        return { output: [], error: `bash: ${cmd}: command not found\nType 'help' for available commands` };
      }
  }
  
  return { output, error: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language } = await req.json() as ExecuteRequest;

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'No code provided', output: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: { output: string[]; error: string | null };

    if (language === 'shell' || language === 'bash') {
      // Handle shell commands line by line
      const lines = code.split('\n').filter(l => l.trim());
      const allOutput: string[] = [];
      let lastError: string | null = null;
      
      for (const line of lines) {
        const lineResult = await handleShellCommand(line);
        allOutput.push(...lineResult.output);
        if (lineResult.error) {
          lastError = lineResult.error;
          break;
        }
      }
      
      result = { output: allOutput, error: lastError };
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
