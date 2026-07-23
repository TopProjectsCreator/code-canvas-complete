import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageActions } from './MessageActions'
import { MessageReactions } from './MessageReactions'
import { formatMessageTime, formatMessageBody, shouldShowProfile } from '@/lib/chat/chatHelpers'
import { isImageFile, isVideoFile, getChatAttachmentUrl } from '@/lib/chat/chatStorage'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { MessageCircle } from 'lucide-react'
import type { ChatMessage } from '@/lib/chat/chatTypes'

interface MessageBubbleProps {
  message: ChatMessage
  prevMessage: ChatMessage | null
  onReply: () => void
  onDelete: () => void
  onAddReaction: (emoji: string) => void
  onRemoveReaction: (emoji: string) => void
}

export function MessageBubble({ message, prevMessage, onReply, onDelete, onAddReaction, onRemoveReaction }: MessageBubbleProps) {
  const { user } = useAuth()
  const showProfile = shouldShowProfile(message, prevMessage)
  const isOwn = user?.id === message.user_id

  return (
    <div className={cn('group relative flex gap-3 px-4 py-0.5 hover:bg-accent/30', showProfile && 'pt-4')}>
      {showProfile ? (
        <>
          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
            <AvatarImage src={message.profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {(message.profile?.display_name ?? '?')[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-semibold text-foreground">
                {message.profile?.display_name ?? 'Unknown'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatMessageTime(message.created_at)}
              </span>
              {message.is_edited && (
                <span className="text-[10px] text-muted-foreground">(edited)</span>
              )}
            </div>
            <MessageBody message={message} />
            <MessageAttachments message={message} />
            <MessageReactions
              reactions={message.reactions ?? []}
              currentUserId={user?.id ?? ''}
              onAddReaction={onAddReaction}
              onRemoveReaction={onRemoveReaction}
            />
            {message.reply_count !== undefined && message.reply_count > 0 && (
              <button
                onClick={onReply}
                className="flex items-center gap-1 mt-1 text-xs text-primary hover:underline cursor-pointer"
              >
                <MessageCircle className="h-3 w-3" />
                {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 min-w-0 ml-11">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] text-muted-foreground invisible group-hover:visible">
              {formatMessageTime(message.created_at)}
            </span>
            {message.is_edited && (
              <span className="text-[10px] text-muted-foreground">(edited)</span>
            )}
          </div>
          <MessageBody message={message} />
          <MessageAttachments message={message} />
          <MessageReactions
            reactions={message.reactions ?? []}
            currentUserId={user?.id ?? ''}
            onAddReaction={onAddReaction}
            onRemoveReaction={onRemoveReaction}
          />
          {message.reply_count !== undefined && message.reply_count > 0 && (
            <button
              onClick={onReply}
              className="flex items-center gap-1 mt-1 text-xs text-primary hover:underline cursor-pointer"
            >
              <MessageCircle className="h-3 w-3" />
              {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      )}
      <MessageActions
        onReply={onReply}
        onReact={() => {}}
        onDelete={isOwn ? onDelete : undefined}
        canDelete={isOwn}
      />
    </div>
  )
}

function MessageBody({ message }: { message: ChatMessage }) {
  const bodyHtml = message.body_html ?? formatMessageBody(message.body)

  return (
    <div
      className="text-sm text-foreground break-words [&_a]:text-primary [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  )
}

function MessageAttachments({ message }: { message: ChatMessage }) {
  const attachments = message.attachments ?? []
  const [urls, setUrls] = useState<Record<string, string | null>>({})

  useEffect(() => {
    for (const att of attachments) {
      if (!urls[att.storage_path]) {
        getChatAttachmentUrl(att.storage_path).then((url) => {
          setUrls(prev => ({ ...prev, [att.storage_path]: url }))
        })
      }
    }
  }, [attachments.length ? attachments.map(a => a.storage_path).join(',') : ''])

  if (attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {attachments.map((att) => {
        const url = urls[att.storage_path]
        if (!url) return null
        if (isImageFile(att.file_type)) {
          return (
            <a key={att.id} href={url} target="_blank" rel="noopener noreferrer" className="max-w-[300px]">
              <img src={url} alt={att.file_name} className="rounded-lg max-h-48 object-cover border border-border" />
            </a>
          )
        }
        if (isVideoFile(att.file_type)) {
          return (
            <video key={att.id} src={url} controls className="rounded-lg max-h-48 max-w-[300px] border border-border" />
          )
        }
        return (
          <a
            key={att.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-lg">
              📎
            </div>
            <div>
              <p className="font-medium">{att.file_name}</p>
              <p className="text-[10px]">{att.file_type}</p>
            </div>
          </a>
        )
      })}
    </div>
  )
}
