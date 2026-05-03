import { useEffect, useState } from "react";

const events = [
  "Alicia opened a canvas",
  "Mina pushed a deployment",
  "Jordan invited 2 teammates",
  "Ops sync completed in 18ms",
];

export function TheVoid() {
  const [eventIndex, setEventIndex] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setEventIndex((i) => (i + 1) % events.length), 2500);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#050507", color: "white", fontFamily: "Inter, sans-serif", padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#ff6b00" }} />
          <div style={{ fontWeight: 700 }}>CodeCanvas</div>
        </div>
        <div style={{ color: "#8f8f95" }}>Back to Home · Try It Free</div>
      </div>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ display: "inline-block", border: "1px solid rgba(255,107,0,0.35)", borderRadius: 999, padding: "6px 12px", color: "#ff6b00", fontSize: 12, letterSpacing: "0.16em", marginBottom: 18 }}>VISUAL QUIET</div>
          <h1 style={{ fontSize: 58, lineHeight: 1.02, margin: 0, fontWeight: 800 }}>CodeCanvas vs. <span style={{ color: "#ff6b00" }}>the field</span></h1>
          <p style={{ color: "#a1a1aa", maxWidth: 720, margin: "16px auto 0" }}>Pick any tool below and see how CodeCanvas stacks up feature by feature — no marketing spin, just the facts.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
          {[["CodeCanvas", "23.5/24"], ["Replit", "16/24"], ["Warmth", "high"], ["Latency", "18ms"]].map(([a,b]) => (
            <div key={a} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ color: "#9ca3af", fontSize: 12, letterSpacing: "0.14em", marginBottom: 8 }}>{a}</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{b}</div>
            </div>
          ))}
        </div>
        <div style={{ border: "1px solid rgba(255,107,0,0.15)", borderRadius: 18, padding: 22, background: "rgba(255,255,255,0.02)", marginBottom: 18 }}>
          <div style={{ color: "#8b8b91", marginBottom: 12 }}>Live activity</div>
          <div style={{ fontSize: 18 }}>{events[eventIndex]}</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={{ background: "#ff6b00", color: "#000", border: 0, padding: "14px 24px", borderRadius: 10, fontWeight: 800 }}>Open CodeCanvas →</button>
          <button style={{ background: "rgba(255,255,255,0.05)", color: "#d4d4d8", border: "1px solid rgba(255,255,255,0.12)", padding: "14px 24px", borderRadius: 10 }}>Explore Systems</button>
        </div>
      </div>
    </div>
  );
}
