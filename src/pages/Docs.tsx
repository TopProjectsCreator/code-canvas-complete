import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleHelp,
  Compass,
  FileText,
  Layers,
  Search,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DOCS_CATEGORIES, DOCS_PAGES, TOTAL_DOC_PAGES } from "@/data/docsContent";

export default function Docs() {
  const { slug } = useParams<{ slug: string }>();
  const [query, setQuery] = useState("");

  const activePage = useMemo(() => DOCS_PAGES.find((page) => page.slug === slug), [slug]);
  const activeIndex = activePage ? DOCS_PAGES.findIndex((page) => page.slug === activePage.slug) : -1;
  const previousPage = activeIndex > 0 ? DOCS_PAGES[activeIndex - 1] : null;
  const nextPage = activeIndex >= 0 && activeIndex < DOCS_PAGES.length - 1 ? DOCS_PAGES[activeIndex + 1] : null;

  const filteredCategories = useMemo(() => {
    if (!query.trim()) {
      return DOCS_CATEGORIES;
    }

    const normalized = query.toLowerCase();
    return DOCS_CATEGORIES.map((category) => ({
      ...category,
      pages: category.pages.filter(
        (page) =>
          page.title.toLowerCase().includes(normalized) ||
          page.summary.toLowerCase().includes(normalized) ||
          page.slug.toLowerCase().includes(normalized),
      ),
    })).filter((category) => category.pages.length > 0);
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                Docs Hub
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">CodeCanvas Documentation</h1>
              <p className="max-w-3xl text-muted-foreground">
                A complete knowledge base with {TOTAL_DOC_PAGES} guided pages covering onboarding, editor
                workflows, AI, runtime, hardware, Scratch, deployment, and collaboration.
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
          <aside className="space-y-4 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-6 lg:h-[calc(100vh-4rem)] lg:overflow-auto">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search docs..."
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <nav className="space-y-4">
              {filteredCategories.map((category) => (
                <section key={category.name}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category.name}
                  </h2>
                  <ul className="space-y-1">
                    {category.pages.map((page) => {
                      const isActive = activePage?.slug === page.slug;
                      return (
                        <li key={page.slug}>
                          <Link
                            to={`/docs/${page.slug}`}
                            className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? "bg-primary/15 text-primary"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {page.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </nav>
          </aside>

          <main className="rounded-2xl border border-border bg-card p-6 md:p-8">
            {!activePage ? (
              <div className="space-y-8">
                <section className="space-y-4">
                  <h2 className="text-2xl font-semibold tracking-tight">Start here</h2>
                  <p className="text-muted-foreground">
                    Pick a page from the left to open a full guide with concepts, examples, and walkthrough
                    steps. If you are new, begin with <strong>Welcome to CodeCanvas</strong>, then continue
                    through the rest of the <strong>Get started</strong> section.
                  </p>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                  <article className="rounded-xl border border-border bg-background p-4">
                    <Compass className="mb-3 h-5 w-5 text-primary" />
                    <h3 className="mb-1 font-semibold">Guided learning paths</h3>
                    <p className="text-sm text-muted-foreground">
                      Follow role-based docs sequences for students, solo makers, and professional teams.
                    </p>
                  </article>
                  <article className="rounded-xl border border-border bg-background p-4">
                    <FileText className="mb-3 h-5 w-5 text-primary" />
                    <h3 className="mb-1 font-semibold">Practical examples</h3>
                    <p className="text-sm text-muted-foreground">
                      Every page includes copyable examples and implementation tactics.
                    </p>
                  </article>
                  <article className="rounded-xl border border-border bg-background p-4">
                    <Layers className="mb-3 h-5 w-5 text-primary" />
                    <h3 className="mb-1 font-semibold">Step-by-step walkthroughs</h3>
                    <p className="text-sm text-muted-foreground">
                      Use concrete checklists to move from idea to publishable project.
                    </p>
                  </article>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xl font-semibold">Recommended sequences</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>
                      <strong>New users:</strong> Welcome → Navigation tour → First project → Template picker
                      overview → Publish your first project.
                    </li>
                    <li>
                      <strong>Team leads:</strong> Team onboarding playbook → Branch strategy guide → Diff
                      review in CodeCanvas → Pre-release checklists.
                    </li>
                    <li>
                      <strong>Educators:</strong> Starter kits for classrooms → Scratch workspace tour →
                      Classroom facilitation tips.
                    </li>
                  </ul>
                </section>
              </div>
            ) : (
              <article className="space-y-8">
                <header className="space-y-4 border-b border-border pb-6">
                  <p className="text-sm text-muted-foreground">{activePage.category}</p>
                  <h2 className="text-3xl font-bold tracking-tight">{activePage.title}</h2>
                  <p className="text-muted-foreground">{activePage.summary}</p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full border border-border px-3 py-1">Level: {activePage.level}</span>
                    <span className="rounded-full border border-border px-3 py-1">Read time: {activePage.readTime}</span>
                    <span className="rounded-full border border-border px-3 py-1">Slug: /docs/{activePage.slug}</span>
                  </div>
                </header>

                {activePage.sections.map((section) => (
                  <section key={section.heading} className="space-y-3">
                    <h3 className="text-xl font-semibold tracking-tight">{section.heading}</h3>
                    <p className="text-muted-foreground">{section.body}</p>
                    {section.bullets && (
                      <ul className="space-y-2 rounded-lg border border-border bg-background p-4 text-muted-foreground">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2">
                            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}

                <footer className="flex flex-col gap-3 border-t border-border pt-6 md:flex-row md:justify-between">
                  {previousPage ? (
                    <Button asChild variant="outline">
                      <Link to={`/docs/${previousPage.slug}`} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        {previousPage.title}
                      </Link>
                    </Button>
                  ) : (
                    <span />
                  )}
                  {nextPage ? (
                    <Button asChild>
                      <Link to={`/docs/${nextPage.slug}`} className="gap-2">
                        {nextPage.title}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </footer>
              </article>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
