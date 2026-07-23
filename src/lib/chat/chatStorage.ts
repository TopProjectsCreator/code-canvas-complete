// @ts-nocheck
import { supabase } from '@/integrations/supabase/client'
import type { ChatMessageAttachment } from './chatTypes'

export async function uploadChatAttachment(
  file: File,
  userId: string,
  messageId: string
): Promise<{ storage_path: string } | { error: string }> {
  const path = `${userId}/${messageId}/${file.name}`

  const { error } = await supabase.storage
    .from('chat-attachments')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) return { error: error.message }

  return { storage_path: path }
}

const signedUrlCache = new Map<string, { url: string; expires: number }>()

export async function getChatAttachmentUrl(storagePath: string): Promise<string | null> {
  const cached = signedUrlCache.get(storagePath)
  if (cached && cached.expires > Date.now()) return cached.url

  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .createSignedUrl(storagePath, 3600)

  if (error || !data) return null
  signedUrlCache.set(storagePath, { url: data.signedUrl, expires: Date.now() + 3500 * 1000 })
  return data.signedUrl
}

export async function deleteChatAttachment(storagePath: string): Promise<{ error?: string }> {
  const { error } = await supabase.storage
    .from('chat-attachments')
    .remove([storagePath])

  if (error) return { error: error.message }
  return {}
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function isVideoFile(mimeType: string): boolean {
  return mimeType.startsWith('video/')
}