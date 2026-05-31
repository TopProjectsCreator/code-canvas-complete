import { useEffect, useState } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Sparkles, Code, Eye, Zap } from "lucide-react";

const features = [
  {
    icon: Code,
    title: "Multi-Language Editor",
    desc: "Write code in 55+ languages with syntax highlighting, autocomplete, and smart suggestions.",
  },
  {
    icon: Eye,
    title: "Live Preview",
    desc: "See your changes instantly with a built-in preview panel. No more switching between tabs.",
  },
  {
    icon: Zap,
    title: "AI-Powered",
    desc: "Generate, explain, and debug code with an intelligent AI assistant at your fingertips.",
  },
];

export const WelcomeSplash = () => {
  const { requestWalkthrough, skip } = useOnboarding();
  const [visible, setVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 2500);
    return () => {
      clearTimeout(t1);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--background)/0.95) 50%, hsl(var(--primary)/0.08) 100%)",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-[0.03]"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-[0.03]"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />

      <div className="absolute top-[15%] left-[10%] w-3 h-3 rounded-sm opacity-20 animate-float" style={{ background: "hsl(var(--primary))" }} />
      <div className="absolute top-[20%] right-[15%] w-4 h-4 rounded-full opacity-20 animate-float-delayed" style={{ background: "hsl(var(--primary))" }} />
      <div className="absolute bottom-[25%] left-[20%] w-2 h-2 rounded-sm opacity-15 animate-float" style={{ animationDelay: "0.5s", background: "hsl(var(--primary))" }} />
      <div className="absolute bottom-[30%] right-[10%] w-3 h-3 rounded-full opacity-20 animate-float-delayed" style={{ background: "hsl(var(--primary))" }} />
      <div className="absolute top-[45%] left-[5%] w-2 h-2 rounded-sm opacity-10 animate-float" style={{ animationDelay: "1s", background: "hsl(var(--primary))" }} />
      <div className="absolute top-[60%] right-[8%] w-3 h-3 rounded-full opacity-15 animate-float-delayed" style={{ background: "hsl(var(--primary))" }} />

      <div
        className={`
          relative z-10 flex flex-col items-center text-center px-6 max-w-2xl mx-auto
          transition-all duration-700 ease-out
          ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
      >
        <div className="mb-6 relative">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center animate-pulse-glow"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.6) 100%)" }}
          >
            <svg viewBox="0 0 32 32" className="w-8 h-8 text-white">
              <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" opacity="0.8" />
              <rect x="18" y="2" width="12" height="12" rx="2" fill="currentColor" opacity="0.6" />
              <rect x="10" y="18" width="12" height="12" rx="2" fill="currentColor" opacity="0.4" />
            </svg>
          </div>
        </div>

        <h1
          className="text-5xl sm:text-6xl font-bold mb-3 tracking-tight"
          style={{ color: "hsl(var(--foreground))" }}
        >
          Welcome to{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.6) 100%)",
            }}
          >
            Code Canvas
          </span>
        </h1>

        <p className="text-lg sm:text-xl mb-10 max-w-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
          Your all-in-one development environment. Write, run, and ship code
          directly from your browser.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-10">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            const isActive = i === activeFeature;
            return (
              <div
                key={i}
                className={`
                  rounded-xl p-5 text-left transition-all duration-500 border
                  ${isActive
                    ? "border-primary/40 shadow-lg scale-[1.02]"
                    : "border-border/50 hover:border-primary/20"
                  }
                `}
                style={{
                  background: isActive
                    ? "hsl(var(--primary)/0.06)"
                    : "hsl(var(--card))",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                  style={{
                    background: isActive
                      ? "hsl(var(--primary)/0.15)"
                      : "hsl(var(--muted))",
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{
                      color: isActive
                        ? "hsl(var(--primary))"
                        : "hsl(var(--muted-foreground))",
                    }}
                  />
                </div>
                <h3
                  className="font-semibold text-sm mb-1"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {feature.desc}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => {
              requestWalkthrough();
            }}
            className="px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)",
              color: "hsl(var(--primary-foreground))",
              boxShadow: "0 4px 20px hsl(var(--primary)/0.3)",
            }}
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Take the Tour
            </span>
          </button>

          <button
            onClick={skip}
            className="px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 hover:opacity-80"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Skip, I&apos;ll explore
          </button>
        </div>

        <p
          className="mt-8 text-xs"
          style={{ color: "hsl(var(--muted-foreground)/0.6)" }}
        >
          A quick 30-second tour &mdash; press Esc to skip anytime
        </p>
      </div>

      <button
        onClick={skip}
        className="absolute top-5 right-5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-accent"
        style={{ color: "hsl(var(--muted-foreground))" }}
      >
        Skip
      </button>
    </div>
  );
};
