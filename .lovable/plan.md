# Fix template-assistant platform description

The template-assistant edge function's system prompt currently tells users "Code execution uses Wandbox" — that's outdated. Today the IDE picks a runtime based on language and host: WebContainers for JS/TS, Pyodide for Python, and a persistent server for compiled languages when running outside Lovable (with a remote sandbox fallback on Lovable-hosted previews).

## Change

Single edit to `supabase/functions/template-assistant/index.ts`, lines 69-75 (the `IMPORTANT PLATFORM FACTS` block inside `SYSTEM_PROMPT`).

Replace:

```
- This platform is Code Canvas Complete (not Replit).
- Code execution uses Wandbox, a remote compilation sandbox.
- .replit files do absolutely nothing here. Never suggest them.
- nix configuration files do nothing here.
- Only standard library modules are available (no pip/npm install at runtime).
- For HTML/CSS/JS and React, code runs in-browser via Babel Standalone.
```

With:

```
- This platform is Code Canvas Complete (not Replit).
- Code execution is hybrid and chosen automatically based on language and host:
  - WebContainers (in-browser Node.js) run JS/TS/React projects, dev servers, npm scripts, and a real shell — fully client-side.
  - Pyodide (in-browser CPython via WebAssembly) runs Python with most of the stdlib and many pure-Python packages — no server round-trip.
  - A persistent server runtime (only when NOT hosted on Lovable) handles compiled languages (C/C++, Rust, Go, Java, etc.) and anything WebContainers/Pyodide can't do. On Lovable-hosted previews this server is unavailable, so those languages fall back to a remote compile sandbox.
- .replit files do absolutely nothing here. Never suggest them.
- nix configuration files do nothing here.
- For HTML/CSS/JS and React, code runs in-browser (WebContainers or the lightweight Babel Standalone preview).
```

Also drop the "Only standard library modules are available" line — it's no longer true (WebContainers supports `npm install`, Pyodide supports `micropip`).

No other files change; the edge function redeploys automatically.
