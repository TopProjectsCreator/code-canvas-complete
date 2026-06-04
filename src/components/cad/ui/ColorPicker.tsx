import { Button } from '@/components/ui/button'

const SWATCHES = [
  '#94a3b8', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#14b8a6',
  '#78716c', '#1e293b', '#ffffff', '#000000',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {SWATCHES.map(color => (
        <Button
          key={color}
          variant="ghost"
          className="h-6 w-6 rounded-full p-0 border"
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        >
          {value === color && <span className="text-[8px]">✓</span>}
        </Button>
      ))}
    </div>
  )
}
