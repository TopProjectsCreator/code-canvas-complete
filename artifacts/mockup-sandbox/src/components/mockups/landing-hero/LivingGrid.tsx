import { useEffect, useRef, useState } from "react";

const nodes = [
  { id: "headline", x: 180, y: 120, w: 520, h: 160, type: "main" },
  { id: "cta", x: 180, y: 300, w: 280, h: 52, type: "cta" },
  { id: "feat1", x: 740, y: 80, w: 200, h: 80, type: "feature", label: "AI Pairing", sub: "Real-time co-pilot" },
  { id: "feat2", x: 740, y: 190, w: 200, h: 80, type: "feature", label: "Live Presence", sub: "See your team" },
  { id: "feat3", x: 740, y: 300, w: 200, h: 80, type: "feature", label: "Edge Builds", sub: "Deploy instantly" },
  { id: "feat4", x: 480, y: 300, w: 180, h: 52, type: "secondary", label: "Explore Systems" },
  { id: "search", x: 180, y: 390, w: 520, h: 44, type: "search" },
];

const edges = [
  { from: "headline", to: "feat1" },
  { from: "headline", to: "feat2" },
  { from: "headline", to: "feat3" },
  { from: "cta", to: "search" },
];

function getCenter(node: typeof nodes[0]) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

export function LivingGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    function draw(t: number) {
      timeRef.current = t;
      const W = canvas!.width;
      const H = canvas!.height;
      ctx.clearRect(0, 0, W, H);

      // Animated grid
      const gridSize = 40;
      const offset = (t * 0.012) % gridSize;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,107,0,0.06)";
      ctx.lineWidth = 1;
      for (let x = -gridSize + offset; x < W + gridSize; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, H);
      }
      for (let y = -gridSize + offset * 0.5; y < H + gridSize; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(W, y);
      }
      ctx.stroke();

      // Edge lines
      edges.forEach(({ from, to }) => {
        const a = nodes.find(n => n.id === from)!;
        const b = nodes.find(n => n.id === to)!;
        const ca = getCenter(a);
        const cb = getCenter(b);
        const pulse = Math.sin(t * 0.002 + ca.x * 0.01) * 0.5 + 0.5;
        const grad = ctx.createLinearGradient(ca.x, ca.y, cb.x, cb.y);
        grad.addColorStop(0, `rgba(255,107,0,${0.15 + pulse * 0.25})`);
        grad.addColorStop(1, `rgba(255,107,0,0.05)`);
        ctx.beginPath();
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -(t * 0.05);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.moveTo(ca.x, ca.y);
        ctx.lineTo(cb.x, cb.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dot on line
        const progress = ((t * 0.0008) % 1);
        const px = ca.x + (cb.x - ca.x) * progress;
        const py = ca.y + (cb.y - ca.y) * progress;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,107,0,0.8)";
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        background: "#0f0f10",
        minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, #0f0f10 100%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* Nav */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 40px", borderBottom: "1px solid rgba(255,107,0,0.12)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "#ff6b00", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#000",
          }}>C</div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>CodeCanvas</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", padding: "8px 16px" }}>Compare</button>
          <button style={{ background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", padding: "8px 16px" }}>Sign In</button>
          <button style={{
            background: "#ff6b00", border: "none", color: "#000",
            fontWeight: 700, fontSize: 14, padding: "8px 20px",
            borderRadius: 8, cursor: "pointer",
          }}>Enter Grid →</button>
        </div>
      </nav>

      {/* Canvas background */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={700}
        style={{ position: "absolute", top: 60, left: 0, opacity: 0.9 }}
      />

      {/* Canvas-node layout */}
      <div style={{ position: "relative", zIndex: 5, height: 520, maxWidth: 980, margin: "60px auto 0" }}>

        {/* Main headline node */}
        <div style={{
          position: "absolute", left: 180, top: 120,
          width: 520,
          background: "rgba(15,15,16,0.92)",
          border: "1px solid rgba(255,107,0,0.35)",
          borderRadius: 12, padding: "28px 32px",
          backdropFilter: "blur(12px)",
          boxShadow: "0 0 40px rgba(255,107,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.15em",
            color: "#ff6b00", marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff6b00", display: "inline-block" }} />
            BUILT FOR REAL CODE CANVASES
          </div>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, lineHeight: 1.15, color: "#fff" }}>
            The collaborative{" "}
            <span style={{ color: "#ff6b00" }}>coding canvas</span>
            {" "}for modern teams
          </h1>
        </div>

        {/* CTA node */}
        <div style={{ position: "absolute", left: 180, top: 306 }}>
          <button style={{
            background: "#ff6b00", border: "none", color: "#000",
            fontWeight: 700, fontSize: 15, padding: "14px 28px",
            borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 0 24px rgba(255,107,0,0.35)",
          }}>
            Open CodeCanvas <span style={{ fontSize: 18 }}>›</span>
          </button>
        </div>

        {/* Secondary CTA node */}
        <div style={{ position: "absolute", left: 340, top: 306 }}>
          <button style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#ccc", fontWeight: 600, fontSize: 15, padding: "14px 28px",
            borderRadius: 10, cursor: "pointer",
          }}>
            Explore Systems
          </button>
        </div>

        {/* Search node */}
        <div style={{
          position: "absolute", left: 180, top: 390, width: 520,
          background: "rgba(15,15,16,0.85)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "12px 18px",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ color: "#555", fontSize: 16 }}>⌕</span>
          <span style={{ color: "#444", fontSize: 14 }}>Search canvases, people...</span>
        </div>

        {/* Feature nodes */}
        {[
          { top: 80, label: "AI Pairing", sub: "Real-time co-pilot", dot: "#ff6b00" },
          { top: 190, label: "Live Presence", sub: "See your team", dot: "#3b82f6" },
          { top: 300, label: "Edge Builds", sub: "Deploy instantly", dot: "#10b981" },
        ].map((feat, i) => (
          <div key={i} style={{
            position: "absolute", left: 760, top: feat.top, width: 200,
            background: "rgba(15,15,16,0.88)",
            border: `1px solid ${feat.dot}33`,
            borderRadius: 10, padding: "16px 18px",
            backdropFilter: "blur(8px)",
            boxShadow: `0 0 20px ${feat.dot}11`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: feat.dot, display: "inline-block", boxShadow: `0 0 8px ${feat.dot}` }} />
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{feat.label}</span>
            </div>
            <div style={{ color: "#666", fontSize: 12 }}>{feat.sub}</div>
          </div>
        ))}

        {/* Corner bracket decoration */}
        {["tl", "tr", "bl", "br"].map(corner => (
          <div key={corner} style={{
            position: "absolute",
            ...(corner.includes("t") ? { top: 110 } : { bottom: 60 }),
            ...(corner.includes("l") ? { left: 165 } : { right: 0 }),
            width: 12, height: 12,
            borderTop: corner.includes("t") ? "2px solid rgba(255,107,0,0.4)" : "none",
            borderBottom: corner.includes("b") ? "2px solid rgba(255,107,0,0.4)" : "none",
            borderLeft: corner.includes("l") ? "2px solid rgba(255,107,0,0.4)" : "none",
            borderRight: corner.includes("r") ? "2px solid rgba(255,107,0,0.4)" : "none",
          }} />
        ))}
      </div>

      {/* Bottom ticker */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        borderTop: "1px solid rgba(255,107,0,0.12)",
        padding: "14px 0", overflow: "hidden",
        background: "rgba(15,15,16,0.95)", zIndex: 10,
      }}>
        <div style={{
          display: "flex", gap: 48, animation: "ticker 20s linear infinite",
          whiteSpace: "nowrap", width: "max-content",
        }}>
          {["AI PAIRING", "ALL IN ONE IDE", "LIVE TEAM PRESENCE", "EDGE-SPEED BUILDS", "BUILT IN GIT", "MULTIPLAYER CANVASES", "AI PAIRING", "ALL IN ONE IDE", "LIVE TEAM PRESENCE"].map((t, i) => (
            <span key={i} style={{ color: "#555", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em" }}>
              <span style={{ color: "#ff6b00", marginRight: 12 }}>●</span>{t}
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}
