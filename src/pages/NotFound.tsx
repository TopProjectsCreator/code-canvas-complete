import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PointerLockControls, Stars, Text } from '@react-three/drei';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BookOpen, FolderGit2, Gauge, Home, Sparkles, Star, Terminal, Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects, type Project } from '@/hooks/useProjects';

/* -------------------------------------------------------------------------- */
/* Hooks                                                                       */
/* -------------------------------------------------------------------------- */

const useTicker = (ms: number) => {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(v => v + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
};

const useElapsed = () => {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS(v => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return s;
};

const fmtElapsed = (s: number) => {
  const h = Math.floor(s / 3600).toString().padStart(2, '0');
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
};

/* -------------------------------------------------------------------------- */
/* First-person controller (WASD + mouse-look via PointerLock)                 */
/* -------------------------------------------------------------------------- */

const ROOM_HALF_X = 9;
const ROOM_HALF_Z = 11;
const EYE_HEIGHT = 1.65;
const SPEED = 4.5; // units / sec
const RUN_MULT = 1.8;

interface ControllerProps {
  enabled: boolean;
  onLock: () => void;
  onUnlock: () => void;
}

const FirstPersonController = ({ enabled, onLock, onUnlock }: ControllerProps) => {
  const { camera, gl } = useThree();
  const lockRef = useRef<PointerLockControlsImpl | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const dir = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Escape' && lockRef.current?.isLocked) lockRef.current.unlock();
    };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Click anywhere on the canvas to engage pointer lock.
  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    const click = () => { lockRef.current?.lock(); };
    el.addEventListener('click', click);
    return () => el.removeEventListener('click', click);
  }, [enabled, gl]);

  useFrame((_, delta) => {
    const locked = lockRef.current?.isLocked;
    if (!locked) return;
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();
    dir.set(0, 0, 0);
    if (keys.current['KeyW'] || keys.current['ArrowUp']) dir.add(fwd);
    if (keys.current['KeyS'] || keys.current['ArrowDown']) dir.sub(fwd);
    if (keys.current['KeyD'] || keys.current['ArrowRight']) dir.add(right);
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) dir.sub(right);
    if (dir.lengthSq() === 0) return;
    dir.normalize();
    const speed = SPEED * (keys.current['ShiftLeft'] || keys.current['ShiftRight'] ? RUN_MULT : 1) * delta;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x + dir.x * speed, -ROOM_HALF_X + 0.6, ROOM_HALF_X - 0.6);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z + dir.z * speed, -ROOM_HALF_Z + 0.6, ROOM_HALF_Z - 0.6);
    camera.position.y = EYE_HEIGHT;
  });

  return (
    <PointerLockControls
      ref={lockRef as React.MutableRefObject<PointerLockControlsImpl>}
      onLock={onLock}
      onUnlock={onUnlock}
    />
  );
};

/* -------------------------------------------------------------------------- */
/* Static geometry                                                             */
/* -------------------------------------------------------------------------- */

const Floor = () => (
  <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[ROOM_HALF_X * 2, ROOM_HALF_Z * 2]} />
      <meshStandardMaterial color="#06070d" metalness={0.6} roughness={0.4} />
    </mesh>
    {/* glowing grid lines via a second slightly lifted plane with a gradient */}
    <gridHelper args={[ROOM_HALF_X * 2, 24, '#7c3aed', '#1e293b']} position={[0, 0.001, 0]} />
  </>
);

const Ceiling = () => (
  <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5, 0]}>
    <planeGeometry args={[ROOM_HALF_X * 2, ROOM_HALF_Z * 2]} />
    <meshStandardMaterial color="#0a0c18" metalness={0.4} roughness={0.7} />
  </mesh>
);

