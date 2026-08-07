// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://xlmvlplazxrouscupidi.supabase.co";
const supabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXZscGxhenhyb3VzY3VwaWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjYyNjQsImV4cCI6MjA4NTU0MjI2NH0.j5b8QH6RusxDfJ21Fsp7A-ILDPPTL4r6ZpmO_OFoqT8";
const supabaseProjectId = process.env.VITE_SUPABASE_PROJECT_ID || "xlmvlplazxrouscupidi";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "./src/server.ts" },
  },
  vite: {
    plugins: [mcpPlugin()],
    resolve: {
      alias: {
        // Excalidraw's prod bundle imports extensionless roughjs paths, which
        // Node's ESM resolver rejects during SSR.
        "roughjs/bin/rough": "roughjs/bin/rough.js",
        "roughjs/bin/math": "roughjs/bin/math.js",
        "roughjs/bin/generator": "roughjs/bin/generator.js",
        // The Scratch packages' Node entries pull in minilog, whose legacy octal

        // escapes break the Worker/SSR bundle. Always use the prebuilt web
        // bundles, and stub minilog for anything that still reaches for it.
        "scratch-vm": new URL(
          "./node_modules/scratch-vm/dist/web/scratch-vm.js",
          import.meta.url,
        ).pathname,
        "scratch-storage": new URL(
          "./node_modules/scratch-storage/dist/web/scratch-storage.js",
          import.meta.url,
        ).pathname,
        "scratch-render": new URL(
          "./node_modules/scratch-render/dist/web/scratch-render.js",
          import.meta.url,
        ).pathname,
        minilog: new URL("./src/lib/minilog-stub.ts", import.meta.url).pathname,
      },
    },
    ssr: {
      // Bundle Excalidraw through Vite so the alias above applies; Node's own
      // ESM resolver otherwise chokes on its extensionless roughjs imports.
    },



    server: {
      // Cross-origin isolation required for WebContainers / SharedArrayBuffer execution engine.
      headers: {
        "Cross-Origin-Embedder-Policy": "credentialless",
        "Cross-Origin-Opener-Policy": "same-origin",
      },
      watch: {
        ignored: ["**/.cache/**"],
      },
      proxy: {
        "/api/replit": { target: "http://localhost:3001", changeOrigin: true, ws: true },
        "/api/preview": { target: "http://localhost:3001", changeOrigin: true, ws: true },
        "/api/proxy": { target: "http://localhost:3001", changeOrigin: true },
        "/api/supabase": { target: "http://localhost:3001", changeOrigin: true },
        "/api/token": { target: "http://localhost:3001", changeOrigin: true },
        "/api/discord": { target: "http://localhost:3001", changeOrigin: true },
        "/api/lsp": { target: "ws://localhost:3001", changeOrigin: true, ws: true },
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
      ...(process.env.VITE_DEPLOY_PLATFORM !== undefined && {
        "import.meta.env.VITE_DEPLOY_PLATFORM": JSON.stringify(process.env.VITE_DEPLOY_PLATFORM),
      }),
    },
  },
});
