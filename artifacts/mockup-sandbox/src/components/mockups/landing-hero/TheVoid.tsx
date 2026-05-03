import { useEffect, useRef, useState } from "react";

function useLiveCount(base: number, variance: number, interval: number) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    const iv = setInterval(() => {
      setValue(base + Math.floor(Math.random() * variance));
    }, interval);
    return () => clearInterval(iv);
  }, [base, variance, interval]);
  return value;
}

function useCountUp(target: number, duration = 1800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const iv = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(iv); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(iv);
  }, [target, duration]);
  return val;
}

function LiveDot({ color = "#28c840" }: { color?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => setOn(v => !v), 900 + Math.random() * 400);
    return () => clearInterval(iv);
  }, []);
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: on ? color : "transparent",
      boxShadow: on ? `0 0 6px ${color}` : "none",
      transition: "all 0.3s ease",
    }} />
  );
}

const ACTIVITY = [
  { user: "mo_k", action: "pushed to", target: "main", time: "2s ago" },
  { user: "priya_d", action: "opened canvas", target: "api-design-v3", time: "11s ago" },
  { user: "t_chen", action: "deployed", target: "staging", time: "34s ago" },
  { user: "alex_r", action: "reviewed", target: "PR #114", time: "1m ago" },
  { user: "sofia_m", action: "forked", target: "chat-widget", time: "2m ago" },
  { user: "jamal_b", action: "created canvas", target: "roadmap-q3", time: "3m ago" },
];

