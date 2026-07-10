import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://xlmvlplazxrouscupidi.supabase.co";
  const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXZscGxhenhyb3VzY3VwaWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjYyNjQsImV4cCI6MjA4NTU0MjI2NH0.j5b8QH6RusxDfJ21Fsp7A-ILDPPTL4r6ZpmO_OFoqT8";
  const supabaseProjectId = process.env.VITE_SUPABASE_PROJECT_ID || "xlmvlplazxrouscupidi";

  return ({
  base: '/',
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    watch: {
      ignored: ["**/.cache/**"],
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    proxy: {
      '/api/replit': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '/api/preview': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '/api/proxy': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/supabase': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/token': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/discord': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/lsp': {
        target: 'ws://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      injectRegister: null,
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      workbox: {
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        // Ensure a newly-deployed SW immediately replaces any stale shell that
        // doesn't know about freshly-added routes (e.g. /auth-bridge).
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // SPA fallback: serve index.html for any navigation that doesn't map
        // to a precached file so React Router can match the route client-side.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/\.lovable\//,
          /^\/auth-bridge/,
          /^\/auth-link/,
          /^\/auth-logout/,
          /^\/auth-callback/,
          /^\/auth\/external-oauth/,
          /^\/admin\//,
          /^\/reset-password/,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "gstatic-fonts-cache", expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "pyodide-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      includeAssets: ["favicon.ico", "placeholder.svg", "robots.txt", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Canvas IDE",
        short_name: "Canvas",
        description: "Build, code, and create — online or offline",
        theme_color: "#1a1d27",
        background_color: "#1a1d27",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "./pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "./pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "./pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePublishableKey),
    'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(supabaseProjectId),
    ...(process.env.VITE_DEPLOY_PLATFORM !== undefined && {
      'import.meta.env.VITE_DEPLOY_PLATFORM': JSON.stringify(process.env.VITE_DEPLOY_PLATFORM),
    }),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  });
});
