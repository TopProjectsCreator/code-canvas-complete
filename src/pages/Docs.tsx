import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, BookOpen, ExternalLink, Search } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ------------------------------------------------------------------ */
/*  Navigation structure derived from docs/docs.json                  */
/* ------------------------------------------------------------------ */

interface NavPage {
  path: string;       // e.g. "features/ai-assistant"
  slug: string;       // url-safe key  "features--ai-assistant"
  label: string;      // derived from path
  group: string;
}

interface NavGroup {
  group: string;
  pages: NavPage[];
}

const RAW_GROUPS: { group: string; pages: string[] }[] = [
  { group: "Overview", pages: ["features/index"] },
  {
    group: "IDE",
    pages: [
      "features/ide/index",
      "features/ide/extensions",
      "features/ide/specialized-editors/index",
      "features/ide/specialized-editors/arduino/upload",
      "features/ide/specialized-editors/arduino/supported-boards",
      "features/ide/specialized-editors/arduino/simulator",
      "features/ide/specialized-editors/arduino/coding-ino",
      "features/ide/specialized-editors/scratch/overview",
      "features/ide/specialized-editors/office/overview",
      "features/ide/specialized-editors/cad/overview",
      "features/ide/specialized-editors/media/overview",
    ],
  },
  { group: "AI", pages: ["features/ai-assistant", "features/ai-mcp"] },
  {
    group: "Workflows",
    pages: [
      "features/workflows/index",
      "features/workflows/triggers",
      "features/workflows/api-playground",
      "features/workflows/history",
      "features/environment",
    ],
  },
  { group: "Execution", pages: ["features/persistent-shell", "features/execute-code", "features/hardware"] },
  { group: "Collaboration", pages: ["features/collaboration"] },
  { group: "Deployment", pages: ["features/deployment"] },
  {
    group: "Platform",
    pages: [
      "features/passkeys",
      "features/automation",
      "features/offline-mode",
      "features/team-management",
    ],
  },
  { group: "Developer reference", pages: ["features/dev-reference", "features/shell-safety-runbook"] },
];

function slugify(path: string) {
  return path.replace(/\//g, "--");
}

function labelFromPath(path: string) {
  const last = path.split("/").pop() || path;
  return last
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^Index$/, "Overview");
}

const NAV_GROUPS: NavGroup[] = RAW_GROUPS.map((g) => ({
  group: g.group,
  pages: g.pages.map((p) => ({
    path: p,
    slug: slugify(p),
    label: labelFromPath(p),
    group: g.group,
  })),
}));

const ALL_PAGES = NAV_GROUPS.flatMap((g) => g.pages);

/* ------------------------------------------------------------------ */
/*  Eagerly import every .mdx file under docs/ as raw text            */
/* ------------------------------------------------------------------ */

const mdxModules = import.meta.glob("/docs/**/*.mdx", { query: "?raw", eager: true }) as Record<
  string,
  { default: string }
>;

const assetModules = import.meta.glob("/docs/assets/*.{png,jpg,jpeg,gif,svg,webp}", { eager: true }) as Record<
  string,
  { default: string }
>;

/** Resolve docs/assets/foo.png → hashed Vite URL */
function resolveAssetUrl(src: string): string {
  // Try exact key first
  let key = src.startsWith("/") ? src : `/docs/assets/${src}`;
  if (assetModules[key]) return assetModules[key].default;
  // Try just the filename
  const filename = src.split("/").pop() || "";
  for (const [k, mod] of Object.entries(assetModules)) {
    if (k.endsWith(`/${filename}`)) return mod.default;
  }
  return src;
}

function getContent(path: string): string | null {
  // path = "features/ai-assistant" → try "/docs/features/ai-assistant.mdx"
  const key = `/docs/${path}.mdx`;
  const mod = mdxModules[key];
  if (mod?.default) return mod.default;
  // Also try with /index.mdx suffix for folder-based pages
  const indexKey = `/docs/${path}/index.mdx`;
  const indexMod = mdxModules[indexKey];
  return indexMod?.default ?? null;
}

