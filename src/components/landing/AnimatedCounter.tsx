import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  label: string;
  icon: React.ReactNode;
  glowColor?: string;
}

export function AnimatedCounter({ value, duration = 1800, label, icon, glowColor = 'hsl(var(--primary))' }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (value === 0 || started.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.floor(eased * value));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  // Also update when value changes after animation
  useEffect(() => {
    if (started.current) setDisplay(value);
  }, [value]);

  return (
    <div
      ref={ref}
      className="relative flex flex-col items-center gap-3 p-6 rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm group hover:border-primary/30 transition-all duration-500"
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ boxShadow: `inset 0 0 30px ${glowColor}15, 0 0 40px ${glowColor}08` }}
      />

      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>

      <span className="text-4xl sm:text-5xl font-bold font-mono tracking-tight text-foreground tabular-nums">
        {display.toLocaleString()}
      </span>

      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
        {label}
      </span>

      {/* Scan line effect */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent animate-pulse" />
      </div>
    </div>
  );
}
