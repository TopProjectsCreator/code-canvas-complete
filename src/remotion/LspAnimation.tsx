import { AbsoluteFill, useCurrentFrame, interpolate, spring, Easing, Img, staticFile } from "remotion";

const FPS = 30;

const BG = "#0a0a0f";
const SURFACE = "#14141f";
const SURFACE2 = "#1c1c2e";
const ACCENT = "#00e599";
const ACCENT_GLOW = "rgba(0, 229, 153, 0.15)";
const BLUE = "#3b82f6";
const BLUE_GLOW = "rgba(59, 130, 246, 0.15)";
const PURPLE = "#a855f7";
const PURPLE_GLOW = "rgba(168, 85, 247, 0.15)";
const RED = "#ef4444";
const TEXT = "#ffffff";
const MUTED = "#8888aa";
const CARD_BG = "#1a1a2e";
const CARD_BORDER = "#2a2a4e";
const YELLOW = "#eab308";

function fadeIn(frame: number, dur = 15, delay = 0): number {
  return interpolate(frame - delay, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });
}

function fadeOut(frame: number, dur = 15, delay = 0): number {
  return interpolate(frame - delay, [0, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });
}

function slideIn(frame: number, dir: number, dur = 25, delay = 0): number {
  const progress = interpolate(frame - delay, [0, dur], [dir, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.elastic(1)),
  });
  return progress;
}

function glowPulse(frame: number, speed = 0.03): number {
  return 0.5 + 0.5 * Math.sin(frame * speed * Math.PI * 2);
}

function typewriter(text: string, frame: number, delay = 0, charSpeed = 2): string {
  const chars = Math.max(0, Math.floor((frame - delay) / charSpeed));
  return text.slice(0, chars);
}

function StepBox({
  label,
  sublabel,
  x,
  y,
  w,
  h,
  color,
  frame,
  delay,
  pulse = false,
}: {
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  frame: number;
  delay: number;
  pulse?: boolean;
}) {
  const fade = fadeIn(frame, 15, delay);
  const slideY = slideIn(frame, 40, 20, delay);
  const glow = pulse ? glowPulse(frame) : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + slideY,
        width: w,
        height: h,
        opacity: fade,
        borderRadius: 12,
        border: `2px solid ${color}`,
        background: `linear-gradient(135deg, ${color}08, ${color}04)`,
        boxShadow: pulse
          ? `0 0 ${20 + glow * 30}px ${color}40, inset 0 0 ${10 + glow * 20}px ${color}15`
          : `0 0 8px ${color}20`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        transition: "none",
      }}
    >
      <span
        style={{
          color: color,
          fontSize: 22,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: 0.5,
          textShadow: `0 0 12px ${color}40`,
        }}
      >
        {label}
      </span>
      {sublabel && (
        <span style={{ color: MUTED, fontSize: 15, marginTop: 4, fontFamily: "monospace" }}>
          {sublabel}
        </span>
      )}
    </div>
  );
}

function Arrow({ x1, y1, x2, y2, frame, delay, color = ACCENT }: {
  x1: number; y1: number; x2: number; y2: number;
  frame: number; delay: number; color?: string;
}) {
  const progress = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });
  const opacity = fadeIn(frame, 10, delay);
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * progress;

  return (
    <div
      style={{
        position: "absolute",
        left: x1,
        top: y1 - 1.5,
        width: len,
        height: 3,
        opacity,
        transformOrigin: "left center",
        transform: `rotate(${angle}deg)`,
        background: `linear-gradient(90deg, ${color}00, ${color}88, ${color})`,
        borderRadius: 2,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -6,
          top: -4,
          borderLeft: `8px solid ${color}`,
          borderTop: "5px solid transparent",
          borderBottom: "5px solid transparent",
        }}
      />
    </div>
  );
}

function ArrowLabel({ text, x, y, frame, delay }: {
  text: string; x: number; y: number; frame: number; delay: number;
}) {
  const opacity = fadeIn(frame, 10, delay);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        color: MUTED,
        fontSize: 11,
        fontFamily: "monospace",
        letterSpacing: 1,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
}

