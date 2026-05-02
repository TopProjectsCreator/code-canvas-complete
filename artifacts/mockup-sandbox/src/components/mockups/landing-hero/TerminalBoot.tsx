import { useEffect, useRef, useState } from "react";

const SCRIPT = [
  { delay: 0,    text: "$ codecanvas init",           type: "cmd" },
  { delay: 600,  text: "→ Spinning up workspace...",   type: "info" },
  { delay: 1100, text: "→ Loading AI co-pilot...",     type: "info" },
  { delay: 1600, text: "→ Connecting team presence...",type: "info" },
  { delay: 2100, text: "✓ Workspace ready.",           type: "success" },
  { delay: 2700, text: "",                             type: "gap" },
  { delay: 2800, text: "The collaborative coding",     type: "headline" },
  { delay: 2800, text: "canvas for modern teams.",     type: "headline2" },
  { delay: 3500, text: "",                             type: "gap" },
  { delay: 3600, text: "$ codecanvas --features",     type: "cmd" },
  { delay: 4100, text: "  AI_PAIRING          enabled", type: "feat" },
  { delay: 4300, text: "  LIVE_PRESENCE       enabled", type: "feat" },
  { delay: 4500, text: "  EDGE_BUILDS         enabled", type: "feat" },
  { delay: 4700, text: "  MULTIPLAYER_CANVAS  enabled", type: "feat" },
  { delay: 4900, text: "  IN_BROWSER_IDE      enabled", type: "feat" },
];

type Line = typeof SCRIPT[0];

export function TerminalBoot() {
  const [lines, setLines] = useState<Line[]>([]);
  const [showCTAs, setShowCTAs] = useState(false);
  const [cursor, setCursor] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    SCRIPT.forEach((line, i) => {
      const t = setTimeout(() => {
        setLines(prev => [...prev, line]);
        if (i === SCRIPT.length - 1) {
          setTimeout(() => setShowCTAs(true), 500);
        }
      }, line.delay);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setCursor(c => !c), 530);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div style={{
      background: "#0a0a0a",
      minHeight: "100vh",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      display: "flex", flexDirection: "column",
    }}>
      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 40px", borderBottom: "1px solid #1a1a1a",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "#ff6b00", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "#000",
          }}>C</div>
          <span style={{ color: "#888", fontSize: 13, letterSpacing: "0.05em" }}>CodeCanvas</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
        </div>
      </nav>

      {/* Terminal window */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{
          width: "100%", maxWidth: 720,
          background: "#111", borderRadius: 12,
          border: "1px solid #222",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px #1a1a1a",
        }}>
          {/* Terminal title bar */}
          <div style={{
            background: "#1a1a1a", padding: "12px 20px",
            display: "flex", alignItems: "center", gap: 8,
            borderBottom: "1px solid #222",
          }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
            <span style={{ marginLeft: 12, color: "#555", fontSize: 12 }}>workspace — codecanvas</span>
          </div>

          {/* Terminal body */}
          <div style={{ padding: "28px 32px", minHeight: 340 }}>
            {lines.map((line, i) => {
              if (line.type === "gap") return <div key={i} style={{ height: 12 }} />;
              if (line.type === "headline") return (
                <div key={i} style={{
                  fontSize: 28, fontWeight: 700, color: "#fff",
                  letterSpacing: "-0.02em", lineHeight: 1.2,
                  marginTop: 4,
                  animation: "fadeIn 0.4s ease",
                }}>
                  {line.text}
                </div>
              );
              if (line.type === "headline2") return (
                <div key={i} style={{
                  fontSize: 28, fontWeight: 700,
                  background: "linear-gradient(90deg, #ff6b00, #ff9a3c)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 8,
                  animation: "fadeIn 0.4s ease",
                }}>
                  {line.text}
                </div>
              );
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 0,
                  marginBottom: 4, animation: "slideIn 0.2s ease",
                }}>
                  <span style={{
                    color: line.type === "cmd" ? "#ff6b00"
                         : line.type === "success" ? "#28c840"
                         : line.type === "feat" ? "#3b82f6"
                         : "#555",
                    fontSize: 14, lineHeight: 1.6, whiteSpace: "pre",
                  }}>
                    {line.text}
                  </span>
                </div>
              );
            })}
            {/* Cursor */}
            <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 2 }}>
              <span style={{ color: "#ff6b00", fontSize: 14 }}>$ </span>
              <span style={{
                display: "inline-block", width: 8, height: 16,
                background: cursor ? "#ff6b00" : "transparent",
                marginLeft: 2, verticalAlign: "middle",
                transition: "background 0.1s",
              }} />
            </div>
            <div ref={bottomRef} />
          </div>

          {/* CTAs */}
          {showCTAs && (
            <div style={{
              borderTop: "1px solid #1e1e1e", padding: "20px 32px",
              display: "flex", gap: 12, alignItems: "center",
              animation: "fadeIn 0.5s ease",
            }}>
              <button style={{
                background: "#ff6b00", border: "none", color: "#000",
                fontWeight: 700, fontSize: 13, padding: "10px 24px",
                borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                letterSpacing: "0.05em",
              }}>
                $ open --workspace
              </button>
              <button style={{
                background: "none", border: "1px solid #333", color: "#666",
                fontWeight: 500, fontSize: 13, padding: "10px 24px",
                borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                letterSpacing: "0.05em",
              }}>
                $ explore --systems
              </button>
              <div style={{
                marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
                background: "#161616", border: "1px solid #222",
                borderRadius: 8, padding: "8px 16px",
              }}>
                <span style={{ color: "#444", fontSize: 13 }}>search canvases, people...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div style={{
        borderTop: "1px solid #1a1a1a", padding: "12px 40px",
        display: "flex", gap: 32, alignItems: "center",
      }}>
        {["AI PAIRING", "ALL IN ONE IDE", "LIVE TEAM PRESENCE", "EDGE-SPEED BUILDS"].map((f, i) => (
          <span key={i} style={{ color: "#333", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em" }}>
            <span style={{ color: "#ff6b00", marginRight: 8 }}>✓</span>{f}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
