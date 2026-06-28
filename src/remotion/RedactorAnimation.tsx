import { AbsoluteFill, useCurrentFrame, interpolate, spring, Easing } from "remotion";

const FPS = 30;

// ── Color palette ────────────────────────────────────────────
const BG = "#0a0a0f";
const SURFACE2 = "#1c1c2e";
const ACCENT = "#00e599";
const ACCENT_GLOW = "rgba(0, 229, 153, 0.15)";
const BLUE = "#3b82f6";
const RED = "#ef4444";
const RED_GLOW = "rgba(239, 68, 68, 0.15)";
const TEXT = "#ffffff";
const MUTED = "#8888aa";
const CARD_BG = "#1a1a2e";
const CARD_BORDER = "#2a2a4e";

// ── Helpers ──────────────────────────────────────────────────

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

// ── Components ───────────────────────────────────────────────

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
  const mx = x1 + (x2 - x1) * progress;
  const my = y1 + (y2 - y1) * progress;

  // Compute angle
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
      {/* Arrowhead */}
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

// ── Scenes ───────────────────────────────────────────────────

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
      {/* Background grid */}
      <DotGrid frame={frame} />

      {/* Logo */}
      <div
        style={{
          width: 120 * logoScale,
          height: 120 * logoScale,
          borderRadius: 24,
          background: `radial-gradient(circle, ${ACCENT}30, ${ACCENT}05)`,
          border: `3px solid ${ACCENT}`,
          boxShadow: `0 0 ${40 + glow * 30}px ${ACCENT_GLOW}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: titleFade,
          marginBottom: 30,
        }}
      >
        <Img
          src={staticFile("/redactor-logo.png")}
          style={{
            width: 64 * logoScale,
            height: 64 * logoScale,
          }}
        />
      </div>

      {/* Title */}
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
        Redactor
      </h1>

      {/* Subtitle */}
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
        Image PII Redaction
      </p>

      {/* Feature badges */}
      {[["OCR-Powered", 160], ["Pixel-Level", 260], ["Zero Data Leakage", 360]].map(
        ([label, delay], i) => {
          const badgeFade = fadeIn(frame, 15, delay as number);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 660,
                left: 500 + i * 340,
                opacity: badgeFade,
                padding: "12px 28px",
                borderRadius: 24,
                background: `${ACCENT}15`,
                border: `1px solid ${ACCENT}30`,
                color: ACCENT,
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

// ── Data flow scene ──────────────────────────────────────────

function cardDigits(): string {
  return "4111 1111 1111 1111";
}

function DataFlowScene({ frame }: { frame: number }) {
  const base = 5 * FPS;
  const f = frame - base;

  return (
    <AbsoluteFill style={{ background: BG }}>
      <DotGrid frame={frame} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 40, left: 0, width: "100%",
        textAlign: "center", opacity: fadeIn(f, 15, 0),
      }}>
        <span style={{ color: MUTED, fontSize: 18, fontFamily: "monospace", letterSpacing: 4, textTransform: "uppercase" }}>
          The Problem
        </span>
        <h2 style={{ color: TEXT, fontSize: 48, fontWeight: 700, fontFamily: "system-ui", margin: "12px 0 0" }}>
          Images contain sensitive data
        </h2>
      </div>

      {/* User App */}
      <StepBox
        label="Your App"
        sublabel="sends image with PII"
        x={80}
        y={320}
        w={300}
        h={130}
        color={BLUE}
        frame={f}
        delay={10}
        pulse
      />

      {/* Arrow 1 */}
      <Arrow x1={380} y1={385} x2={640} y2={385} frame={f} delay={30} color={RED} />
      <ArrowLabel text="API Request (OpenAI format)" x={430} y={360} frame={f} delay={40} />

      {/* Redactor Proxy */}
      <StepBox
        label="Redactor Proxy"
        sublabel="intercepts & inspects"
        x={660}
        y={300}
        w={320}
        h={150}
        color={ACCENT}
        frame={f}
        delay={45}
        pulse
      />

      {/* Arrow 2 */}
      <Arrow x1={980} y1={375} x2={1180} y2={375} frame={f} delay={65} />
      <ArrowLabel text="Forward after redaction" x={1030} y={350} frame={f} delay={75} />

      {/* LLM */}
      <StepBox
        label="AI Provider"
        sublabel="receives clean image"
        x={1200}
        y={320}
        w={300}
        h={130}
        color={BLUE}
        frame={f}
        delay={80}
      />

      {/* Warning callout */}
      <div
        style={{
          position: "absolute",
          top: 540,
          left: "50%",
          marginLeft: -300,
          width: 600,
          opacity: fadeIn(f, 20, 35),
          padding: "20px 28px",
          borderRadius: 12,
          background: RED_GLOW,
          border: `1px solid ${RED}40`,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span style={{ fontSize: 32 }}>&#9888;&#65039;</span>
        <span style={{ color: RED, fontSize: 18, fontFamily: "system-ui", lineHeight: 1.5 }}>
          Credit card numbers, SSNs, emails, API keys in images are sent to third-party AI providers
        </span>
      </div>
    </AbsoluteFill>
  );
}

// ── OCR Scene ────────────────────────────────────────────────

function OCRScene({ frame }: { frame: number }) {
  const base = 12 * FPS;
  const f = frame - base;

  // Camera icon scanning across the image
  const scanY = interpolate(f, [0, 60], [180, 560], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });

  // OCR text appearing
  const ocrText = typewriter(
    "Card Number: 4111 1111 1111 1111\nExpiry: 12/28\nCVV: 123",
    f, 50, 3,
  );

  // Highlight animation for card number
  const highlightFade = interpolate(
    Math.max(0, f - 65),
    [0, 5, 15, 20],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ background: BG }}>
      <DotGrid frame={frame} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 40, left: 0, width: "100%",
        textAlign: "center", opacity: fadeIn(f, 15, 0),
      }}>
        <span style={{ color: MUTED, fontSize: 18, fontFamily: "monospace", letterSpacing: 4, textTransform: "uppercase" }}>
          Step 1
        </span>
        <h2 style={{ color: TEXT, fontSize: 48, fontWeight: 700, fontFamily: "system-ui", margin: "12px 0 0" }}>
          OCR Text Detection
        </h2>
      </div>

      {/* "Image" card */}
      <div
        style={{
          position: "absolute",
          left: 100, top: 150,
          width: 500, height: 440,
          borderRadius: 12,
          background: "linear-gradient(135deg, #1a1a3e, #0d0d20)",
          border: `2px solid ${BLUE}30`,
          opacity: fadeIn(f, 15, 10),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Simulated credit card image */}
        <div
          style={{
            width: 380, height: 240,
            borderRadius: 10,
            background: "linear-gradient(135deg, #1e3a5f, #2a4a7a)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: 24,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          {/* Card number text visible in image */}
          <span
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: 28,
              fontFamily: "monospace",
              letterSpacing: 4,
              marginBottom: 12,
            }}
          >
            {cardDigits()}
          </span>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "monospace" }}>12/28</span>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "monospace" }}>***</span>
          </div>
        </div>

        {/* Badge */}
        <div
          style={{
            marginTop: 20,
            padding: "6px 16px",
            borderRadius: 8,
            background: `${BLUE}20`,
            color: BLUE,
            fontSize: 14,
            fontFamily: "monospace",
          }}
        >
          Input Image (base64 PNG)
        </div>
      </div>

      {/* Scanning line */}
      <div
        style={{
          position: "absolute",
          left: 100, width: 500,
          top: scanY,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
          boxShadow: `0 0 16px ${ACCENT}`,
          opacity: fadeIn(f, 10, 5) * (scanY < 620 ? 1 : 0),
        }}
      />

      {/* OCR engine box */}
      <StepBox
        label="Tesseract.js OCR (Wasm)"
        sublabel="100% local processing"
        x={700}
        y={160}
        w={340}
        h={110}
        color={ACCENT}
        frame={f}
        delay={15}
        pulse
      />

      {/* Extracted text panel */}
      <div
        style={{
          position: "absolute",
          left: 700, top: 300,
          width: 520, height: 260,
          borderRadius: 12,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          opacity: fadeIn(f, 15, 35),
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ color: MUTED, fontSize: 14, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
            OCR Extracted Text
          </span>
          <span style={{ color: ACCENT, fontSize: 13, fontFamily: "monospace" }}>
            confidence 98%
          </span>
        </div>

        {/* Animated OCR text */}
        <pre
          style={{
            color: TEXT,
            fontSize: 20,
            fontFamily: "monospace",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {ocrText}
        </pre>

        {/* Highlight card number */}
        {highlightFade > 0 && (
          <div
            style={{
              position: "absolute",
              left: 32,
              top: 76,
              height: 28,
              width: 460,
              borderRadius: 4,
              background: `${RED}30`,
              border: `1px solid ${RED}50`,
              opacity: highlightFade,
            }}
          />
        )}
      </div>

      {/* PII found callout */}
      <div
        style={{
          position: "absolute",
          left: 700, top: 590,
          opacity: fadeIn(f, 15, 70),
          padding: "16px 24px",
          borderRadius: 8,
          background: RED_GLOW,
          border: `1px solid ${RED}40`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ color: RED, fontSize: 24 }}>&#128680;</span>
        <span style={{ color: RED, fontSize: 18, fontFamily: "system-ui", fontWeight: 600 }}>
          PII Detected: Credit Card Number
        </span>
      </div>
    </AbsoluteFill>
  );
}

// ── Redaction scene ──────────────────────────────────────────

function RedactionScene({ frame }: { frame: number }) {
  const base = 19 * FPS;
  const f = frame - base;

  // Pixelation animation
  const pixelProgress = interpolate(
    Math.max(0, f - 25),
    [0, 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease) },
  );

  // Token text appearing
  const tokenOpacity = fadeIn(f, 10, 55);

  // Token text typing
  const tokenText = typewriter("[CARD_1]", f, 55, 4);

  return (
    <AbsoluteFill style={{ background: BG }}>
      <DotGrid frame={frame} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 40, left: 0, width: "100%",
        textAlign: "center", opacity: fadeIn(f, 15, 0),
      }}>
        <span style={{ color: MUTED, fontSize: 18, fontFamily: "monospace", letterSpacing: 4, textTransform: "uppercase" }}>
          Step 2
        </span>
        <h2 style={{ color: TEXT, fontSize: 48, fontWeight: 700, fontFamily: "system-ui", margin: "12px 0 0" }}>
          Pixel-Level Redaction
        </h2>
      </div>

      {/* Before card */}
      <div
        style={{
          position: "absolute",
          left: 80, top: 150,
          width: 600, height: 400,
          borderRadius: 12,
          background: CARD_BG,
          border: `2px solid ${BLUE}30`,
          opacity: fadeIn(f, 15, 5),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span style={{ color: MUTED, fontSize: 16, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
          Before
        </span>
        {/* Simulated credit card */}
        <div
          style={{
            width: 400, height: 250,
            borderRadius: 12,
            background: "linear-gradient(135deg, #1e3a5f, #2a4a7a)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            position: "relative",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 28, fontFamily: "monospace", letterSpacing: 4, marginBottom: 12 }}>
            {cardDigits()}
          </span>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "monospace" }}>12/28</span>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "monospace" }}>VISA</span>
          </div>
        </div>
      </div>

      {/* Arrow */}
      <Arrow x1={680} y1={350} x2={800} y2={350} frame={f} delay={20} color={ACCENT} />
      <ArrowLabel text="Pixelation + Token" x={710} y={330} frame={f} delay={30} />

      {/* After card */}
      <div
        style={{
          position: "absolute",
          left: 820, top: 150,
          width: 600, height: 400,
          borderRadius: 12,
          background: CARD_BG,
          border: `2px solid ${ACCENT}30`,
          opacity: fadeIn(f, 15, 20),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span style={{ color: MUTED, fontSize: 16, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
          After
        </span>
        {/* Redacted credit card */}
        <div
          style={{
            width: 400, height: 250,
            borderRadius: 12,
            background: "linear-gradient(135deg, #1e3a5f, #2a4a7a)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Pixelated region */}
          <div
            style={{
              position: "absolute",
              left: 28, top: 175,
              height: 36,
              width: 350,
              borderRadius: 4,
              opacity: pixelProgress,
              display: "flex",
              flexWrap: "wrap",
              overflow: "hidden",
            }}
          >
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 10, height: 10,
                  background: i % 3 === 0 ? "#2d2d2d" : i % 3 === 1 ? "#3d3d3d" : "#1d1d1d",
                }}
              />
            ))}
          </div>

          {/* Token overlay */}
          <div
            style={{
              position: "absolute",
              left: 28, top: 180,
              opacity: tokenOpacity,
              width: 350, height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: ACCENT,
                fontSize: 20,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: 2,
                background: `${ACCENT}15`,
                padding: "2px 12px",
                borderRadius: 4,
                border: `1px solid ${ACCENT}40`,
              }}
            >
              {tokenText}
            </span>
          </div>

          {/* Rest of card */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 50 }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "monospace" }}>12/28</span>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "monospace" }}>VISA</span>
          </div>
        </div>
      </div>

      {/* Annotation */}
      <div
        style={{
          position: "absolute",
          left: 820, top: 570,
          width: 600,
          opacity: fadeIn(f, 15, 60),
          padding: "16px 24px",
          borderRadius: 8,
          background: ACCENT_GLOW,
          border: `1px solid ${ACCENT}30`,
          textAlign: "center",
        }}
      >
        <span style={{ color: ACCENT, fontSize: 16, fontFamily: "system-ui" }}>
          Credit card number replaced with <strong>[CARD_1]</strong> &mdash; same token format as text redaction
        </span>
      </div>
    </AbsoluteFill>
  );
}

// ── Video Scene ──────────────────────────────────────────────

function VideoScene({ frame }: { frame: number }) {
  const base = 26 * FPS;
  const f = frame - base;

  // Pipeline step glow animations
  const step = (delay: number, dur = 20): number =>
    interpolate(Math.max(0, f - delay), [0, dur / 2, dur], [0, 1, 0], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.ease,
    });

  // Download progress: two blocks fill in
  const downloadFill = interpolate(Math.max(0, f - 25), [0, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // I-frame extraction: visual separation of I from P/B
  const iframeExtract = fadeIn(f, 15, 35);

  // Pipeline glow on each stage
  const decodeGlow = step(45);
  const ocrGlow = step(55);
  const pixelateGlow = step(65);
  const encodeGlow = step(75);
  const remuxGlow = step(85);

  // Chunked streaming: block pulses
  const chunk1 = fadeIn(f, 8, 90);
  const chunk2 = fadeIn(f, 8, 98);
  const chunk3 = fadeIn(f, 8, 106);

  return (
    <AbsoluteFill style={{ background: BG }}>
      <DotGrid frame={frame} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 30, left: 0, width: "100%",
        textAlign: "center", opacity: fadeIn(f, 15, 0),
      }}>
        <span style={{ color: MUTED, fontSize: 16, fontFamily: "monospace", letterSpacing: 4, textTransform: "uppercase" }}>
          Step 3
        </span>
        <h2 style={{ color: TEXT, fontSize: 40, fontWeight: 700, fontFamily: "system-ui", margin: "6px 0 0" }}>
          Video I-Frame Streaming
        </h2>
      </div>

      {/* ── Left: Provider Fetch ── */}
      <div
        style={{
          position: "absolute", left: 40, top: 130, width: 240,
          opacity: fadeIn(f, 15, 10),
        }}
      >
        <div
          style={{
            borderRadius: 10, border: `2px solid ${BLUE}40`,
            background: `${BLUE}08`, padding: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#127909;</div>
          <div style={{ color: BLUE, fontSize: 15, fontWeight: 700, fontFamily: "system-ui" }}>
            AI Provider
          </div>
          <div style={{ color: MUTED, fontSize: 12, fontFamily: "monospace", marginTop: 4 }}>
            GET /v/&lt;id&gt;.mp4
          </div>
          <div style={{
            marginTop: 8, padding: "4px 10px", borderRadius: 6,
            background: `${BLUE}15`, color: BLUE, fontSize: 11, fontFamily: "monospace",
          }}>
            No auth headers needed
          </div>
        </div>
      </div>

      {/* Arrow: Provider → Proxy */}
      <Arrow x1={280} y1={190} x2={380} y2={190} frame={f} delay={15} color={BLUE} />
      <ArrowLabel text="HTTP Fetch" x={300} y={170} frame={f} delay={20} />

      {/* ── Center: Video Pipeline ── */}
      <div
        style={{
          position: "absolute", left: 390, top: 110, width: 750,
          opacity: fadeIn(f, 15, 20),
        }}
      >
        {/* Pipeline header */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginBottom: 6,
        }}>
          <span style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
            Redactor Proxy — Video Pipeline
          </span>
          <span style={{ color: ACCENT, fontSize: 11, fontFamily: "monospace" }}>
            chunked transfer keeps function alive
          </span>
        </div>

        {/* Pipeline boxes row */}
        <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
          {/* 1. Download */}
          <div style={{
            flex: 1, borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
            background: CARD_BG, padding: 8, textAlign: "center",
            opacity: fadeIn(f, 10, 22),
          }}>
            <div style={{ color: BLUE, fontSize: 13, fontWeight: 700, fontFamily: "system-ui" }}>Download</div>
            <div style={{
              height: 4, borderRadius: 2, marginTop: 6,
              background: SURFACE2, overflow: "hidden",
            }}>
              <div style={{
                width: `${downloadFill * 100}%`, height: "100%",
                background: BLUE, borderRadius: 2,
              }} />
            </div>
            <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>
              progressive stream
            </div>
          </div>

          {/* 2. Demux */}
          <div style={{
            flex: 1, borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
            background: CARD_BG, padding: 8, textAlign: "center",
            opacity: fadeIn(f, 10, 28),
          }}>
            <div style={{ color: BLUE, fontSize: 13, fontWeight: 700, fontFamily: "system-ui" }}>Demux</div>
            <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", marginTop: 6 }}>
              mp4box.js
            </div>
            <div style={{ color: MUTED, fontSize: 9, fontFamily: "monospace" }}>
              separate tracks
            </div>
          </div>

          {/* 3. I-Frame Decode */}
          <div style={{
            flex: 1, borderRadius: 8,
            border: `1px solid ${decodeGlow > 0.5 ? ACCENT : CARD_BORDER}`,
            boxShadow: decodeGlow > 0.5 ? `0 0 12px ${ACCENT}50` : undefined,
            background: decodeGlow > 0.5 ? `${ACCENT}08` : CARD_BG, padding: 8, textAlign: "center",
            opacity: fadeIn(f, 10, 34),
          }}>
            <div style={{
              color: decodeGlow > 0.5 ? ACCENT : TEXT, fontSize: 13,
              fontWeight: 700, fontFamily: "system-ui",
            }}>
              h264 Decode
            </div>
            <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>
              Wasm decoder
            </div>
            <div style={{ color: MUTED, fontSize: 9, fontFamily: "monospace" }}>
              I-frame → RGBA
            </div>
          </div>

          {/* 4. OCR */}
          <div style={{
            flex: 1, borderRadius: 8,
            border: `1px solid ${ocrGlow > 0.5 ? ACCENT : CARD_BORDER}`,
            boxShadow: ocrGlow > 0.5 ? `0 0 12px ${ACCENT}50` : undefined,
            background: ocrGlow > 0.5 ? `${ACCENT}08` : CARD_BG, padding: 8, textAlign: "center",
            opacity: fadeIn(f, 10, 40),
          }}>
            <div style={{
              color: ocrGlow > 0.5 ? ACCENT : TEXT, fontSize: 13,
              fontWeight: 700, fontFamily: "system-ui",
            }}>
              OCR Scan
            </div>
            <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>
              Tesseract.js
            </div>
            <div style={{ color: MUTED, fontSize: 9, fontFamily: "monospace" }}>
              PII detection
            </div>
          </div>

          {/* 5. Pixelate */}
          <div style={{
            flex: 1, borderRadius: 8,
            border: `1px solid ${pixelateGlow > 0.5 ? ACCENT : CARD_BORDER}`,
            boxShadow: pixelateGlow > 0.5 ? `0 0 12px ${ACCENT}50` : undefined,
            background: pixelateGlow > 0.5 ? `${ACCENT}08` : CARD_BG, padding: 8, textAlign: "center",
            opacity: fadeIn(f, 10, 46),
          }}>
            <div style={{
              color: pixelateGlow > 0.5 ? ACCENT : TEXT, fontSize: 13,
              fontWeight: 700, fontFamily: "system-ui",
            }}>
              Pixelate
            </div>
            <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>
              block avg
            </div>
            <div style={{ color: MUTED, fontSize: 9, fontFamily: "monospace" }}>
              + token overlay
            </div>
          </div>

          {/* 6. Re-encode */}
          <div style={{
            flex: 1, borderRadius: 8,
            border: `1px solid ${encodeGlow > 0.5 ? ACCENT : CARD_BORDER}`,
            boxShadow: encodeGlow > 0.5 ? `0 0 12px ${ACCENT}50` : undefined,
            background: encodeGlow > 0.5 ? `${ACCENT}08` : CARD_BG, padding: 8, textAlign: "center",
            opacity: fadeIn(f, 10, 52),
          }}>
            <div style={{
              color: encodeGlow > 0.5 ? ACCENT : TEXT, fontSize: 13,
              fontWeight: 700, fontFamily: "system-ui",
            }}>
              h264 Encode
            </div>
            <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>
              Wasm encoder
            </div>
            <div style={{ color: MUTED, fontSize: 9, fontFamily: "monospace" }}>
              RGBA → I-frame
            </div>
          </div>

          {/* 7. Remux */}
          <div style={{
            flex: 1, borderRadius: 8,
            border: `1px solid ${remuxGlow > 0.5 ? ACCENT : CARD_BORDER}`,
            boxShadow: remuxGlow > 0.5 ? `0 0 12px ${ACCENT}50` : undefined,
            background: remuxGlow > 0.5 ? `${ACCENT}08` : CARD_BG, padding: 8, textAlign: "center",
            opacity: fadeIn(f, 10, 58),
          }}>
            <div style={{
              color: remuxGlow > 0.5 ? ACCENT : TEXT, fontSize: 13,
              fontWeight: 700, fontFamily: "system-ui",
            }}>
              Remux
            </div>
            <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>
              mp4box.js
            </div>
            <div style={{ color: MUTED, fontSize: 9, fontFamily: "monospace" }}>
              I + P/B frames
            </div>
          </div>
        </div>
      </div>

      {/* I-frame extraction visual */}
      <div style={{
        position: "absolute", left: 390, top: 270, width: 750,
        opacity: iframeExtract, display: "flex", gap: 4,
        alignItems: "center", justifyContent: "center",
      }}>
        {/* I-frame block */}
        <div style={{
          width: 80, height: 40, borderRadius: 6,
          background: `${ACCENT}25`, border: `2px solid ${ACCENT}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: ACCENT, fontSize: 11, fontFamily: "monospace", fontWeight: 700,
        }}>
          I-frame
        </div>

        {/* Arrow down */}
        <div style={{
          width: 24, textAlign: "center", color: ACCENT, fontSize: 18,
        }}>
          &#8595;
        </div>

        {/* P-frames blocks */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} style={{
            width: 50, height: 30, borderRadius: 4,
            background: `${BLUE}10`, border: `1px solid ${BLUE}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: MUTED, fontSize: 9, fontFamily: "monospace",
            opacity: 0.5 + 0.5 * Math.sin(i * 0.8 + f * 0.05),
          }}>
            {i % 2 === 0 ? "P" : "B"}
          </div>
        ))}

        {/* Arrow up */}
        <div style={{
          width: 24, textAlign: "center", color: BLUE, fontSize: 18,
        }}>
          &#8593;
        </div>

        {/* Passthrough label */}
        <div style={{
          color: MUTED, fontSize: 10, fontFamily: "monospace",
          writingMode: "vertical-rl", letterSpacing: 1,
        }}>
          pass through
        </div>
      </div>

      {/* I-frame processing detail */}
      <div style={{
        position: "absolute", left: 100, top: 340, width: 1100,
        opacity: fadeIn(f, 15, 45),
        display: "flex", gap: 12, alignItems: "flex-start",
        justifyContent: "center",
      }}>
        {/* Detail boxes */}
        {[
          { label: "Decode", glow: decodeGlow, detail: "h264 NAL → RGBA pixels", delay: 0 },
          { label: "OCR", glow: ocrGlow, detail: "Text detection → PII match", delay: 10 },
          { label: "Pixelate", glow: pixelateGlow, detail: "8×8 block pixelation + token", delay: 20 },
          { label: "Encode", glow: encodeGlow, detail: "RGBA → h264 NAL (Wasm)", delay: 30 },
        ].map((step_, i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 8, padding: "10px 12px",
            border: `1px solid ${step_.glow > 0.5 ? ACCENT : CARD_BORDER}`,
            background: step_.glow > 0.5 ? `${ACCENT}08` : CARD_BG,
            boxShadow: step_.glow > 0.5 ? `0 0 16px ${ACCENT}40` : undefined,
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div style={{
              color: step_.glow > 0.5 ? ACCENT : TEXT, fontSize: 13,
              fontWeight: 700, fontFamily: "system-ui",
            }}>
              {step_.label}
            </div>
            <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace" }}>
              {step_.detail}
            </div>
          </div>
        ))}
      </div>

      {/* P/B frame passthrough explanation */}
      <div style={{
        position: "absolute", left: 100, top: 410,
        opacity: fadeIn(f, 15, 65),
        display: "flex", gap: 20, alignItems: "center",
        padding: "10px 20px", borderRadius: 8,
        background: `${BLUE}08`, border: `1px solid ${BLUE}25`,
        width: 1100,
      }}>
        <span style={{ color: BLUE, fontSize: 22, fontWeight: 700, fontFamily: "system-ui" }}>
          &#9889;
        </span>
        <div>
          <div style={{ color: TEXT, fontSize: 14, fontWeight: 600, fontFamily: "system-ui" }}>
            P/B-frames automatically propagate pixelation
          </div>
          <div style={{ color: MUTED, fontSize: 12, fontFamily: "monospace", marginTop: 2 }}>
            Motion prediction references I-frame macroblocks — only ~1 frame/sec needs OCR, not 30/sec
          </div>
        </div>
      </div>

      {/* ── Arrow: Proxy → Provider ── */}
      <Arrow x1={1140} y1={190} x2={1240} y2={190} frame={f} delay={80} color={ACCENT} />
      <ArrowLabel text="Chunked Streaming" x={1150} y={170} frame={f} delay={85} />

      {/* ── Right: Streaming Response ── */}
      <div
        style={{
          position: "absolute", left: 1250, top: 130, width: 220,
          opacity: fadeIn(f, 15, 80),
        }}
      >
        <div
          style={{
            borderRadius: 10, border: `2px solid ${ACCENT}40`,
            background: `${ACCENT}08`, padding: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#128196;</div>
          <div style={{ color: ACCENT, fontSize: 15, fontWeight: 700, fontFamily: "system-ui" }}>
            Redacted MP4
          </div>

          {/* Chunked transfer blocks */}
          {[{ label: "moov", delay: 90, show: chunk1 },
            { label: "moof+mdat (I-frame)", delay: 98, show: chunk2 },
            { label: "moof+mdat (P-frames)", delay: 106, show: chunk3 },
          ].map((ch, i) => (
            <div key={i} style={{
              marginTop: 6, padding: "3px 8px", borderRadius: 4,
              background: ch.show > 0 ? `${ACCENT}15` : SURFACE2,
              border: `1px solid ${ch.show > 0 ? ACCENT : SURFACE2}`,
              color: ch.show > 0 ? ACCENT : MUTED,
              fontSize: 10, fontFamily: "monospace",
              opacity: ch.show,
            }}>
              {ch.label}
            </div>
          ))}

          <div style={{
            marginTop: 8, padding: "4px 10px", borderRadius: 6,
            background: `${ACCENT}15`, color: ACCENT, fontSize: 11, fontFamily: "monospace",
          }}>
            Transfer-Encoding: chunked
          </div>
        </div>
      </div>

      {/* Bottom key insight */}
      <div style={{
        position: "absolute", bottom: 40, left: "50%", marginLeft: -450, width: 900,
        opacity: fadeIn(f, 20, 95),
        padding: "14px 24px", borderRadius: 10,
        background: ACCENT_GLOW, border: `1px solid ${ACCENT}30`,
        textAlign: "center",
      }}>
        <span style={{ color: ACCENT, fontSize: 16, fontFamily: "system-ui", fontWeight: 600 }}>
          Zero extra wall-clock time &mdash; video processing hides inside provider's download window
        </span>
      </div>
    </AbsoluteFill>
  );
}

// ── Final scene ──────────────────────────────────────────────

function FinalScene({ frame }: { frame: number }) {
  const base = 26 * FPS;
  const f = frame - base;

  const titleFade = fadeIn(f, 15, 5);
  const items: { icon: string; text: string; delay: number }[] = [
    { icon: "\u2705", text: "Zero data leaves your infrastructure", delay: 25 },
    { icon: "\u2705", text: "Same token dedup across images & text", delay: 40 },
    { icon: "\u2705", text: "Supports OpenAI, Anthropic & Gemini", delay: 55 },
    { icon: "\u2705", text: "Configurable per proxy key", delay: 70 },
    { icon: "\u2705", text: "Works with all 14 AI providers", delay: 85 },
  ];

  const glow = glowPulse(frame, 0.025);

  return (
    <AbsoluteFill style={{ background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <DotGrid frame={frame} />

      {/* Logo */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 20,
          background: `radial-gradient(circle, ${ACCENT}30, transparent)`,
          border: `2px solid ${ACCENT}`,
          boxShadow: `0 0 ${30 + glow * 20}px ${ACCENT_GLOW}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: titleFade,
          marginBottom: 24,
        }}
      >
        <Img
          src={staticFile("/redactor-logo.png")}
          style={{ width: 56, height: 56 }}
        />
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
        Image Redaction is Live
      </h1>

      <ul style={{ marginTop: 40, listStyle: "none", padding: 0 }}>
        {items.map((item, i) => {
          const itemFade = fadeIn(f, 15, item.delay);
          return (
            <li
              key={i}
              style={{
                opacity: itemFade,
                color: TEXT,
                fontSize: 24,
                fontFamily: "system-ui",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span style={{ fontSize: 28 }}>{item.icon}</span>
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
        Built with Tesseract.js  &middot;  ImageScript  &middot;  Deno Edge Functions
      </div>
    </AbsoluteFill>
  );
}

// ── Main Composition ─────────────────────────────────────────

export const RedactorAnimation: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* Scene 1: Intro (0-5s) */}
      {frame >= 0 && frame < 5 * FPS && <IntroScene frame={frame} />}

      {/* Scene 2: Data flow (5-12s) */}
      {frame >= 5 * FPS && frame < 12 * FPS && <DataFlowScene frame={frame} />}

      {/* Scene 3: OCR (12-19s) */}
      {frame >= 12 * FPS && frame < 19 * FPS && <OCRScene frame={frame} />}

      {/* Scene 4: Redaction (19-26s) */}
      {frame >= 19 * FPS && frame < 26 * FPS && <RedactionScene frame={frame} />}

      {/* Scene 5: Video I-Frame Streaming (26-33s) */}
      {frame >= 26 * FPS && frame < 33 * FPS && <VideoScene frame={frame} />}

      {/* Scene 6: Final (33-39s) */}
      {frame >= 33 * FPS && frame < 39 * FPS && <FinalScene frame={frame} />}
    </AbsoluteFill>
  );
};