interface WallProps { position: [number, number, number]; rotation?: [number, number, number]; size: [number, number]; }
const Wall = ({ position, rotation = [0, 0, 0], size }: WallProps) => (
  <mesh position={position} rotation={rotation}>
    <planeGeometry args={size} />
    <meshStandardMaterial color="#0b0e1a" metalness={0.5} roughness={0.6} side={THREE.DoubleSide} />
  </mesh>
);

/* -------------------------------------------------------------------------- */
/* HUD screen mounted on a wall                                                */
/* -------------------------------------------------------------------------- */

interface ScreenProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
  glow?: string;
  children: React.ReactNode;
}

const Screen = ({ position, rotation = [0, 0, 0], width, height, glow = '#22d3ee', children }: ScreenProps) => {
  // 1 CSS pixel per 0.0025 world units → readable text. width 4 → 1600px wide DOM.
  const distance = 0.0025;
  return (
    <group position={position} rotation={rotation}>
      {/* glowing frame */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 0.18, height + 0.18]} />
        <meshBasicMaterial color={glow} transparent opacity={0.18} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      <Html
        transform
        distanceFactor={1 / distance / 400}
        position={[0, 0, 0.001]}
        occlude={false}
        style={{
          width: `${width / distance}px`,
          height: `${height / distance}px`,
          pointerEvents: 'auto',
        }}
      >
        <div
          className="w-full h-full overflow-hidden rounded-md"
          style={{
            background: 'radial-gradient(120% 120% at 0% 0%, rgba(99,102,241,0.18), rgba(2,6,23,0.95))',
            boxShadow: `inset 0 0 80px ${glow}33`,
          }}
        >
          {children}
        </div>
      </Html>
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/* Center 404 hologram pedestal                                                */
/* -------------------------------------------------------------------------- */

const Hologram = () => {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.4;
      groupRef.current.position.y = 1.6 + Math.sin(clock.elapsedTime * 1.5) * 0.08;
    }
  });
  return (
    <>
      {/* pedestal */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.1, 0.6, 24]} />
        <meshStandardMaterial color="#1e1b4b" metalness={0.8} roughness={0.3} emissive="#312e81" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.61, 0]}>
        <cylinderGeometry args={[0.92, 0.92, 0.04, 24]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={1.2} />
      </mesh>
      <pointLight position={[0, 1.6, 0]} color="#a78bfa" intensity={6} distance={6} />
      <group ref={groupRef}>
        <Text
          fontSize={1.4}
          color="#f0abfc"
          anchorX="center"
          anchorY="middle"
          outlineColor="#a21caf"
          outlineWidth={0.04}
          outlineOpacity={0.9}
        >
          404
        </Text>
        <Text
          position={[0, -0.9, 0]}
          fontSize={0.16}
          color="#67e8f9"
          anchorX="center"
          anchorY="middle"
        >
          ANOMALY · ROUTE NOT FOUND
        </Text>
      </group>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Decorative server racks along the back wall                                 */
/* -------------------------------------------------------------------------- */

const ServerRack = ({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) => {
  const lights = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    y: 0.4 + i * 0.32,
    color: ['#22c55e', '#06b6d4', '#a78bfa', '#f59e0b'][i % 4],
  })), []);
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[0.9, 4, 0.5]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.4} />
      </mesh>
      {lights.map((l, i) => (
        <mesh key={i} position={[0.36, l.y, 0]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={l.color} />
        </mesh>
      ))}
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/* Particles                                                                   */
/* -------------------------------------------------------------------------- */

const Particles = () => {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * ROOM_HALF_X * 2;
      arr[i * 3 + 1] = Math.random() * 4.5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * ROOM_HALF_Z * 2;
    }
    return arr;
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#67e8f9" size={0.04} transparent opacity={0.5} />
    </points>
  );
};

/* -------------------------------------------------------------------------- */
/* Screen contents                                                             */
/* -------------------------------------------------------------------------- */

