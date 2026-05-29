import { cn } from "@/lib/utils";

interface DropIndicatorProps {
  parentId: string | null;
  index: number;
  isActive: boolean;
}

export function DropIndicator({ parentId, index, isActive }: DropIndicatorProps) {
  if (!isActive) return null;

  return (
    <div
      data-drop-parent={parentId ?? "root"}
      data-drop-index={index}
      className={cn(
        "h-0.5 rounded-full transition-all duration-150",
        "bg-primary/70",
        "my-0.5",
        isActive ? "opacity-100 scale-y-150" : "opacity-0",
      )}
    />
  );
}
