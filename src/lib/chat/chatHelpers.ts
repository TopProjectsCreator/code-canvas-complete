import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import type { ChatMessage, ChatChannel } from './chatTypes'

export function formatMessageTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  if (isToday(date)) return format(date, 'h:mm a')
  if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a')
  if (date.getFullYear() === new Date().getFullYear()) return format(date, 'MMM d, h:mm a')
  return format(date, 'MMM d, yyyy, h:mm a')
}

export function formatMessageDateSeparator(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMMM d, yyyy')
}

export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return formatDistanceToNow(date, { addSuffix: true })
}

export function getChannelDisplayName(channel: ChatChannel): string {
  if (channel.is_dm) return channel.name
  return '# ' + channel.name
}

export function isSameDay(d1: string, d2: string): boolean {
  if (!d1 || !d2) return false
  const a = new Date(d1)
  const b = new Date(d2)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function shouldShowProfile(msg: ChatMessage, prevMsg: ChatMessage | null): boolean {
  if (!prevMsg) return true
  if (prevMsg.user_id !== msg.user_id) return true
  if (!isSameDay(prevMsg.created_at, msg.created_at)) return true
  const diff = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()
  return diff > 5 * 60 * 1000
}

export function parseMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g)
  if (!matches) return []
  return matches.map(m => m.slice(1))
}

export function highlightMentions(text: string): string {
  return text.replace(/@(\w+)/g, '<span class="text-primary font-medium bg-primary/10 rounded px-0.5">@$1</span>')
}

export function linkifyText(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+)/g
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>')
}

export function formatMessageBody(body: string): string {
  return linkifyText(highlightMentions(body))
}

export function sortChannels(channels: ChatChannel[]): ChatChannel[] {
  return [...channels].sort((a, b) => {
    if (a.is_dm && !b.is_dm) return 1
    if (!a.is_dm && b.is_dm) return -1
    if (a.name === 'general') return -1
    if (b.name === 'general') return 1
    return a.name.localeCompare(b.name)
  })
}

export function truncateFileName(name: string, maxLen = 30): string {
  if (name.length <= maxLen) return name
  const ext = name.lastIndexOf('.')
  if (ext === -1) return name.slice(0, maxLen - 3) + '...'
  const extPart = name.slice(ext)
  const namePart = name.slice(0, ext)
  const remaining = maxLen - extPart.length - 3
  if (remaining <= 0) return name.slice(0, maxLen - 3) + '...'
  return namePart.slice(0, remaining) + '...' + extPart
}

export function getFileIconClass(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'file-image'
  if (mimeType.startsWith('video/')) return 'file-video'
  if (mimeType.startsWith('audio/')) return 'file-audio'
  if (mimeType.includes('pdf')) return 'file-pdf'
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return 'file-archive'
  if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('javascript')) return 'file-text'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'file-spreadsheet'
  return 'file'
}
