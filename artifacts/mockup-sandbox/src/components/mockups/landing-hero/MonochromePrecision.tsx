import { useEffect, useState } from "react";

const FEATURES = [
  { label: "AI Pair Programmer", sub: "9+ providers. Your codebase, fully understood." },
  { label: "Live Team Presence", sub: "Multiplayer cursors, chat, shared canvas." },
  { label: "Edge Builds", sub: "Deploy globally in under 10 seconds." },
  { label: "Git Built-in", sub: "Commit, branch, PR — all in the sidebar." },
  { label: "Visual Canvas", sub: "Diagram and design next to your code." },
  { label: "Automations", sub: "Trigger workflows on push, schedule, or webhook." },
];

function useCountUp(target: number, duration = 2000) {
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

export function MonochromePrecision() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [tick, setTick] = useState(0);
  const devs = useCountUp(40200, 1800);
  const canvases = useCountUp(2100000, 2000);

  useEffect(() => {
    const iv = setInterval(() => {
      setActiveFeature(f => (f + 1) % FEATURES.length);
      setTick(t => t + 1);
    }, 2400);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      background: "#fff", minHeight: "100vh",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      color: "#0a0a0a", position: "relative", overflow: "hidden",
    }}>
      {/* Thin horizontal rule accent */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#0a0a0a" }} />

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "28px 48px", borderBottom: "1px solid #e5e5e5",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, background: "#0a0a0a", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "#fff",
          }}>C</div>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>CodeCanvas</span>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {["Compare", "Docs", "Blog"].map(l => (
            <span key={l} style={{ fontSize: 14, color: "#555", cursor: "pointer", letterSpacing: "-0.01em" }}>{l}</span>
          ))}
          <button style={{
            background: "#0a0a0a", border: "none", color: "#fff",
            fontWeight: 600, fontSize: 13, padding: "9px 22px",
            borderRadius: 6, cursor: "pointer", letterSpacing: "-0.01em",
          }}>Start free</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "100px 48px 80px", maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
        <div>
          {/* Precision label */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: "1px solid #d4d4d4", padding: "6px 14px", borderRadius: 4,
            fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: "#555",
            marginBottom: 40,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0a0a0a", display: "inline-block" }} />
            COLLABORATIVE IDE · EST. 2026
          </div>

          <h1 style={{
            margin: "0 0 32px", fontSize: 64, fontWeight: 800,
            lineHeight: 0.95, letterSpacing: "-0.04em", color: "#0a0a0a",
          }}>
            The IDE<br />
            your team<br />
            <span style={{ color: "#b0b0b0" }}>actually uses.</span>
          </h1>

          <p style={{
            margin: "0 0 48px", fontSize: 17, lineHeight: 1.65,
            color: "#555", maxWidth: 440, letterSpacing: "-0.01em",
          }}>
            CodeCanvas brings your editor, AI co-pilot, team presence, and deploy pipeline into a single tab. No switching. No setup.
          </p>

          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 56 }}>
            <button style={{
              background: "#0a0a0a", border: "none", color: "#fff",
              fontWeight: 700, fontSize: 15, padding: "15px 36px",
              borderRadius: 8, cursor: "pointer", letterSpacing: "-0.02em",
            }}>Open CodeCanvas →</button>
            <button style={{
              background: "none", border: "1px solid #d4d4d4", color: "#0a0a0a",
              fontWeight: 500, fontSize: 14, padding: "14px 28px",
              borderRadius: 8, cursor: "pointer", letterSpacing: "-0.01em",
            }}>See how it works</button>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 40, paddingTop: 32, borderTop: "1px solid #e5e5e5" }}>
            {[
              { num: devs > 1000 ? `${(devs / 1000).toFixed(0)}k+` : devs, label: "developers" },
              { num: canvases > 1000000 ? `${(canvases / 1000000).toFixed(1)}M` : canvases, label: "canvases" },
              { num: "<100ms", label: "sync latency" },
            ].map(({ num, label }) => (
              <div key={label}>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>{num}</div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 4, letterSpacing: "0.04em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature cycle panel */}
        <div style={{ paddingTop: 8 }}>
          {/* Active feature large display */}
          <div style={{
            border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden",
            marginBottom: 12,
          }}>
            <div style={{
              background: "#fafafa", padding: "40px 36px",
              borderBottom: "1px solid #e5e5e5",
              minHeight: 140,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: "#999", marginBottom: 16 }}>
                {String(activeFeature + 1).padStart(2, "0")} / {String(FEATURES.length).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "#0a0a0a", marginBottom: 10 }}>
                {FEATURES[activeFeature].label}
              </div>
              <div style={{ fontSize: 14, color: "#777", lineHeight: 1.6 }}>
                {FEATURES[activeFeature].sub}
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 2, background: "#f0f0f0" }}>
              <div style={{
                height: "100%", background: "#0a0a0a",
                width: `${((tick % FEATURES.length) / FEATURES.length) * 100}%`,
                transition: "width 2.4s linear",
              }} />
            </div>
          </div>

          {/* Feature list */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#e5e5e5", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                onClick={() => setActiveFeature(i)}
                style={{
                  background: i === activeFeature ? "#0a0a0a" : "#fff",
                  padding: "16px 18px", cursor: "pointer",
                  transition: "background 0.2s ease",
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: i === activeFeature ? "#fff" : "#0a0a0a", letterSpacing: "-0.01em" }}>
                  {f.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom ticker */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        borderTop: "1px solid #e5e5e5", background: "#fff",
        padding: "14px 0", overflow: "hidden",
      }}>
        <div style={{ display: "flex", gap: 64, animation: "ticker 22s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
          {["AI PAIRING", "LIVE PRESENCE", "EDGE BUILDS", "GIT BUILT-IN", "VISUAL CANVAS", "AUTOMATIONS", "AI PAIRING", "LIVE PRESENCE", "EDGE BUILDS"].map((t, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: "#aaa" }}>
              <span style={{ marginRight: 12, color: "#ccc" }}>—</span>{t}
            </span>
          ))}
        </div>
      </div>

      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}
