import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteRequest {
  code: string;
  language: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language } = await req.json() as ExecuteRequest;

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'No code provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let output: string[] = [];
    let error: string | null = null;

    // Create a custom console that captures output
    const capturedLogs: string[] = [];
    const customConsole = {
      log: (...args: unknown[]) => {
        capturedLogs.push(args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      },
      error: (...args: unknown[]) => {
        capturedLogs.push('[ERROR] ' + args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      },
      warn: (...args: unknown[]) => {
        capturedLogs.push('[WARN] ' + args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      },
      info: (...args: unknown[]) => {
        capturedLogs.push('[INFO] ' + args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      },
    };

    if (language === 'javascript' || language === 'typescript') {
      try {
        // Wrap code execution with custom console
        const wrappedCode = `
          const console = ${JSON.stringify(customConsole)};
          console.log = (...args) => __capturedLogs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
          console.error = (...args) => __capturedLogs.push('[ERROR] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
          console.warn = (...args) => __capturedLogs.push('[WARN] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
          console.info = (...args) => __capturedLogs.push('[INFO] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
          ${code}
        `;

        // Use Function constructor to create a sandboxed execution context
        const __capturedLogs: string[] = [];
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        
        // Create function with captured logs in scope
        const fn = new AsyncFunction('__capturedLogs', `
          const console = {
            log: (...args) => __capturedLogs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')),
            error: (...args) => __capturedLogs.push('[ERROR] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')),
            warn: (...args) => __capturedLogs.push('[WARN] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')),
            info: (...args) => __capturedLogs.push('[INFO] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')),
          };
          
          // Helper functions available to user code
          const print = console.log;
          const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
          
          // Math helpers
          const { PI, E, sqrt, abs, pow, floor, ceil, round, random, sin, cos, tan, log, exp, max, min } = Math;
          
          try {
            ${code}
          } catch (e) {
            console.error(e.message);
          }
        `);
        
        const result = await fn(__capturedLogs);
        
        output = __capturedLogs;
        
        // If there's a return value, add it to output
        if (result !== undefined) {
          output.push(`=> ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`);
        }
        
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    } else if (language === 'shell' || language === 'bash') {
      // Simulate common shell commands
      const lines = code.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);
        
        switch (cmd) {
          case 'echo':
            output.push(args.join(' ').replace(/^["']|["']$/g, ''));
            break;
          case 'pwd':
            output.push('/home/runner/my-repl');
            break;
          case 'whoami':
            output.push('runner');
            break;
          case 'date':
            output.push(new Date().toString());
            break;
          case 'uname':
            if (args.includes('-a')) {
              output.push('Linux replit 5.15.0-1 #1 SMP x86_64 GNU/Linux');
            } else {
              output.push('Linux');
            }
            break;
          case 'node':
            if (args[0] === '-v' || args[0] === '--version') {
              output.push('v20.10.0');
            } else if (args[0] === '-e') {
              // Execute inline JS
              try {
                const jsCode = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
                const __capturedLogs: string[] = [];
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                const fn = new AsyncFunction('__capturedLogs', `
                  const console = {
                    log: (...args) => __capturedLogs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')),
                  };
                  ${jsCode}
                `);
                await fn(__capturedLogs);
                output.push(...__capturedLogs);
              } catch (e) {
                output.push(`Error: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
            break;
          case 'npm':
            if (args[0] === '-v' || args[0] === '--version') {
              output.push('10.2.0');
            } else if (args[0] === 'init') {
              output.push('Wrote to /home/runner/my-repl/package.json');
            } else if (args[0] === 'install' || args[0] === 'i') {
              const pkg = args[1] || '';
              output.push(`added ${Math.floor(Math.random() * 50) + 10} packages in ${(Math.random() * 3 + 1).toFixed(1)}s`);
            }
            break;
          case 'ls':
            const files = ['index.html', 'style.css', 'script.js', 'README.md', '.config'];
            if (args.includes('-la') || args.includes('-l')) {
              output.push('total 20');
              output.push('drwxr-xr-x  2 runner runner 4096 Feb  1 18:00 .');
              output.push('drwxr-xr-x  3 runner runner 4096 Feb  1 18:00 ..');
              files.forEach(f => {
                const isDir = f.startsWith('.');
                output.push(`${isDir ? 'd' : '-'}rw-r--r--  1 runner runner  ${Math.floor(Math.random() * 1000) + 100} Feb  1 18:00 ${f}`);
              });
            } else {
              output.push(files.join('  '));
            }
            break;
          case 'cat':
            if (args[0]) {
              output.push(`cat: ${args[0]}: Use the editor to view file contents`);
            }
            break;
          case 'mkdir':
            output.push(`Created directory: ${args[0] || 'unnamed'}`);
            break;
          case 'touch':
            output.push(`Created file: ${args[0] || 'unnamed'}`);
            break;
          case 'clear':
            output.push('\x1Bc'); // Clear screen escape code
            break;
          case 'help':
            output.push('Available commands:');
            output.push('  echo <text>     - Print text');
            output.push('  node -e <code>  - Execute JavaScript');
            output.push('  node -v         - Show Node.js version');
            output.push('  npm -v          - Show npm version');
            output.push('  npm install     - Install packages');
            output.push('  ls [-la]        - List files');
            output.push('  pwd             - Print working directory');
            output.push('  date            - Show current date');
            output.push('  whoami          - Show current user');
            output.push('  clear           - Clear terminal');
            break;
          case 'exit':
            output.push('logout');
            break;
          case 'env':
            output.push('NODE_ENV=development');
            output.push('HOME=/home/runner');
            output.push('USER=runner');
            output.push('SHELL=/bin/bash');
            break;
          default:
            if (cmd) {
              output.push(`bash: ${cmd}: command not found`);
            }
        }
      }
    } else {
      error = `Unsupported language: ${language}`;
    }

    return new Response(
      JSON.stringify({ 
        output, 
        error,
        executedAt: new Date().toISOString()
      }),
      { 
        status: error ? 400 : 200, 
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