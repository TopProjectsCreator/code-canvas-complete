import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  ChevronRight,
  CircuitBoard,
  Code2,
  Cpu,
  Gauge,
  Globe,
  Layers,
  Orbit,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicCanvasSearch } from "@/components/landing/PublicCanvasSearch";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { useLandingStats } from "@/hooks/useLandingStats";

const missionBlocks = [
  {
    title: "Neural Coding Core",
    description: "Generate, refactor, and debug with a context-aware AI copilot that sees your full workspace.",
    icon: <Bot className="h-4 w-4" />,
  },
  {
    title: "Planet-Scale Runtime",
    description: "Run containers, terminals, and previews instantly in the browser with zero local setup.",
    icon: <Cpu className="h-4 w-4" />,
  },
  {
    title: "Creative Fusion Stack",
    description: "Code, electronics, 3D, docs, and media in one command center built for modern makers.",
    icon: <Layers className="h-4 w-4" />,
  },
];

const matrixCards = [
  {
    title: "IDE GRID",
    subtitle: "Multi-language engineering",
    points: ["20+ language support", "Live syntax intelligence", "Project-level code search"],
    icon: <Code2 className="h-5 w-5" />,
  },
  {
    title: "AGENT HUB",
    subtitle: "AI-native workflow",
    points: ["Context-aware assistants", "Refactor pipelines", "Debug session traces"],
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    title: "RUNTIME OPS",
    subtitle: "Execution in milliseconds",
    points: ["Web terminal", "Instant preview", "Edge-ready exports"],
    icon: <Terminal className="h-5 w-5" />,
  },
  {
    title: "COLLAB NET",
    subtitle: "Realtime teamwork",
    points: ["Publishable canvases", "Fork + remix loops", "Shared creative pipelines"],
    icon: <Globe className="h-5 w-5" />,
  },
];

const signalReadout = [
  { label: "Latency", value: "12ms", icon: <Gauge className="h-4 w-4" /> },
  { label: "AI Agents", value: "128", icon: <Bot className="h-4 w-4" /> },
  { label: "Deploy Region", value: "Global", icon: <Radar className="h-4 w-4" /> },
  { label: "Build Status", value: "Realtime", icon: <Orbit className="h-4 w-4" /> },
];

const timeline = [
  {
    tag: "01",
    title: "Initialize workspace",
    text: "Boot a futuristic workspace with templates for apps, hardware, and content in seconds.",
  },
  {
    tag: "02",
    title: "Augment with AI",
    text: "Use autonomous coding flows for generation, review, and optimization inside the editor.",
  },
  {
    tag: "03",
    title: "Ship at velocity",
    text: "Publish, share, and iterate with cloud-native infrastructure and built-in collaboration.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { stats } = useLandingStats();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.05] motion-safe:animate-grid-drift"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary) / 0.26) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.26) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute inset-0 opacity-[0.08] motion-safe:animate-scanline" />
        <div className="absolute left-1/2 top-0 h-[580px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[170px]" />
        <div className="absolute -left-20 top-[30%] h-72 w-72 rounded-full bg-info/20 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/10 blur-[150px]" />
      </div>

      <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/25">
              <CircuitBoard className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="font-mono text-lg font-semibold tracking-tight">CodeCanvas OS</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/editor")}>Sign In</Button>
            <Button size="sm" onClick={() => navigate("/editor")} className="gap-1.5 shadow-lg shadow-primary/30">
              Enter Grid <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="px-6 pb-16 pt-28">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-3xl border border-primary/20 bg-card/40 p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl sm:p-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                Future-Ready Development Stack
              </div>

              <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                Rebuilt for the next decade of
                <span className="bg-gradient-to-r from-primary via-primary/80 to-info bg-clip-text text-transparent"> digital creation</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
                CodeCanvas is now a fully futuristic homepage experience—AI-native, cloud-native, and collaboration-first.
                Build apps, hardware, and media from one immersive interface.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate("/editor")} className="h-12 gap-2 px-8 text-base">
                  Launch Command Center <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 border-border/60 px-8 text-base"
                  onClick={() => document.getElementById("systems")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Explore Systems
                </Button>
              </div>

              <div className="mt-8">
                <PublicCanvasSearch />
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {missionBlocks.map((block) => (
                  <div key={block.title} className="rounded-2xl border border-border/50 bg-background/40 p-4">
                    <div className="mb-2 inline-flex items-center gap-2 text-sm text-primary">
                      {block.icon}
                      {block.title}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{block.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-6" id="systems">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 text-center">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-primary">System Architecture</p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A modular platform built for speed and scale</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {matrixCards.map((card) => (
                <div
                  key={card.title}
                  className="group rounded-2xl border border-primary/20 bg-gradient-to-b from-card/60 to-card/20 p-5 transition duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/15"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {card.icon}
                  </div>
                  <p className="font-mono text-xs tracking-[0.2em] text-primary">{card.title}</p>
                  <h3 className="mt-1 text-lg font-semibold">{card.subtitle}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {card.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-14">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-primary/20 bg-card/35 p-6 backdrop-blur-sm sm:p-8">
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-primary">Signal Telemetry</p>
              <h3 className="text-2xl font-semibold tracking-tight">Realtime platform status</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {signalReadout.map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/50 bg-background/40 p-4">
                    <div className="mb-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                      {item.icon}
                      {item.label}
                    </div>
                    <p className="text-xl font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-primary">Mission Sequence</p>
              <div className="space-y-4">
                {timeline.map((item) => (
                  <div key={item.tag} className="rounded-xl border border-primary/20 bg-background/35 p-4">
                    <div className="mb-1 inline-flex items-center gap-2 text-sm font-semibold">
                      <span className="font-mono text-primary">{item.tag}</span>
                      {item.title}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-16">
          <div className="mx-auto max-w-5xl rounded-3xl border border-border/40 bg-card/30 p-8 text-center backdrop-blur-sm sm:p-12">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Zap className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Step into the futuristic workspace</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              From solo prototyping to collaborative shipping, CodeCanvas gives you one intelligent environment for every stage.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <AnimatedCounter value={stats.totalUsers} label="Total Users" icon={<Users className="h-6 w-6" />} glowColor="hsl(var(--primary))" />
              <AnimatedCounter value={stats.onlineUsers} label="Online Now" icon={<Workflow className="h-6 w-6" />} glowColor="hsl(142 71% 45%)" />
              <AnimatedCounter value={stats.totalCanvases} label="Canvases Created" icon={<Rocket className="h-6 w-6" />} glowColor="hsl(199 89% 48%)" />
            </div>
            <Button size="lg" className="mt-8 h-12 gap-2 px-10" onClick={() => navigate("/editor")}>
              Start Building <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              No install required · Browser-native runtime
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
