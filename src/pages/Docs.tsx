import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleHelp,
  Compass,
  ExternalLink,
  FileText,
  Layers,
  Rocket,
  Search,
  Sparkles,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DOCS_CATEGORIES,
  DOCS_PAGES,
  TOTAL_DOC_PAGES,
  getDocImageUrl,
} from "@/data/docsContent";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
                A complete knowledge base with {TOTAL_DOC_PAGES} guided pages, long-form walkthroughs,
                practical quickstarts, and FAQ-driven troubleshooting.
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
                    Explore a docs experience inspired by modern product docs portals: discover quickstarts,
                    implementation runbooks, FAQs, and resource links from every page.
                  </p>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                  <article className="rounded-xl border border-border bg-background p-4">
                    <Compass className="mb-3 h-5 w-5 text-primary" />
                    <h3 className="mb-1 font-semibold">Learning paths</h3>
                    <p className="text-sm text-muted-foreground">Follow role-based sequences and progress quickly.</p>
                  </article>
                  <article className="rounded-xl border border-border bg-background p-4">
                    <FileText className="mb-3 h-5 w-5 text-primary" />
                    <h3 className="mb-1 font-semibold">Deep walkthroughs</h3>
                    <p className="text-sm text-muted-foreground">Each page includes long execution plans and checks.</p>
                  </article>
                  <article className="rounded-xl border border-border bg-background p-4">
                    <Layers className="mb-3 h-5 w-5 text-primary" />
                    <h3 className="mb-1 font-semibold">Operational docs</h3>
                    <p className="text-sm text-muted-foreground">Ship-ready guidance with troubleshooting and FAQs.</p>
                  </article>
                </section>
              </div>
            ) : (
              <article className="space-y-10">
                <header className="space-y-4 border-b border-border pb-6">
                  <p className="text-sm text-muted-foreground">{activePage.category}</p>
                  <h2 className="text-3xl font-bold tracking-tight">{activePage.title}</h2>
                  <p className="text-muted-foreground">{activePage.summary}</p>
                  <p className="text-muted-foreground">{activePage.introduction}</p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full border border-border px-3 py-1">Level: {activePage.level}</span>
                    <span className="rounded-full border border-border px-3 py-1">Read time: {activePage.readTime}</span>
                    <span className="rounded-full border border-border px-3 py-1">Slug: /docs/{activePage.slug}</span>
                  </div>
                  <figure className="overflow-hidden rounded-xl border border-border bg-background">
                    <img
                      src={getDocImageUrl(activePage.slug)}
                      alt={`${activePage.title} documentation illustration`}
                      className="h-64 w-full object-cover md:h-80"
                      loading="lazy"
                    />
                    <figcaption className="px-4 py-3 text-sm text-muted-foreground">
                      Visual reference for {activePage.title}.
                    </figcaption>
                  </figure>
                </header>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-semibold tracking-tight">Quickstart guides</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {activePage.quickstarts.map((card) => (
                      <article key={card.title} className="rounded-xl border border-border bg-background p-4 space-y-2">
                        <p className="text-xs text-muted-foreground">⏱ {card.duration}</p>
                        <h4 className="font-semibold">{card.title}</h4>
                        <p className="text-sm text-muted-foreground">{card.description}</p>
                        <p className="text-sm text-primary">{card.cta} →</p>
                      </article>
                    ))}
                  </div>
                </section>

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

                <section className="space-y-4 rounded-xl border border-border bg-background p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-semibold tracking-tight">Frequently asked questions</h3>
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    {activePage.faq.map((item, index) => (
                      <AccordionItem key={item.question} value={`faq-${index}`}>
                        <AccordionTrigger>{item.question}</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xl font-semibold tracking-tight">Additional resources</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    {activePage.resources.map((resource) => (
                      <a
                        key={resource.title}
                        href={resource.href}
                        target={resource.href.startsWith("http") ? "_blank" : undefined}
                        rel={resource.href.startsWith("http") ? "noreferrer" : undefined}
                        className="rounded-lg border border-border bg-background p-4 transition-colors hover:bg-secondary"
                      >
                        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                          {resource.title}
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">{resource.description}</p>
                      </a>
                    ))}
                  </div>
                </section>

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
