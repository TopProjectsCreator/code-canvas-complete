import logo from "@assets/image_1777776859272.png";

export function CodeCanvasLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src={logo} alt="CodeCanvas" className="h-9 w-9 rounded-lg object-cover shadow-lg shadow-primary/25" />
      <span className="font-mono text-lg font-semibold tracking-tight">CodeCanvas</span>
    </div>
  );
}