## Add Browser-Native Shell via WebContainers (Node.js)

### Overview

Integrate `@webcontainer/api` to provide a real Node.js shell (jsh) directly in the browser. Shell/bash/JS commands run locally via WebContainers. Compiled languages (Python, C, Rust, etc.) continue using the existing edge function (Wandbox + optional container backend -- both kept intact).

### Files to Change

**1. Install `@webcontainer/api**`

- Add the package dependency

**2. New file: `src/hooks/useWebContainer.ts**`

- Singleton pattern: one WebContainer instance shared across the app
- `boot()` on first use, expose status (`idle` | `booting` | `ready` | `error`)
- `spawn(command, args)` -- runs a command, returns stdout/stderr as string arrays
- `writeFile(path, content)` / `readFile(path)` for syncing project files
- `teardown()` cleanup on unmount
- Lazy boot: container only starts when the user first runs a shell command

**3. Update `src/hooks/useCodeExecution.ts**`

- Import `useWebContainer`
- New routing logic at the top of `executeCode`:
  - If language is `shell`, `bash`, or `javascript` and WebContainer is available, run via WebContainer's `jsh` or `node`
  - Otherwise, fall through to existing edge function path (Wandbox/container -- untouched)
- `executeShellCommand` routes through WebContainer when ready
- Keep all existing session tracking and edge function code as-is (container backend still works for those who configure it)

**4. Update `src/components/ide/Terminal.tsx**`

- Import `useWebContainer` for boot status
- Show a "Booting shell..." indicator on first command if container is still starting
- No structural changes to the terminal UI -- commands still flow through `useCodeExecution`
- If the use is attempting to use pip or uv or something not supported without setting up container runner,  They will be alerted that it wont work and detailed instructions how to make it work.

**5. Update `vite.config.ts**`

- Add required COOP/COEP headers for WebContainers:

```text
server.headers:
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
```

**6. Update `README.md**`

- Add a section explaining that shell commands now run via WebContainers in-browser for Node.js
- Keep the existing container runner documentation for users who want full Linux shell with Python/system tools
- Note the COOP/COEP header requirement for production deployments

7. **System Instructions**
  Edit the system instructions so that the bots know of this limitation.
8. Settings
  Keep a setting so that users who really want to can use the wandbox api instead of this.

### Architecture

```text
Terminal Command
    |
    +-- shell/bash/js --> WebContainer (in-browser, real Node.js shell)
    |                     (npm, npx, node all work natively)
    |
    +-- python/c/rust/go/etc --> Edge Function
                                   |
                                   +-- Wandbox (default)
                                   +-- Container backend (if configured)
```

### What stays the same

- Edge function `execute-code` is untouched -- Wandbox and container backend remain
- `EXECUTOR_MODE` env var still works for container deployments
- All compiled language execution unchanged
- AI chat shell commands route through the same `useCodeExecution` hook

### Technical Notes

- WebContainers require SharedArrayBuffer, which needs COOP/COEP headers
- The COEP `require-corp` header may break loading cross-origin resources (images, fonts from CDNs) unless they have CORS headers. We'll use `credentialless` instead of `require-corp` to avoid this issue where possible.
- Boot time is ~2-3 seconds on first use, then instant for subsequent commands. 

&nbsp;