import { useEffect, useRef, useState } from "react";

const BOOT_LINES = [
  "CodeCanvas v3.1.0 (linux/amd64)",
  "Initializing workspace kernel...",
  "Loading AI context engine... [claude-4, gpt-4o, gemini-2.5]",
  "Mounting collaboration layer... [1,847 peers connected]",
  "Starting edge build daemon... [23 regions active]",
  "Attaching git index... [ok]",
  "Canvas renderer ready.",
  "",
  "$ _",
];

const FEATURES = [
  { cmd: "codecanvas ai pair --model=claude-4", out: "AI pair programmer ready. Codebase indexed. 1,284 files." },
  { cmd: "codecanvas team join --canvas=main", out: "3 teammates online. Cursors synced. Latency: 47ms." },
  { cmd: "codecanvas deploy --env=production", out: "Build succeeded. Deployed to 23 edge regions in 8.2s." },
  { cmd: "codecanvas git log --oneline -5", out: "a3f2d1c feat: live canvas rewrite\nb8e91aa fix: sync race condition\n..." },
];

function useTypewriter(text: string, speed = 28) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    if (!text) return;
    let i = 0;
    const iv = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return displayed;
}

function useLiveCount(base: number, v: number, ms: number) {
  const [val, setVal] = useState(base);
  useEffect(() => {
    const iv = setInterval(() => setVal(base + Math.floor(Math.random() * v)), ms);
    return () => clearInterval(iv);
  }, [base, v, ms]);
  return val;
}

function Cursor({ visible = true }: { visible?: boolean }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => setOn(x => !x), 530);
    return () => clearInterval(iv);
  }, []);
  if (!visible) return null;
  return <span style={{ display: "inline-block", width: 8, height: 16, background: on ? "#00ff88" : "transparent", verticalAlign: "text-bottom", transition: "background 0.1s" }} />;
}

