import logo from "@assets/image_1777776917888.png";

export function CodeCanvasLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src={logo} alt="CodeCanvas" className="h-12 w-auto object-contain" />
    </div>
  );
}