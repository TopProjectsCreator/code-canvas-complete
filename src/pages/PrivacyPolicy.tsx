import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronUp, Link as LinkIcon, Check } from "lucide-react";
import { Seo } from "@/components/Seo";
import { cn } from "@/lib/utils";

const sections = [
  { id: "information-we-collect", label: "Information We Collect" },
  { id: "how-we-use-information", label: "How We Use Information" },
  { id: "legal-bases", label: "Legal Bases for Processing" },
  { id: "how-we-disclose", label: "How We Disclose Information" },
  { id: "international-transfers", label: "International Data Transfers" },
  { id: "data-retention", label: "Data Retention" },
  { id: "security", label: "Security" },
  { id: "your-rights", label: "Your Privacy Rights & Choices" },
  { id: "cookies", label: "Cookies & Tracking Technologies" },
  { id: "childrens-privacy", label: "Children's Privacy" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact Us" },
] as const;

const effectiveDate = "April 22, 2026";

const copyToClipboard = async (id: string) => {
  const url = `${window.location.origin}${window.location.pathname}#${id}`;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
};

function SectionLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        window.history.replaceState(null, "", `#${id}`);
        const ok = await copyToClipboard(id);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover/section:opacity-40 hover:opacity-100! focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Copy link to section"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <LinkIcon className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    const refs = sectionRefs.current;
    for (const el of Object.values(refs)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const setRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <Seo
        title="Privacy Policy | Code Canvas"
        description="How Code Canvas collects, uses, and protects your data."
        path="/privacy-policy"
      />

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-12 lg:px-8">
        {/* ── Sidebar TOC ── */}
        <aside className="hidden shrink-0 lg:block lg:w-56 xl:w-64">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              On this page
            </p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(s.id);
                  if (el) {
                    window.history.replaceState(null, "", `#${s.id}`);
                    el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className={cn(
                  "block truncate rounded-md px-3 py-1.5 text-sm transition-colors",
                  activeSection === s.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s.label}
              </a>
            ))}
          </div>
        </aside>

        {/* ── Content ── */}
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl border border-border bg-card/60 p-8 shadow-sm sm:p-10 lg:p-12">
            {/* ── Header ── */}
            <header className="mb-10 space-y-3">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
              <p className="text-sm text-muted-foreground">Effective date: {effectiveDate}</p>
              <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                Code Canvas is a browser-based IDE that combines a code editor, AI assistant, terminal,
                and specialized tools for hardware, media, office documents, and more. This Privacy Policy
                explains how we collect, use, disclose, store, and protect your personal information when
                you use our website, applications, and related services (collectively, the "Service").
              </p>
            </header>

            {/* ── Section 1 ── */}
            <section
              id="information-we-collect"
              ref={setRef("information-we-collect")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                1. Information We Collect
                <SectionLink id="information-we-collect" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                We collect information directly from you, automatically when you use the Service, and
                from third-party sources such as identity providers and payment processors.
              </p>
              <ul className="space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground [&>li]:list-disc">
                <li>
                  <span className="font-medium text-foreground">Account and profile data.</span>{" "}
                  Name, email, username, avatar, password hashes or third-party authentication
                  identifiers (GitHub, GitLab, Bitbucket, Google), organization and workspace
                  membership, and account preferences.
                </li>
                <li>
                  <span className="font-medium text-foreground">Project and collaboration content.</span>{" "}
                  Code, files, prompts, AI chat messages, AI-generated outputs (code, images, audio,
                  video), comments, uploads, project metadata, version history, and session recordings
                  you create or submit.
                </li>
                <li>
                  <span className="font-medium text-foreground">AI interaction data.</span>{" "}
                  Prompts, code context, and file contents you send to the AI assistant are processed
                  by third-party model providers you configure (OpenAI, Anthropic, Google Gemini). You
                  may bring your own API key, in which case data is sent directly to the provider
                  under their privacy policy.
                </li>
                <li>
                  <span className="font-medium text-foreground">Usage and technical data.</span>{" "}
                  IP address, browser type, device identifiers, operating system, referral URLs, pages
                  viewed, feature usage (editors used, terminal sessions, compilation requests),
                  timestamps, and error logs.
                </li>
                <li>
                  <span className="font-medium text-foreground">Billing and transaction data.</span>{" "}
                  Subscription status, invoices, payment method metadata, and transaction records
                  processed by our payment providers.
                </li>
                <li>
                  <span className="font-medium text-foreground">Passkey / WebAuthn data.</span>{" "}
                  Public key credentials generated during passkey registration for passwordless
                  authentication. Private keys remain on your device and are never sent to our servers.
                </li>
                <li>
                  <span className="font-medium text-foreground">Support and communications data.</span>{" "}
                  Messages you send to support, survey responses, bug reports, and feedback.
                </li>
                <li>
                  <span className="font-medium text-foreground">Cookies and similar technologies.</span>{" "}
                  Data needed for sign-in, preferences, security protections, analytics, and product
                  performance measurement.
                </li>
              </ul>
            </section>

            {/* ── Section 2 ── */}
            <section
              id="how-we-use-information"
              ref={setRef("how-we-use-information")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                2. How We Use Information
                <SectionLink id="how-we-use-information" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                We use personal information for legitimate business and operational purposes, including:
              </p>
              <ul className="space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground [&>li]:list-disc">
                <li>Provide, maintain, personalize, and improve the Service and its features (code editor, terminal, AI assistant, Scratch, Arduino, 3D editor, Media Suite, Office Suite).</li>
                <li>Authenticate users via email/password or passkey/WebAuthn, enforce permissions, and secure accounts and workspaces.</li>
                <li>Route AI prompts to your configured model provider and return generated responses (code, images, audio, video).</li>
                <li>Process payments, billing events, refunds, and subscription renewals.</li>
                <li>Monitor reliability, prevent abuse, investigate incidents, and detect fraudulent or unauthorized activity.</li>
                <li>Respond to support requests, communicate service updates, and deliver administrative notices.</li>
                <li>Develop analytics, product insights, and aggregate metrics to improve user experience.</li>
                <li>Comply with legal obligations and protect rights, safety, and property.</li>
              </ul>
            </section>

            {/* ── Section 3 ── */}
            <section
              id="legal-bases"
              ref={setRef("legal-bases")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                3. Legal Bases for Processing
                <SectionLink id="legal-bases" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Depending on your jurisdiction, we may process personal information under one or more
                legal bases, including: performance of a contract with you (to provide the Service),
                your consent (where we ask for it), legitimate interests (such as improving and
                securing our Service, preventing abuse, and developing new features), and compliance
                with legal obligations.
              </p>
            </section>

            {/* ── Section 4 ── */}
            <section
              id="how-we-disclose"
              ref={setRef("how-we-disclose")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                4. How We Disclose Information
                <SectionLink id="how-we-disclose" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                We do not sell your personal information for money. We may disclose personal
                information in the following circumstances:
              </p>
              <ul className="space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground [&>li]:list-disc">
                <li>With vendors and service providers that perform hosting, analytics, customer support, email delivery, payment processing, and security functions on our behalf.</li>
                <li>With AI model providers you configure (OpenAI, Anthropic, Google Gemini) to process your prompts and generate responses. If you bring your own API key, data goes directly to the provider.</li>
                <li>With integrations or third-party services you authorize to access your account or content (GitHub, GitLab, Bitbucket).</li>
                <li>With other workspace members as part of real-time collaboration, shared projects, and team administration features.</li>
                <li>With affiliates or successors in connection with a merger, acquisition, financing, reorganization, bankruptcy, or sale of assets.</li>
                <li>With legal authorities or other parties when required to comply with law, legal process, or enforceable governmental request.</li>
                <li>When necessary to investigate violations, enforce our terms, or protect rights, property, and safety.</li>
              </ul>
            </section>

            {/* ── Section 5 ── */}
            <section
              id="international-transfers"
              ref={setRef("international-transfers")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                5. International Data Transfers
                <SectionLink id="international-transfers" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                We may process and store information in countries other than where you live, including
                the United States. Where required by law, we use appropriate safeguards for cross-border
                transfers, such as Standard Contractual Clauses and equivalent protections designed to
                protect transferred data.
              </p>
            </section>

            {/* ── Section 6 ── */}
            <section
              id="data-retention"
              ref={setRef("data-retention")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                6. Data Retention
                <SectionLink id="data-retention" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                We retain personal information for as long as necessary to provide the Service, meet
                contractual commitments, resolve disputes, enforce agreements, and satisfy legal, tax,
                accounting, and security requirements. Retention periods vary based on data type and
                context. For example, project content and AI conversation history are retained until
                you delete them or your account is closed; session recordings are retained for a
                defined period and then automatically deleted.
              </p>
            </section>

            {/* ── Section 7 ── */}
            <section
              id="security"
              ref={setRef("security")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                7. Security
                <SectionLink id="security" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                We implement administrative, technical, and organizational measures designed to protect
                personal information. These include encryption in transit (TLS), encryption at rest,
                access controls, logging, monitoring, and regular security reviews. The Service is
                open-source and self-hostable, allowing you to audit the codebase. No system is
                perfectly secure, and we cannot guarantee absolute security. We encourage you to use
                strong, unique passwords and enable passkey authentication where available.
              </p>
            </section>

            {/* ── Section 8 ── */}
            <section
              id="your-rights"
              ref={setRef("your-rights")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                8. Your Privacy Rights & Choices
                <SectionLink id="your-rights" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                Subject to local law, you may have rights to access, correct, delete, or port your
                personal information, and to restrict or object to certain processing. You may also
                withdraw consent where processing relies on consent.
              </p>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                Residents of certain U.S. states, including California, may have rights to know,
                delete, correct, and opt out of certain uses such as targeted advertising or sharing.
                We will not discriminate against you for exercising applicable privacy rights.
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                To submit a privacy request, contact us using the details below. We may need to verify
                your identity before completing a request. You can also manage your account data and
                export your projects through the Service's settings and project export features.
              </p>
            </section>

            {/* ── Section 9 ── */}
            <section
              id="cookies"
              ref={setRef("cookies")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                9. Cookies & Tracking Technologies
                <SectionLink id="cookies" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                We use cookies, local storage, and similar technologies to keep you signed in, remember
                preferences, measure engagement, and improve performance. The Service also uses browser
                storage (IndexedDB, localStorage) for offline support via our PWA service worker and
                WebContainer state persistence. You can control many cookie settings through your
                browser, but disabling some cookies may affect functionality.
              </p>
            </section>

            {/* ── Section 10 ── */}
            <section
              id="childrens-privacy"
              ref={setRef("childrens-privacy")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                10. Children's Privacy
                <SectionLink id="childrens-privacy" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                The Service is not directed to children under 13, and we do not knowingly collect
                personal information from children under 13 without legally required consent. If you
                believe a child has provided personal information, please contact us so we can
                investigate and take appropriate action.
              </p>
            </section>

            {/* ── Section 11 ── */}
            <section
              id="changes"
              ref={setRef("changes")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                11. Changes to This Policy
                <SectionLink id="changes" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                We may update this Privacy Policy from time to time to reflect legal, technical, or
                business changes. When we make material changes, we will post the updated policy and
                revise the effective date above. Continued use of the Service after the revised policy
                becomes effective means you accept the updated terms.
              </p>
            </section>

            {/* ── Section 12 ── */}
            <section
              id="contact"
              ref={setRef("contact")}
              className="group/section scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                12. Contact Us
                <SectionLink id="contact" />
              </h2>
              <p className="mb-2 text-[15px] leading-relaxed text-muted-foreground">
                For privacy requests or questions, contact:{" "}
                <span className="font-medium text-foreground">privacy@codecanvas.example</span>.
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Please also review our{" "}
                <Link to="/terms-of-use" className="text-primary underline underline-offset-4 hover:text-primary/80">
                  Terms of Use
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* ── Back to top ── */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors hover:bg-muted"
          aria-label="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </main>
  );
}