const ScreenChrome = ({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) => (
  <div className="flex flex-col h-full font-sans text-slate-100 p-6">
    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em]" style={{ color: accent }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
        {title}
      </div>
      <div className="font-mono text-[10px] text-slate-500">CC-OS · v4.04</div>
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

const HeroScreen = ({ path }: { path: string }) => (
  <ScreenChrome title="Anomaly Report" accent="#f0abfc">
    <div className="flex flex-col gap-4">
      <div className="text-[140px] leading-none font-black bg-gradient-to-br from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent select-none tracking-tighter">
        404
      </div>
      <div className="text-3xl font-semibold">No route to that destination.</div>
      <div className="font-mono text-base text-slate-400 break-all">
        GET <span className="text-fuchsia-300">{path || '/'}</span> · <span className="text-amber-300">404 NOT_FOUND</span>
      </div>
      <p className="text-slate-300 text-base max-w-2xl">
        The AI router could not resolve that path. Walk around the room — every screen is live. Click a destination
        on the navigation pillar, or step up to a console to see your most-used canvases.
      </p>
      <div className="flex items-center gap-3 text-sm text-slate-400 pt-1">
        <span className="px-2 py-1 rounded border border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200 font-mono text-xs">
          ESC to release cursor
        </span>
        <span className="px-2 py-1 rounded border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 font-mono text-xs">
          WASD + mouse to roam
        </span>
      </div>
    </div>
  </ScreenChrome>
);

const NavScreen = () => {
  const navigate = useNavigate();
  const items = [
    { label: 'Back to landing', icon: Home, path: '/landing', accent: 'from-cyan-500 to-fuchsia-500' },
    { label: 'Open the editor', icon: Terminal, path: '/editor', accent: 'from-emerald-500 to-cyan-500' },
    { label: 'Browse docs', icon: BookOpen, path: '/docs', accent: 'from-amber-500 to-rose-500' },
    { label: 'Profile · home', icon: Sparkles, path: '/home', accent: 'from-violet-500 to-fuchsia-500' },
  ];
  return (
    <ScreenChrome title="Quick Nav" accent="#22d3ee">
      <div className="grid grid-cols-1 gap-3">
        {items.map((it) => (
          <button
            key={it.path}
            type="button"
            onClick={() => navigate(it.path)}
            className={`group flex items-center gap-4 px-5 py-4 rounded-lg bg-gradient-to-r ${it.accent} bg-opacity-10 border border-white/15 hover:border-white/40 hover:scale-[1.02] transition-all text-left shadow-lg`}
          >
            <it.icon className="w-7 h-7 text-white drop-shadow" />
            <div className="flex-1">
              <div className="text-lg font-semibold text-white">{it.label}</div>
              <div className="font-mono text-xs text-white/70">{it.path}</div>
            </div>
            <ArrowRight className="w-6 h-6 text-white/80 group-hover:translate-x-1 transition-transform" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-5 py-3 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-base"
        >
          ← Go back to where I was
        </button>
      </div>
    </ScreenChrome>
  );
};

const ProjectsScreen = ({ projects, loading, isAuthed }: { projects: Project[]; loading: boolean; isAuthed: boolean }) => {
  const navigate = useNavigate();
  const top = useMemo(() => {
    const sorted = [...projects].sort((a, b) =>
      (b.stars_count || 0) - (a.stars_count || 0) ||
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    return sorted.slice(0, 6);
  }, [projects]);

  return (
    <ScreenChrome title="Most-used canvases" accent="#34d399">
      {!isAuthed ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
          <FolderGit2 className="w-10 h-10 text-slate-500" />
          <div className="text-lg">Sign in to see your canvases.</div>
          <button
            type="button"
            onClick={() => navigate('/landing')}
            className="px-4 py-2 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm hover:bg-emerald-500/30"
          >
            Go to landing →
          </button>
        </div>
      ) : loading ? (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm">Syncing your canvases…</div>
      ) : top.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
          <FolderGit2 className="w-10 h-10 text-slate-500" />
          <div className="text-lg">No canvases yet.</div>
          <button
            type="button"
            onClick={() => navigate('/editor')}
            className="px-4 py-2 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm hover:bg-emerald-500/30"
          >
            Create one →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {top.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/project/${p.id}`)}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-400/40 transition-colors text-left"
            >
              <span className="font-mono text-emerald-300/70 text-xs w-6">#{(i + 1).toString().padStart(2, '0')}</span>
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium truncate">{p.name}</div>
                <div className="font-mono text-[11px] text-slate-500 truncate">
                  {p.language || 'mixed'} · updated {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </div>
              <span className="flex items-center gap-1 text-amber-300 text-xs font-mono">
                <Star className="w-3 h-3" /> {p.stars_count ?? 0}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>
          ))}
        </div>
      )}
    </ScreenChrome>
  );
};

const TelemetryScreen = ({ tick, fast }: { tick: number; fast: number }) => {
  const cpu = 30 + Math.round(20 * (Math.sin(tick * 0.5) + 1) / 2);
  const gpu = 56 + Math.round(28 * (Math.sin(tick * 0.31) + 1) / 2);
  const tps = 1200 + Math.round(450 * (Math.sin(tick * 0.4 + 1) + 1) / 2);
  const lat = Math.max(8, 18 + Math.round(8 * Math.sin(tick * 0.6)));
  const bars = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const x = (Math.sin(fast * 0.4 + i * 0.6) + Math.sin(fast * 0.13 + i * 1.3)) * 0.5 + 0.5;
    return Math.max(0.1, Math.min(1, x));
  }), [fast]);
  return (
    <ScreenChrome title="Live Telemetry" accent="#f59e0b">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'CPU',      value: `${cpu}%`,    sub: 'cluster avg' },
          { label: 'GPU',      value: `${gpu}%`,    sub: 'A100 ×4' },
          { label: 'Tokens/s', value: `${tps}`,     sub: 'streaming' },
          { label: 'Latency',  value: `${lat} ms`,  sub: 'p50 edge' },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-white/10 bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-amber-300">{s.label}</div>
            <div className="font-mono text-2xl mt-1">{s.value}</div>
            <div className="text-[10px] text-slate-500">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-white/10 bg-black/40 p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-amber-300">
          <span className="flex items-center gap-1.5"><Gauge className="w-3 h-3" /> Throughput</span>
          <span className="font-mono">{(4123 + tick * 7).toLocaleString()} req</span>
        </div>
        <div className="flex items-end gap-[3px] h-16 mt-2">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-amber-500/60 to-fuchsia-400/80 transition-all duration-300"
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-md border border-white/10 bg-black/40 p-3">
        <div className="text-[10px] uppercase tracking-widest text-amber-300">Vector index</div>
        <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300"
            style={{ width: `${60 + (tick % 40)}%`, transition: 'width 0.6s ease' }}
          />
        </div>
        <div className="font-mono text-[10px] text-slate-500 mt-1">
          {(2_400_000 + tick * 23).toLocaleString()} embeddings · 768d
        </div>
      </div>
    </ScreenChrome>
  );
};

const ActivityScreen = ({ tick, path }: { tick: number; path: string }) => {
  const lines = useMemo(() => {
    const events = [
      `→ analyzing intent for ${path || '/'}`,
      `→ neural index lookup (k=7)`,
      `→ closest match : /editor · score 0.91`,
      `→ closest match : /landing · score 0.86`,
      `→ closest match : /docs · score 0.74`,
      `✓ recovery suggestions ready`,
      `· agent-${(tick % 9) + 1} reporting nominal`,
      `· edge-${(tick % 4) + 1} sync ok`,
    ];
    const out: string[] = [];
    for (let i = 0; i <= tick % events.length; i++) out.push(events[i]);
    return out;
  }, [tick, path]);
  return (
    <ScreenChrome title="Router Activity" accent="#a78bfa">
      <div className="font-mono text-[13px] leading-7 space-y-1">
        {lines.map((l, i) => (
          <div key={i} className={l.startsWith('✓') ? 'text-emerald-300' : l.startsWith('→') ? 'text-cyan-300' : 'text-slate-400'}>
            <span className="text-slate-600 mr-3">{(i + 1).toString().padStart(2, '0')}</span>
            {l}
          </div>
        ))}
        <div className="text-fuchsia-300">
          <span className="text-slate-600 mr-3">{(lines.length + 1).toString().padStart(2, '0')}</span>
          ▌<span className="animate-pulse">_</span>
        </div>
      </div>
    </ScreenChrome>
  );
};

/* -------------------------------------------------------------------------- */
/* Error boundary — keeps the overlay usable if WebGL/Three crashes            */
/* -------------------------------------------------------------------------- */

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) {
    console.error('3D control room failed to render:', err);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                   */
/* -------------------------------------------------------------------------- */

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { projects, loading, fetchProjects } = useProjects();
  const tick = useTicker(800);
  const fast = useTicker(120);
  const elapsed = useElapsed();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  useEffect(() => { if (user) fetchProjects(); }, [user, fetchProjects]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Animated 2D backdrop — visible during load and as graceful fallback if WebGL fails */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle at 50% 30%, #0a0d1c 0%, #02030a 70%)',
      }}>
        <div className="absolute inset-0 opacity-[0.18]" style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          transform: 'perspective(800px) rotateX(55deg) translateY(-20%) scale(2.2)',
          transformOrigin: 'center bottom',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 60%, transparent 100%)',
        }} />
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <CanvasErrorBoundary>
      <Canvas
        shadows
        camera={{ position: [0, EYE_HEIGHT, 4], fov: 70, near: 0.1, far: 100 }}
        gl={{ antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.25} color="#6366f1" />
          <pointLight position={[0, 4.5, -8]} color="#22d3ee" intensity={20} distance={18} />
          <pointLight position={[-8, 4.5, 4]} color="#a78bfa" intensity={18} distance={18} />
          <pointLight position={[8, 4.5, 4]} color="#f59e0b" intensity={14} distance={16} />
          <pointLight position={[0, 4.5, 10]} color="#22c55e" intensity={12} distance={16} />

          {/* Stars beyond windows (looks great through atmospheric darkness) */}
          <Stars radius={50} depth={30} count={1500} factor={4} fade speed={0.4} />

          {/* Room shell */}
          <Floor />
          <Ceiling />
          <Wall position={[0, 2.5, -ROOM_HALF_Z]} size={[ROOM_HALF_X * 2, 5]} />
          <Wall position={[0, 2.5, ROOM_HALF_Z]} rotation={[0, Math.PI, 0]} size={[ROOM_HALF_X * 2, 5]} />
          <Wall position={[-ROOM_HALF_X, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} size={[ROOM_HALF_Z * 2, 5]} />
          <Wall position={[ROOM_HALF_X, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} size={[ROOM_HALF_Z * 2, 5]} />

          {/* Decor */}
          <ServerRack x={-7.5} z={-9.5} />
          <ServerRack x={-5.5} z={-9.5} />
          <ServerRack x={5.5}  z={-9.5} />
          <ServerRack x={7.5}  z={-9.5} />
          <Particles />

          {/* Center hologram */}
          <Hologram />

          {/* SCREENS — one per "wall station" */}
          {/* Front wall (large hero) */}
          <Screen
            position={[0, 2.7, -ROOM_HALF_Z + 0.06]}
            width={7.2}
            height={3.6}
            glow="#f0abfc"
          >
            <HeroScreen path={location.pathname} />
          </Screen>

          {/* Left wall — Projects */}
          <Screen
            position={[-ROOM_HALF_X + 0.06, 2.4, -2]}
            rotation={[0, Math.PI / 2, 0]}
            width={5.6}
            height={3.4}
            glow="#34d399"
          >
            <ProjectsScreen projects={projects} loading={loading} isAuthed={!!user} />
          </Screen>

          {/* Left wall — Activity (further along the wall) */}
          <Screen
            position={[-ROOM_HALF_X + 0.06, 2.4, 4]}
            rotation={[0, Math.PI / 2, 0]}
            width={4.6}
            height={3}
            glow="#a78bfa"
          >
            <ActivityScreen tick={tick} path={location.pathname} />
          </Screen>

          {/* Right wall — Telemetry */}
          <Screen
            position={[ROOM_HALF_X - 0.06, 2.4, -2]}
            rotation={[0, -Math.PI / 2, 0]}
            width={5.6}
            height={3.4}
            glow="#f59e0b"
          >
            <TelemetryScreen tick={tick} fast={fast} />
          </Screen>

          {/* Right wall — Quick Nav buttons */}
          <Screen
            position={[ROOM_HALF_X - 0.06, 2.4, 4]}
            rotation={[0, -Math.PI / 2, 0]}
            width={4.6}
            height={3.4}
            glow="#22d3ee"
          >
            <NavScreen />
          </Screen>

          <FirstPersonController
            enabled
            onLock={() => setLocked(true)}
            onUnlock={() => setLocked(false)}
          />
        </Suspense>
      </Canvas>
      </CanvasErrorBoundary>

      {/* Top status bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center gap-3 px-5 py-2.5 bg-black/60 backdrop-blur border-b border-white/10 text-[11px] font-mono pointer-events-none">
        <div className="flex items-center gap-1.5 text-fuchsia-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-semibold tracking-wider">CODECANVAS // 3D AI CONTROL ROOM</span>
        </div>
        <div className="text-slate-500">·</div>
        <div className="text-amber-300">ROUTE ANOMALY 0x{(0xc04 + tick % 256).toString(16).toUpperCase()}</div>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-emerald-400" /> uptime {fmtElapsed(elapsed)}</span>
          <span>region edge-{(tick % 4) + 1}</span>
        </div>
      </div>

      {/* Crosshair (only when pointer locked) */}
      {locked && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-300/70 shadow-[0_0_8px_2px_rgba(34,211,238,0.5)]" />
        </div>
      )}

      {/* Engage overlay */}
      {!locked && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-none"
        >
          <div className="text-center max-w-md px-6 pointer-events-auto">
            <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-fuchsia-300 mb-3">404 · anomaly detected</div>
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-br from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent mb-3">
              The route is missing.
            </h1>
            <p className="text-slate-300 text-sm mb-5">
              Step into the AI control room. Look around at the live screens and walk over to a console to find your way back.
            </p>
            <div className="text-xs font-mono text-slate-400 space-y-1.5 mb-6">
              <div><span className="text-cyan-300">click</span> · enter the room</div>
              <div><span className="text-cyan-300">W A S D</span> · move · <span className="text-cyan-300">shift</span> to run</div>
              <div><span className="text-cyan-300">mouse</span> · look · <span className="text-cyan-300">ESC</span> · release cursor</div>
            </div>
            <button
              type="button"
              onClick={() => {
                // Synthesize a click on the canvas so PointerLockControls engages.
                const canvas = document.querySelector('canvas');
                canvas?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              }}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50"
            >
              Enter the control room
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="mt-5 flex items-center justify-center gap-3 text-xs">
              <Link to="/landing" className="text-slate-400 hover:text-white underline-offset-4 hover:underline">Just take me home</Link>
              <span className="text-slate-700">·</span>
              <Link to="/editor" className="text-slate-400 hover:text-white underline-offset-4 hover:underline">Open editor</Link>
              <span className="text-slate-700">·</span>
              <Link to="/docs" className="text-slate-400 hover:text-white underline-offset-4 hover:underline">Docs</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotFound;
