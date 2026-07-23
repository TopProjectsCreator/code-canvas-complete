import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, X, File } from 'lucide-react'
import { formatFileSize, isImageFile } from '@/lib/chat/chatStorage'
import { truncateFileName } from '@/lib/chat/chatHelpers'

interface FilePreview {
  file: File
  preview?: string
}

interface FileUploadProps {
  files: FilePreview[]
  onAdd: (files: FileList) => void
  onRemove: (index: number) => void
  disabled?: boolean
}

export function FileUpload({ files, onAdd, onRemove, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAdd(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => (
            <div key={`${f.file.name}-${f.file.size}`} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs max-w-[200px]">
              {isImageFile(f.file.type) && f.preview ? (
                <img src={f.preview} alt="" className="w-5 h-5 rounded object-cover" />
              ) : (
                <File className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate text-muted-foreground">{truncateFileName(f.file.name)}</span>
              <span className="text-[10px] text-muted-foreground/60">{formatFileSize(f.file.size)}</span>
              <button onClick={() => onRemove(i)} className="ml-0.5 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
