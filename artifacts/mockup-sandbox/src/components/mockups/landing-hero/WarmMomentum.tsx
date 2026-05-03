import { useEffect, useState } from "react";

function useLiveCount(base: number, variance: number, ms: number) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const iv = setInterval(() => setV(base + Math.floor(Math.random() * variance)), ms);
    return () => clearInterval(iv);
  }, [base, variance, ms]);
  return v;
}

const CARDS = [
  { icon: "⚡", title: "AI Pair Programmer", body: "9+ AI providers. Your whole codebase in context. Ask, plan, build.", color: "#f59e0b" },
  { icon: "👥", title: "Live Team Presence", body: "See everyone's cursor. Chat. Share canvases. Multiplayer, native.", color: "#ec4899" },
  { icon: "🚀", title: "Edge-Speed Builds", body: "Push to deploy. Global edge. Custom domains. Under 10 seconds.", color: "#8b5cf6" },
  { icon: "🔀", title: "Git Built-in", body: "Commit, branch, pull request, diff — right in the sidebar.", color: "#10b981" },
  { icon: "🗂️", title: "Visual Canvas", body: "Diagram, plan, and sketch alongside your code. No tab switching.", color: "#f59e0b" },
  { icon: "⚙️", title: "Automations", body: "Trigger workflows on push, schedule, or webhook. Zero infra.", color: "#ec4899" },
];

const TESTIMONIALS = [
  { name: "Priya D.", role: "Staff Eng @ Stripe", text: "We shipped 40% faster in the first month. The live presence alone is worth it." },
  { name: "Mo K.", role: "Founder, Raycast", text: "Every tool I needed in one tab. I haven't opened another IDE since." },
  { name: "Sofia M.", role: "CTO @ Linear", text: "The AI actually understands our codebase. It's like pairing with someone who's read everything." },
];

export function WarmMomentum() {
  const [testIdx, setTestIdx] = useState(0);
  const online = useLiveCount(1847, 15, 2600);
  const deploys = useLiveCount(3241, 10, 4200);

  useEffect(() => {
    const iv = setInterval(() => setTestIdx(i => (i + 1) % TESTIMONIALS.length), 4000);
    return () => clearInterval(iv);
  }, []);

  const t = TESTIMONIALS[testIdx];

  return (
    <div style={{
      background: "#fdf8f2", minHeight: "100vh",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      color: "#1a0e00", position: "relative",
    }}>
      {/* Warm gradient top bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)" }} />

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 48px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#fff",
          }}>C</div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em", color: "#1a0e00" }}>CodeCanvas</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, padding: "6px 14px", background: "#fff2d8", borderRadius: 20, marginRight: 16, alignItems: "center", border: "1px solid rgba(245,158,11,0.2)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>{online.toLocaleString()} online</span>
          </div>
          <button style={{ background: "none", border: "none", color: "#78716c", fontSize: 14, cursor: "pointer", padding: "8px 16px" }}>Compare</button>
          <button onClick={() => window.location.href = '/editor'} style={{
            background: "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)",
            border: "none", color: "#fff", fontWeight: 700, fontSize: 14,
            padding: "10px 24px", borderRadius: 10, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
          }}>Start free →</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "72px 48px 64px", maxWidth: 1280, margin: "0 auto" }}>
        {/* Eyebrow */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: "#fff2d8", border: "1px solid rgba(245,158,11,0.3)",
          borderRadius: 20, padding: "7px 18px", marginBottom: 36,
        }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>Now with Claude 4 & Gemini 2.5 Pro</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div>
            <h1 style={{
              margin: "0 0 24px", fontSize: 62, fontWeight: 800,
              lineHeight: 0.96, letterSpacing: "-0.04em", color: "#1a0e00",
            }}>
              Build together,<br />
              <span style={{ background: "linear-gradient(90deg, #f59e0b, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ship faster.
              </span>
            </h1>

            <p style={{
              margin: "0 0 40px", fontSize: 18, lineHeight: 1.65,
              color: "#78716c", maxWidth: 460, letterSpacing: "-0.01em",
            }}>
              CodeCanvas brings your IDE, AI, team, and deploy into one warm, fast workspace. Stop switching tabs. Start building.
            </p>

            <div style={{ display: "flex", gap: 14, marginBottom: 48, flexWrap: "wrap" }}>
              <button onClick={() => window.location.href = '/editor'} style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)",
                border: "none", color: "#fff", fontWeight: 700, fontSize: 16,
                padding: "16px 36px", borderRadius: 12, cursor: "pointer",
                boxShadow: "0 6px 20px rgba(245,158,11,0.3)", letterSpacing: "-0.01em",
              }}>Open CodeCanvas — it's free</button>
              <button style={{
                background: "#fff", border: "1.5px solid #e8d5b0", color: "#78716c",
                fontWeight: 600, fontSize: 15, padding: "15px 28px",
                borderRadius: 12, cursor: "pointer",
              }}>Watch demo ▶</button>
            </div>

            {/* Live stats pills */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { val: `${(online / 1000).toFixed(1)}k`, label: "devs online now", color: "#f59e0b" },
                { val: deploys.toLocaleString(), label: "deploys today", color: "#10b981" },
                { val: "<100ms", label: "sync latency", color: "#8b5cf6" },
              ].map(({ val, label, color }) => (
                <div key={label} style={{
                  background: "#fff", border: `1.5px solid ${color}22`,
                  borderRadius: 10, padding: "10px 18px",
                  display: "flex", flexDirection: "column", gap: 2,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}>
                  <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.04em", color }}>{val}</span>
                  <span style={{ fontSize: 11, color: "#aaa", fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rotating testimonial */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: "36px 36px",
              boxShadow: "0 8px 40px rgba(245,158,11,0.1), 0 2px 8px rgba(0,0,0,0.06)",
              border: "1px solid rgba(245,158,11,0.12)", minHeight: 160,
            }}>
              <div style={{ fontSize: 32, color: "#f59e0b", marginBottom: 16, lineHeight: 1 }}>"</div>
              <p style={{ margin: "0 0 20px", fontSize: 17, lineHeight: 1.65, color: "#1a0e00", letterSpacing: "-0.01em", fontWeight: 500 }}>
                {t.text}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg, #f59e0b, #ec4899)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                }}>{t.name[0]}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a0e00" }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>{t.role}</div>
                </div>
              </div>
            </div>

            {/* Testimonial dots */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {TESTIMONIALS.map((_, i) => (
                <div key={i} onClick={() => setTestIdx(i)} style={{
                  width: i === testIdx ? 20 : 6, height: 6, borderRadius: 3,
                  background: i === testIdx ? "#f59e0b" : "#e5d3b0",
                  cursor: "pointer", transition: "all 0.3s ease",
                }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section style={{ padding: "0 48px 60px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {CARDS.map(({ icon, title, body, color }) => (
            <div key={title} style={{
              background: "#fff", borderRadius: 14, padding: "28px 28px",
              border: "1.5px solid #f0e8d8",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a0e00", marginBottom: 8, letterSpacing: "-0.02em" }}>{title}</div>
              <div style={{ fontSize: 13, color: "#78716c", lineHeight: 1.6 }}>{body}</div>
              <div style={{ marginTop: 16, height: 2, background: color, borderRadius: 1, width: 32 }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default WarmMomentum;
