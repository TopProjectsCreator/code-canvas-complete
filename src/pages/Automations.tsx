import { Link } from "react-router-dom";

export default function AutomationsPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-card/40 p-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-primary">Workflows &amp; Integrations</p>
          <h1 className="text-4xl font-bold tracking-tight">Automations in Code Canvas</h1>
          <p className="text-base text-muted-foreground">
            A built-in automation hub for chaining triggers, API calls, AI steps, and integrations — all running on
            the same runtime that powers our agentic mode.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What we implement</h2>
          <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li><strong>70+ ready-made blocks</strong> covering HTTP, transforms, AI calls, conditionals, loops, delays, file ops, notifications, and more.</li>
            <li><strong>Trigger-First design.</strong> Every workflow starts with an explicit trigger: webhook, schedule, file change, manual, or event from another workflow.</li>
            <li><strong>Variable injection.</strong> Reference any prior step's output with <code className="rounded bg-muted px-1">{`{{prev.*}}`}</code> templates — no glue code required.</li>
            <li><strong>API Playground</strong> for testing endpoints and capturing them straight into a workflow step.</li>
            <li><strong>Full run history</strong> with per-step inputs, outputs, durations, and replay.</li>
            <li><strong>Integrations</strong> with email, SMS, GitHub, MCP servers, and any HTTP API.</li>
            <li><strong>Agentic mode bridge.</strong> The 8-iteration autonomous executor can invoke workflows as tools, and workflows can invoke the AI as a step.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Typical use cases</h2>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>Webhook → AI summarize → Slack/email digest</li>
            <li>Scheduled scrape → transform → write to a Google Sheet</li>
            <li>GitHub PR opened → run tests → comment with AI review</li>
            <li>Form submission → enrich via API → store in the database</li>
          </ul>
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
          <Link to="/editor" className="text-primary underline underline-offset-4">Open the editor</Link>
          <Link to="/office" className="text-primary underline underline-offset-4">Office</Link>
          <Link to="/scratch" className="text-primary underline underline-offset-4">Scratch</Link>
        </footer>
      </div>
    </main>
  );
}
