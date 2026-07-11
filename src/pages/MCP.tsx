import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, ExternalLink, Terminal, Sparkles, Zap, Shield, Code2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

const MCP_URL = "https://xlmvlplazxrouscupidi.supabase.co/functions/v1/mcp";

type ClientKey = "claude" | "codex" | "opencode" | "cursor";

const clients: {
  key: ClientKey;
  name: string;
  tagline: string;
  accent: string;
  steps: { title: string; body?: string; code?: string; lang?: string }[];
}[] = [
  {
    key: "claude",
    name: "Claude Code",
    tagline: "Anthropic's terminal-native coding agent",
    accent: "from-orange-500/20 via-orange-500/5 to-transparent",
    steps: [
      {
        title: "Add the MCP server",
        body: "Run this once from any terminal. Claude Code stores the connection globally.",
        code: `claude mcp add --transport http codecanvas ${MCP_URL}`,
        lang: "bash",
      },
      {
        title: "Authenticate",
        body: "Inside Claude Code, run /mcp and pick codecanvas → Authenticate. A browser window opens for OAuth.",
        code: `/mcp`,
        lang: "text",
      },
      {
        title: "Use it",
        body: "Claude now sees every CodeCanvas tool — list canvases, edit files, run code, leave comments.",
      },
    ],
  },
  {
    key: "codex",
    name: "Codex CLI",
    tagline: "OpenAI's open-source coding CLI",
    accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    steps: [
      {
        title: "Edit ~/.codex/config.toml",
        body: "Add a streamable HTTP MCP entry. Codex handles OAuth automatically on first use.",
        code: `[mcp_servers.codecanvas]
url = "${MCP_URL}"
transport = "http"`,
        lang: "toml",
      },
      {
        title: "Restart Codex",
        body: "Quit and relaunch codex. The first tool call triggers the OAuth flow in your browser.",
        code: `codex`,
        lang: "bash",
      },
    ],
  },
  {
    key: "opencode",
    name: "OpenCode",
    tagline: "The open-source AI coding agent",
    accent: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    steps: [
      {
        title: "Setup",
        kind: "split",
        options: [
          {
            title: "Option 1 — Just ask opencode",
            body: "Copy this prompt and paste it to opencode. It'll add CodeCanvas and handle the OAuth login.",
            code: `Install this MCP server and help me login: ${MCP_URL}`,
            lang: "text",
          },
          {
            title: "Option 2 — Do it yourself",
            body: "Add CodeCanvas to your config and authenticate manually.",
            codes: [
              {
                code: `{
  "mcp": {
    "codecanvas": {
      "type": "remote",
      "url": "${MCP_URL}",
      "oauth": {}
    }
  }
}`,
                lang: "json",
              },
              {
                code: "opencode mcp auth codecanvas",
                lang: "bash",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "cursor",
    name: "Cursor",
    tagline: "The AI-first code editor",
    accent: "from-violet-500/20 via-violet-500/5 to-transparent",
    steps: [
      {
        title: "Open ~/.cursor/mcp.json",
        body: "Or use Cursor Settings → MCP → Add new server.",
        code: `{
  "mcpServers": {
    "codecanvas": {
      "url": "${MCP_URL}"
    }
  }
}`,
        lang: "json",
      },
      {
        title: "Sign in",
        body: "Cursor prompts to authenticate on first use. Approve in the browser and you're in.",
      },
    ],
  },
  {
    key: "pi",
    name: "Pi",
    tagline: "The minimal, extensible coding agent",
    accent: "from-amber-500/20 via-amber-500/5 to-transparent",
    steps: [
      {
        title: "Setup",
        kind: "split",
        options: [
          {
            title: "Option 1 — Just ask Pi",
            body: "Copy this prompt and paste it to Pi. It'll install the MCP adapter, add CodeCanvas, and handle the OAuth login.",
            code: `Install the pi-mcp-adapter extension, add this MCP server, and help me login: ${MCP_URL}`,
            lang: "text",
          },
          {
            title: "Option 2 — Do it yourself",
            body: "Install the adapter, configure CodeCanvas, and authenticate manually.",
            codes: [
              {
                code: "pi install npm:pi-mcp-adapter",
                lang: "bash",
              },
              {
                code: `{
  "mcpServers": {
    "codecanvas": {
      "url": "${MCP_URL}",
      "auth": "oauth"
    }
  }
}`,
                lang: "json",
              },
              {
                code: "/mcp-auth codecanvas",
                lang: "text",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "hermes",
    name: "Hermes",
    tagline: "The self-improving AI coding agent",
    accent: "from-purple-500/20 via-purple-500/5 to-transparent",
    steps: [
      {
        title: "Setup",
        kind: "split",
        options: [
          {
            title: "Option 1 — Just ask Hermes",
            body: "Copy this prompt and paste it to Hermes. It'll add CodeCanvas and handle the OAuth login.",
            code: `Add this MCP server and help me login: ${MCP_URL}`,
            lang: "text",
          },
          {
            title: "Option 2 — Do it yourself",
            body: "Add CodeCanvas to ~/.hermes/config.yaml. Hermes auto-discovers OAuth on first use.",
            codes: [
              {
                code: `mcp_servers:
  codecanvas:
    url: "${MCP_URL}"
    auth: oauth`,
                lang: "yaml",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "openclaw",
    name: "OpenClaw",
    tagline: "The open-source AI agent platform",
    accent: "from-red-500/20 via-red-500/5 to-transparent",
    steps: [
      {
        title: "Setup",
        kind: "split",
        options: [
          {
            title: "Option 1 — Just ask OpenClaw",
            body: "Copy this prompt and paste it to OpenClaw. It'll add CodeCanvas and handle the OAuth login.",
            code: `Install this MCP server and help me login: ${MCP_URL}`,
            lang: "text",
          },
          {
            title: "Option 2 — Do it yourself",
            body: "Add the server and authenticate manually.",
            codes: [
              {
                code: `openclaw mcp add codecanvas --url ${MCP_URL} --transport streamable-http --auth oauth`,
                lang: "bash",
              },
              {
                code: "openclaw mcp login codecanvas",
                lang: "bash",
              },
            ],
          },
        ],
      },
    ],
  },
];

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/60 bg-[hsl(var(--terminal-bg))]">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {lang ?? "shell"}
          </span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const features = [
  { icon: Code2, title: "Read & write files", body: "Full access to every file in your canvases." },
  { icon: Terminal, title: "Run code & shell", body: "Execute in the sandbox, get output back." },
  { icon: Shield, title: "OAuth 2.1 secured", body: "Every request runs as you, under your RLS." },
  { icon: Zap, title: "26+ tools", body: "Everything the in-app assistant can do." },
];

export default function MCP() {
  const [active, setActive] = useState<ClientKey>("claude");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const client = clients.find((c) => c.key === active)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Connect CodeCanvas MCP — Claude, Codex, OpenCode, Cursor, Pi, Hermes, OpenClaw"
        description="Wire CodeCanvas into your AI coding agent over Model Context Protocol. Copy-paste setup for Claude Code, Codex CLI, OpenCode, Cursor, Pi, Hermes, and OpenClaw."
        path="/mcp"
      />

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Nav */}
        <nav className="border-b border-border/40 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="font-mono">codecanvas</span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">v0.2.0</span>
              <Link to="/docs">
                <Button variant="ghost" size="sm">Docs</Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <header className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <div
            className={`transition-all duration-1000 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-xs text-primary">
              <Sparkles className="h-3 w-3" />
              NEW · Model Context Protocol
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Plug CodeCanvas into
              <br />
              <span className="bg-gradient-to-r from-primary via-orange-400 to-primary bg-clip-text text-transparent">
                any AI coding agent.
              </span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              One MCP endpoint. OAuth 2.1. Every tool the in-app assistant has — canvases, files, execution,
              comments, reviews — exposed to Claude Code, Codex, OpenCode, and Cursor.
            </p>

            {/* Endpoint card */}
            <div className="mt-10 max-w-3xl">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                MCP endpoint
              </div>
              <CodeBlock code={MCP_URL} lang="url" />
            </div>
          </div>

          {/* Feature strip */}
          <div className="mt-16 grid grid-cols-2 gap-3 md:grid-cols-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`rounded-lg border border-border/60 bg-card/40 p-4 backdrop-blur-sm transition-all duration-700 ${
                  mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: `${200 + i * 80}ms` }}
              >
                <f.icon className="mb-3 h-5 w-5 text-primary" />
                <div className="mb-1 text-sm font-semibold">{f.title}</div>
                <div className="text-xs leading-relaxed text-muted-foreground">{f.body}</div>
              </div>
            ))}
          </div>
        </header>

        {/* Setup */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-primary">
                / setup
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Pick your agent.
              </h2>
            </div>
            <div className="hidden font-mono text-xs text-muted-foreground sm:block">
              {clients.length} clients supported
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-8 flex flex-wrap gap-2 border-b border-border/60">
            {clients.map((c) => (
              <button
                key={c.key}
                onClick={() => setActive(c.key)}
                className={`relative -mb-px px-4 py-3 font-mono text-sm transition-colors ${
                  active === c.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.name}
                {active === c.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* Active client panel */}
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${client.accent}`} />
            <div className="relative p-8 md:p-10">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-background/60">
                  <Terminal className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{client.name}</h3>
                  <p className="text-sm text-muted-foreground">{client.tagline}</p>
                </div>
              </div>

              <ol className="space-y-6">
                {client.steps.map((step, i) => (
                  <li key={i} className="relative pl-12">
                    <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-sm font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="pt-1">
                      <div className="mb-1 text-base font-semibold">{step.title}</div>
                      {step.kind === "split" && step.options ? (
                        <div className="relative">
                          <div className="absolute left-1/2 top-4 z-10 hidden -translate-x-1/2 sm:flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card font-mono text-[10px] font-bold text-muted-foreground">
                            OR
                          </div>
                          <div className="grid gap-5 sm:grid-cols-2">
                            {step.options.map((opt, j) => (
                              <div
                                key={j}
                                className={`relative rounded-xl border ${
                                  j === 0
                                    ? "border-primary/20 bg-gradient-to-b from-primary/[0.04] to-transparent"
                                    : "border-border/60 bg-card/30"
                                } p-5 pt-4`}
                              >
                                {j === 0 && (
                                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-primary/10" />
                                )}
                                <div className="mb-3 flex items-center gap-2.5">
                                  <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                      j === 0
                                        ? "bg-primary/15 text-primary"
                                        : "bg-muted text-muted-foreground"
                                    } font-mono text-[11px] font-bold`}
                                  >
                                    {j === 0 ? "A" : "B"}
                                  </div>
                                  <div className="text-sm font-semibold">{opt.title}</div>
                                </div>
                                {opt.body && (
                                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                                    {opt.body}
                                  </p>
                                )}
                                <div className="space-y-2.5">
                                  {(opt.codes ?? (opt.code ? [opt.code] : [])).map((entry, k) => {
                                    const code = typeof entry === "string" ? entry : entry.code;
                                    const lang = typeof entry === "string" ? (opt.lang ?? "bash") : (entry.lang ?? "bash");
                                    return (
                                      <div key={k} className="relative pl-7">
                                        <div className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-muted font-mono text-[9px] font-bold text-muted-foreground">
                                          {k + 1}
                                        </div>
                                        <CodeBlock code={code} lang={lang} />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {step.body && (
                            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                          )}
                          {step.code && <CodeBlock code={step.code} lang={step.lang} />}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-16 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 md:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h3 className="mb-2 text-2xl font-bold">Don't have an account yet?</h3>
                <p className="text-muted-foreground">
                  Sign in to CodeCanvas first — the OAuth flow needs somewhere to send you.
                </p>
              </div>
              <div className="flex gap-3">
                <Link to="/editor">
                  <Button size="lg" className="gap-2">
                    Open the editor
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
                <a
                  href="https://modelcontextprotocol.io/specification/2025-06-18/basic/transports"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="lg" variant="outline" className="gap-2">
                    MCP spec
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

          <p className="mt-10 text-center font-mono text-xs text-muted-foreground">
            More clients coming. Ping us if yours isn't listed.
          </p>
        </section>
      </div>
    </div>
  );
}
