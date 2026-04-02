import { useNavigate } from "react-router-dom";
import {
  Zap, Code2, Play, Terminal, GitBranch, Cpu, Sparkles, Globe, Users,
  ArrowRight, ChevronRight, Palette, Box, Music, FileText, Layers,
  Activity, Eye, FolderKanban, Rocket, ShieldCheck, Workflow, Bot, Orbit, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicCanvasSearch } from "@/components/landing/PublicCanvasSearch";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { useLandingStats } from "@/hooks/useLandingStats";

const features = [
  { icon: <Code2 className="w-5 h-5" />, title: "Multi-Language Editor", description: "Write in 20+ languages with syntax highlighting, IntelliSense, and real-time error detection." },
  { icon: <Play className="w-5 h-5" />, title: "Instant Preview", description: "See your changes live with hot-reload for web projects. Run code in-browser with zero setup." },
  { icon: <Sparkles className="w-5 h-5" />, title: "AI Assistant", description: "Generate, refactor, and debug code with a built-in AI chat that understands your entire project." },
  { icon: <Terminal className="w-5 h-5" />, title: "Integrated Terminal", description: "Full terminal emulation powered by WebContainers. Install packages and run commands natively." },
  { icon: <Cpu className="w-5 h-5" />, title: "Arduino & Hardware", description: "Write, compile, and flash Arduino sketches directly from the browser with breadboard simulation." },
  { icon: <Box className="w-5 h-5" />, title: "3D & CAD Editor", description: "View and generate 3D models with text-to-3D AI from 6 different providers." },
  { icon: <Palette className="w-5 h-5" />, title: "Open Source", description: "A fully open source and free platform. See us on github at:\nhttps://github.com/TopProjectsCreator/code-canvas-complete." },
  { icon: <GitBranch className="w-5 h-5" />, title: "Git Integration", description: "Import from GitHub, GitLab, or Bitbucket. Built-in version history and branching." },
  { icon: <Music className="w-5 h-5" />, title: "Media Editors", description: "Edit audio, video, images, and office documents — all within the same workspace." },
  { icon: <Layers className="w-5 h-5" />, title: "Custom Themes", description: "Choose from 7 built-in themes or create and share your own with the theme builder." },
  { icon: <Globe className="w-5 h-5" />, title: "Share & Collaborate", description: "Publish projects, fork others' work, and star your favorites." },
  { icon: <FileText className="w-5 h-5" />, title: "Office Suite", description: "Built-in Word, Excel, and PowerPoint editors for documentation alongside your code." },
];

const featureTracks = [
  {
    title: "Build",
    label: "Core IDE",
    icon: <Code2 className="w-4 h-4" />,
    items: ["20+ languages", "Realtime previews", "Web terminal", "Git-native workflow"],
  },
  {
    title: "Create",
    label: "Specialized Editors",
    icon: <Palette className="w-4 h-4" />,
    items: ["Arduino + simulator", "3D/CAD generation", "Media suite", "Office docs"],
  },
  {
    title: "Scale",
    label: "Collaboration",
    icon: <Users className="w-4 h-4" />,
    items: ["Project publishing", "Team collaboration", "Theme sharing", "Public canvas discovery"],
  },
  {
    title: "Accelerate",
    label: "AI Layer",
    icon: <Bot className="w-4 h-4" />,
    items: ["Code generation", "Debug help", "Refactors", "Context-aware chat"],
  },
];

const orbitBadges = ["Neural IDE", "WebContainers", "Realtime AI", "Hardware Labs", "Design System", "Cloud Runtime"];
const telemetry = [
  { label: "Latency", value: "12ms", icon: <Gauge className="w-3.5 h-3.5" /> },
  { label: "Agents Online", value: "128", icon: <Bot className="w-3.5 h-3.5" /> },
  { label: "Build Queue", value: "Realtime", icon: <Orbit className="w-3.5 h-3.5" /> },
];

