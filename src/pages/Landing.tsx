import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
    title: "Canvas-First Coding",
    description: "Design projects on visual whiteboards and share documents and powerpoints as a team, then jump directly into the files, terminal, and live preview.",
    icon: <Bot className="h-4 w-4" />,
  },
  {
    title: "Browser IDE + Runtime",
    description: "Run code, packages, and previews in your browser with no local setup and no context switching.",
    icon: <Cpu className="h-4 w-4" />,
  },
  {
    title: "Real Collaboration",
    description: "Share canvases, fork projects, and build together with publish-ready links and remix workflows.",
    icon: <Layers className="h-4 w-4" />,
  },
];

const matrixCards = [
  {
    title: "EDITOR CORE",
    subtitle: "Code faster in context",
    points: ["Multi-file editing", "Syntax-aware workflows", "Project-wide search"],
    icon: <Code2 className="h-5 w-5" />,
  },
  {
    title: "AI ASSIST",
    subtitle: "Copilot for every canvas",
    points: ["Generate + refactor code", "Explain symbols", "Guide debugging steps"],
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    title: "BUILD + RUN",
    subtitle: "Ship from one workspace",
    points: ["Web terminal", "Instant app preview", "Git-friendly workflow"],
    icon: <Terminal className="h-5 w-5" />,
  },
  {
    title: "COMMUNITY",
    subtitle: "Discover and remix",
    points: ["Public canvas search", "Fork + remix loops", "Share projects in one click"],
    icon: <Globe className="h-5 w-5" />,
  },
];

const staticSignalReadout = [
  { label: "Deploy Region", value: "Global", icon: <Radar className="h-4 w-4" /> },
  { label: "Build Status", value: "Realtime", icon: <Orbit className="h-4 w-4" /> },
];

const timeline = [
  {
    tag: "01",
    title: "Start from a canvas",
    text: "Create or open a canvas and map ideas into runnable code, files, and connected tools.",
  },
  {
    tag: "02",
    title: "Build with AI",
    text: "Generate, refactor, and explain code directly in your workspace without losing project context.",
  },
  {
    tag: "03",
    title: "Publish and collaborate",
    text: "Share your canvas, gather feedback, and iterate quickly with remix-friendly project links.",
  },
];

const floatingBadges = ["Realtime AI Pairing", "All in one IDE", "Live Team Presence", "Edge-Speed Builds", "Built in Git", "Multiplayer Canvases", "Browser Native", "Instant Previews", "No Install Required", "Publish builtin", "Office (word/pptx/exel) support", "Live chat and video rooms", "Top-Noch Extentions pane", "Full terminal", "Copy Zapier with our amazing automations system", "Make workflows for easy deploys and actions."];
// pulseNodes is now derived live from recent public projects (see component body)

