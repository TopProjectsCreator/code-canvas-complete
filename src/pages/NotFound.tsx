import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, BookOpen, Cpu, Database, Gauge, Globe,
  Home, MessageSquare, Network, Search as SearchIcon, Shield, Sparkles, Terminal,
  Wifi, Zap,
} from 'lucide-react';

const CODE_LINES = [
  ['const', ' agent', ' = ', "await ", "Resolver", '.', 'lookup', '(', '"', '%PATH%', '"', ');'],
  ['if', ' (!', 'agent', ') ', '{'],
  ['  ', 'logger', '.', 'warn', '(', '"', 'route_not_found', '"', ', { ', 'path', ': ', '"', '%PATH%', '"', ' });'],
  ['  ', 'metrics', '.', 'increment', '(', '"', 'http.404', '"', ');'],
  ['  ', 'return', ' ', 'router', '.', 'recover', '(', 'context', ');'],
  ['}'],
  [''],
  ['# ', 'GPT-Router :: pathfinding'],
  ['→ ', 'analyzing intent…'],
  ['→ ', 'querying neural index (k=7)'],
  ['→ ', 'top match : ', '/editor', ' · score 0.91'],
  ['→ ', 'fallback   : ', '/landing', ' · score 0.86'],
  ['→ ', 'fallback   : ', '/docs',    ' · score 0.74'],
  ['', '✓ recovery suggestions ready.'],
];

const tokenColor = (t: string) => {
  if (t.startsWith('"') || t.startsWith("'")) return 'text-emerald-300';
  if (t.startsWith('//') || t.startsWith('# ')) return 'text-slate-500';
  if (t.startsWith('→')) return 'text-cyan-300';
  if (t.startsWith('✓')) return 'text-emerald-400';
  if (/^(const|let|var|if|return|await|function)$/.test(t.trim())) return 'text-fuchsia-400';
  if (/^[A-Z]/.test(t.trim())) return 'text-amber-300';
  if (t.endsWith('(') || t === '.') return 'text-slate-300';
  return 'text-slate-200';
};

const useTicker = (intervalMs: number) => {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
};

const useElapsedSeconds = () => {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return s;
};

const formatElapsed = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `00:${m}:${sec}`;
};

const StatCard = ({
  icon: Icon, label, value, sub, accent = 'cyan',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: 'cyan' | 'fuchsia' | 'emerald' | 'amber';
}) => {
  const accentMap = {
    cyan: 'text-cyan-300 border-cyan-400/30 shadow-[0_0_24px_-10px_rgba(34,211,238,0.6)]',
    fuchsia: 'text-fuchsia-300 border-fuchsia-400/30 shadow-[0_0_24px_-10px_rgba(232,121,249,0.6)]',
    emerald: 'text-emerald-300 border-emerald-400/30 shadow-[0_0_24px_-10px_rgba(52,211,153,0.6)]',
    amber: 'text-amber-300 border-amber-400/30 shadow-[0_0_24px_-10px_rgba(251,191,36,0.6)]',
  } as const;
  return (
    <div className={`rounded-lg border bg-slate-900/60 backdrop-blur p-3 ${accentMap[accent]}`}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-80">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="font-mono text-xl mt-1 leading-none">{value}</div>
      {sub && <div className="text-[10px] opacity-60 mt-1">{sub}</div>}
    </div>
  );
};

