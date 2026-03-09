import { useNavigate } from 'react-router-dom';
import { 
  Zap, Code2, Play, Terminal, GitBranch, Cpu, 
  Sparkles, Globe, Users, ArrowRight, ChevronRight,
  Palette, Box, Music, FileText, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: <Code2 className="w-5 h-5" />,
    title: 'Multi-Language Editor',
    description: 'Write in 20+ languages with syntax highlighting, IntelliSense, and real-time error detection.',
  },
  {
    icon: <Play className="w-5 h-5" />,
    title: 'Instant Preview',
    description: 'See your changes live with hot-reload for web projects. Run code in-browser with zero setup.',
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: 'AI Assistant',
    description: 'Generate, refactor, and debug code with a built-in AI chat that understands your entire project.',
  },
  {
    icon: <Terminal className="w-5 h-5" />,
    title: 'Integrated Terminal',
    description: 'Full terminal emulation powered by WebContainers. Install packages and run commands natively.',
  },
  {
    icon: <Cpu className="w-5 h-5" />,
    title: 'Arduino & Hardware',
    description: 'Write, compile, and flash Arduino sketches directly from the browser with breadboard simulation.',
  },
  {
    icon: <Box className="w-5 h-5" />,
    title: '3D & CAD Editor',
    description: 'View and generate 3D models with text-to-3D AI from 6 different providers.',
  },
  {
    icon: <Palette className="w-5 h-5" />,
    title: 'Scratch Blocks',
    description: 'Visual block-based programming for beginners. Export to .sb3 and run Scratch projects.',
  },
  {
    icon: <GitBranch className="w-5 h-5" />,
    title: 'Git Integration',
    description: 'Import from GitHub, GitLab, or Bitbucket. Built-in version history and branching.',
  },
  {
    icon: <Music className="w-5 h-5" />,
    title: 'Media Editors',
    description: 'Edit audio, video, images, and office documents — all within the same workspace.',
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: 'Custom Themes',
    description: 'Choose from 7 built-in themes or create and share your own with the theme builder.',
  },
  {
    icon: <Globe className="w-5 h-5" />,
    title: 'Share & Collaborate',
    description: 'Publish projects, fork others\' work, and star your favorites.',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: 'Office Suite',
    description: 'Built-in Word, Excel, and PowerPoint editors for documentation alongside your code.',
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">CodeCanvas</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/editor')}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/editor')} className="gap-1.5">
              Start Coding <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/50 text-sm text-muted-foreground mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            AI-powered development environment
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Code anything.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
              Right here.
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            A full-featured IDE in your browser — write code, build hardware, create 3D models, 
            and compose music. No downloads, no setup.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button 
              size="lg" 
              onClick={() => navigate('/editor')}
              className="text-base px-8 h-12 gap-2 shadow-lg shadow-primary/20"
            >
              Open Editor <ChevronRight className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-base px-8 h-12"
            >
              See Features
            </Button>
          </div>
        </div>

        {/* Editor mockup */}
        <div className="max-w-5xl mx-auto mt-16 relative">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xl shadow-black/40">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-warning/60" />
                <div className="w-3 h-3 rounded-full bg-success/60" />
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-2">main.tsx — CodeCanvas</span>
            </div>
            {/* Code content */}
            <div className="p-6 font-mono text-sm leading-7 text-muted-foreground">
              <div><span className="text-syntax-keyword">import</span> {'{'} <span className="text-syntax-variable">useState</span> {'}'} <span className="text-syntax-keyword">from</span> <span className="text-syntax-string">'react'</span>;</div>
              <div><span className="text-syntax-keyword">import</span> {'{'} <span className="text-syntax-variable">Canvas</span> {'}'} <span className="text-syntax-keyword">from</span> <span className="text-syntax-string">'@/components/Canvas'</span>;</div>
              <div className="mt-2"><span className="text-syntax-keyword">const</span> <span className="text-syntax-function">App</span> = () {'=> {'}</div>
              <div className="pl-6"><span className="text-syntax-keyword">const</span> [<span className="text-syntax-variable">code</span>, <span className="text-syntax-function">setCode</span>] = <span className="text-syntax-function">useState</span>(<span className="text-syntax-string">''</span>);</div>
              <div className="pl-6 mt-1"><span className="text-syntax-keyword">return</span> {'<'}<span className="text-syntax-variable">Canvas</span> <span className="text-syntax-variable">onChange</span>={'{'}setCode{'}'} /{'>'}</div>
              <div>{'}'};</div>
            </div>
          </div>
          {/* Glow under the mockup */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-primary/10 blur-[60px] pointer-events-none" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need to build
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From writing your first line of code to deploying production hardware.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-5 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-12 rounded-2xl border border-border bg-gradient-to-b from-card to-background relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="relative">
              <Users className="w-10 h-10 text-primary mx-auto mb-6" />
              <h2 className="text-3xl font-bold tracking-tight mb-3">
                Start building today
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                No account required. Jump straight into the editor and start creating — 
                sign up later to save and share your work.
              </p>
              <Button 
                size="lg" 
                onClick={() => navigate('/editor')}
                className="text-base px-10 h-12 gap-2 shadow-lg shadow-primary/20"
              >
                Launch Editor <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary-foreground" />
            </div>
            <span>CodeCanvas</span>
          </div>
          <p>Built with passion for developers everywhere.</p>
        </div>
      </footer>
    </div>
  );
}
