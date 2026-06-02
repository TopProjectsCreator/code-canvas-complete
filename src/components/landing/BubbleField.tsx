import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  alpha: number;
  pulsePhase: number;
  ringPhase: number;
  breaking: boolean;
  breakTime: number;
}

interface Fragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  alpha: number;
}

const NODE_COUNT = 45;
const MAX_RADIUS = 5;
const MIN_RADIUS = 2;
const REPULSION_DIST = 140;
const REPULSION_FORCE = 0.5;
const BREAK_DIST = 32;
const BREAK_DURATION = 300;
const RESPAWN_DELAY = 500;
const FRAGMENT_COUNT = 4;
const CONNECTION_DIST = 130;

export default function BubbleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const fragmentsRef = useRef<Fragment[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const nodes: Node[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push(createNode(canvas.width, canvas.height, i));
    }
    nodesRef.current = nodes;
    const fragments: Fragment[] = [];

    const onMove = (e: PointerEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    const onDown = (e: PointerEvent) => {
      const mx = e.clientX;
      const my = e.clientY;
      for (const n of nodes) {
        if (n.breaking) continue;
        const dx = n.x - mx;
        const dy = n.y - my;
        if (dx * dx + dy * dy < (BREAK_DIST + n.radius) * (BREAK_DIST + n.radius)) {
          breakNode(n, fragments, Date.now());
        }
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);

    const loop = (now: number) => {
      const W = canvas.width;
      const H = canvas.height;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.clearRect(0, 0, W, H);

      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];

        if (n.breaking) {
          const elapsed = now - n.breakTime;
          const progress = Math.min(elapsed / BREAK_DURATION, 1);
          n.radius *= 1 - progress * 0.015;
          n.alpha = 1 - progress * progress;
          if (progress >= 1) {
            nodes.splice(i, 1);
            setTimeout(() => {
              if (canvas && nodesRef.current) {
                const idx = nodesRef.current.length;
                nodesRef.current.push(createNode(W, H, idx));
              }
            }, RESPAWN_DELAY * (0.5 + Math.random() * 0.8));
          }
          continue;
        }

        const dx = n.x - mx;
        const dy = n.y - my;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist < BREAK_DIST && dist > 0) {
          breakNode(n, fragments, now);
          continue;
        }

        if (dist < REPULSION_DIST && dist > 0) {
          const force = (REPULSION_DIST - dist) / REPULSION_DIST;
          const repel = force * REPULSION_FORCE;
          n.vx += (dx / dist) * repel;
          n.vy += (dy / dist) * repel;
        }

        n.vx += Math.sin(now * 0.0008 + n.pulsePhase) * 0.03;
        n.vy += Math.cos(now * 0.0006 + n.pulsePhase * 1.3) * 0.03;

        n.vx += (Math.random() - 0.5) * 0.04;
        n.vy += (Math.random() - 0.5) * 0.04;

        n.vx *= 0.97;
        n.vy *= 0.97;

        n.x += n.vx;
        n.y += n.vy;

        const margin = n.radius;
        if (n.x < margin) { n.x = margin; n.vx *= -0.5; }
        if (n.x > W - margin) { n.x = W - margin; n.vx *= -0.5; }
        if (n.y < margin) { n.y = margin; n.vy *= -0.5; }
        if (n.y > H - margin) { n.y = H - margin; n.vy *= -0.5; }

        drawNode(ctx, n, now);
      }

      for (let i = fragments.length - 1; i >= 0; i--) {
        const f = fragments[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.015;
        f.alpha -= 0.01;
        f.radius *= 0.97;
        if (f.alpha <= 0) {
          fragments.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${f.hue}, 90%, 70%, ${f.alpha * 0.7})`;
        ctx.fill();
      }

      const active = nodes.filter(n => !n.breaking);
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const a = active[i];
          const b = active[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECTION_DIST) {
            const strength = 1 - d / CONNECTION_DIST;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 80%, 60%, ${strength * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      style={{ pointerEvents: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

function createNode(W: number, H: number, _idx: number): Node {
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    radius: MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS),
    hue: 210 + Math.random() * 80,
    alpha: 0.6 + Math.random() * 0.4,
    pulsePhase: Math.random() * Math.PI * 2,
    ringPhase: Math.random() * Math.PI * 2,
    breaking: false,
    breakTime: 0,
  };
}

function breakNode(n: Node, fragments: Fragment[], now: number) {
  n.breaking = true;
  n.breakTime = now;
  for (let i = 0; i < FRAGMENT_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / FRAGMENT_COUNT + (Math.random() - 0.5) * 0.8;
    const speed = 0.8 + Math.random() * 2;
    fragments.push({
      x: n.x,
      y: n.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      radius: n.radius * (0.3 + Math.random() * 0.4),
      hue: n.hue + (Math.random() - 0.5) * 40,
      alpha: 1,
    });
  }
}

function drawNode(ctx: CanvasRenderingContext2D, n: Node, now: number) {
  const r = n.radius;
  const breathe = 1 + Math.sin(now * 0.002 + n.pulsePhase) * 0.15;
  const drawR = r * breathe;

  const glowSize = drawR * 8;

  const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowSize);
  grad.addColorStop(0, `hsla(${n.hue}, 90%, 70%, ${n.alpha * 0.12})`);
  grad.addColorStop(0.3, `hsla(${n.hue}, 80%, 55%, ${n.alpha * 0.05})`);
  grad.addColorStop(1, `hsla(${n.hue}, 70%, 40%, 0)`);
  ctx.beginPath();
  ctx.arc(n.x, n.y, glowSize, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = `hsla(${n.hue}, 90%, 70%, ${n.alpha * 0.6})`;
  ctx.shadowBlur = drawR * 4;

  ctx.beginPath();
  ctx.arc(n.x, n.y, drawR, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${n.hue}, 90%, 75%, ${n.alpha * 0.9})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(n.x, n.y, drawR * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(0, 0%, 100%, ${n.alpha * 0.25})`;
  ctx.fill();

  ctx.shadowBlur = 0;

  const ringRadius = drawR + 3 + Math.sin(now * 0.0015 + n.ringPhase) * 2;
  ctx.beginPath();
  ctx.arc(n.x, n.y, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(${n.hue}, 80%, 70%, ${n.alpha * 0.2})`;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  const ring2 = ringRadius + 4 + Math.sin(now * 0.002 + n.ringPhase * 0.7) * 2;
  ctx.beginPath();
  ctx.arc(n.x, n.y, ring2, 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(${n.hue + 20}, 70%, 60%, ${n.alpha * 0.1})`;
  ctx.lineWidth = 0.5;
  ctx.stroke();
}
