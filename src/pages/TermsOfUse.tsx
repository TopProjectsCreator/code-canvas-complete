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
            These Terms of Use govern access to and use of CodeCanvas. By using the service, you agree to these terms.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Eligibility and account registration</h2>
          <p className="text-sm text-muted-foreground">
            You must have legal capacity to enter a contract. You are responsible for account security and activities under your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Acceptable use</h2>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>Do not violate laws, regulations, or third-party rights.</li>
            <li>Do not attempt unauthorized access, abuse, disruption, malware distribution, or reverse engineering prohibited by law.</li>
            <li>Do not use the service for harmful, fraudulent, or abusive activity.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. User content and licenses</h2>
          <p className="text-sm text-muted-foreground">
            You retain ownership of content you submit. You grant us a non-exclusive license to host, process, transmit, and display content as needed to provide and improve the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Intellectual property</h2>
          <p className="text-sm text-muted-foreground">
            The service, including software, branding, and related materials, is protected by intellectual property laws. Except as expressly permitted, no rights are granted.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Third-party services</h2>
          <p className="text-sm text-muted-foreground">
            Integrations and third-party tools may be subject to separate terms and privacy policies. We are not responsible for third-party services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Fees, billing, and taxes</h2>
          <p className="text-sm text-muted-foreground">
            Paid features may require fees and recurring billing. Charges are due as stated at purchase. You are responsible for applicable taxes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Termination and suspension</h2>
          <p className="text-sm text-muted-foreground">
            We may suspend or terminate access for violations, security reasons, legal requirements, or discontinued services. You may stop using the service at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Disclaimers</h2>
          <p className="text-sm text-muted-foreground">
            The service is provided “as is” and “as available” to the fullest extent permitted by law, without warranties of any kind.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Limitation of liability</h2>
          <p className="text-sm text-muted-foreground">
            To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or loss of profits/data/use.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Indemnification</h2>
          <p className="text-sm text-muted-foreground">
            You agree to indemnify and hold harmless CodeCanvas from claims arising from your use of the service, your content, or your violation of law or these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">11. Governing law and dispute resolution</h2>
          <p className="text-sm text-muted-foreground">
            These terms are governed by applicable law specified in your order form or organization agreement. If none is specified, local law of the service operator applies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">12. Changes to these terms</h2>
          <p className="text-sm text-muted-foreground">
            We may update these terms from time to time. Continued use after changes become effective constitutes acceptance of the updated terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">13. Contact</h2>
          <p className="text-sm text-muted-foreground">
            For legal notices, contact: <span className="font-medium">legal@codecanvas.example</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Please also review our <Link to="/privacy-policy" className="text-primary underline underline-offset-4">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