export function TerminalVerdict() {
  const [bootDone, setBootDone] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [featIdx, setFeatIdx] = useState(0);
  const [showCmd, setShowCmd] = useState(false);
  const [showOut, setShowOut] = useState(false);
  const online = useLiveCount(1847, 18, 2400);
  const deploys = useLiveCount(3241, 12, 3800);
  const latency = useLiveCount(47, 20, 1800);
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      setBootLines(BOOT_LINES.slice(0, i + 1));
      i++;
      if (i >= BOOT_LINES.length) {
        clearInterval(iv);
        setTimeout(() => setBootDone(true), 400);
      }
    }, 140);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!bootDone) return;
    setShowCmd(false); setShowOut(false);
    const t1 = setTimeout(() => setShowCmd(true), 300);
    const t2 = setTimeout(() => setShowOut(true), 1400);
    const t3 = setTimeout(() => {
      setFeatIdx(i => (i + 1) % FEATURES.length);
    }, 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [bootDone, featIdx]);

  const feat = FEATURES[featIdx];
  const typedCmd = useTypewriter(showCmd ? feat.cmd : "", 24);

  return (
    <div style={{
      background: "#0d1117", minHeight: "100vh",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      color: "#e6edf3", position: "relative", display: "flex", flexDirection: "column",
    }}>
      {/* Scanline overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.03,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.5) 2px, rgba(0,255,136,0.5) 3px)",
        backgroundSize: "100% 3px",
      }} />

      {/* Nav — terminal bar */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 42,
        background: "#161b22", borderBottom: "1px solid #21262d",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["#ff5f57", "#febc2e", "#28c840"].map(c => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: "#484f58" }}>codecanvas — bash — 140×48</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 11, color: "#00ff88" }}>● {online.toLocaleString()} online</span>
          <span style={{ fontSize: 11, color: "#484f58" }}>{latency}ms</span>
          <button onClick={() => window.location.href = '/editor'} style={{
            background: "#238636", border: "1px solid #2ea043", color: "#fff",
            fontWeight: 700, fontSize: 11, padding: "5px 14px", borderRadius: 6,
            cursor: "pointer", letterSpacing: "0.02em",
          }}>$ open --free</button>
        </div>
      </nav>

      {/* Main terminal area */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>

        {/* Left: boot / feature terminal */}
        <div ref={termRef} style={{
          padding: "32px 36px", borderRight: "1px solid #21262d",
          position: "relative", zIndex: 5, overflowY: "auto",
        }}>
          {/* ASCII logo */}
          <pre style={{
            color: "#00ff88", fontSize: 10, lineHeight: 1.2, marginBottom: 24,
            fontWeight: 400, letterSpacing: 0,
          }}>{`  ██████╗ ██████╗  ██████╗
 ██╔════╝██╔════╝ ██╔════╝
 ██║     ██║      ██║
 ██╚════╝██╚════╝ ██╚════╝
  ╚═════╝ ╚═════╝  ╚═════╝  CANVAS`}</pre>

          {/* Boot sequence */}
          {bootLines.map((line, i) => (
            <div key={i} style={{
              fontSize: 12, lineHeight: 2, color: line.startsWith("$") ? "#00ff88" : i === 0 ? "#00ff88" : "#8b949e",
            }}>
              {line === "" ? "\u00a0" : (
                <>
                  {!line.startsWith("$") && <span style={{ color: "#484f58" }}>[{String(i).padStart(2, "0")}] </span>}
                  {line}
                  {i === bootLines.length - 1 && !bootDone && <Cursor />}
                </>
              )}
            </div>
          ))}

          {/* Live feature commands */}
          {bootDone && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, lineHeight: 2, color: "#00ff88" }}>
                <span style={{ color: "#484f58" }}>~/codecanvas</span>
                <span style={{ color: "#58a6ff" }}> [main]</span>
                {" "}<span style={{ color: "#00ff88" }}>❯</span>{" "}
                {typedCmd}
                {showCmd && !showOut && <Cursor />}
              </div>
              {showOut && (
                <div style={{ marginTop: 4, paddingLeft: 16, borderLeft: "2px solid #21262d" }}>
                  {feat.out.split("\n").map((line, i) => (
                    <div key={i} style={{ fontSize: 12, lineHeight: 1.9, color: "#8b949e", whiteSpace: "pre" }}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: stats + hero text */}
        <div style={{ padding: "40px 44px", position: "relative", zIndex: 5 }}>
          <div style={{ fontSize: 11, color: "#00ff88", letterSpacing: "0.14em", marginBottom: 32 }}>
            // THE VERDICT
          </div>

          <h1 style={{
            margin: "0 0 20px", fontSize: 48, fontWeight: 700,
            lineHeight: 1.0, letterSpacing: "-0.03em", color: "#e6edf3",
          }}>
            One terminal.<br />
            Every tool.<br />
            <span style={{ color: "#00ff88" }}>Ship anything.</span>
          </h1>

          <p style={{
            margin: "0 0 40px", fontSize: 14, lineHeight: 1.75,
            color: "#8b949e", maxWidth: 400,
          }}>
            IDE + AI + team presence + deploy. In one tab. No config. No yak shaving. Just code.
          </p>

          <div style={{ display: "flex", gap: 12, marginBottom: 48, flexWrap: "wrap" }}>
            <button onClick={() => window.location.href = '/editor'} style={{
              background: "#238636", border: "1px solid #2ea043", color: "#fff",
              fontWeight: 700, fontSize: 14, padding: "12px 28px",
              borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            }}>$ codecanvas start --free</button>
            <button style={{
              background: "none", border: "1px solid #30363d", color: "#8b949e",
              fontWeight: 500, fontSize: 14, padding: "12px 22px",
              borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            }}>man codecanvas</button>
          </div>

          {/* Live stat grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#21262d", border: "1px solid #21262d", borderRadius: 8, overflow: "hidden", marginBottom: 32 }}>
            {[
              { key: "ONLINE_NOW", val: online.toLocaleString(), color: "#00ff88" },
              { key: "DEPLOYS_TODAY", val: deploys.toLocaleString(), color: "#58a6ff" },
              { key: "SYNC_LATENCY", val: `${latency}ms`, color: "#f0883e" },
              { key: "REGIONS_ACTIVE", val: "23", color: "#bc8cff" },
            ].map(({ key, val, color }) => (
              <div key={key} style={{ background: "#0d1117", padding: "18px 20px" }}>
                <div style={{ fontSize: 10, color: "#484f58", letterSpacing: "0.1em", marginBottom: 6 }}>{key}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: "-0.02em" }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Feature index */}
          <div style={{ fontSize: 11, color: "#484f58", letterSpacing: "0.06em", marginBottom: 12 }}>// FEATURES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["AI pair programming", "Live team presence", "Edge deploy pipeline", "Built-in git workflow", "Visual canvas", "Automations engine"].map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#8b949e" }}>
                <span style={{ color: "#238636" }}>✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{
        height: 28, background: "#238636", display: "flex",
        alignItems: "center", paddingLeft: 16, gap: 24,
        position: "relative", zIndex: 10,
      }}>
        {[
          `● branch: main`,
          `↑ ${deploys} deploys`,
          `⚡ ${latency}ms sync`,
          `◎ ${online.toLocaleString()} online`,
        ].map((s, i) => (
          <span key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "inherit" }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

export default TerminalVerdict;
