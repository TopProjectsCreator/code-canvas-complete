import { Input } from '@/components/ui/input'
import { useMemo } from 'react'

function tryEval(expr: string): { value: number | null; error: string | null } {
  const trimmed = expr.trim()
  if (!trimmed) return { value: null, error: null }

  if (/^[0-9+\-*/.()%^ \t]+$/.test(trimmed)) {
    try {
      const sanitized = trimmed.replace(/\^/g, '**')
      const result = Function(`"use strict"; return (${sanitized})`)()
      if (typeof result === 'number' && isFinite(result)) {
        return { value: result, error: null }
      }
    } catch {
      return { value: null, error: 'Invalid expression' }
    }
  }
  return { value: null, error: null }
}

interface ExpressionInputProps {
  value: string
  onChange: (value: string) => void
  evaluated?: number
  error?: string
}

export function ExpressionInput({ value, onChange, evaluated: propEvaluated, error: propError }: ExpressionInputProps) {
  const local = useMemo(() => tryEval(value), [value])
  const displayError = propError ?? local.error
  const displayValue = propEvaluated ?? local.value

  return (
    <div className="space-y-1">
      <Input
        className={`h-7 text-xs font-mono ${displayError ? 'border-red-500' : displayValue !== null ? 'border-green-500' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="e.g. d1 * 2 + 5"
      />
      {displayError && <p className="text-[10px] text-red-500">{displayError}</p>}
      {displayValue !== null && !displayError && (
        <p className="text-[10px] text-muted-foreground">= {displayValue}</p>
      )}
    </div>
  )
}
