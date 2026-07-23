import { createContext, useContext, type ReactNode } from 'react'
import { create } from 'zustand'
import type { ChatWorkspace, ChatChannel, ChatMessage } from '@/lib/chat/chatTypes'

interface ChatState {
  activeWorkspace: ChatWorkspace | null
  activeChannel: ChatChannel | null
  activeThread: ChatMessage | null
  sidebarOpen: boolean
  threadPanelOpen: boolean
  searchOpen: boolean
  typingUsers: Record<string, { user_id: string; display_name: string; expires_at: number }[]>
}

interface ChatActions {
  setActiveWorkspace: (workspace: ChatWorkspace | null) => void
  setActiveChannel: (channel: ChatChannel | null) => void
  setActiveThread: (message: ChatMessage | null) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setThreadPanelOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setTypingUsers: (channelId: string, users: { user_id: string; display_name: string; expires_at: number }[]) => void
  addTypingUser: (channelId: string, user: { user_id: string; display_name: string; expires_at: number }) => void
  removeTypingUser: (channelId: string, userId: string) => void
}

type ChatStore = ChatState & ChatActions

const defaultState: ChatState = {
  activeWorkspace: null,
  activeChannel: null,
  activeThread: null,
  sidebarOpen: true,
  threadPanelOpen: false,
  searchOpen: false,
  typingUsers: {},
}

const useChatStore = create<ChatStore>((set) => ({
  ...defaultState,

  setActiveWorkspace: (workspace) => set({
    activeWorkspace: workspace,
    activeChannel: null,
    activeThread: null,
  }),

  setActiveChannel: (channel) => set({
    activeChannel: channel,
    activeThread: null,
    threadPanelOpen: false,
  }),

  setActiveThread: (message) => set({
    activeThread: message,
    threadPanelOpen: !!message,
  }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setThreadPanelOpen: (open) => set({
    threadPanelOpen: open,
    ...(open ? {} : { activeThread: null }),
  }),

  setSearchOpen: (open) => set({ searchOpen: open }),

  setTypingUsers: (channelId, users) => set((s) => ({
    typingUsers: { ...s.typingUsers, [channelId]: users },
  })),

  addTypingUser: (channelId, user) => set((s) => {
    const existing = s.typingUsers[channelId] ?? []
    const filtered = existing.filter(u => u.user_id !== user.user_id)
    return {
      typingUsers: { ...s.typingUsers, [channelId]: [...filtered, user] },
    }
  }),

  removeTypingUser: (channelId, userId) => set((s) => {
    const existing = s.typingUsers[channelId] ?? []
    return {
      typingUsers: { ...s.typingUsers, [channelId]: existing.filter(u => u.user_id !== userId) },
    }
  }),
}))

const ChatContext = createContext<typeof useChatStore | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  return (
    <ChatContext.Provider value={useChatStore}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatStoreContext() {
  const store = useContext(ChatContext)
  if (!store) {
    throw new Error('useChatStoreContext must be used within a ChatProvider')
  }
  return store()
}

export { useChatStore }
