import { Link } from "react-router-dom";

const effectiveDate = "April 22, 2026";

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-card/40 p-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
          <p className="text-sm text-muted-foreground">Effective date: {effectiveDate}</p>
          <p className="text-sm text-muted-foreground">
            These Terms of Use ("Terms") govern your access to and use of CodeCanvas websites, apps, APIs, and
            related services (collectively, the "Service"). By creating an account, accessing, or using the Service,
            you agree to these Terms.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Eligibility and account registration</h2>
          <p className="text-sm text-muted-foreground">
            You must have legal capacity to enter into a binding agreement to use the Service. If you use the Service
            on behalf of an organization, you represent that you are authorized to bind that organization to these
            Terms.
          </p>
          <p className="text-sm text-muted-foreground">
            You are responsible for keeping your account credentials confidential, maintaining accurate account
            information, and for all activity under your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Acceptable use</h2>
          <p className="text-sm text-muted-foreground">You agree to use the Service lawfully and responsibly. You must not:</p>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>Violate applicable laws, regulations, or third-party rights, including privacy and intellectual property rights.</li>
            <li>Attempt unauthorized access to systems, accounts, or data, or interfere with service integrity or performance.</li>
            <li>Upload or transmit malware, exploit code, or malicious content.</li>
            <li>Use the Service for fraud, harassment, abuse, deceptive practices, or harmful conduct.</li>
            <li>Bypass technical limitations, rate limits, or protective controls unless explicitly permitted by us.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. User content and licenses</h2>
          <p className="text-sm text-muted-foreground">
            You retain ownership of content you submit to the Service, including text, files, code, and prompts
            ("User Content"). You grant CodeCanvas a worldwide, non-exclusive, royalty-free license to host,
            reproduce, process, transmit, display, and adapt User Content solely as necessary to provide, operate,
            secure, and improve the Service.
          </p>
          <p className="text-sm text-muted-foreground">
            You represent that you have all rights necessary to submit User Content and that User Content does not
            violate law or third-party rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Intellectual property</h2>
          <p className="text-sm text-muted-foreground">
            The Service, including software, design, trademarks, branding, documentation, and related materials, is
            owned by CodeCanvas or its licensors and is protected by intellectual property laws. Except as expressly
            allowed by these Terms, no rights are granted to you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Third-party services and integrations</h2>
          <p className="text-sm text-muted-foreground">
            The Service may interoperate with third-party services, tools, or websites. Your use of third-party
            services is subject to those providers&apos; terms and privacy policies. CodeCanvas is not responsible for
            third-party services or their content, availability, or data handling practices.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Fees, billing, renewals, and taxes</h2>
          <p className="text-sm text-muted-foreground">
            Certain features may require a paid plan. By subscribing, you authorize charges for recurring fees, usage
            overages, and applicable taxes as described at checkout or in your order form.
          </p>
          <p className="text-sm text-muted-foreground">
            Unless otherwise stated, subscriptions renew automatically until canceled. You are responsible for
            maintaining valid payment information and for all taxes associated with your use of the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Term, suspension, and termination</h2>
          <p className="text-sm text-muted-foreground">
            These Terms remain in effect while you use the Service. We may suspend or terminate access immediately if
            we reasonably believe you violated these Terms, created security or legal risk, or if required by law.
          </p>
          <p className="text-sm text-muted-foreground">
            You may stop using the Service at any time. Termination does not limit rights or remedies that accrued
            before termination.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Disclaimers</h2>
          <p className="text-sm text-muted-foreground">
            To the fullest extent permitted by law, the Service is provided "as is" and "as available" without
            warranties of any kind, express or implied, including implied warranties of merchantability, fitness for a
            particular purpose, non-infringement, and uninterrupted availability.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Limitation of liability</h2>
          <p className="text-sm text-muted-foreground">
            To the fullest extent permitted by law, CodeCanvas and its affiliates, officers, employees, and licensors
            will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or
            for loss of profits, revenues, data, goodwill, or business interruption, arising out of or related to the
            Service.
          </p>
          <p className="text-sm text-muted-foreground">
            Where liability cannot be excluded, our total liability for all claims relating to the Service will not
            exceed the amount you paid to CodeCanvas for the Service during the 12 months preceding the event giving
            rise to liability.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Indemnification</h2>
          <p className="text-sm text-muted-foreground">
            You agree to defend, indemnify, and hold harmless CodeCanvas and its affiliates from and against claims,
            liabilities, damages, losses, and expenses (including reasonable legal fees) arising from your use of the
            Service, your User Content, or your violation of these Terms or applicable law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">11. Governing law and dispute resolution</h2>
          <p className="text-sm text-muted-foreground">
            These Terms are governed by the law specified in your order form or organization agreement. If no law is
            specified, the laws of the service operator&apos;s principal place of business apply, excluding conflict of law
            rules.
          </p>
          <p className="text-sm text-muted-foreground">
            Any dispute, claim, or controversy arising from these Terms or the Service will be resolved in the courts
            agreed in your governing agreement, or otherwise courts with competent jurisdiction in the service
            operator&apos;s principal place of business.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">12. Changes to these terms</h2>
          <p className="text-sm text-muted-foreground">
            We may modify these Terms from time to time. If we make material changes, we will post the updated Terms
            with a revised effective date. Continued use of the Service after the revised Terms become effective means
            you accept the updated Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">13. General terms</h2>
          <p className="text-sm text-muted-foreground">
            If any provision of these Terms is found unenforceable, the remaining provisions remain in effect. Failure
            to enforce any provision is not a waiver. You may not assign these Terms without our consent, except where
            permitted by law; we may assign these Terms in connection with a merger, acquisition, or sale of assets.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">14. Contact</h2>
          <p className="text-sm text-muted-foreground">
            For legal notices, contact: <span className="font-medium">legal@codecanvas.example</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Please also review our{" "}
            <Link to="/privacy-policy" className="text-primary underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
