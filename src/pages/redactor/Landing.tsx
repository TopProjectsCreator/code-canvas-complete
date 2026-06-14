import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Zap, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { previewRedaction } from "@/redactor/lib/redaction.functions";
import { HighlightedText } from "@/redactor/components/HighlightedText";
import { RedactorFavicon } from "@/redactor/components/RedactorFavicon";

const SAMPLE = `Hello, my name is Sarah Chen. My OpenAI key is sk-proj-abcd1234efgh5678ijkl9012mnop3456 and you can email me at sarah@acme.com. My server is at 192.168.1.42 with token eyJhbGciOiJIUzI1NiJ9.payload.signature. Card on file: 4242 4242 4242 4242.`;

export default function RedactorLanding() {
  const [input, setInput] = useState(SAMPLE);
  const [result, setResult] = useState<{ redacted: string; matches: { token: string; original: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  function handleRedact() {
    setLoading(true);
    try {
      const r = previewRedaction(input);
      setResult({ redacted: r.redacted, matches: r.matches });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <RedactorFavicon />
      <header className="border-b border-border/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-mono font-semibold flex items-center gap-2">
            <img src="/redactor-logo.png" alt="" className="size-5" />
            redactor
          </div>
          <div className="flex items-center gap-3">
            <Link to="/redactor/auth" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link to="/redactor/auth">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="font-mono text-xs uppercase tracking-widest text-[oklch(0.86_0.18_165)] mb-4">
          AI gateway · self-hosted
        </p>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mb-6 max-w-3xl">
          Stop sending secrets to AI providers.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          A drop-in proxy that sits in front of OpenAI, Anthropic, Gemini, and 12+ other providers.
          Strips API keys, PII, and credentials from every prompt — and restores them in the response
          before your app sees it.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/redactor/auth">
            <Button size="lg">Create an account</Button>
          </Link>
          <a href="#playground">
            <Button size="lg" variant="outline">
              Try it live
            </Button>
          </a>
        </div>

        <div className="mt-10 rounded-lg border border-border/60 bg-card/40 p-4 font-mono text-xs overflow-x-auto">
          <div className="text-muted-foreground mb-2"># Point your OpenAI SDK at the proxy</div>
          <pre className="text-foreground">{`const openai = new OpenAI({
  baseURL: "https://your-proxy.up.railway.app/api/public/v1",
  apiKey: "lvp_live_••••••••••••••••",
});`}</pre>
        </div>
      </section>

      <section id="playground" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold mb-2">See it in action</h2>
        <p className="text-muted-foreground mb-6">
          Paste anything sensitive. The redactor runs in your browser, with no storage.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-mono uppercase text-muted-foreground mb-2">Input</div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-64 rounded-lg border border-border/60 bg-card/40 p-3 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[oklch(0.86_0.18_165)]"
            />
            <Button onClick={handleRedact} disabled={loading} className="mt-3">
              {loading ? "Redacting…" : "Redact →"}
            </Button>
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-muted-foreground mb-2">
              What the AI provider would see
            </div>
            <div className="w-full h-64 rounded-lg border border-border/60 bg-card/40 p-3 font-mono text-sm overflow-auto whitespace-pre-wrap">
              {result ? (
                <HighlightedText text={result.redacted} />
              ) : (
                <span className="text-muted-foreground">Click "Redact" to see the output.</span>
              )}
            </div>
            {result && result.matches.length > 0 && (
              <div className="mt-3 text-xs space-y-1">
                <div className="font-mono uppercase text-muted-foreground">
                  {result.matches.length} redactions
                </div>
                <ul className="space-y-1">
                  {result.matches.slice(0, 6).map((m, i) => (
                    <li key={i} className="font-mono">
                      <span className="text-[oklch(0.86_0.18_165)]">{m.token}</span>
                      <span className="text-muted-foreground"> ← </span>
                      <span className="line-through text-destructive/70">
                        {m.original.length > 40 ? m.original.slice(0, 40) + "…" : m.original}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-6">
        <Feature icon={Shield} title="20+ providers" text="OpenAI, Anthropic, Gemini, xAI, Groq, Mistral, DeepSeek, OpenRouter, Together, Cohere, Fireworks, Cerebras, SambaNova, Perplexity — plus custom OpenAI-compatible endpoints." />
        <Feature icon={Eye} title="Tokenize + rehydrate" text="Each secret becomes a stable token like [EMAIL_1]. The model only sees tokens. Responses are auto-rehydrated before reaching your app." />
        <Feature icon={Lock} title="AES-256-GCM at rest" text="Your provider keys are encrypted with HKDF-derived per-row keys. Plaintext never written to disk or logs." />
        <Feature icon={Zap} title="Streaming aware" text="SSE chunks pass through a transformer that buffers partial tokens, so even Claude's chunked deltas come back correct." />
      </section>

      <footer className="border-t border-border/60 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground font-mono flex justify-between">
          <span>redactor · self-hosted</span>
          <span>your keys, your postgres, your machine</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-5 bg-card/40">
      <Icon className="size-5 text-[oklch(0.86_0.18_165)] mb-3" />
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