const Bars = ({ seed }: { seed: number }) => {
  const heights = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const x = (Math.sin(seed * 0.7 + i * 0.6) + Math.sin(seed * 0.13 + i * 1.3)) * 0.5 + 0.5;
    return Math.max(0.1, Math.min(1, x));
  }), [seed]);
  return (
    <div className="flex items-end gap-[2px] h-12">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm bg-gradient-to-t from-cyan-500/50 to-fuchsia-400/80 transition-all duration-300"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
};

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const tick = useTicker(800);
  const fastTick = useTicker(120);
  const elapsed = useElapsedSeconds();

  // Live-ish stats derived from ticks
  const cpu = 30 + Math.round(20 * (Math.sin(tick * 0.5) + 1) / 2);
  const gpu = 56 + Math.round(28 * (Math.sin(tick * 0.31) + 1) / 2);
  const tokensPerSec = 1200 + Math.round(450 * (Math.sin(tick * 0.4 + 1) + 1) / 2);
  const latency = 18 + Math.round(8 * Math.sin(tick * 0.6));
  const reqs = 4123 + tick * 7;
  const uptime = formatElapsed(elapsed);

  // Typewriter terminal
  const [typed, setTyped] = useState<string[][]>([]);
  const idxRef = useRef({ line: 0, col: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const { line, col } = idxRef.current;
      if (line >= CODE_LINES.length) return;
      const tokens = CODE_LINES[line].map((t) => t.replace('%PATH%', location.pathname || '/'));
      const fullSoFar = tokens.slice(0, col + 1);
      setTyped((prev) => {
        const next = prev.slice(0, line);
        next[line] = fullSoFar;
        return next;
      });
      if (col + 1 >= tokens.length) {
        idxRef.current = { line: line + 1, col: 0 };
      } else {
        idxRef.current = { line, col: col + 1 };
      }
    }, 90);
    return () => clearInterval(id);
  }, [location.pathname]);

  // Quick search
  const [q, setQ] = useState('');
  const suggestions = useMemo(() => {
    const all = [
      { label: 'Open the editor', path: '/editor', icon: Terminal },
      { label: 'Go to landing page', path: '/landing', icon: Sparkles },
      { label: 'Browse docs', path: '/docs', icon: BookOpen },
      { label: 'Getting started', path: '/docs/features--getting-started', icon: Zap },
      { label: 'Privacy policy', path: '/privacy-policy', icon: Shield },
      { label: 'Terms of use', path: '/terms-of-use', icon: Shield },
    ];
    const t = q.trim().toLowerCase();
    if (!t) return all.slice(0, 4);
    return all.filter((s) => s.label.toLowerCase().includes(t) || s.path.toLowerCase().includes(t));
  }, [q]);

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  // Subtle parallax on mouse move
  const bgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!bgRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 12;
      bgRef.current.style.setProperty('--mx', `${x}px`);
      bgRef.current.style.setProperty('--my', `${y}px`);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#04060d] text-slate-100 font-sans">
      {/* Background: animated grid + radial glows */}
      <div ref={bgRef} className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            transform: 'translate(var(--mx,0), var(--my,0)) perspective(800px) rotateX(55deg) translateY(-20%) scale(2.2)',
            transformOrigin: 'center bottom',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 60%, transparent 100%)',
          }}
        />
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[300px] rounded-full bg-indigo-500/20 blur-3xl" />
        {/* Scanlines */}
        <div
          className="absolute inset-0 mix-blend-overlay opacity-30"
          style={{
            backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)',
          }}
        />
      </div>

      {/* Top status bar */}
      <div className="relative z-10 flex items-center gap-3 px-5 py-2.5 border-b border-white/10 bg-black/40 backdrop-blur text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-fuchsia-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-semibold tracking-wider">CODECANVAS // AI CONTROL ROOM</span>
        </div>
        <div className="text-slate-500">·</div>
        <div className="flex items-center gap-1.5 text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          ROUTE ANOMALY 0x{(0xc04 + tick % 256).toString(16).toUpperCase()}
        </div>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1"><Wifi className="w-3 h-3 text-emerald-400" /> uplink</span>
          <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-cyan-300" /> region: edge-{(tick % 4) + 1}</span>
          <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-fuchsia-300" /> uptime {uptime}</span>
        </div>
      </div>

      {/* Main grid */}
      <div className="relative z-10 grid grid-cols-12 grid-rows-[auto_1fr_auto] gap-3 p-3 md:p-5 h-[calc(100%-37px)] overflow-auto">
        {/* Hero */}
        <div className="col-span-12 lg:col-span-8 rounded-xl border border-white/10 bg-slate-950/60 backdrop-blur p-5 md:p-7 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage: 'radial-gradient(600px 200px at 80% 0%, rgba(99,102,241,0.4), transparent), radial-gradient(400px 200px at 0% 100%, rgba(232,121,249,0.3), transparent)',
            }}
          />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-fuchsia-200">
                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" /> Anomaly Detected
              </span>
              <span className="text-[11px] font-mono text-slate-400">node: agent-{(tick % 9) + 1}</span>
            </div>

            <div className="flex items-end gap-4 flex-wrap">
              <div className="font-mono text-[88px] md:text-[120px] leading-none font-black bg-gradient-to-br from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent tracking-tighter select-none">
                404
              </div>
              <div className="pb-3">
                <div className="text-2xl md:text-3xl font-semibold">No route to that destination.</div>
                <div className="text-slate-400 mt-1 font-mono text-sm break-all">
                  GET <span className="text-fuchsia-300">{location.pathname || '/'}</span> · <span className="text-amber-300">404 NOT_FOUND</span>
                </div>
              </div>
            </div>

            <p className="text-slate-300/90 max-w-2xl">
              The AI router could not resolve that path. Three on-call agents are still standing by — pick a destination,
              search the index, or jump back to a known-good environment.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                to="/landing"
                className="group inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50 transition-shadow"
              >
                <Home className="w-4 h-4" /> Back to landing
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/editor"
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium"
              >
                <Terminal className="w-4 h-4" /> Open editor
              </Link>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium"
              >
                <BookOpen className="w-4 h-4" /> Browse docs
              </Link>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium"
              >
                ← Go back
              </button>
            </div>
          </div>
        </div>

        {/* Stats column */}
        <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-3 content-start">
          <StatCard icon={Cpu}      label="CPU"        value={`${cpu}%`}                 sub="cluster avg" accent="cyan" />
          <StatCard icon={Gauge}    label="GPU"        value={`${gpu}%`}                 sub="A100 ×4"      accent="fuchsia" />
          <StatCard icon={Zap}      label="Tokens/s"   value={`${tokensPerSec}`}         sub="streaming"    accent="emerald" />
          <StatCard icon={Network}  label="Latency"    value={`${Math.max(8, latency)} ms`} sub="p50 edge"  accent="amber" />
          <div className="col-span-2 rounded-lg border border-white/10 bg-slate-900/60 backdrop-blur p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Throughput
              </div>
              <div className="text-[11px] font-mono text-slate-400">{reqs.toLocaleString()} req</div>
            </div>
            <Bars seed={fastTick} />
          </div>
          <div className="col-span-2 rounded-lg border border-white/10 bg-slate-900/60 backdrop-blur p-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> Vector index</span>
              <span className="text-emerald-300 font-mono">healthy</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300"
                style={{ width: `${60 + (tick % 40)}%`, transition: 'width 0.6s ease' }}
              />
            </div>
            <div className="mt-1 text-[10px] font-mono text-slate-500">{(2_400_000 + tick * 23).toLocaleString()} embeddings · 768d</div>
          </div>
        </div>

        {/* Terminal */}
        <div className="col-span-12 lg:col-span-8 rounded-xl border border-white/10 bg-black/70 backdrop-blur overflow-hidden flex flex-col min-h-[260px]">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-white/5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-3 text-xs font-mono text-slate-400">router/recovery.ts — agent shell</span>
            <div className="flex-1" />
            <span className="text-[10px] font-mono text-slate-500">PID 4042 · ttys001</span>
          </div>
          <div className="flex-1 p-4 font-mono text-[12px] md:text-[13px] leading-6 overflow-auto">
            {typed.map((tokens, i) => (
              <div key={i} className="whitespace-pre-wrap">
                <span className="text-slate-600 select-none mr-3">{(i + 1).toString().padStart(2, '0')}</span>
                {tokens.map((tok, j) => (
                  <span key={j} className={tokenColor(tok)}>{tok}</span>
                ))}
              </div>
            ))}
            <div className="text-cyan-300">
              <span className="text-slate-600 select-none mr-3">{(typed.length + 1).toString().padStart(2, '0')}</span>
              ▌<span className="animate-pulse">_</span>
            </div>
          </div>
        </div>

        {/* Search & quick destinations */}
        <div className="col-span-12 lg:col-span-4 rounded-xl border border-white/10 bg-slate-950/60 backdrop-blur p-4 flex flex-col gap-3 min-h-[260px]">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <SearchIcon className="w-3.5 h-3.5" /> Quick jump
          </div>
          <div className="relative">
            <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && suggestions[0]) navigate(suggestions[0].path);
              }}
              placeholder="Search routes, docs, intents…"
              className="w-full rounded-md bg-black/50 border border-white/10 focus:border-fuchsia-400/60 focus:outline-none focus:ring-1 focus:ring-fuchsia-400/30 pl-8 pr-3 py-2 text-sm placeholder:text-slate-500"
            />
          </div>
          <div className="flex-1 overflow-auto -mx-2">
            {suggestions.length === 0 ? (
              <div className="text-xs text-slate-500 px-2 py-6 text-center">No matches. Try "editor" or "docs".</div>
            ) : (
              <div className="space-y-1">
                {suggestions.map((s) => (
                  <Link
                    key={s.path}
                    to={s.path}
                    className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 border border-transparent hover:border-white/10 mx-2"
                  >
                    <s.icon className="w-4 h-4 text-cyan-300" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{s.label}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">{s.path}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-fuchsia-300 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2">
            tip · press <kbd className="border border-white/15 rounded px-1">Enter</kbd> to jump to the top result
          </div>
        </div>

        {/* Bottom telemetry strip */}
        <div className="col-span-12 rounded-xl border border-white/10 bg-black/40 backdrop-blur px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-slate-400">
          <span><span className="text-emerald-300">●</span> healthy · {(8 + (tick % 5))} of 8 agents online</span>
          <span><MessageSquare className="inline w-3 h-3 mr-1 text-cyan-300" />{(tick * 3 + 41) % 1000} chats / min</span>
          <span><Zap className="inline w-3 h-3 mr-1 text-amber-300" /> {(0.92 + (tick % 7) * 0.005).toFixed(3)} confidence</span>
          <span className="hidden md:inline">last_recovery: route → /editor in {12 + (tick % 9)} ms</span>
          <div className="flex-1" />
          <span className="opacity-70">© CodeCanvas · all systems nominal</span>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
