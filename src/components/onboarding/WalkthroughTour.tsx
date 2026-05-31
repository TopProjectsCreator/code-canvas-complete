import { useState, useCallback } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  FolderOpen,
  Code,
  Terminal,
  Play,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Compass,
} from "lucide-react";

const steps = [
  {
    icon: Compass,
    title: "Welcome to Code Canvas",
    description:
      "This quick tour will show you around so you can start building right away.",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: FolderOpen,
    title: "File Explorer",
    description:
      "Browse and manage your project files. Create, rename, or delete files and folders — all from the left sidebar.",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: Code,
    title: "Code Editor",
    description:
      "Write code with syntax highlighting, autocomplete, and inline error detection. Supports 55+ languages.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: Terminal,
    title: "Terminal",
    description:
      "Run shell commands, install packages, and execute scripts right inside your browser. No setup needed.",
    color: "from-orange-500 to-amber-600",
  },
  {
    icon: Play,
    title: "Run & Preview",
    description:
      "Hit the Run button to execute your code and see the live preview update instantly as you type.",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Sparkles,
    title: "AI Assistant",
    description:
      "Ask questions, generate code, fix bugs, and get explanations from your AI pair programmer. Always ready to help.",
    color: "from-pink-500 to-rose-600",
  },
];

export const WalkthroughTour = () => {
  const { currentStep, totalSteps, nextStep, prevStep, skip, complete } = useOnboarding();
  const [animateIn, setAnimateIn] = useState(true);
  const step = steps[currentStep];
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;

  const handleNext = useCallback(() => {
    setAnimateIn(false);
    setTimeout(() => {
      nextStep();
      setAnimateIn(true);
    }, 200);
  }, [nextStep]);

  const handlePrev = useCallback(() => {
    setAnimateIn(false);
    setTimeout(() => {
      prevStep();
      setAnimateIn(true);
    }, 200);
  }, [prevStep]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--background)/0.95) 50%, hsl(var(--primary)/0.06) 100%)",
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
        className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full opacity-[0.03]"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full opacity-[0.03]"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
        }}
      />

      <div
        className="absolute top-[15%] left-[10%] w-2 h-2 rounded-sm opacity-20 animate-float"
        style={{ background: "hsl(var(--primary))" }}
      />
      <div
        className="absolute top-[25%] right-[12%] w-3 h-3 rounded-full opacity-20 animate-float-delayed"
        style={{ background: "hsl(var(--primary))" }}
      />
      <div
        className="absolute bottom-[20%] left-[15%] w-2 h-2 rounded-full opacity-15 animate-float"
        style={{ animationDelay: "0.5s", background: "hsl(var(--primary))" }}
      />

      <div
        className={`
          relative z-10 flex flex-col items-center text-center px-6 max-w-lg mx-auto
          transition-all duration-300 ease-out
          ${animateIn ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"}
        `}
      >
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-8 bg-gradient-to-br ${step.color} shadow-lg`}
        >
          <step.icon className="w-9 h-9 text-white" />
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentStep ? "28px" : "6px",
                height: "6px",
                background:
                  i === currentStep
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted-foreground)/0.2)",
              }}
            />
          ))}
        </div>

        <h2
          className="text-2xl sm:text-3xl font-bold mb-3"
          style={{ color: "hsl(var(--foreground))" }}
        >
          {step.title}
        </h2>

        <p
          className="text-base sm:text-lg mb-10 leading-relaxed"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          {step.description}
        </p>

        <div className="flex items-center gap-3">
          {!isFirst && (
            <button
              onClick={handlePrev}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-accent"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}

          {isLast ? (
            <button
              onClick={complete}
              className="px-8 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)",
                color: "hsl(var(--primary-foreground))",
                boxShadow: "0 4px 20px hsl(var(--primary)/0.3)",
              }}
            >
              Got it, let&apos;s go!
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-8 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)",
                color: "hsl(var(--primary-foreground))",
                boxShadow: "0 4px 20px hsl(var(--primary)/0.3)",
              }}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="mt-6 text-xs" style={{ color: "hsl(var(--muted-foreground)/0.5)" }}>
          Step {currentStep + 1} of {totalSteps}
        </p>
      </div>

      <button
        onClick={skip}
        className="absolute top-5 right-5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-accent"
        style={{ color: "hsl(var(--muted-foreground))" }}
      >
        Skip tour
      </button>
    </div>
  );
};
