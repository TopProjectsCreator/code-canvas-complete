import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

interface AlertBannerProps {
  type: 'error' | 'warning' | 'info'
  message: string
  onDismiss?: () => void
}

export function AlertBanner({ type, message, onDismiss }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const colors = {
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-b text-xs ${colors[type]}`}>
      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        className="p-0.5 hover:opacity-70"
        onClick={() => { setDismissed(true); onDismiss?.() }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
