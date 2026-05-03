export function CodeCanvasLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src="/favicon.svg" alt="CodeCanvas" className="h-12 w-auto object-contain" />
    </div>
  );
}