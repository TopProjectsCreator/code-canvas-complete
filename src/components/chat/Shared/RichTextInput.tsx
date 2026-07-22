import { useRef, useEffect, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'

interface RichTextInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  minRows?: number
  maxRows?: number
  className?: string
}

export function RichTextInput({
  value,
  onChange,
  onSend,
  placeholder = 'Message...',
  disabled,
  minRows = 1,
  maxRows = 10,
  className = '',
}: RichTextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 20
    const maxHeight = maxRows * lineHeight
    const newHeight = Math.min(ta.scrollHeight, maxHeight)
    ta.style.height = `${newHeight}px`
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [maxRows])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) {
        onSend()
      }
    }
  }

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={`min-h-[36px] max-h-[200px] resize-none text-sm py-2 px-3 ${className}`}
      rows={minRows}
    />
  )
}
