import { Input } from '@/components/ui/input'

interface NumericInputProps {
  value: number
  onChange: (value: number) => void
  unit?: string
  className?: string
  min?: number
  max?: number
  step?: number
}

export function NumericInput({ value, onChange, unit, className = '', min, max, step }: NumericInputProps) {
  return (
    <div className="relative">
      <Input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className={`h-7 text-xs pr-6 ${className}`}
      />
      {unit && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {unit}
        </span>
      )}
    </div>
  )
}