function DotGrid({ frame }: { frame: number }) {
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < 80; i++) {
    const x = (i % 10) * 210 + 30;
    const y = Math.floor(i / 10) * 120 + 30;
    const opacity = (0.06 + 0.04 * Math.sin(i * 1.7 + frame * 0.02));
    dots.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: ACCENT,
          opacity,
        }}
      />,
    );
  }
  return <>{dots}</>;
}

function IntroScene({ frame }: { frame: number }) {
  const titleFade = fadeIn(frame, 25, 0);
  const subFade = fadeIn(frame, 20, 20);
  const logoScale = spring({
    frame: frame - 5,
    fps: FPS,
    config: { damping: 8, stiffness: 100 },
  });
  const glow = glowPulse(frame, 0.02);

  return (
    <AbsoluteFill style={{ background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <DotGrid frame={frame} />

      <div
        style={{
          width: 120 * logoScale,
          height: 120 * logoScale,
          borderRadius: 24,
          background: `radial-gradient(circle, ${PURPLE}30, ${PURPLE}05)`,
          border: `3px solid ${PURPLE}`,
          boxShadow: `0 0 ${40 + glow * 30}px ${PURPLE_GLOW}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: titleFade,
          marginBottom: 30,
        }}
      >
        <span style={{ fontSize: 48 * logoScale, color: TEXT }}>{`</>`}</span>
      </div>

      <h1
        style={{
          color: TEXT,
          fontSize: 96,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: -1,
          opacity: titleFade,
          margin: 0,
        }}
      >
        Introducing LSP
      </h1>

      <p
        style={{
          color: MUTED,
          fontSize: 32,
          fontFamily: "system-ui, sans-serif",
          opacity: subFade,
          marginTop: 16,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        Language Server Protocol
      </p>

      {[["Autocomplete", 160], ["Hover Info", 260], ["Live Diagnostics", 360], ["Go to Definition", 460]].map(
        ([label, delay], i) => {
          const badgeFade = fadeIn(frame, 15, delay as number);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 660,
                left: 200 + i * 400,
                opacity: badgeFade,
                padding: "12px 28px",
                borderRadius: 24,
                background: `${PURPLE}15`,
                border: `1px solid ${PURPLE}30`,
                color: PURPLE,
                fontSize: 20,
                fontWeight: 600,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {label as string}
            </div>
          );
        },
      )}
    </AbsoluteFill>
  );
}

function ArchScene({ frame }: { frame: number }) {
  const base = 5 * FPS;
  const f = frame - base;

  return (
    <AbsoluteFill style={{ background: BG }}>
      <DotGrid frame={frame} />

      <div style={{
        position: "absolute", top: 40, left: 0, width: "100%",
        textAlign: "center", opacity: fadeIn(f, 15, 0),
      }}>
        <span style={{ color: MUTED, fontSize: 18, fontFamily: "monospace", letterSpacing: 4, textTransform: "uppercase" }}>
          Architecture
        </span>
        <h2 style={{ color: TEXT, fontSize: 48, fontWeight: 700, fontFamily: "system-ui", margin: "12px 0 0" }}>
          LSP Integration Pipeline
        </h2>
      </div>

      <StepBox
        label="CodeMirror 6"
        sublabel="Editor UI"
        x={60}
        y={280}
        w={240}
        h={120}
        color={BLUE}
        frame={f}
        delay={10}
        pulse
      />

      <Arrow x1={300} y1={340} x2={420} y2={340} frame={f} delay={25} color={ACCENT} />
      <ArrowLabel text="JSON-RPC" x={340} y={315} frame={f} delay={30} />

      <StepBox
        label="LSP Client"
        sublabel="Feature Broker"
        x={440}
        y={270}
        w={260}
        h={140}
        color={ACCENT}
        frame={f}
        delay={35}
        pulse
      />

      <Arrow x1={700} y1={340} x2={820} y2={340} frame={f} delay={50} color={ACCENT} />
      <ArrowLabel text="Transport Layer" x={730} y={315} frame={f} delay={55} />

      <StepBox
        label="TypeScript Worker"
        sublabel="In-browser TS Service"
        x={840}
        y={180}
        w={280}
        h={100}
        color={PURPLE}
        frame={f}
        delay={60}
      />

      <StepBox
        label="Replit WebSocket"
        sublabel="14 Language Servers"
        x={840}
        y={300}
        w={280}
        h={100}
        color={PURPLE}
        frame={f}
        delay={70}
      />

      <StepBox
        label="Offline WASM"
        sublabel="CDN Fallback"
        x={840}
        y={420}
        w={280}
        h={100}
        color={PURPLE}
        frame={f}
        delay={80}
      />

      <div
        style={{
          position: "absolute",
          top: 570,
          left: "50%",
          marginLeft: -400,
          width: 800,
          opacity: fadeIn(f, 20, 50),
          padding: "16px 28px",
          borderRadius: 12,
          background: `${ACCENT}10`,
          border: `1px solid ${ACCENT}30`,
          textAlign: "center",
        }}
      >
        <span style={{ color: ACCENT, fontSize: 18, fontFamily: "system-ui", fontWeight: 600 }}>
          JSON-RPC 2.0 protocol &mdash; initialize, didOpen, didChange, publishDiagnostics, completion, hover, definition, references, ...
        </span>
      </div>
    </AbsoluteFill>
  );
}

function FeaturesScene({ frame }: { frame: number }) {
  const base = 11 * FPS;
  const f = frame - base;

  const codeLines = [
    { text: "function greet(name: string) {", color: TEXT, delay: 20 },
    { text: '  return `Hello, ${name}!`;', color: TEXT, delay: 28 },
    { text: "}", color: TEXT, delay: 36 },
    { text: "", color: TEXT, delay: 38 },
    { text: "greet(42);", color: TEXT, delay: 40 },
    { text: "// ^ Error: Argument of type 'number'", color: RED, delay: 48 },
    { text: "//   is not assignable to parameter of type 'string'", color: RED, delay: 52 },
  ];

  return (
    <AbsoluteFill style={{ background: BG }}>
      <DotGrid frame={frame} />

      <div style={{
        position: "absolute", top: 40, left: 0, width: "100%",
        textAlign: "center", opacity: fadeIn(f, 15, 0),
      }}>
        <span style={{ color: MUTED, fontSize: 18, fontFamily: "monospace", letterSpacing: 4, textTransform: "uppercase" }}>
          Editor Features
        </span>
        <h2 style={{ color: TEXT, fontSize: 48, fontWeight: 700, fontFamily: "system-ui", margin: "12px 0 0" }}>
          Smart Code Intelligence
        </h2>
      </div>

      {/* Code editor panel */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 140,
          width: 840,
          height: 460,
          borderRadius: 12,
          background: "#0d0d1a",
          border: `2px solid ${CARD_BORDER}`,
          opacity: fadeIn(f, 15, 8),
          overflow: "hidden",
        }}
      >
        {/* Editor header */}
        <div
          style={{
            padding: "10px 16px",
            background: SURFACE,
            borderBottom: `1px solid ${CARD_BORDER}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: RED }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: YELLOW }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: ACCENT }} />
          <span style={{ color: MUTED, fontSize: 13, fontFamily: "monospace", marginLeft: 12 }}>
            app.tsx
          </span>
          <span style={{ color: ACCENT, fontSize: 11, fontFamily: "monospace", marginLeft: "auto" }}>
            TypeScript
          </span>
        </div>

        {/* Code content */}
        <div style={{ padding: "16px 20px" }}>
          {codeLines.map((line, i) => {
            const lineFade = fadeIn(f, 10, line.delay);
            return (
              <div
                key={i}
                style={{
                  opacity: lineFade,
                  color: line.color,
                  fontSize: 20,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  lineHeight: 1.8,
                  whiteSpace: "pre",
                }}
              >
                <span style={{ color: MUTED, fontSize: 14, marginRight: 24, userSelect: "none", opacity: 0.5 }}>
                  {String(i + 1).padStart(2, " ")}
                </span>
                {line.text}
              </div>
            );
          })}
        </div>

        {/* Autocomplete popup */}
        <div
          style={{
            position: "absolute",
            left: 160,
            top: 210,
            width: 320,
            opacity: fadeIn(f, 12, 60),
            borderRadius: 8,
            background: SURFACE,
            border: `1px solid ${PURPLE}40`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${CARD_BORDER}`, color: MUTED, fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
            Autocomplete
          </div>
          {["greet(name: string): string", "greetings: string[]", "green: string"].map((item, i) => (
            <div
              key={i}
              style={{
                padding: "6px 12px",
                background: i === 0 ? `${PURPLE}20` : "transparent",
                color: i === 0 ? PURPLE : MUTED,
                fontSize: 14,
                fontFamily: "monospace",
              }}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        <div
          style={{
            position: "absolute",
            left: 160,
            top: 150,
            width: 340,
            opacity: fadeIn(f, 12, 75),
            borderRadius: 8,
            background: SURFACE,
            border: `1px solid ${ACCENT}40`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
            padding: 12,
          }}
        >
          <div style={{ color: ACCENT, fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>
            function greet(name: string): string
          </div>
          <div style={{ color: MUTED, fontSize: 12, fontFamily: "monospace", marginTop: 4 }}>
            Returns a greeting string for the given name.
          </div>
        </div>

        {/* Diagnostic squiggle */}
        <div
          style={{
            position: "absolute",
            left: 340,
            top: 392,
            width: 80,
            height: 3,
            opacity: fadeIn(f, 8, 48),
            background: `repeating-linear-gradient(90deg, ${RED}, ${RED} 4px, transparent 4px, transparent 6px)`,
          }}
        />
      </div>

      {/* Feature list */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 150,
          width: 380,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {[
          { label: "Autocomplete", color: PURPLE, delay: 65, icon: "→" },
          { label: "Hover Info", color: BLUE, delay: 75, icon: "→" },
          { label: "Live Diagnostics", color: RED, delay: 85, icon: "→" },
          { label: "Go to Definition", color: ACCENT, delay: 95, icon: "→" },
          { label: "Find References", color: YELLOW, delay: 105, icon: "→" },
          { label: "Signature Help", color: PURPLE, delay: 115, icon: "→" },
          { label: "Code Actions", color: BLUE, delay: 125, icon: "→" },
          { label: "Document Formatting", color: ACCENT, delay: 135, icon: "→" },
        ].map((feat, i) => {
          const featFade = fadeIn(f, 10, feat.delay);
          return (
            <div
              key={i}
              style={{
                opacity: featFade,
                padding: "10px 16px",
                borderRadius: 8,
                background: `${feat.color}08`,
                border: `1px solid ${feat.color}25`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ color: feat.color, fontSize: 16 }}>{feat.icon}</span>
              <span style={{ color: TEXT, fontSize: 16, fontWeight: 600, fontFamily: "system-ui" }}>
                {feat.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function TransportScene({ frame }: { frame: number }) {
  const base = 18 * FPS;
  const f = frame - base;

  return (
    <AbsoluteFill style={{ background: BG }}>
      <DotGrid frame={frame} />

      <div style={{
        position: "absolute", top: 40, left: 0, width: "100%",
        textAlign: "center", opacity: fadeIn(f, 15, 0),
      }}>
        <span style={{ color: MUTED, fontSize: 18, fontFamily: "monospace", letterSpacing: 4, textTransform: "uppercase" }}>
          Transport Layer
        </span>
        <h2 style={{ color: TEXT, fontSize: 48, fontWeight: 700, fontFamily: "system-ui", margin: "12px 0 0" }}>
          Three Modes of Operation
        </h2>
      </div>

      {/* Transport card 1 */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 170,
          width: 540,
          height: 360,
          borderRadius: 16,
          background: CARD_BG,
          border: `2px solid ${ACCENT}40`,
          opacity: fadeIn(f, 15, 10),
          padding: 28,
          display: "flex",
          flexDirection: "column",
          boxShadow: `0 0 30px ${ACCENT}10`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `${ACCENT}20`, display: "flex",
            alignItems: "center", justifyContent: "center",
            border: `1px solid ${ACCENT}40`,
          }}>
            <span style={{ color: ACCENT, fontSize: 24 }}>&#9881;</span>
          </div>
          <div>
            <div style={{ color: ACCENT, fontSize: 24, fontWeight: 700, fontFamily: "system-ui" }}>
              TypeScript Worker
            </div>
            <div style={{ color: MUTED, fontSize: 14, fontFamily: "monospace" }}>
              In-browser language service
            </div>
          </div>
        </div>
        <div style={{
          padding: 12, borderRadius: 8, background: SURFACE2,
          border: `1px solid ${CARD_BORDER}`, marginBottom: 12,
        }}>
          <div style={{ color: ACCENT, fontSize: 14, fontFamily: "monospace" }}>
            $ importScripts("typescript@5.8.3")
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {["Completions", "Diagnostics", "Hover", "Definition", "Formatting"].map((tag) => (
            <div key={tag} style={{
              padding: "3px 10px", borderRadius: 6,
              background: `${ACCENT}12`, color: ACCENT,
              fontSize: 11, fontFamily: "monospace",
            }}>
              {tag}
            </div>
          ))}
        </div>
        <div style={{ color: MUTED, fontSize: 13, fontFamily: "monospace", marginTop: "auto" }}>
          0ms round-trip &middot; Offline capable &middot; Full TS/JS/TSX/JSX
        </div>
      </div>

      {/* Transport card 2 */}
      <div
        style={{
          position: "absolute",
          left: 660,
          top: 170,
          width: 540,
          height: 360,
          borderRadius: 16,
          background: CARD_BG,
          border: `2px solid ${BLUE}40`,
          opacity: fadeIn(f, 15, 20),
          padding: 28,
          display: "flex",
          flexDirection: "column",
          boxShadow: `0 0 30px ${BLUE}10`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `${BLUE}20`, display: "flex",
            alignItems: "center", justifyContent: "center",
            border: `1px solid ${BLUE}40`,
          }}>
            <span style={{ color: BLUE, fontSize: 24 }}>&#127760;</span>
          </div>
          <div>
            <div style={{ color: BLUE, fontSize: 24, fontWeight: 700, fontFamily: "system-ui" }}>
              Replit WebSocket
            </div>
            <div style={{ color: MUTED, fontSize: 14, fontFamily: "monospace" }}>
              Cloud backend servers
            </div>
          </div>
        </div>
        <div style={{
          padding: 12, borderRadius: 8, background: SURFACE2,
          border: `1px solid ${CARD_BORDER}`, marginBottom: 12,
        }}>
          <div style={{ color: BLUE, fontSize: 14, fontFamily: "monospace" }}>
            wss://host/api/lsp/ws?language=...
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {["Python", "CSS", "HTML", "JSON", "Markdown", "SQL", "YAML", "Shell", "XML", "TOML"].map((tag) => (
            <div key={tag} style={{
              padding: "3px 10px", borderRadius: 6,
              background: `${BLUE}12`, color: BLUE,
              fontSize: 11, fontFamily: "monospace",
            }}>
              {tag}
            </div>
          ))}
        </div>
        <div style={{ color: MUTED, fontSize: 13, fontFamily: "monospace", marginTop: "auto" }}>
          14 languages &middot; Auto-reconnect &middot; Exponential backoff
        </div>
      </div>

      {/* Transport card 3 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          marginLeft: -270,
          top: 570,
          width: 540,
          height: 130,
          borderRadius: 16,
          background: CARD_BG,
          border: `2px solid ${PURPLE}40`,
          opacity: fadeIn(f, 15, 30),
          padding: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 30px ${PURPLE}10`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${PURPLE}20`, display: "flex",
            alignItems: "center", justifyContent: "center",
            border: `1px solid ${PURPLE}40`,
          }}>
            <span style={{ color: PURPLE, fontSize: 18 }}>&#9889;</span>
          </div>
          <div>
            <div style={{ color: PURPLE, fontSize: 20, fontWeight: 700, fontFamily: "system-ui" }}>
              Offline WASM Fallback
            </div>
          </div>
        </div>
        <div style={{ color: MUTED, fontSize: 13, fontFamily: "monospace" }}>
          CDN-delivered WASM language servers &middot; Works without internet
        </div>
      </div>
    </AbsoluteFill>
  );
}

function BridgeScene({ frame }: { frame: number }) {
  const base = 24 * FPS;
  const f = frame - base;

  const diagItems = [
    { msg: "Argument of type 'number' is not assignable to parameter of type 'string'", type: "error", delay: 20 },
    { msg: "'unusedVar' is declared but its value is never read", type: "warning", delay: 35 },
    { msg: 'Missing return type on function', type: "info", delay: 50 },
  ];

  return (
    <AbsoluteFill style={{ background: BG }}>
      <DotGrid frame={frame} />

      <div style={{
        position: "absolute", top: 40, left: 0, width: "100%",
        textAlign: "center", opacity: fadeIn(f, 15, 0),
      }}>
        <span style={{ color: MUTED, fontSize: 18, fontFamily: "monospace", letterSpacing: 4, textTransform: "uppercase" }}>
          AI Bridge
        </span>
        <h2 style={{ color: TEXT, fontSize: 48, fontWeight: 700, fontFamily: "system-ui", margin: "12px 0 0" }}>
          Diagnostics → Agent Context
        </h2>
      </div>

      {/* LSP Side */}
      <div
        style={{
          position: "absolute", left: 60, top: 160,
          width: 500, height: 500,
          borderRadius: 16, background: CARD_BG,
          border: `2px solid ${ACCENT}30`,
          opacity: fadeIn(f, 15, 5),
          padding: 24,
        }}
      >
        <div style={{ color: ACCENT, fontSize: 18, fontWeight: 700, fontFamily: "system-ui", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 24 }}>&#128220;</span>
          LSP Diagnostics
        </div>

        {diagItems.map((item, i) => {
          const itemFade = fadeIn(f, 10, item.delay);
          const typeColor = item.type === "error" ? RED : item.type === "warning" ? YELLOW : BLUE;
          return (
            <div
              key={i}
              style={{
                opacity: itemFade,
                padding: "10px 14px",
                borderRadius: 8,
                background: `${typeColor}08`,
                border: `1px solid ${typeColor}25`,
                marginBottom: 10,
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <span style={{
                color: typeColor, fontSize: 11, fontFamily: "monospace",
                fontWeight: 700, textTransform: "uppercase", minWidth: 50,
              }}>
                {item.type}
              </span>
              <span style={{ color: TEXT, fontSize: 13, fontFamily: "monospace", lineHeight: 1.4 }}>
                {item.msg}
              </span>
            </div>
          );
        })}
      </div>

      {/* Arrow */}
      <Arrow x1={560} y1={400} x2={700} y2={400} frame={f} delay={55} color={PURPLE} />
      <ArrowLabel text="aiBridge.ts" x={590} y={375} frame={f} delay={60} />

      {/* AI Side */}
      <div
        style={{
          position: "absolute", left: 720, top: 160,
          width: 500, height: 500,
          borderRadius: 16, background: CARD_BG,
          border: `2px solid ${PURPLE}30`,
          opacity: fadeIn(f, 15, 45),
          padding: 24,
        }}
      >
        <div style={{ color: PURPLE, fontSize: 18, fontWeight: 700, fontFamily: "system-ui", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 24 }}>&#129302;</span>
          AI Agent Context
        </div>

        <div style={{
          padding: 14, borderRadius: 8, background: SURFACE2,
          border: `1px solid ${CARD_BORDER}`,
          fontFamily: "monospace", fontSize: 13, lineHeight: 1.6,
          color: MUTED, whiteSpace: "pre-wrap",
          opacity: fadeIn(f, 15, 55),
        }}>
          <span style={{ color: PURPLE }}>## LSP Diagnostics</span>{"\n"}
          {"\n"}
          <span style={{ color: MUTED }}>The following code issues were detected:</span>{"\n"}
          {"\n"}
          <span style={{ color: RED }}>### app.tsx</span>{"\n"}
          <span style={{ color: RED }}>**1 error(s):**</span>{"\n"}
          <span style={{ color: TEXT }}>- Ln 5:11 — Argument of type...</span>{"\n"}
          {"\n"}
          <span style={{ color: YELLOW }}>**1 warning(s):**</span>{"\n"}
          <span style={{ color: TEXT }}>- Ln 8:7 — 'unusedVar' is...</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute", bottom: 40, left: "50%", marginLeft: -500, width: 1000,
          opacity: fadeIn(f, 20, 70),
          padding: "14px 24px", borderRadius: 10,
          background: ACCENT_GLOW, border: `1px solid ${ACCENT}30`,
          textAlign: "center",
        }}
      >
        <span style={{ color: ACCENT, fontSize: 16, fontFamily: "system-ui", fontWeight: 600 }}>
          AI agent automatically sees file errors &mdash; no need to copy-paste error messages
        </span>
      </div>
    </AbsoluteFill>
  );
}

function FinalScene({ frame }: { frame: number }) {
  const base = 30 * FPS;
  const f = frame - base;

  const titleFade = fadeIn(f, 15, 5);
  const glow = glowPulse(frame, 0.025);

  const items = [
    { icon: "\u2705", text: "CodeMirror 6 integration", delay: 25 },
    { icon: "\u2705", text: "TypeScript Worker (in-browser)", delay: 40 },
    { icon: "\u2705", text: "14 language servers via Replit", delay: 55 },
    { icon: "\u2705", text: "Offline WASM fallback", delay: 70 },
    { icon: "\u2705", text: "AI Bridge — auto-context for agents", delay: 85 },
    { icon: "\u2705", text: "Autocomplete & Hover & Diagnostics", delay: 100 },
    { icon: "\u2705", text: "Go to Definition & Find References", delay: 115 },
  ];

  return (
    <AbsoluteFill style={{ background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <DotGrid frame={frame} />

      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 20,
          background: `radial-gradient(circle, ${PURPLE}30, transparent)`,
          border: `2px solid ${PURPLE}`,
          boxShadow: `0 0 ${30 + glow * 20}px ${PURPLE_GLOW}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: titleFade,
          marginBottom: 24,
        }}
      >
        <span style={{ fontSize: 44, color: TEXT }}>{`</>`}</span>
      </div>

      <h1
        style={{
          color: TEXT,
          fontSize: 64,
          fontWeight: 800,
          fontFamily: "system-ui",
          opacity: titleFade,
          margin: 0,
          textAlign: "center",
        }}
      >
        LSP is Live
      </h1>

      <ul style={{ marginTop: 30, listStyle: "none", padding: 0 }}>
        {items.map((item, i) => {
          const itemFade = fadeIn(f, 15, item.delay);
          return (
            <li
              key={i}
              style={{
                opacity: itemFade,
                color: TEXT,
                fontSize: 22,
                fontFamily: "system-ui",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <span>{item.text}</span>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          position: "absolute",
          bottom: 60,
          opacity: fadeIn(f, 20, 90),
          color: MUTED,
          fontSize: 16,
          fontFamily: "monospace",
          letterSpacing: 1,
        }}
      >
        JSON-RPC 2.0 &middot; TypeScript 5.8 &middot; CodeMirror 6
      </div>
    </AbsoluteFill>
  );
}

export const LspAnimation: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: BG }}>
      {frame >= 0 && frame < 5 * FPS && <IntroScene frame={frame} />}
      {frame >= 5 * FPS && frame < 11 * FPS && <ArchScene frame={frame} />}
      {frame >= 11 * FPS && frame < 18 * FPS && <FeaturesScene frame={frame} />}
      {frame >= 18 * FPS && frame < 24 * FPS && <TransportScene frame={frame} />}
      {frame >= 24 * FPS && frame < 30 * FPS && <BridgeScene frame={frame} />}
      {frame >= 30 * FPS && frame < 36 * FPS && <FinalScene frame={frame} />}
    </AbsoluteFill>
  );
};
