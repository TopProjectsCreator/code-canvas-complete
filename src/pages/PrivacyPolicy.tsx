import { Link } from "react-router-dom";

const effectiveDate = "April 22, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-card/40 p-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Effective date: {effectiveDate}</p>
          <p className="text-sm text-muted-foreground">
            This Privacy Policy describes how CodeCanvas collects, uses, discloses, and safeguards personal information when you use our site, apps, and services.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Information we collect</h2>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>Account data (name, email, authentication credentials, organization/workspace membership).</li>
            <li>Project and user content (files, prompts, collaboration comments, uploads, metadata).</li>
            <li>Usage and device data (logs, browser details, IP address, session identifiers, diagnostics).</li>
            <li>Payment and billing data processed by payment providers.</li>
            <li>Cookies and similar technologies for login state, security, analytics, and preferences.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. How we use information</h2>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>Provide, maintain, secure, and improve the service.</li>
            <li>Authenticate users and enforce access controls.</li>
            <li>Train and evaluate safety, abuse prevention, and reliability workflows where permitted by law and contract.</li>
            <li>Provide support, notices, and updates.</li>
            <li>Comply with legal obligations and protect rights, safety, and property.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Legal bases for processing (where applicable)</h2>
          <p className="text-sm text-muted-foreground">
            Depending on your location, we process data under one or more legal bases including contract performance, consent, legitimate interests, and legal compliance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Sharing and disclosures</h2>
          <p className="text-sm text-muted-foreground">
            We may share information with service providers (hosting, analytics, payments, communications), integrations you authorize, business transfer counterparties, and authorities when legally required.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. International data transfers</h2>
          <p className="text-sm text-muted-foreground">
            Data may be processed in countries other than your own. We apply appropriate safeguards for cross-border transfers where required.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Data retention</h2>
          <p className="text-sm text-muted-foreground">
            We retain personal information only as long as needed for the purposes in this policy, including legal, tax, accounting, security, and dispute-resolution needs.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Security</h2>
          <p className="text-sm text-muted-foreground">
            We implement administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission or storage is 100% secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Your privacy rights</h2>
          <p className="text-sm text-muted-foreground">
            Subject to local law, you may have rights to access, delete, correct, and port data, or to restrict/object to processing. You may also appeal decisions where required. We do not discriminate against you for exercising applicable rights.
          </p>
          <p className="text-sm text-muted-foreground">
            For certain U.S. states (including California), residents may have rights to know, delete, correct, opt out of targeted advertising/sales/sharing, and limit use of sensitive personal information where applicable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Children&apos;s privacy</h2>
          <p className="text-sm text-muted-foreground">
            The service is not directed to children under 13 and we do not knowingly collect personal information from children under 13 without verifiable parental consent.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Changes to this policy</h2>
          <p className="text-sm text-muted-foreground">
            We may update this Privacy Policy from time to time. Material updates will be posted with a revised effective date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">11. Contact us</h2>
          <p className="text-sm text-muted-foreground">
            For privacy requests or questions, contact: <span className="font-medium">privacy@codecanvas.example</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            You can also review our <Link to="/terms-of-use" className="text-primary underline underline-offset-4">Terms of Use</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