function ActivityFeed() {
  const [items, setItems] = useState(ACTIVITY);
  const [flash, setFlash] = useState<number | null>(null);

  useEffect(() => {
    const actions = ["pushed to", "opened canvas", "deployed", "reviewed", "forked"];
    const users = ["wei_x", "nadia_p", "r_santos", "h_kim", "dev_lu"];
    const targets = ["feature/auth", "canvas-v2", "production", "PR #119", "boilerplate"];
    const iv = setInterval(() => {
      const newItem = {
        user: users[Math.floor(Math.random() * users.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        target: targets[Math.floor(Math.random() * targets.length)],
        time: "just now",
      };
      setItems(prev => [newItem, ...prev.slice(0, 5)]);
      setFlash(0);
      setTimeout(() => setFlash(null), 600);
    }, 3200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 0",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          opacity: i === 0 && flash === 0 ? 0.5 : 1,
          transition: "opacity 0.3s ease",
          animation: i === 0 ? "slideDown 0.3s ease" : undefined,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: `hsl(${(item.user.charCodeAt(0) * 37) % 360}, 60%, 35%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {item.user[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{item.user}</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}> {item.action} </span>
            <span style={{ color: "#ff6b00", fontSize: 13 }}>{item.target}</span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, flexShrink: 0 }}>{item.time}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, accent = "#ff6b00", live = false }: {
  label: string; value: string | number; sub?: string; accent?: string; live?: boolean;
}) {
  return (
    <div style={{
      padding: "28px 32px",
      borderTop: `2px solid ${accent}`,
      background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {live && <LiveDot color={accent} />}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", fontWeight: 500 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

export function TheVoid() {
  const [navHover, setNavHover] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Live-updating numbers
  const activeDevs = useLiveCount(1847, 12, 2800);
  const deploysToday = useLiveCount(3241, 8, 4100);
  const syncLatency = useLiveCount(47, 18, 1500);
  const canvasesOpen = useLiveCount(892, 15, 3300);

  // Count-up on load
  const totalDevs = useCountUp(40200, 2000);
  const totalCanvases = useCountUp(2100000, 2200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setMousePos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
    };
    el.addEventListener("mousemove", handleMove);
    return () => el.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div ref={containerRef} style={{
      background: "#000", fontFamily: "'Inter', sans-serif",
      display: "flex", flexDirection: "column", position: "relative",
      cursor: "default",
    }}>
      {/* Spotlight */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
        background: `radial-gradient(700px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,107,0,0.04) 0%, transparent 60%)`,
        transition: "background 0.08s ease",
      }} />

      {/* Grain */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, opacity: 0.025,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        backgroundSize: "128px",
      }} />

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 48px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
      }}>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 500, letterSpacing: "0.02em" }}>CodeCanvas</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 16 }}>
            <LiveDot color="#28c840" />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
              {activeDevs.toLocaleString()} online
            </span>
          </div>
          <button
            onMouseEnter={() => setNavHover(true)}
            onMouseLeave={() => setNavHover(false)}
            style={{
              background: navHover ? "#ff6b00" : "transparent",
              border: "1px solid", borderColor: navHover ? "#ff6b00" : "rgba(255,255,255,0.15)",
              color: navHover ? "#000" : "rgba(255,255,255,0.5)",
              fontWeight: navHover ? 700 : 400, fontSize: 13, padding: "8px 20px",
              borderRadius: 6, cursor: "pointer", transition: "all 0.2s ease",
            }}>
            Sign in
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        position: "relative", zIndex: 5, minHeight: "92vh",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "80px 48px 60px",
      }}>
        <div style={{ fontSize: 11, color: "#ff6b00", letterSpacing: "0.18em", fontWeight: 500, marginBottom: 36, opacity: 0.8 }}>
          COLLABORATIVE · CODING · CANVAS
        </div>
        <h1 style={{
          margin: 0, fontSize: "clamp(56px, 8vw, 104px)",
          fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.04em", color: "#fff",
          maxWidth: 820,
        }}>
          Code together.<br />
          <span style={{ color: "rgba(255,255,255,0.18)" }}>Ship faster.</span>
        </h1>

        <p style={{
          marginTop: 40, maxWidth: 480, fontSize: 16,
          color: "rgba(255,255,255,0.35)", lineHeight: 1.7,
          fontWeight: 400, letterSpacing: "-0.01em",
        }}>
          CodeCanvas brings your IDE, AI co-pilot, automations, and team into one place.
          Plan, build, deploy — without switching tabs.
        </p>

        <div style={{ marginTop: 48, display: "flex", gap: 16, alignItems: "center" }}>
          <button onClick={() => window.location.href = '/editor'} style={{
            background: "#ff6b00", border: "none", color: "#000",
            fontWeight: 700, fontSize: 15, padding: "15px 36px",
            borderRadius: 8, cursor: "pointer", letterSpacing: "-0.01em",
          }}>
            Enter the grid
          </button>
          <button style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.25)",
            fontWeight: 400, fontSize: 15, padding: "15px 0",
            cursor: "pointer", letterSpacing: "-0.01em",
          }}>
            See how it works →
          </button>
        </div>

        {/* Ghost features */}
        <div style={{
          position: "absolute", right: 48, top: "50%", transform: "translateY(-50%)",
          display: "flex", flexDirection: "column", gap: 24, opacity: 0.2,
        }}>
          {["AI Pairing", "Live Presence", "Edge Builds", "Git Built-in", "Office Files", "Automations"].map((f) => (
            <div key={f} style={{ fontSize: 12, color: "#fff", fontWeight: 500, letterSpacing: "0.06em", textAlign: "right" }}>
              {f}
            </div>
          ))}
        </div>

        {/* Right accent line */}
        <div style={{
          position: "absolute", right: 0, top: "10%", bottom: "10%", width: 1,
          background: "linear-gradient(to bottom, transparent, rgba(255,107,0,0.25) 40%, rgba(255,107,0,0.25) 60%, transparent)",
        }} />
      </section>

      {/* ── LIVE STATS GRID ── */}
      <section style={{ position: "relative", zIndex: 5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{
          padding: "20px 48px 0",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <LiveDot color="#ff6b00" />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.14em" }}>LIVE DATA</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <StatCard label="DEVELOPERS ONLINE" value={activeDevs.toLocaleString()} sub="right now" accent="#ff6b00" live />
          <StatCard label="CANVASES OPEN" value={canvasesOpen.toLocaleString()} sub="active sessions" accent="#3b82f6" live />
          <StatCard label="DEPLOYS TODAY" value={deploysToday.toLocaleString()} sub="and counting" accent="#10b981" live />
          <StatCard label="SYNC LATENCY" value={`${syncLatency}ms`} sub="p99 global" accent="#a78bfa" live />
        </div>
      </section>

      {/* ── CUMULATIVE STATS ── */}
      <section style={{
        position: "relative", zIndex: 5,
        padding: "72px 48px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0,
      }}>
        {[
          { num: totalDevs > 1000 ? `${(totalDevs / 1000).toFixed(1)}k+` : totalDevs, label: "developers" },
          { num: totalCanvases > 1000000 ? `${(totalCanvases / 1000000).toFixed(1)}M` : totalCanvases.toLocaleString(), label: "canvases created" },
          { num: "<100ms", label: "sync latency" },
        ].map(({ num, label }) => (
          <div key={label} style={{ padding: "0 0 0 0", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 52, fontWeight: 800, color: "#fff", letterSpacing: "-0.05em", lineHeight: 1 }}>{num}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", marginTop: 10, letterSpacing: "0.06em" }}>{label}</div>
          </div>
        ))}
      </section>

      {/* ── LIVE ACTIVITY FEED ── */}
      <section style={{
        position: "relative", zIndex: 5,
        padding: "72px 48px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
            <LiveDot color="#28c840" />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.14em" }}>LIVE ACTIVITY</span>
          </div>
          <ActivityFeed />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.14em", marginBottom: 32 }}>
            WHY TEAMS SWITCH
          </div>
          {[
            { q: "Everything in one tab.", d: "IDE, terminal, AI, deployment, docs. No context switching." },
            { q: "Your whole team, live.", d: "Real-time multiplayer — cursors, chat, canvases, code." },
            { q: "Ship without thinking about infra.", d: "Push to deploy. Edge builds in under 10 seconds." },
            { q: "AI that knows your codebase.", d: "Not just autocomplete — an agent that reads, plans, and acts." },
          ].map(({ q, d }) => (
            <div key={q} style={{ marginBottom: 32, paddingLeft: 20, borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>{q}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{
        position: "relative", zIndex: 5,
        padding: "80px 48px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.14em", marginBottom: 56 }}>
          EVERYTHING YOU NEED
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "rgba(255,255,255,0.06)" }}>
          {[
            { title: "Full browser IDE", desc: "Monaco editor, multi-file, 50+ languages. No install." },
            { title: "AI Pair Programmer", desc: "9+ providers. GPT-4o, Claude, Gemini. Bring your own key." },
            { title: "Live team presence", desc: "See who's in your canvas. Multiplayer cursors and chat." },
            { title: "Automations", desc: "Trigger workflows on push, schedule, or webhook. No infra." },
            { title: "Office file support", desc: "Open and edit .docx, .pptx, .xlsx alongside your code." },
            { title: "Image & video generation", desc: "AI-generate assets without leaving the workspace." },
            { title: "Visual canvas / whiteboard", desc: "Diagram, plan, and design next to your code." },
            { title: "Edge-speed builds", desc: "Deploy to global edge in seconds. Custom domains included." },
            { title: "Git built-in", desc: "Commit, branch, PR, diff — all in the sidebar." },
          ].map(({ title, desc }) => (
            <div key={title} style={{ background: "#000", padding: "32px 32px" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 10, letterSpacing: "-0.02em" }}>{title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        position: "relative", zIndex: 5,
        padding: "120px 48px",
        display: "flex", flexDirection: "column", alignItems: "flex-start",
      }}>
        <h2 style={{
          margin: 0, fontSize: "clamp(40px, 6vw, 72px)",
          fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", lineHeight: 0.95,
          maxWidth: 640,
        }}>
          Start coding.<br />
          <span style={{ color: "rgba(255,255,255,0.18)" }}>No setup required.</span>
        </h2>
        <div style={{ marginTop: 48, display: "flex", gap: 16, alignItems: "center" }}>
          <button style={{
            background: "#ff6b00", border: "none", color: "#000",
            fontWeight: 700, fontSize: 15, padding: "15px 36px",
            borderRadius: 8, cursor: "pointer",
          }}>
            Open CodeCanvas — it's free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: "relative", zIndex: 5,
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "24px 48px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>© 2026 CodeCanvas</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <LiveDot color="#28c840" />
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>All systems operational</span>
        </div>
      </footer>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default TheVoid;
