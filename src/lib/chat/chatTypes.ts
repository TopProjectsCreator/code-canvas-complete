export interface ChatWorkspace {
  id: string
  team_id: string | null
  name: string
  description: string | null
  icon_url: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ChatChannel {
  id: string
  workspace_id: string
  name: string
  topic: string | null
  description: string | null
  is_private: boolean
  is_dm: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ChatChannelMember {
  id: string
  channel_id: string
  user_id: string
  role: 'member' | 'admin'
  last_read_at: string | null
  notification_prefs: { all: boolean } | { mentions_only: boolean } | { muted: boolean }
  joined_at: string
  profile?: ProfileBrief
}

export interface ProfileBrief {
  id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
}

export interface ChatMessage {
  id: string
  channel_id: string
  user_id: string
  parent_id: string | null
  body: string
  body_html: string | null
  is_pinned: boolean
  is_edited: boolean
  created_at: string
  updated_at: string
  profile?: ProfileBrief
  reactions?: ChatMessageReaction[]
  attachments?: ChatMessageAttachment[]
  reply_count?: number
}

export interface ChatMessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface ChatMessageAttachment {
  id: string
  message_id: string
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  created_at: string
}

export interface ChatUserPresence {
  user_id: string
  workspace_id: string
  status: 'online' | 'away' | 'busy' | 'offline'
  custom_status_text: string | null
  custom_status_emoji: string | null
  last_seen_at: string
}

export interface NewMessage {
  channel_id: string
  body: string
  body_html?: string | null
  parent_id?: string | null
}

export interface TypingUser {
  user_id: string
  display_name: string
  expires_at: number
}
