import { useEffect, useState } from "react";

const lines = [
  "booting codecanvas runtime...",
  "syncing team presence...",
  "mounting live canvas preview...",
  "loading compare metrics...",
  "ready.",
];

export function TerminalBoot() {
  const [index, setIndex] = useState(0);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const step = setInterval(() => setIndex((i) => Math.min(i + 1, lines.length - 1)), 1200);
    const blink = setInterval(() => setCursor((v) => !v), 500);
    return () => {
      clearInterval(step);
      clearInterval(blink);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0c", color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace", padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#ff6b00" }} />
          <div style={{ fontWeight: 700 }}>CodeCanvas</div>
        </div>
        <div style={{ color: "#8a8a8f", fontSize: 13 }}>Compare · Sign In · Enter Grid</div>
      </div>
      <div style={{ border: "1px solid rgba(255,107,0,0.22)", borderRadius: 16, padding: 28, background: "linear-gradient(180deg, rgba(255,107,0,0.06), rgba(255,255,255,0.02))", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ color: "#ff6b00", marginBottom: 16, letterSpacing: "0.18em", fontSize: 12 }}>SYSTEM BOOT</div>
        <div style={{ fontSize: 56, lineHeight: 1.02, fontWeight: 800, marginBottom: 18 }}>The collaborative <span style={{ color: "#ff6b00" }}>coding canvas</span> for modern teams</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          <button style={{ background: "#ff6b00", color: "#000", border: 0, padding: "14px 24px", borderRadius: 10, fontWeight: 800 }}>Open CodeCanvas →</button>
          <button style={{ background: "rgba(255,255,255,0.05)", color: "#d4d4d8", border: "1px solid rgba(255,255,255,0.12)", padding: "14px 24px", borderRadius: 10 }}>Explore Systems</button>
        </div>
        <div style={{ background: "#09090a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20, minHeight: 220 }}>
          {lines.slice(0, index + 1).map((line, i) => (
            <div key={line} style={{ marginBottom: 8, color: i === lines.length - 1 ? "#ff6b00" : "#cbd5e1" }}>
              <span style={{ color: "#8a8a8f" }}>{String(i + 1).padStart(2, "0")}</span> {'>'} {line}{i === index && cursor ? "_" : ""}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 1080, marginLeft: "auto", marginRight: "auto" }}>
        {[["AI Pairing", "active"], ["Live Presence", "synced"], ["Edge Builds", "shipping"]].map(([title, sub]) => (
          <div key={title} style={{ padding: 18, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontWeight: 700 }}>{title}</div>
            <div style={{ color: "#8a8a8f", fontSize: 13 }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