/** Strip YAML front-matter and Mintlify JSX-like components */
function cleanMdx(raw: string): { title: string; description: string; body: string } {
  let title = "";
  let description = "";
  let body = raw;

  // Extract front-matter
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const block = fm[1];
    title = block.match(/title:\s*"([^"]+)"/)?.[1] ?? "";
    description = block.match(/description:\s*"([^"]+)"/)?.[1] ?? "";
    body = raw.slice(fm[0].length).trim();
  }

  // Strip Mintlify components like <Card>, <Columns>, <Note> etc — keep inner text
  body = body
    .replace(/<Columns[^>]*>/g, "")
    .replace(/<\/Columns>/g, "")
    .replace(/<Card\s+title="([^"]*)"[^>]*>/g, "\n#### $1\n")
    .replace(/<\/Card>/g, "")
    .replace(/<Note>/g, "> **Note:** ")
    .replace(/<\/Note>/g, "")
    .replace(/<[A-Z][^>]*\/>/g, ""); // self-closing custom components

  return { title, description, body };
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function Docs() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // If no slug, redirect to first page
  useEffect(() => {
    if (!slug && ALL_PAGES.length > 0) {
      navigate(`/docs/${ALL_PAGES[0].slug}`, { replace: true });
    }
  }, [slug, navigate]);

  const activePage = useMemo(() => ALL_PAGES.find((p) => p.slug === slug), [slug]);
  const activeIndex = activePage ? ALL_PAGES.indexOf(activePage) : -1;
  const prevPage = activeIndex > 0 ? ALL_PAGES[activeIndex - 1] : null;
  const nextPage = activeIndex >= 0 && activeIndex < ALL_PAGES.length - 1 ? ALL_PAGES[activeIndex + 1] : null;

  const content = useMemo(() => {
    if (!activePage) return null;
    const raw = getContent(activePage.path);
    return raw ? cleanMdx(raw) : null;
  }, [activePage]);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return NAV_GROUPS;
    const q = query.toLowerCase();
    return NAV_GROUPS.map((g) => ({
      ...g,
      pages: g.pages.filter(
        (p) => p.label.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)
      ),
    })).filter((g) => g.pages.length > 0);
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                Documentation
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">CodeCanvas Docs</h1>
              <p className="max-w-3xl text-muted-foreground">
                Powered by Mintlify — covering the IDE, AI copilots, editors, execution, collaboration, and deployment.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/">Landing</Link>
              </Button>
              <Button asChild>
                <Link to="/editor">Open Editor</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          {/* Sidebar */}
          <aside className="space-y-4 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-6 lg:h-[calc(100vh-4rem)] lg:overflow-auto">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search docs…"
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <nav className="space-y-4">
              {filteredGroups.map((g) => (
                <section key={g.group}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.group}
                  </h2>
                  <ul className="space-y-1">
                    {g.pages.map((p) => {
                      const isActive = activePage?.slug === p.slug;
                      return (
                        <li key={p.slug}>
                          <Link
                            to={`/docs/${p.slug}`}
                            className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? "bg-primary/15 text-primary"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {p.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="rounded-2xl border border-border bg-card p-6 md:p-8">
            {content ? (
              <article className="space-y-6">
                <header className="space-y-3 border-b border-border pb-6">
                  <p className="text-sm text-muted-foreground">{activePage?.group}</p>
                  <h2 className="text-3xl font-bold tracking-tight">{content.title || activePage?.label}</h2>
                  {content.description && (
                    <p className="text-muted-foreground">{content.description}</p>
                  )}
                </header>

                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-primary">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img: ({ src, alt, ...props }) => (
                        <img
                          {...props}
                          src={src ? resolveAssetUrl(src) : ""}
                          alt={alt || ""}
                          className="rounded-lg border border-border my-4 max-w-full"
                          loading="lazy"
                        />
                      ),
                    }}
                  >
                    {content.body}
                  </ReactMarkdown>
                </div>

                <footer className="flex flex-col gap-3 border-t border-border pt-6 md:flex-row md:justify-between">
                  {prevPage ? (
                    <Button asChild variant="outline">
                      <Link to={`/docs/${prevPage.slug}`} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        {prevPage.label}
                      </Link>
                    </Button>
                  ) : (
                    <span />
                  )}
                  {nextPage ? (
                    <Button asChild>
                      <Link to={`/docs/${nextPage.slug}`} className="gap-2">
                        {nextPage.label}
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </footer>
              </article>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h2 className="text-xl font-semibold">Page not found</h2>
                <p className="mt-2 text-muted-foreground">Select a page from the sidebar to get started.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
