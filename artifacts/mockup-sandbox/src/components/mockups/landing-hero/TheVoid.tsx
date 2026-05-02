import { useEffect, useRef, useState } from "react";

export function TheVoid() {
  const [hovering, setHovering] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    };
    el.addEventListener("mousemove", handleMove);
    return () => el.removeEventListener("mousemove", handleMove);
  }, []);

  const spotlightX = mousePos.x * 100;
  const spotlightY = mousePos.y * 100;

  return (
    <div
      ref={containerRef}
      style={{
        background: "#000",
        minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      {/* Mouse-tracking spotlight */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(600px circle at ${spotlightX}% ${spotlightY}%, rgba(255,107,0,0.04) 0%, transparent 60%)`,
        transition: "background 0.1s ease",
        zIndex: 1,
      }} />

      {/* Subtle grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
        opacity: 0.025,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        backgroundSize: "128px",
      }} />

      {/* Nav — ultra minimal */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "28px 48px",
      }}>
        <span style={{
          color: "#fff", fontSize: 15, fontWeight: 500,
          letterSpacing: "0.02em",
        }}>CodeCanvas</span>
        <button
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          style={{
            background: hovering ? "#ff6b00" : "transparent",
            border: "1px solid",
            borderColor: hovering ? "#ff6b00" : "rgba(255,255,255,0.15)",
            color: hovering ? "#000" : "rgba(255,255,255,0.5)",
            fontWeight: hovering ? 700 : 400,
            fontSize: 13, padding: "8px 20px",
            borderRadius: 6, cursor: "pointer",
            transition: "all 0.2s ease",
            letterSpacing: "0.04em",
          }}
        >
          Sign in
        </button>
      </nav>

      {/* Center — the single statement */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "flex-start", justifyContent: "center",
        padding: "0 48px", maxWidth: 900, position: "relative", zIndex: 5,
      }}>

        {/* Super-minimal badge */}
        <div style={{
          fontSize: 11, color: "#ff6b00", letterSpacing: "0.18em", fontWeight: 500,
          marginBottom: 32, opacity: 0.8,
        }}>
          COLLABORATIVE · CODING · CANVAS
        </div>

        {/* The statement */}
        <h1 style={{
          margin: 0,
          fontSize: "clamp(52px, 7vw, 88px)",
          fontWeight: 800,
          lineHeight: 1.0,
          letterSpacing: "-0.04em",
          color: "#fff",
        }}>
          Code together.{"\n"}
          <span style={{ color: "rgba(255,255,255,0.2)" }}>
            Ship faster.
          </span>
        </h1>

        {/* Invisible-until-hover CTA region */}
        <div style={{
          marginTop: 56,
          display: "flex", gap: 16, alignItems: "center",
        }}>
          <button style={{
            background: "#ff6b00",
            border: "none",
            color: "#000",
            fontWeight: 700,
            fontSize: 15,
            padding: "14px 32px",
            borderRadius: 8,
            cursor: "pointer",
            letterSpacing: "-0.01em",
          }}>
            Enter the grid
          </button>
          <button style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.25)",
            fontWeight: 400,
            fontSize: 15,
            padding: "14px 0",
            cursor: "pointer",
            letterSpacing: "-0.01em",
          }}>
            See how it works →
          </button>
        </div>

        {/* Micro-stats — only the numbers */}
        <div style={{
          marginTop: 80,
          display: "flex", gap: 48,
        }}>
          {[
            { num: "40k+", label: "developers" },
            { num: "2.1M", label: "canvases created" },
            { num: "<100ms", label: "sync latency" },
          ].map(({ num, label }) => (
            <div key={label}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em" }}>{num}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 4, letterSpacing: "0.04em" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Single decorative line */}
      <div style={{
        position: "absolute", right: 0, top: "15%", bottom: "15%",
        width: 1,
        background: "linear-gradient(to bottom, transparent, rgba(255,107,0,0.3) 40%, rgba(255,107,0,0.3) 60%, transparent)",
        zIndex: 2,
      }} />

      {/* Right column — appearing like a ghost */}
      <div style={{
        position: "absolute", right: 48, top: "50%", transform: "translateY(-50%)",
        zIndex: 5, display: "flex", flexDirection: "column", gap: 20,
        opacity: 0.25,
      }}>
        {["AI Pairing", "Live Presence", "Edge Builds", "Git Built-in"].map((f, i) => (
          <div key={i} style={{
            fontSize: 12, color: "#fff", fontWeight: 500,
            letterSpacing: "0.06em", textAlign: "right",
          }}>
            {f}
          </div>
        ))}
      </div>

      {/* Bottom rule */}
      <div style={{
        position: "relative", zIndex: 5,
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "24px 48px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>
          © 2026 CodeCanvas
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#28c840", display: "inline-block" }} />
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>All systems operational</span>
        </div>
      </div>
    </div>
  );
}
