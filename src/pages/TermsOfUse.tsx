import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronUp, Link as LinkIcon, Check } from "lucide-react";
import { Seo } from "@/components/Seo";
import { cn } from "@/lib/utils";

const sections = [
  { id: "eligibility", label: "Eligibility & Account Registration" },
  { id: "acceptable-use", label: "Acceptable Use" },
  { id: "user-content", label: "User Content & Licenses" },
  { id: "ai-generated-content", label: "AI-Generated Content" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "third-party", label: "Third-Party Services & Integrations" },
  { id: "fees", label: "Fees, Billing, Renewals & Taxes" },
  { id: "term-suspension", label: "Term, Suspension & Termination" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "limitation-liability", label: "Limitation of Liability" },
  { id: "indemnification", label: "Indemnification" },
  { id: "governing-law", label: "Governing Law & Dispute Resolution" },
  { id: "changes", label: "Changes to These Terms" },
  { id: "general", label: "General Terms" },
  { id: "contact", label: "Contact" },
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

export default function TermsOfUsePage() {
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
        title="Terms of Use | Code Canvas"
        description="The terms governing your use of Code Canvas."
        path="/terms-of-use"
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
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Use</h1>
              <p className="text-sm text-muted-foreground">Effective date: {effectiveDate}</p>
              <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                These Terms of Use ("Terms") govern your access to and use of Code Canvas websites,
                apps, APIs, browser-based IDE, AI assistant, terminal, and related services
                (collectively, the "Service"). By creating an account, accessing, or using the Service,
                you agree to these Terms. If you are using the Service on behalf of an organization,
                you represent that you are authorized to bind that organization to these Terms.
              </p>
            </header>

            {/* ── Section 1 ── */}
            <section
              id="eligibility"
              ref={setRef("eligibility")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                1. Eligibility & Account Registration
                <SectionLink id="eligibility" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                You must have legal capacity to enter into a binding agreement to use the Service. If
                you use the Service on behalf of an organization, you represent that you are authorized
                to bind that organization to these Terms.
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                You are responsible for keeping your account credentials confidential, maintaining
                accurate account information, and for all activity under your account. You may
                authenticate using email and password or passkey (WebAuthn). You may also link
                third-party accounts (GitHub, GitLab, Bitbucket, Google) for authentication and
                repository access.
              </p>
            </section>

            {/* ── Section 2 ── */}
            <section
              id="acceptable-use"
              ref={setRef("acceptable-use")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                2. Acceptable Use
                <SectionLink id="acceptable-use" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                You agree to use the Service lawfully and responsibly. You must not:
              </p>
              <ul className="space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground [&>li]:list-disc">
                <li>Violate applicable laws, regulations, or third-party rights, including privacy and intellectual property rights.</li>
                <li>Attempt unauthorized access to systems, accounts, or data, or interfere with service integrity or performance.</li>
                <li>Upload or transmit malware, exploit code, or malicious content through the Service or WebContainer runtime.</li>
                <li>Use the AI assistant for prompt injection attacks, generating harmful content, or circumventing safety measures.</li>
                <li>Reverse engineer, decompile, or extract source code from the Service's compiled frontend or backend components beyond what is permitted by open-source licensing.</li>
                <li>Use the Service for fraud, harassment, abuse, deceptive practices, or harmful conduct.</li>
                <li>Bypass technical limitations, rate limits, or protective controls unless explicitly permitted by us.</li>
                <li>Use automated scripts or bots to interact with the Service in a way that imposes an unreasonable burden on infrastructure.</li>
              </ul>
            </section>

            {/* ── Section 3 ── */}
            <section
              id="user-content"
              ref={setRef("user-content")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                3. User Content & Licenses
                <SectionLink id="user-content" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                You retain ownership of content you submit to the Service, including text, files, code,
                prompts, AI-generated outputs, and media ("User Content"). You grant Code Canvas a
                worldwide, non-exclusive, royalty-free license to host, reproduce, process, transmit,
                display, and adapt User Content solely as necessary to provide, operate, secure, and
                improve the Service. This includes processing your prompts through AI model providers
                you configure and storing the generated responses.
              </p>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                If you share projects publicly or enable community forking, you grant other users a
                license to view, fork, and remix your User Content within the Service. You may remove
                shared access at any time, but forks created before removal may persist.
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                You represent that you have all rights necessary to submit User Content and that User
                Content does not violate law or third-party rights.
              </p>
            </section>

            {/* ── Section 4 ── */}
            <section
              id="ai-generated-content"
              ref={setRef("ai-generated-content")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                4. AI-Generated Content
                <SectionLink id="ai-generated-content" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                The Service provides an AI assistant that can generate code, images, audio, video, and
                text based on your prompts. AI-generated content is derived from models provided by
                third parties (OpenAI, Anthropic, Google Gemini) or models you configure via a
                bring-your-own-key setup.
              </p>
              <ul className="space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground [&>li]:list-disc">
                <li>AI-generated output is your responsibility. You should review, test, and validate all AI-generated code before using it in production.</li>
                <li>AI models may produce inaccurate, biased, or insecure outputs. We make no warranty about the accuracy, safety, or fitness of AI-generated content.</li>
                <li>You must not use the AI assistant to generate content that violates these Terms, applicable law, or the acceptable use policies of underlying model providers.</li>
                <li>Prompts and context sent to AI models may be processed on third-party infrastructure subject to the provider's privacy and data handling practices.</li>
              </ul>
            </section>

            {/* ── Section 5 ── */}
            <section
              id="intellectual-property"
              ref={setRef("intellectual-property")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                5. Intellectual Property
                <SectionLink id="intellectual-property" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                The Service, including its software, design, trademarks, branding, documentation, and
                related materials, is owned by Code Canvas or its licensors and is protected by
                intellectual property laws. The source code for the Service is available under an
                open-source license as published in the repository. Except as expressly allowed by
                these Terms or the applicable open-source license, no rights are granted to you.
              </p>
            </section>

            {/* ── Section 6 ── */}
            <section
              id="third-party"
              ref={setRef("third-party")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                6. Third-Party Services & Integrations
                <SectionLink id="third-party" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                The Service integrates with third-party services, including GitHub, GitLab, Bitbucket,
                AI model providers (OpenAI, Anthropic, Google Gemini), and Supabase for backend
                infrastructure. Your use of third-party services is subject to those providers' terms
                and privacy policies. Code Canvas is not responsible for third-party services or their
                content, availability, or data handling practices. When you bring your own API key for
                AI access, your data flows directly to that provider under their terms.
              </p>
            </section>

            {/* ── Section 7 ── */}
            <section
              id="fees"
              ref={setRef("fees")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                7. Fees, Billing, Renewals & Taxes
                <SectionLink id="fees" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                Certain features may require a paid plan. By subscribing, you authorize charges for
                recurring fees, usage overages, and applicable taxes as described at checkout or in
                your order form.
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Unless otherwise stated, subscriptions renew automatically until canceled. You are
                responsible for maintaining valid payment information and for all taxes associated with
                your use of the Service. Refunds are handled in accordance with our refund policy as
                stated at the point of purchase.
              </p>
            </section>

            {/* ── Section 8 ── */}
            <section
              id="term-suspension"
              ref={setRef("term-suspension")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                8. Term, Suspension & Termination
                <SectionLink id="term-suspension" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                These Terms remain in effect while you use the Service. We may suspend or terminate
                access immediately if we reasonably believe you violated these Terms, created security
                or legal risk, or if required by law.
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                You may stop using the Service at any time. You can export your projects and data
                through the Service's project settings before account closure. Termination does not
                limit rights or remedies that accrued before termination.
              </p>
            </section>

            {/* ── Section 9 ── */}
            <section
              id="disclaimers"
              ref={setRef("disclaimers")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                9. Disclaimers
                <SectionLink id="disclaimers" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                To the fullest extent permitted by law, the Service is provided "as is" and "as
                available" without warranties of any kind, express or implied, including implied
                warranties of merchantability, fitness for a particular purpose, non-infringement, and
                uninterrupted availability. This includes the AI assistant, WebContainer runtime,
                terminal, and all specialized editors. We do not warrant that the Service will be
                error-free, secure, or that AI-generated outputs will be accurate or fit for your
                intended use.
              </p>
            </section>

            {/* ── Section 10 ── */}
            <section
              id="limitation-liability"
              ref={setRef("limitation-liability")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                10. Limitation of Liability
                <SectionLink id="limitation-liability" />
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
                To the fullest extent permitted by law, Code Canvas and its affiliates, officers,
                employees, and licensors will not be liable for indirect, incidental, special,
                consequential, exemplary, or punitive damages, or for loss of profits, revenues, data,
                goodwill, or business interruption, arising out of or related to the Service.
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Where liability cannot be excluded, our total liability for all claims relating to the
                Service will not exceed the amount you paid to Code Canvas for the Service during the
                12 months preceding the event giving rise to liability.
              </p>
            </section>

            {/* ── Section 11 ── */}
            <section
              id="indemnification"
              ref={setRef("indemnification")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                11. Indemnification
                <SectionLink id="indemnification" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                You agree to defend, indemnify, and hold harmless Code Canvas and its affiliates from
                and against claims, liabilities, damages, losses, and expenses (including reasonable
                legal fees) arising from your use of the Service, your User Content, or your violation
                of these Terms or applicable law.
              </p>
            </section>

            {/* ── Section 12 ── */}
            <section
              id="governing-law"
              ref={setRef("governing-law")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                12. Governing Law & Dispute Resolution
                <SectionLink id="governing-law" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                These Terms are governed by the law specified in your order form or organization
                agreement. If no law is specified, the laws of the service operator's principal place
                of business apply, excluding conflict of law rules.
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Any dispute, claim, or controversy arising from these Terms or the Service will be
                resolved in the courts agreed in your governing agreement, or otherwise courts with
                competent jurisdiction in the service operator's principal place of business.
              </p>
            </section>

            {/* ── Section 13 ── */}
            <section
              id="changes"
              ref={setRef("changes")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                13. Changes to These Terms
                <SectionLink id="changes" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                We may modify these Terms from time to time. If we make material changes, we will post
                the updated Terms with a revised effective date. Continued use of the Service after the
                revised Terms become effective means you accept the updated Terms.
              </p>
            </section>

            {/* ── Section 14 ── */}
            <section
              id="general"
              ref={setRef("general")}
              className="group/section mb-8 scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                14. General Terms
                <SectionLink id="general" />
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                If any provision of these Terms is found unenforceable, the remaining provisions remain
                in effect. Failure to enforce any provision is not a waiver. You may not assign these
                Terms without our consent, except where permitted by law; we may assign these Terms in
                connection with a merger, acquisition, or sale of assets. These Terms, together with
                any order form or governing agreement, constitute the entire agreement between you and
                Code Canvas regarding the Service.
              </p>
            </section>

            {/* ── Section 15 ── */}
            <section
              id="contact"
              ref={setRef("contact")}
              className="group/section scroll-mt-24"
            >
              <h2 className="mb-3 text-xl font-semibold">
                15. Contact
                <SectionLink id="contact" />
              </h2>
              <p className="mb-2 text-[15px] leading-relaxed text-muted-foreground">
                For legal notices or questions, contact:{" "}
                <span className="font-medium text-foreground">legal@codecanvas.example</span>.
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Please also review our{" "}
                <Link to="/privacy-policy" className="text-primary underline underline-offset-4 hover:text-primary/80">
                  Privacy Policy
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
