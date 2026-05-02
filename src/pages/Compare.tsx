import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  X,
  Minus,
  CircuitBoard,
  ChevronDown,
  ChevronUp,
  Zap,
  Code2,
  Terminal,
  Globe,
  Users,
  Layers,
  Bot,
  ShieldCheck,
  Cpu,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const COMPETITORS = [
  {
    id: "replit",
    name: "Replit",
    tagline: "Online IDE with hosting",
    color: "#F26207",
    bg: "from-orange-500/10 to-orange-500/5",
    border: "border-orange-500/30",
    description:
      "A browser-based IDE focused on quick hosting and multiplayer editing.",
  },
  {
    id: "lovable",
    name: "Lovable",
    tagline: "AI-first web app builder",
    color: "#E04EFF",
    bg: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/30",
    description:
      "Prompt-driven UI generation that outputs deployable React apps.",
  },
  {
    id: "base44",
    name: "Base44",
    tagline: "No-code AI app platform",
    color: "#3B82F6",
    bg: "from-blue-500/10 to-blue-500/5",
    border: "border-blue-500/30",
    description:
      "Drag-and-drop AI builder for business apps with database backing.",
  },
  {
    id: "bolt",
    name: "Bolt (StackBlitz)",
    tagline: "AI full-stack generator",
    color: "#FBBF24",
    bg: "from-yellow-500/10 to-yellow-500/5",
    border: "border-yellow-500/30",
    description:
      "One-shot full-stack project generation from a prompt using WebContainers.",
  },
  {
    id: "cursor",
    name: "Cursor",
    tagline: "AI-augmented local IDE",
    color: "#10B981",
    bg: "from-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-500/30",
    description:
      "VS Code fork with deep AI code editing, chat, and autocomplete.",
  },
  {
    id: "v0",
    name: "v0 (Vercel)",
    tagline: "UI component generator",
    color: "#FFFFFF",
    bg: "from-neutral-500/10 to-neutral-500/5",
    border: "border-neutral-500/30",
    description:
      "Generates shadcn/tailwind UI components from prompts, no runtime.",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    tagline: "AI pair programmer",
    color: "#58A6FF",
    bg: "from-sky-500/10 to-sky-500/5",
    border: "border-sky-500/30",
    description:
      "IDE extension providing inline suggestions, chat, and pull request reviews.",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    tagline: "Agentic coding IDE",
    color: "#A78BFA",
    bg: "from-violet-500/10 to-violet-500/5",
    border: "border-violet-500/30",
    description:
      "Local IDE with autonomous AI agent that plans and executes multi-file tasks.",
  },
];

type FeatureValue = true | false | "partial" | string;

interface Feature {
  category: string;
  icon: React.ReactNode;
  items: {
    label: string;
    description?: string;
    codecanvas: FeatureValue;
    competitors: Record<string, FeatureValue>;
  }[];
}

