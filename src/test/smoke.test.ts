import { describe, it, expect } from "vitest";

const BASE = "http://localhost:5000";

async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

// These tests exercise the running dev server, so they only make sense when one
// is up. Skip (rather than fail) when it isn't reachable — otherwise the suite
// fails unconditionally in environments that don't run a server.
const serverUp = await isServerUp();

describe.skipIf(!serverUp)("smoke test — dev server", () => {

  it("serves index.html with root div", async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('<div id="root"></div>');
  });

  it("serves all source modules with JS content type", async () => {
    const files = [
      "/src/main.tsx",
      "/src/App.tsx",
      "/src/components/ide/RTFEditor.tsx",
      "/src/components/ide/MarkdownComposer.tsx",
      "/src/components/ide/office/WordEditor.tsx",
    ];
    for (const f of files) {
      const res = await fetch(`${BASE}${f}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("javascript");
    }
  });

  it("pre-bundled tiptap dependencies are resolved", async () => {
    const deps = [
      "@tiptap_extension-text-align.js",
      "@tiptap_extension-text-style.js",
      "@tiptap_extension-color.js",
      "@tiptap_extension-font-family.js",
      "@tiptap_extension-image.js",
    ];
    for (const dep of deps) {
      const res = await fetch(`${BASE}/node_modules/.vite/deps/${dep}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("javascript");
    }
  });

  it("TextStyle uses named import in RTFEditor", async () => {
    const res = await fetch(`${BASE}/src/components/ide/RTFEditor.tsx`);
    const body = await res.text();
    expect(body).toContain("import { TextStyle }");
  });

  it("all imports in RTFEditor resolve to valid pre-bundled modules", async () => {
    const res = await fetch(`${BASE}/src/components/ide/RTFEditor.tsx`);
    const body = await res.text();
    const imports = body.match(/\/node_modules\/\.vite\/deps\/[^'"]+/g) || [];
    expect(imports.length).toBeGreaterThan(0);
    const results = await Promise.all(
      imports.map((imp) => fetch(`${BASE}${imp}`).then((r) => r.status))
    );
    expect(results.every((s) => s === 200)).toBe(true);
  });
});