export default function Landing() {
  const navigate = useNavigate();
  const { stats } = useLandingStats();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Cyber grid background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 opacity-[0.03] motion-safe:animate-grid-drift"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute inset-0 opacity-[0.07] motion-safe:animate-scanline" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[200px] motion-safe:animate-float-slow" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/3 rounded-full blur-[150px] motion-safe:animate-float-delayed" />
        <div className="absolute top-1/3 left-8 w-56 h-56 bg-info/10 rounded-full blur-[120px] motion-safe:animate-float-slow" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/30 bg-background/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Zap className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight font-mono">CodeCanvas</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/editor")} className="text-muted-foreground hover:text-foreground">
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/editor")} className="gap-1.5 shadow-lg shadow-primary/20">
              Start Coding <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-16 px-6 z-10">
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="hidden md:block absolute -left-20 top-24 w-40 h-40 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md motion-safe:animate-float-slow" />
          <div className="hidden md:block absolute -right-20 top-16 w-44 h-44 rounded-full border border-info/20 bg-info/10 backdrop-blur-md motion-safe:animate-float-delayed" />
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm text-primary mb-6 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI-powered development environment
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            Code anything.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-primary/50">
              Right here.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            A futuristic cloud workstation for coding, hardware, AI, media, and docs. One tab, zero setup, fully composable.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => navigate("/editor")}
              className="text-base px-8 h-12 gap-2 shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-shadow"
            >
              Open Editor <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="text-base px-8 h-12 border-border/50 hover:border-primary/30"
            >
              See Features
            </Button>
          </div>

          <div className="mt-8">
            <PublicCanvasSearch />
          </div>

          <div className="mt-10 overflow-hidden rounded-full border border-border/40 bg-card/30 backdrop-blur-sm">
            <div className="flex whitespace-nowrap py-2 motion-safe:animate-marquee">
              {[...orbitBadges, ...orbitBadges].map((badge, index) => (
                <span key={`${badge}-${index}`} className="mx-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-mono text-primary/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-primary/20 bg-gradient-to-b from-card/80 to-card/30 p-4 sm:p-5 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full border border-primary/30 motion-safe:animate-orbit-ring" />
            <div className="absolute -left-12 -bottom-12 h-28 w-28 rounded-full border border-info/30 motion-safe:animate-orbit-ring [animation-delay:1.5s]" />
            <div className="relative">
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-primary mb-3">Neural Control Deck</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {telemetry.map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/40 bg-background/40 px-3 py-3 text-left">
                    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      {item.icon}
                      {item.label}
                    </div>
                    <p className="text-lg font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Editor mockup */}
        <div className="max-w-5xl mx-auto mt-14 relative">
          <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-primary/5">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/30 border-b border-border/50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/50" />
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-2">main.tsx — CodeCanvas</span>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground/50 font-mono">
                <Activity className="w-3 h-3 text-success" />
                <span>live</span>
              </div>
            </div>
            <div className="p-6 font-mono text-sm leading-7 text-muted-foreground">
              <div><span className="text-syntax-keyword">import</span> {"{"} <span className="text-syntax-variable">useState</span> {"}"} <span className="text-syntax-keyword">from</span> <span className="text-syntax-string">'react'</span>;</div>
              <div><span className="text-syntax-keyword">import</span> {"{"} <span className="text-syntax-variable">Canvas</span> {"}"} <span className="text-syntax-keyword">from</span> <span className="text-syntax-string">'@/components/Canvas'</span>;</div>
              <div className="mt-2"><span className="text-syntax-keyword">const</span> <span className="text-syntax-function">App</span> = () {"=> {"}</div>
              <div className="pl-6"><span className="text-syntax-keyword">const</span> [<span className="text-syntax-variable">code</span>, <span className="text-syntax-function">setCode</span>] = <span className="text-syntax-function">useState</span>(<span className="text-syntax-string">''</span>);</div>
              <div className="pl-6 mt-1"><span className="text-syntax-keyword">return</span> {"<"}<span className="text-syntax-variable">Canvas</span> <span className="text-syntax-variable">onChange</span>={"{"}setCode{"}"} /{">"}</div>
              <div>{"}"};</div>
            </div>
          </div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-2/3 h-12 bg-primary/8 blur-[50px] pointer-events-none" />
        </div>
      </section>

      {/* Orbit tracks */}
      <section className="relative px-6 py-8 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {featureTracks.map((track) => (
              <div
                key={track.title}
                className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-card/70 to-card/20 p-5 transition-transform duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
              >
                <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-primary/10 blur-2xl motion-safe:animate-pulse-soft" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-mono text-primary mb-4">
                    {track.icon}
                    {track.label}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{track.title}</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {track.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/80" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="relative py-16 px-6 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.25em] text-primary font-mono mb-2">Live Platform Stats</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">The community in numbers</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AnimatedCounter
              value={stats.totalUsers}
              label="Total Users"
              icon={<Users className="w-6 h-6" />}
              glowColor="hsl(var(--primary))"
            />
            <AnimatedCounter
              value={stats.onlineUsers}
              label="Online Now"
              icon={<Eye className="w-6 h-6" />}
              glowColor="hsl(142 71% 45%)"
            />
            <AnimatedCounter
              value={stats.totalCanvases}
              label="Canvases Created"
              icon={<FolderKanban className="w-6 h-6" />}
              glowColor="hsl(199 89% 48%)"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 z-10 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.25em] text-primary font-mono mb-2">Capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">All systems, all features, one command center</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Explore the complete CodeCanvas stack—from first prototype to deployed automation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative p-5 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-card/60 hover:border-primary/20 hover:-translate-y-1 transition-all duration-500"
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary/15 group-hover:shadow-lg group-hover:shadow-primary/10 transition-all duration-300">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold mb-1.5 text-sm">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-xs">{f.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-primary mb-2"><Rocket className="w-4 h-4" /> Velocity</div>
              <p className="text-sm text-muted-foreground">Launch projects instantly with browser-native runtime and live reload loops.</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-primary mb-2"><Workflow className="w-4 h-4" /> Continuity</div>
              <p className="text-sm text-muted-foreground">Keep code, hardware design, docs, and media in a unified creative pipeline.</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-primary mb-2"><ShieldCheck className="w-4 h-4" /> Reliability</div>
              <p className="text-sm text-muted-foreground">Use stable cloud tooling with source control and AI support for every iteration.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 z-10 relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-12 rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/[0.02] pointer-events-none" />
            <div
              className="absolute inset-0 opacity-[0.015] pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(hsl(var(--primary) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.5) 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
              }}
            />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Zap className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-3">Start building today</h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                No account required. Jump straight into the editor and start creating — sign up later to save and share your work.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/editor")}
                className="text-base px-10 h-12 gap-2 shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-shadow"
              >
                Launch Editor <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 px-6 z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center shadow-md shadow-primary/20">
              <Zap className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-mono">CodeCanvas</span>
          </div>
          <p className="text-muted-foreground/60">Built with passion for developers everywhere.</p>
        </div>
      </footer>
    </div>
  );
}
