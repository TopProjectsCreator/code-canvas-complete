import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { RichTextInput } from '../Shared/RichTextInput'
import { FileUpload } from '../Shared/FileUpload'
import { EmojiPicker } from '../Shared/EmojiPicker'
import { UserMentionList } from '../Shared/UserMention'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import type { ProfileBrief } from '@/lib/chat/chatTypes'

interface FilePreview {
  file: File
  preview?: string
}

interface MessageInputProps {
  onSend: (text: string, files: File[]) => Promise<void> | void
  sending: boolean
  disabled?: boolean
  placeholder?: string
  mentionSuggestions: ProfileBrief[]
  onMentionSearch: (query: string) => void
}

export function MessageInput({
  onSend,
  sending,
  disabled,
  placeholder = 'Message...',
  mentionSuggestions,
  onMentionSearch,
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<FilePreview[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  

  const handleSend = useCallback(async () => {
    if (!text.trim() && files.length === 0) return
    try {
      await onSend(text, files.map(f => f.file))
      setText('')
      setFiles([])
    } catch {
      toast.error('Failed to send message. Please try again.')
    }
  }, [text, files, onSend])

  const handleAddFiles = useCallback((fileList: FileList) => {
    const newFiles: FilePreview[] = Array.from(fileList).map(file => {
      const fp: FilePreview = { file }
      if (file.type.startsWith('image/')) {
        fp.preview = URL.createObjectURL(file)
      }
      return fp
    })
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => {
      const removed = prev[index]
      if (removed?.preview) URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const handleEmojiSelect = useCallback((emoji: string) => {
    setText(prev => prev + emoji)
  }, [])

  const handleTextChange = useCallback((value: string) => {
    setText(value)
    const atMatch = value.match(/@(\w*)$/)
    if (atMatch) {
      setShowMentions(true)
      setMentionIndex(0)
      onMentionSearch(atMatch[1])
    } else {
      setShowMentions(false)
    }
  }, [onMentionSearch])

  const handleMentionSelect = useCallback((user: ProfileBrief) => {
    setText(prev => prev.replace(/@(\w*)$/, `@${user.display_name ?? user.user_id} `))
    setShowMentions(false)
  }, [])

  return (
    <div className="shrink-0 border-t border-border px-4 py-3">
      {files.length > 0 && (
        <FileUpload
          files={files}
          onAdd={handleAddFiles}
          onRemove={handleRemoveFile}
          disabled={sending || disabled}
        />
      )}
      <div className="flex items-end gap-2 relative">
        <FileUpload
          files={[]}
          onAdd={handleAddFiles}
          onRemove={handleRemoveFile}
          disabled={sending || disabled}
        />
        <EmojiPicker onSelect={handleEmojiSelect} />
        <div className="flex-1 relative">
          {showMentions && (
            <UserMentionList
              suggestions={mentionSuggestions}
              onSelect={handleMentionSelect}
              activeIndex={mentionIndex}
              onClose={() => setShowMentions(false)}
            />
          )}
          <RichTextInput
            value={text}
            onChange={handleTextChange}
            onSend={handleSend}
            placeholder={placeholder}
            disabled={sending || disabled}
          />
        </div>
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={(!text.trim() && files.length === 0) || sending || disabled}
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
