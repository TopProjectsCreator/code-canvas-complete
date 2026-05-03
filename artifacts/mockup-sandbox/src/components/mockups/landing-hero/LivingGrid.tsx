import { useEffect, useRef, useState } from "react";

const nodes = [
  { id: "headline", x: 180, y: 120, w: 460, h: 150 },
  { id: "cta", x: 180, y: 300, w: 240, h: 52 },
  { id: "feat1", x: 700, y: 80, w: 170, h: 72, label: "AI Pairing", sub: "Real-time co-pilot" },
  { id: "feat2", x: 700, y: 190, w: 170, h: 72, label: "Live Presence", sub: "See your team" },
  { id: "feat3", x: 700, y: 300, w: 170, h: 72, label: "Edge Builds", sub: "Deploy instantly" },
  { id: "search", x: 180, y: 390, w: 500, h: 44 },
];

const edges = [
  { from: "headline", to: "feat1" },
  { from: "headline", to: "feat2" },
  { from: "headline", to: "feat3" },
  { from: "cta", to: "search" },
];

function getCenter(node: { x: number; y: number; w: number; h: number }) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

export function LivingGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liveUsers, setLiveUsers] = useState(1847);
  const [liveCanvases, setLiveCanvases] = useState(892);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const userIv = setInterval(() => setLiveUsers((v) => v + (Math.random() > 0.5 ? 1 : -1)), 2200);
    const canvasIv = setInterval(() => setLiveCanvases((v) => v + (Math.random() > 0.5 ? 1 : 0)), 3100);
    return () => {
      clearInterval(userIv);
      clearInterval(canvasIv);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const draw = (t: number) => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const gridSize = 40;
      const offset = (t * 0.012) % gridSize;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,107,0,0.06)";
      ctx.lineWidth = 1;
      for (let x = -gridSize + offset; x < W + gridSize; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      for (let y = -gridSize + offset * 0.5; y < H + gridSize; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();

      edges.forEach(({ from, to }) => {
        const a = nodes.find((n) => n.id === from)!;
        const b = nodes.find((n) => n.id === to)!;
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

        const progress = (t * 0.0008) % 1;
        const px = ca.x + (cb.x - ca.x) * progress;
        const py = ca.y + (cb.y - ca.y) * progress;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,107,0,0.8)";
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ background: "#0f0f10", minHeight: "100vh", fontFamily: "'Inter', sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, #0f0f10 100%)", pointerEvents: "none", zIndex: 1 }} />
      <nav style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", borderBottom: "1px solid rgba(255,107,0,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/favicon.svg" alt="CodeCanvas" style={{ width: 32, height: 32 }} />
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>CodeCanvas</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", padding: "8px 16px" }}>Compare</button>
          <button style={{ background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", padding: "8px 16px" }}>Sign In</button>
          <button style={{ background: "#ff6b00", border: "none", color: "#000", fontWeight: 700, fontSize: 14, padding: "8px 20px", borderRadius: 8, cursor: "pointer" }}>Enter Grid →</button>
        </div>
      </nav>
      <canvas ref={canvasRef} width={1280} height={700} style={{ position: "absolute", top: 60, left: 0, opacity: 0.9 }} />
      <div style={{ position: "relative", zIndex: 5, height: 520, maxWidth: 980, margin: "60px auto 0" }}>
        <div style={{ position: "absolute", left: 180, top: 120, width: 460, background: "rgba(15,15,16,0.92)", border: "1px solid rgba(255,107,0,0.35)", borderRadius: 12, padding: "24px 28px", backdropFilter: "blur(12px)", boxShadow: "0 0 40px rgba(255,107,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "#ff6b00", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff6b00", display: "inline-block" }} />
            BUILT FOR REAL CODE CANVASES
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, lineHeight: 1.06, color: "#fff", maxWidth: 390 }}>
            The collaborative <span style={{ color: "#ff6b00" }}>coding canvas</span> for modern teams
          </h1>
        </div>
        <div style={{ position: "absolute", left: 180, top: 300, display: "flex", gap: 14 }}>
          <button onClick={() => window.location.href = '/editor'} style={{ background: "#ff6b00", border: "none", color: "#000", fontWeight: 700, fontSize: 15, padding: "14px 28px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 0 24px rgba(255,107,0,0.35)" }}>
            Open CodeCanvas <span style={{ fontSize: 18 }}>›</span>
          </button>
          <button style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#ddd", fontWeight: 600, fontSize: 15, padding: "14px 24px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
            Explore Systems
          </button>
        </div>
        <div style={{ position: "absolute", left: 180, top: 388, width: 500, background: "rgba(15,15,16,0.85)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 18px", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#555", fontSize: 16 }}>⌕</span>
          <span style={{ color: "#444", fontSize: 14 }}>Search canvases, people...</span>
        </div>
        <div style={{ position: "absolute", right: 140, top: 80, width: 170, background: "rgba(15,15,16,0.88)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 10, padding: "14px 16px", transition: "transform 0.2s ease", transform: hovered === "feat1" ? "translateY(-2px)" : "none" }} onMouseEnter={() => setHovered("feat1")} onMouseLeave={() => setHovered(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff6b00" }} /> <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>AI Pairing</span></div>
          <div style={{ color: "#666", fontSize: 12 }}>Real-time co-pilot</div>
        </div>
        <div style={{ position: "absolute", right: 140, top: 190, width: 170, background: "rgba(15,15,16,0.88)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6" }} /> <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>Live Presence</span></div>
          <div style={{ color: "#666", fontSize: 12 }}>See your team</div>
        </div>
        <div style={{ position: "absolute", right: 140, top: 300, width: 170, background: "rgba(15,15,16,0.88)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} /> <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>Edge Builds</span></div>
          <div style={{ color: "#666", fontSize: 12 }}>Deploy instantly</div>
        </div>
        {[["tl", 100, 165], ["tr", 100, 120], ["bl", 60, 165], ["br", 60, 120]].map(([corner, y, x]) => (
          <div key={String(corner)} style={{ position: "absolute", top: corner === "bl" || corner === "br" ? undefined : y as number, bottom: corner === "bl" || corner === "br" ? y as number : undefined, left: corner === "tl" || corner === "bl" ? x as number : undefined, right: corner === "tr" || corner === "br" ? x as number : undefined, width: 12, height: 12, borderTop: corner === "tl" || corner === "tr" ? "2px solid rgba(255,107,0,0.4)" : "none", borderBottom: corner === "bl" || corner === "br" ? "2px solid rgba(255,107,0,0.4)" : "none", borderLeft: corner === "tl" || corner === "bl" ? "2px solid rgba(255,107,0,0.4)" : "none", borderRight: corner === "tr" || corner === "br" ? "2px solid rgba(255,107,0,0.4)" : "none" }} />
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: "1px solid rgba(255,107,0,0.12)", padding: "14px 0", overflow: "hidden", background: "rgba(15,15,16,0.95)", zIndex: 10 }}>
        <div style={{ display: "flex", gap: 48, animation: "ticker 20s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
          {["AI PAIRING", "ALL IN ONE IDE", "LIVE TEAM PRESENCE", "EDGE-SPEED BUILDS", "BUILT IN GIT", "MULTIPLAYER CANVASES", "AI PAIRING", "ALL IN ONE IDE", "LIVE TEAM PRESENCE"].map((t, i) => <span key={i} style={{ color: "#555", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em" }}><span style={{ color: "#ff6b00", marginRight: 12 }}>●</span>{t}</span>)}
        </div>
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

export default LivingGrid;
