import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, BookOpen, ExternalLink, Search } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ------------------------------------------------------------------ */
/*  Navigation structure                                               */
/* ------------------------------------------------------------------ */

interface NavPage {
  path: string;
  slug: string;
  label: string;
  group: string;
}

interface NavGroup {
  group: string;
  pages: NavPage[];
}

type PageEntry = string | { path: string; label: string };

const RAW_GROUPS: { group: string; pages: PageEntry[] }[] = [
  { group: "Overview", pages: ["features/index"] },
  {
    group: "IDE Workspace",
    pages: [
      "features/ide/index",
      "features/ide/extensions",
      "features/environment",
    ],
  },
  {
    group: "Specialized Editors",
    pages: [
      { path: "features/ide/specialized-editors/index", label: "Overview" },
      "features/hardware",
      { path: "features/ide/specialized-editors/arduino/upload", label: "Arduino Upload" },
      { path: "features/ide/specialized-editors/arduino/coding-ino", label: "Coding in .ino" },
      { path: "features/ide/specialized-editors/arduino/simulator", label: "Simulator" },
      { path: "features/ide/specialized-editors/arduino/supported-boards", label: "Supported Boards" },
      { path: "features/ide/specialized-editors/scratch/overview", label: "Scratch" },
      { path: "features/ide/specialized-editors/media/overview", label: "Media & 3D" },
      { path: "features/ide/specialized-editors/office/overview", label: "Office Suite" },
      { path: "features/ide/specialized-editors/cad/overview", label: "CAD Viewer" },
    ],
  },
  { group: "AI", pages: ["features/ai-assistant", "features/ai-mcp"] },
  {
    group: "Workflows & Automation",
    pages: [
      { path: "features/workflows/index", label: "Workflows" },
      { path: "features/workflows/triggers", label: "Triggers" },
      { path: "features/workflows/api-playground", label: "API Playground" },
      { path: "features/workflows/history", label: "History" },
      "features/automation",
    ],
  },
  {
    group: "Execution",
    pages: [
      "features/persistent-shell",
      "features/execute-code",
      "features/hardware",
    ],
  },
  {
    group: "Collaboration",
    pages: ["features/collaboration", "features/team-management"],
  },
  { group: "Deployment", pages: ["features/deployment"] },
  {
    group: "Security & Access",
    pages: ["features/passkeys", "features/offline-mode"],
  },
  {
    group: "Developer Reference",
    pages: ["features/dev-reference", "features/shell-safety-runbook"],
  },
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
  pages: g.pages.map((entry) => {
    if (typeof entry === "string") {
      return {
        path: entry,
        slug: slugify(entry),
        label: labelFromPath(entry),
        group: g.group,
      };
    }
    return {
      path: entry.path,
      slug: slugify(entry.path),
      label: entry.label,
      group: g.group,
    };
  }),
}));

// Deduplicate pages (same path can appear in multiple groups — keep first occurrence)
const seen = new Set<string>();
const ALL_PAGES = NAV_GROUPS.flatMap((g) => g.pages).filter((p) => {
  if (seen.has(p.slug)) return false;
  seen.add(p.slug);
  return true;
});

/* ------------------------------------------------------------------ */
/*  File imports                                                       */
/* ------------------------------------------------------------------ */

const mdxModules = import.meta.glob("/docs/**/*.mdx", { query: "?raw", eager: true }) as Record<
  string,
  { default: string }
>;

const assetModules = import.meta.glob("/docs/assets/*.{png,jpg,jpeg,gif,svg,webp}", { eager: true }) as Record<
  string,
  { default: string }
>;

function resolveAssetUrl(src: string): string {
  const decoded = decodeURIComponent(src);
  let key = decoded.startsWith("/") ? decoded : `/docs/assets/${decoded}`;
  if (assetModules[key]) return assetModules[key].default;
  const filename = decoded.split("/").pop() || "";
  for (const [k, mod] of Object.entries(assetModules)) {
    if (k.endsWith(`/${filename}`)) return mod.default;
  }
  return src;
}