const FEATURES: Feature[] = [
  {
    category: "Development Environment",
    icon: <Code2 className="h-4 w-4" />,
    items: [
      {
        label: "Full browser IDE",
        description: "Complete code editor without local install",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: "partial",
          base44: false,
          bolt: "partial",
          cursor: false,
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "Multi-file editing",
        description: "Edit multiple files and navigate between them",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: true,
          base44: false,
          bolt: true,
          cursor: true,
          v0: false,
          "github-copilot": true,
          windsurf: true,
        },
      },
      {
        label: "Syntax highlighting (50+ languages)",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: "partial",
          base44: false,
          bolt: true,
          cursor: true,
          v0: false,
          "github-copilot": true,
          windsurf: true,
        },
      },
      {
        label: "Find & replace across project",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: false,
          base44: false,
          bolt: false,
          cursor: true,
          v0: false,
          "github-copilot": true,
          windsurf: true,
        },
      },
      {
        label: "Visual canvas / whiteboard",
        description: "Design and diagram alongside code",
        codecanvas: true,
        competitors: {
          replit: false,
          lovable: false,
          base44: false,
          bolt: false,
          cursor: false,
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
    ],
  },
  {
    category: "Terminal & Runtime",
    icon: <Terminal className="h-4 w-4" />,
    items: [
      {
        label: "Full PTY terminal",
        description: "Real bash shell with interactive programs",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: false,
          base44: false,
          bolt: "partial",
          cursor: true,
          v0: false,
          "github-copilot": true,
          windsurf: true,
        },
      },
      {
        label: "Run code in browser",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: true,
          base44: true,
          bolt: true,
          cursor: false,
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "Live app preview",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: true,
          base44: true,
          bolt: true,
          cursor: false,
          v0: "partial",
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "Package installation (npm/pip/etc.)",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: "partial",
          base44: false,
          bolt: true,
          cursor: true,
          v0: false,
          "github-copilot": true,
          windsurf: true,
        },
      },
    ],
  },
  {
    category: "AI Capabilities",
    icon: <Bot className="h-4 w-4" />,
    items: [
      {
        label: "Multi-provider AI (9+ providers)",
        description: "OpenAI, Anthropic, Gemini, DeepSeek, etc.",
        codecanvas: true,
        competitors: {
          replit: "partial",
          lovable: false,
          base44: false,
          bolt: false,
          cursor: "partial",
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "AI chat with project context",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: true,
          base44: true,
          bolt: true,
          cursor: true,
          v0: false,
          "github-copilot": true,
          windsurf: true,
        },
      },
      {
        label: "AI image generation",
        codecanvas: true,
        competitors: {
          replit: false,
          lovable: false,
          base44: false,
          bolt: false,
          cursor: false,
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "AI video generation",
        codecanvas: true,
        competitors: {
          replit: false,
          lovable: false,
          base44: false,
          bolt: false,
          cursor: false,
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "Bring your own API key",
        codecanvas: true,
        competitors: {
          replit: false,
          lovable: false,
          base44: false,
          bolt: false,
          cursor: true,
          v0: false,
          "github-copilot": false,
          windsurf: true,
        },
      },
      {
        label: "Inline code autocomplete",
        codecanvas: "partial",
        competitors: {
          replit: true,
          lovable: false,
          base44: false,
          bolt: false,
          cursor: true,
          v0: false,
          "github-copilot": true,
          windsurf: true,
        },
      },
    ],
  },
  {
    category: "Collaboration",
    icon: <Users className="h-4 w-4" />,
    items: [
      {
        label: "Real-time multiplayer editing",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: false,
          base44: false,
          bolt: false,
          cursor: false,
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "Public project sharing / forking",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: "partial",
          base44: false,
          bolt: false,
          cursor: false,
          v0: "partial",
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "Live chat & video rooms",
        codecanvas: true,
        competitors: {
          replit: false,
          lovable: false,
          base44: false,
          bolt: false,
          cursor: false,
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
    ],
  },
  {
    category: "Extras",
    icon: <Layers className="h-4 w-4" />,
    items: [
      {
        label: "Git integration",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: true,
          base44: false,
          bolt: false,
          cursor: true,
          v0: false,
          "github-copilot": true,
          windsurf: true,
        },
      },
      {
        label: "Office file support (docx, pptx, xlsx)",
        codecanvas: true,
        competitors: {
          replit: false,
          lovable: false,
          base44: false,
          bolt: false,
          cursor: false,
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "Extensions / plugin system",
        codecanvas: true,
        competitors: {
          replit: "partial",
          lovable: false,
          base44: false,
          bolt: false,
          cursor: true,
          v0: false,
          "github-copilot": true,
          windsurf: "partial",
        },
      },
      {
        label: "Automations / workflow builder",
        codecanvas: true,
        competitors: {
          replit: false,
          lovable: false,
          base44: "partial",
          bolt: false,
          cursor: false,
          v0: false,
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "No local install required",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: true,
          base44: true,
          bolt: true,
          cursor: false,
          v0: true,
          "github-copilot": false,
          windsurf: false,
        },
      },
      {
        label: "Free tier available",
        codecanvas: true,
        competitors: {
          replit: true,
          lovable: true,
          base44: true,
          bolt: true,
          cursor: true,
          v0: true,
          "github-copilot": true,
          windsurf: true,
        },
      },
    ],
  },
];

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === true)
    return (
      <span className="flex items-center justify-center">
        <Check className="h-4 w-4 text-emerald-400" />
      </span>
    );
  if (value === false)
    return (
      <span className="flex items-center justify-center">
        <X className="h-4 w-4 text-red-400/70" />
      </span>
    );
  if (value === "partial")
    return (
      <span className="flex items-center justify-center">
        <Minus className="h-4 w-4 text-yellow-400/80" />
      </span>
    );
  return (
    <span className="text-xs text-muted-foreground text-center block">{value}</span>
  );
}

function scoreCompetitor(id: string): number {
  let score = 0;
  FEATURES.forEach((f) =>
    f.items.forEach((item) => {
      const v = item.competitors[id];
      if (v === true) score++;
      if (v === "partial") score += 0.5;
    })
  );
  return score;
}

function scoreCodeCanvas(): number {
  let score = 0;
  FEATURES.forEach((f) =>
    f.items.forEach((item) => {
      const v = item.codecanvas;
      if (v === true) score++;
      if (v === "partial") score += 0.5;
    })
  );
  return score;
}

const TOTAL_FEATURES = FEATURES.reduce((a, f) => a + f.items.length, 0);

export default function Compare() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>("replit");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(FEATURES.map((f) => f.category))
  );

  const competitor = COMPETITORS.find((c) => c.id === selected)!;
  const ccScore = scoreCodeCanvas();
  const compScore = scoreCompetitor(selected);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary) / 0.26) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.26) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-primary/10 blur-[150px]" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-primary/10 blur-[130px]" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/25">
              <CircuitBoard className="h-[18px] w-[18px] text-primary-foreground" />
            </div>
            <span className="font-mono text-lg font-semibold tracking-tight">
              CodeCanvas
            </span>
          </button>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/landing")}
            >
              Back to Home
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/editor")}
              className="gap-1.5 shadow-lg shadow-primary/30"
            >
              Try It Free <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-24 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">

          {/* Hero */}
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Feature Comparison
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              CodeCanvas vs.{" "}
              <span className="bg-gradient-to-r from-primary via-primary/80 to-info bg-clip-text text-transparent">
                the field
              </span>
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-base text-muted-foreground sm:text-lg">
              Pick any tool below and see how CodeCanvas stacks up feature by
              feature — no marketing spin, just the facts.
            </p>
          </div>

          {/* Competitor picker */}
          <div className="mb-10">
            <p className="mb-4 text-sm font-mono text-muted-foreground uppercase tracking-widest text-center">
              Compare against
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {COMPETITORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`rounded-xl border p-4 text-left transition-all hover:scale-[1.02] ${
                    selected === c.id
                      ? `bg-gradient-to-br ${c.bg} ${c.border} shadow-lg`
                      : "border-border/40 bg-card/40 hover:border-border/70"
                  }`}
                >
                  <div
                    className="mb-1 font-semibold text-sm"
                    style={{ color: selected === c.id ? c.color : undefined }}
                  >
                    {c.name}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {c.tagline}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Score summary */}
          <div className="mb-8 rounded-2xl border border-primary/20 bg-card/40 p-6 backdrop-blur-sm shadow-lg shadow-primary/5">
            <div className="grid grid-cols-2 gap-6 sm:gap-10">
              {/* CodeCanvas score */}
              <div className="text-center">
                <div className="mb-1 flex items-center justify-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/20">
                    <CircuitBoard className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-mono font-semibold text-primary">
                    CodeCanvas
                  </span>
                </div>
                <div className="text-4xl font-bold tabular-nums">
                  {ccScore}
                  <span className="text-lg text-muted-foreground">
                    /{TOTAL_FEATURES}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(ccScore / TOTAL_FEATURES) * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Math.round((ccScore / TOTAL_FEATURES) * 100)}% of features
                </div>
              </div>

              {/* Competitor score */}
              <div className="text-center">
                <div className="mb-1 flex items-center justify-center gap-2">
                  <span
                    className="font-mono font-semibold"
                    style={{ color: competitor.color }}
                  >
                    {competitor.name}
                  </span>
                </div>
                <div className="text-4xl font-bold tabular-nums">
                  {compScore}
                  <span className="text-lg text-muted-foreground">
                    /{TOTAL_FEATURES}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(compScore / TOTAL_FEATURES) * 100}%`,
                      backgroundColor: competitor.color,
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Math.round((compScore / TOTAL_FEATURES) * 100)}% of features
                </div>
              </div>
            </div>

            {/* Verdict */}
            <div className="mt-6 rounded-xl border border-primary/15 bg-primary/5 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {competitor.description}
              </p>
              {ccScore > compScore && (
                <p className="mt-2 font-semibold text-primary">
                  CodeCanvas leads by{" "}
                  <span className="font-mono">{ccScore - compScore}</span>{" "}
                  features in this comparison.
                </p>
              )}
              {ccScore <= compScore && (
                <p className="mt-2 font-semibold text-yellow-400">
                  {competitor.name} matches or exceeds CodeCanvas in{" "}
                  <span className="font-mono">{compScore - ccScore}</span>{" "}
                  areas — we're working on it!
                </p>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Supported
            </span>
            <span className="flex items-center gap-1.5">
              <Minus className="h-3.5 w-3.5 text-yellow-400" /> Partial / limited
            </span>
            <span className="flex items-center gap-1.5">
              <X className="h-3.5 w-3.5 text-red-400/70" /> Not available
            </span>
          </div>

          {/* Comparison table */}
          <div className="space-y-3">
            {FEATURES.map((section) => {
              const expanded = expandedCategories.has(section.category);
              return (
                <div
                  key={section.category}
                  className="overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm"
                >
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(section.category)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-primary">{section.icon}</span>
                      <span className="font-semibold tracking-tight">
                        {section.category}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
                        {section.items.length}
                      </span>
                    </div>
                    {expanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Table */}
                  {expanded && (
                    <div className="border-t border-border/30">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_auto_auto] border-b border-border/20 bg-muted/10 px-5 py-2">
                        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                          Feature
                        </span>
                        <span className="w-28 text-center text-xs font-mono text-primary uppercase tracking-wider">
                          CodeCanvas
                        </span>
                        <span
                          className="w-28 text-center text-xs font-mono uppercase tracking-wider"
                          style={{ color: competitor.color }}
                        >
                          {competitor.name}
                        </span>
                      </div>

                      {section.items.map((item, i) => (
                        <div
                          key={item.label}
                          className={`grid grid-cols-[1fr_auto_auto] items-center px-5 py-3.5 ${
                            i % 2 === 0 ? "" : "bg-muted/5"
                          } border-b border-border/10 last:border-0`}
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {item.label}
                            </div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {item.description}
                              </div>
                            )}
                          </div>
                          <div className="w-28">
                            <FeatureCell value={item.codecanvas} />
                          </div>
                          <div className="w-28">
                            <FeatureCell
                              value={
                                item.competitors[selected] ?? false
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-14 rounded-3xl border border-primary/20 bg-card/40 p-8 text-center backdrop-blur-sm shadow-2xl shadow-primary/10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-primary">
              <Zap className="h-3 w-3" />
              Ready to switch?
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              Start building on CodeCanvas — free.
            </h2>
            <p className="mt-3 max-w-lg mx-auto text-muted-foreground">
              No credit card, no install. Open your browser and start coding in
              seconds.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => navigate("/editor")}
                className="h-12 gap-2 px-8 text-base shadow-lg shadow-primary/30"
              >
                Open CodeCanvas <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 border-border/60 px-8 text-base"
                onClick={() => navigate("/landing")}
              >
                Learn more
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