export default function Landing() {
  const navigate = useNavigate();
  const { stats } = useLandingStats();

  const agentsLabel = stats.activeAgents > 0 ? "AI Agents Live" : "Total Prompts";
  const agentsValue = stats.activeAgents > 0
    ? stats.activeAgents.toLocaleString()
    : stats.totalPrompts.toLocaleString();

  const signalReadout = [
    { label: "Latency", value: stats.latencyMs > 0 ? `${stats.latencyMs}ms` : "—", icon: <Gauge className="h-4 w-4" /> },
    { label: agentsLabel, value: agentsValue, icon: <Bot className="h-4 w-4" /> },
    ...staticSignalReadout,
  ];

  // Live pulse nodes from most-recently-updated public canvases
  const [pulseNodes, setPulseNodes] = useState<Array<{ id: string; projectId: string | null; status: string }>>([
    { id: "—", projectId: null, status: "Connecting" },
    { id: "—", projectId: null, status: "Connecting" },
    { id: "—", projectId: null, status: "Connecting" },
  ]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, language, updated_at")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(3);
      if (cancelled || !data) return;
      const statuses = ["Synced", "Rendering", "Deploying", "Building", "Live"];
      setPulseNodes(
        data.map((p: any, i: number) => ({
          id: (p.name || "Canvas").slice(0, 18),
          projectId: p.id ?? null,
          status: statuses[i % statuses.length],
        })),
      );
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);


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
        <div className="absolute left-1/2 top-[12%] h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-info/20 blur-[150px] motion-safe:animate-aurora-shift" />
        <div className="absolute -left-20 top-[30%] h-72 w-72 rounded-full bg-info/20 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/10 blur-[150px]" />
        <div className="absolute right-[8%] top-[22%] h-28 w-28 rounded-full border border-primary/35 motion-safe:animate-orbit-ring" />
        <div className="absolute left-[10%] top-[48%] h-16 w-16 rounded-full border border-info/40 motion-safe:animate-orbit-ring [animation-delay:1.6s]" />
        {[...Array(16)].map((_, idx) => (
          <span
            key={`star-${idx}`}
            className="absolute h-1 w-1 rounded-full bg-primary/60 motion-safe:animate-pulse"
            style={{
              left: `${6 + ((idx * 11) % 88)}%`,
              top: `${8 + ((idx * 17) % 78)}%`,
              animationDelay: `${(idx % 8) * 0.35}s`,
            }}
          />
        ))}
      </div>

      <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/25">
              <CircuitBoard className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="font-mono text-lg font-semibold tracking-tight">CodeCanvas</span>
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
                Built for Real Code Canvases
              </div>

              <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                The collaborative
                <span className="bg-gradient-to-r from-primary via-primary/80 to-info bg-clip-text text-transparent"> coding canvas for modern teams</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
                CodeCanvas brings your automations and tools, a full in-browser IDE, and AI coding tools together so you can plan, design,
                build, run, automate, and share software from one place.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate("/editor")} className="h-12 gap-2 px-8 text-base">
                  Open CodeCanvas <ChevronRight className="h-4 w-4" />
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

              <div className="mt-6 overflow-hidden rounded-xl border border-primary/20 bg-background/45 px-3 py-2">
                <div className="flex animate-marquee gap-3 text-xs uppercase tracking-[0.18em] text-primary/90">
                  {[...floatingBadges, ...floatingBadges].map((badge, idx) => (
                    <span key={`${badge}-${idx}`} className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-10 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
                  {missionBlocks.map((block) => (
                    <div key={block.title} className="rounded-2xl border border-border/50 bg-background/40 p-4 transition duration-500 hover:-translate-y-1 hover:border-primary/45 hover:shadow-lg hover:shadow-primary/15">
                      <div className="mb-2 inline-flex items-center gap-2 text-sm text-primary">
                        {block.icon}
                        {block.title}
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">{block.description}</p>
                    </div>
                  ))}
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/45 p-4 sm:p-5 motion-safe:animate-tilt-wave">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Neural Grid</p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
                      Live
                    </span>
                  </div>

                  <div className="space-y-2">
                    {pulseNodes.map((node, idx) => {
                      const clickable = !!node.projectId;
                      return (
                        <button
                          key={`${node.id}-${idx}`}
                          type="button"
                          disabled={!clickable}
                          onClick={() => node.projectId && navigate(`/project/${node.projectId}`)}
                          className={`relative w-full overflow-hidden rounded-xl border border-primary/20 bg-card/45 px-3 py-2 text-left transition-colors ${clickable ? "hover:border-primary/50 hover:bg-card/70 cursor-pointer" : "cursor-default"}`}
                        >
                          <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-primary/20 to-transparent motion-safe:animate-shimmer-line" style={{ animationDelay: `${idx * 0.4}s` }} />
                          <div className="relative flex items-center justify-between text-xs">
                            <span className="font-mono text-primary/90">{node.id}</span>
                            <span className="text-muted-foreground">{node.status}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Online</p>
                      <p className="text-sm font-semibold">{stats.onlineUsers.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Agents</p>
                      <p className="text-sm font-semibold">{stats.activeAgents.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Canvases</p>
                      <p className="text-sm font-semibold">{stats.totalCanvases.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-6" id="systems">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 text-center">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-primary">Platform Features</p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need to go from idea to shipped code</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {matrixCards.map((card) => (
                <div
                  key={card.title}
                  className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-card/60 to-card/20 p-5 transition duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/15"
                >
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
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
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-primary">Why teams choose CodeCanvas</p>
              <h3 className="text-2xl font-semibold tracking-tight">Built for everyday development workflows</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {signalReadout.map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/50 bg-background/40 p-4 transition duration-500 hover:border-primary/45 hover:shadow-md hover:shadow-primary/15">
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
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-primary">How it works</p>
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
            <h2 className="text-3xl font-bold tracking-tight">Start building on your code canvas</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              From solo prototyping to team shipping, CodeCanvas keeps planning, coding, and collaboration in one connected space.
             (Yes, this is live)
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <AnimatedCounter value={stats.totalUsers} label="Total Users" icon={<Users className="h-6 w-6" />} glowColor="hsl(var(--primary))" />
              <AnimatedCounter value={stats.onlineUsers} label="Online Now" icon={<Workflow className="h-6 w-6" />} glowColor="hsl(142 71% 45%)" />
              <AnimatedCounter value={stats.totalCanvases} label="Canvases Created" icon={<Rocket className="h-6 w-6" />} glowColor="hsl(199 89% 48%)" />
            </div>
            <Button size="lg" className="mt-8 h-12 gap-2 px-10" onClick={() => navigate("/editor")}>
              Start Building <ArrowRight className="h-4 w-4" />
            </Button>
            <br></br>
            <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              No install required · Browser-native runtime
            </div>
          </div>
        </section>
        <section id="capabilities" className="relative px-6 py-24 border-t border-primary/10 bg-primary/[0.01]">
          <div className="mx-auto max-w-6xl">

            <div className="mb-16 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                Template Library
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">What can you make?</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                From low-level systems engineering to collaborative office suites—CodeCanvas provides the runtime and environment for any project.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

              <div className="group rounded-2xl border border-border/50 bg-card/20 p-6 backdrop-blur-sm transition-all hover:border-primary/40">
                <div className="mb-4 flex items-center gap-3 text-primary">
                  <div className="p-2 rounded-lg bg-primary/10"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg></div>
                  <span className="font-mono text-xs uppercase tracking-widest">Web Ecosystem</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">react</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">nodejs</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">typescript</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">html</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">javascript</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">php</span>
                </div>
              </div>

              <div className="group rounded-2xl border border-border/50 bg-card/20 p-6 backdrop-blur-sm transition-all hover:border-primary/40">
                <div className="mb-4 flex items-center gap-3 text-primary">
                  <div className="p-2 rounded-lg bg-primary/10"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-cpu"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg></div>
                  <span className="font-mono text-xs uppercase tracking-widest">Systems & Low-Level</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">rust</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">cpp</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">zig</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">go</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">csharp</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">swift</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">nim</span>
                </div>
              </div>

              <div className="group rounded-2xl border border-border/50 bg-card/20 p-6 backdrop-blur-sm transition-all hover:border-primary/40">
                <div className="mb-4 flex items-center gap-3 text-primary">
                  <div className="p-2 rounded-lg bg-primary/10"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-brain-circuit"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.105V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2.143a4 4 0 0 0 1.143-3V7a3 3 0 1 0-6 0v1"/><path d="M9 13a4.5 4.5 0 0 0 3-4"/><path d="M6.003 5.125A3 3 0 1 0 12 7"/><path d="M14 18h.01"/><path d="M14 14h.01"/><path d="M18 18h.01"/><path d="M18 14h.01"/></svg></div>
                  <span className="font-mono text-xs uppercase tracking-widest">Logic & Data</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">python</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">haskell</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">julia</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">elixir</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">lisp</span>
                  <span className="px-2 py-1 rounded bg-background/50 border border-border/40 text-xs text-muted-foreground group-hover:text-foreground">ocaml</span>
                </div>
              </div>

              <div className="group rounded-2xl border border-border/50 bg-card/20 p-6 backdrop-blur-sm transition-all hover:border-primary/40 md:col-span-2 lg:col-span-3">
                <div className="mb-4 flex items-center gap-3 text-primary">
                  <div className="p-2 rounded-lg bg-primary/10"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layers"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg></div>
                  <span className="font-mono text-xs uppercase tracking-widest">Office & Media Assets</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 border border-border/40 text-sm text-muted-foreground group-hover:text-foreground group-hover:border-info/30 transition-all">
                    <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span> Word
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 border border-border/40 text-sm text-muted-foreground group-hover:text-foreground group-hover:border-green-500/30 transition-all">
                    <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span> excel
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 border border-border/40 text-sm text-muted-foreground group-hover:text-foreground group-hover:border-orange-500/30 transition-all">
                    <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></span> powerpoint
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 border border-border/40 text-sm text-muted-foreground group-hover:text-foreground group-hover:border-primary/30 transition-all">
                    <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]"></span> video & audio
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 border border-border/40 text-sm text-muted-foreground group-hover:text-foreground group-hover:border-primary/30 transition-all">
                    <span className="h-2 w-2 rounded-full bg-primary"></span> CAD editor
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border/20">
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-muted-foreground text-center mb-6">Discovery Tier Environments</p>
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                <span className="text-xs font-mono">secureops</span>
                <span className="text-xs font-mono">automation</span>
                <span className="text-xs font-mono">arduino</span>
                <span className="text-xs font-mono">ftc</span>
                <span className="text-xs font-mono">pony</span>
                <span className="text-xs font-mono">lazyk</span>
                <span className="text-xs font-mono">scratch</span>
                <span className="text-xs font-mono">nim</span>
                <span className="text-xs font-mono">crystal</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