function getContent(path: string): string | null {
  const key = `/docs/${path}.mdx`;
  const mod = mdxModules[key];
  if (mod?.default) return mod.default;
  const indexKey = `/docs/${path}/index.mdx`;
  const indexMod = mdxModules[indexKey];
  return indexMod?.default ?? null;
}

function cleanMdx(raw: string): { title: string; description: string; body: string } {
  let title = "";
  let description = "";
  let body = raw;

  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const block = fm[1];
    title = block.match(/title:\s*"([^"]+)"/)?.[1] ?? "";
    description = block.match(/description:\s*"([^"]+)"/)?.[1] ?? "";
    body = raw.slice(fm[0].length).trim();
  }

  body = body
    .replace(/<Columns[^>]*>/g, "")
    .replace(/<\/Columns>/g, "")
    .replace(/<Card\s+title="([^"]*)"[^>]*>/g, "\n#### $1\n")
    .replace(/<\/Card>/g, "")
    .replace(/<Note>/g, "\n> **Note:** ")
    .replace(/<\/Note>/g, "\n")
    .replace(/<[A-Z][^>]*\/>/g, "");

  return { title, description, body };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Docs() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

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
                Full feature reference for the IDE, AI assistant, editors, execution, collaboration, and deployment.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/">Home</Link>
              </Button>
              <Button asChild>
                <Link to="/editor">Open Editor</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
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
                  <ul className="space-y-0.5">
                    {g.pages.map((p) => {
                      const isActive = activePage?.slug === p.slug;
                      return (
                        <li key={p.slug}>
                          <Link
                            to={`/docs/${p.slug}`}
                            className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                              isActive
                                ? "bg-primary/20 font-medium text-primary"
                                : "text-foreground/70 hover:bg-secondary hover:text-foreground"
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
          <main className="min-w-0 rounded-2xl border border-border bg-card p-6 md:p-8">
            {content ? (
              <article className="space-y-6">
                <header className="space-y-3 border-b border-border pb-6">
                  <p className="text-sm text-muted-foreground">{activePage?.group}</p>
                  <h2 className="text-3xl font-bold tracking-tight">{content.title || activePage?.label}</h2>
                  {content.description && (
                    <p className="text-muted-foreground">{content.description}</p>
                  )}
                </header>

                <div className="docs-body">
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
                      table: ({ children }) => (
                        <div className="my-4 w-full overflow-x-auto">
                          <table className="w-full border-collapse text-sm">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="border-b border-border bg-muted/50">{children}</thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody className="divide-y divide-border">{children}</tbody>
                      ),
                      tr: ({ children }) => (
                        <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
                      ),
                      th: ({ children }) => (
                        <th className="px-4 py-2 text-left font-semibold text-foreground">{children}</th>
                      ),
                      td: ({ children }) => (
                        <td className="px-4 py-2 text-foreground/90">{children}</td>
                      ),
                      h1: ({ children }) => (
                        <h1 className="mt-8 mb-4 text-2xl font-bold text-foreground">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="mt-8 mb-3 text-xl font-bold text-foreground">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mt-6 mb-2 text-lg font-semibold text-foreground">{children}</h3>
                      ),
                      h4: ({ children }) => (
                        <h4 className="mt-4 mb-2 text-base font-semibold text-foreground">{children}</h4>
                      ),
                      p: ({ children }) => (
                        <p className="mb-4 leading-7 text-foreground/90">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-4 ml-6 list-disc space-y-1 text-foreground/90">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-4 ml-6 list-decimal space-y-1 text-foreground/90">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-7">{children}</li>
                      ),
                      code: ({ className, children, ...props }) => {
                        const isBlock = className?.includes("language-");
                        if (isBlock) {
                          return (
                            <code className="block rounded-lg bg-muted border border-border px-4 py-3 text-sm font-mono text-foreground overflow-x-auto whitespace-pre">{children}</code>
                          );
                        }
                        return (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground/90" {...props}>{children}</code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted p-4">{children}</pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="my-4 border-l-4 border-primary pl-4 text-foreground/80 italic">{children}</blockquote>
                      ),
                      a: ({ href, children }) => (
                        <a href={href} className="text-primary underline underline-offset-2 hover:text-primary/80" target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}>{children}</a>
                      ),
                      hr: () => <hr className="my-6 border-border" />,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
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
