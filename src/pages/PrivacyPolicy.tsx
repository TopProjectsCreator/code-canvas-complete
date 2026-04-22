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
            This Privacy Policy explains how CodeCanvas collects, uses, discloses, stores, and protects personal
            information when you access our website, applications, and related services (collectively, the
            "Service"). It also explains choices and rights that may be available to you under applicable law.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Information we collect</h2>
          <p className="text-sm text-muted-foreground">
            We collect information directly from you, automatically when you use the Service, and from third-party
            sources such as identity providers and payment processors.
          </p>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>
              <span className="font-medium">Account and profile data:</span> Name, email, username, avatar,
              password hashes or third-party authentication identifiers, organization/workspace membership, and
              account preferences.
            </li>
            <li>
              <span className="font-medium">Project and collaboration content:</span> Prompts, code, files,
              messages, comments, uploads, project metadata, and version history you create or submit.
            </li>
            <li>
              <span className="font-medium">Usage and technical data:</span> IP address, browser type, device
              identifiers, operating system, referral URLs, pages viewed, feature usage, timestamps, and error logs.
            </li>
            <li>
              <span className="font-medium">Billing and transaction data:</span> Subscription status, invoices,
              payment method metadata, and transaction records processed by our payment providers.
            </li>
            <li>
              <span className="font-medium">Support and communications data:</span> Messages you send to support,
              survey responses, bug reports, and feedback.
            </li>
            <li>
              <span className="font-medium">Cookies and similar technologies:</span> Data needed for sign-in,
              preferences, security protections, analytics, and product performance measurement.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. How we use information</h2>
          <p className="text-sm text-muted-foreground">We use personal information for legitimate business and operational purposes, including to:</p>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>Provide, maintain, personalize, and improve the Service and related features.</li>
            <li>Authenticate users, enforce permissions, and secure accounts and workspaces.</li>
            <li>Process payments, billing events, refunds, and subscription renewals.</li>
            <li>Monitor reliability, prevent abuse, investigate incidents, and detect fraudulent activity.</li>
            <li>Respond to support requests, communicate service updates, and deliver administrative notices.</li>
            <li>Develop analytics, product insights, and aggregate metrics to improve user experience.</li>
            <li>
              Train, evaluate, and improve quality and safety systems where permitted by law and by applicable
              customer agreements.
            </li>
            <li>Comply with legal obligations and protect rights, safety, and property.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Legal bases for processing (where applicable)</h2>
          <p className="text-sm text-muted-foreground">
            Depending on your jurisdiction, we may process personal information under one or more legal bases,
            including: performance of a contract with you, your consent, legitimate interests (such as improving and
            securing our Service), and compliance with legal obligations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. How and when we disclose information</h2>
          <p className="text-sm text-muted-foreground">
            We do not sell your personal information for money. We may disclose personal information in the following
            circumstances:
          </p>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>With vendors and service providers that perform hosting, analytics, customer support, email delivery, payment processing, and security functions on our behalf.</li>
            <li>With integrations or third-party services you authorize to access your account or content.</li>
            <li>With affiliates or successors in connection with a merger, acquisition, financing, reorganization, bankruptcy, or sale of assets.</li>
            <li>With legal authorities or other parties when required to comply with law, legal process, or enforceable governmental request.</li>
            <li>When necessary to investigate violations, enforce our terms, or protect rights, property, and safety.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. International data transfers</h2>
          <p className="text-sm text-muted-foreground">
            We may process and store information in countries other than where you live. Where required by law, we use
            appropriate safeguards for cross-border transfers, such as contractual safeguards and equivalent protections
            designed to protect transferred data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Data retention</h2>
          <p className="text-sm text-muted-foreground">
            We retain personal information for as long as necessary to provide the Service, meet contractual
            commitments, resolve disputes, enforce agreements, and satisfy legal, tax, accounting, and security
            requirements. Retention periods vary based on data type and context.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Security</h2>
          <p className="text-sm text-muted-foreground">
            We implement administrative, technical, and organizational measures designed to protect personal
            information. These may include access controls, encryption in transit, logging, and monitoring. No system
            is perfectly secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Your privacy rights and choices</h2>
          <p className="text-sm text-muted-foreground">
            Subject to local law, you may have rights to access, correct, delete, or port your personal information,
            and to restrict or object to certain processing. You may also withdraw consent where processing relies on
            consent.
          </p>
          <p className="text-sm text-muted-foreground">
            Residents of certain U.S. states, including California, may have rights to know, delete, correct, and opt
            out of certain uses such as targeted advertising or sharing. We will not discriminate against you for
            exercising applicable privacy rights.
          </p>
          <p className="text-sm text-muted-foreground">
            To submit a privacy request, contact us using the details below. We may need to verify your identity before
            completing a request.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Cookies and tracking technologies</h2>
          <p className="text-sm text-muted-foreground">
            We use cookies, local storage, and similar technologies to keep you signed in, remember preferences,
            measure engagement, and improve performance. You can control many cookie settings through your browser, but
            disabling some cookies may affect functionality.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Children&apos;s privacy</h2>
          <p className="text-sm text-muted-foreground">
            The Service is not directed to children under 13, and we do not knowingly collect personal information from
            children under 13 without legally required consent. If you believe a child has provided personal
            information, please contact us so we can investigate and take appropriate action.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">11. Changes to this policy</h2>
          <p className="text-sm text-muted-foreground">
            We may update this Privacy Policy from time to time to reflect legal, technical, or business changes. When
            we make material changes, we will post the updated policy and revise the effective date above.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">12. Contact us</h2>
          <p className="text-sm text-muted-foreground">
            For privacy requests or questions, contact: <span className="font-medium">privacy@codecanvas.example</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            You can also review our{" "}
            <Link to="/terms-of-use" className="text-primary underline underline-offset-4">
              Terms of Use
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
