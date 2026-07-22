import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useChannels } from '@/hooks/useChannels'
import { useChatMessages } from '@/hooks/useChatMessages'
import { usePresence } from '@/hooks/usePresence'
import { useChatMentions } from '@/hooks/useChatMentions'
import { useChatStore } from '@/contexts/ChatContext'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, Menu } from 'lucide-react'

import { WorkspaceSwitcher } from './Sidebar/WorkspaceSwitcher'
import { ChannelList } from './Sidebar/ChannelList'
import { DirectMessageList } from './Sidebar/DirectMessageList'
import { UserStatusSection } from './Sidebar/UserStatusSection'
import { ChannelHeader } from './MainPanel/ChannelHeader'
import { MessageList } from './MainPanel/MessageList'
import { MessageInput } from './MainPanel/MessageInput'
import { ThreadPanel } from './MainPanel/ThreadPanel'
import { CreateChannelDialog } from './Dialogs/CreateChannelDialog'
import { CreateWorkspaceDialog } from './Dialogs/CreateWorkspaceDialog'
import { WorkspaceSettingsDialog } from './Dialogs/WorkspaceSettingsDialog'
import { ChannelDetailsDialog } from './Dialogs/ChannelDetailsDialog'
import { InvitePeopleDialog } from './Dialogs/InvitePeopleDialog'
import { SetUserStatusDialog } from './Dialogs/SetUserStatusDialog'
import { ChatSearchDialog } from './Dialogs/ChatSearchDialog'
import type { ChatChannel, ChatChannelMember, ProfileBrief, SearchResult } from '@/lib/chat/chatTypes'

interface ChatLayoutProps {
  workspaceId?: string
  channelId?: string
}

export function ChatLayout({ workspaceId, channelId }: ChatLayoutProps) {
  const { user, profile } = useAuth()
  const { workspaces, loading: wsLoading, createWorkspace, updateWorkspace } = useWorkspaces()
  const store = useChatStore()
  const {
    activeWorkspace, setActiveWorkspace,
    activeChannel, setActiveChannel,
    activeThread, setActiveThread,
    sidebarOpen, toggleSidebar,
    threadPanelOpen, setThreadPanelOpen,
    searchOpen, setSearchOpen,
  } = store

  const { channels, dmChannels, loading: chLoading, createChannel, joinChannel, leaveChannel, updateChannel, deleteChannel, fetchMembers } = useChannels(activeWorkspace?.id ?? null)
  const { messages, loading: msgLoading, loadingMore, hasMore, sending, sendMessage, deleteMessage, addReaction, removeReaction, loadMore, updateLastRead } = useChatMessages(activeChannel?.id ?? null)
  const { presenceMap, updateStatus, updateCustomStatus, isOnline } = usePresence(activeWorkspace?.id ?? null)
  const { mentionSuggestions, searchUsers, notifyMentions } = useChatMentions()

  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const [channelDetailsOpen, setChannelDetailsOpen] = useState(false)
  const [invitePeopleOpen, setInvitePeopleOpen] = useState(false)
  const [userStatusOpen, setUserStatusOpen] = useState(false)
  const [channelMembers, setChannelMembers] = useState<(ChatChannelMember & { profile?: ProfileBrief })[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const isAdmin = activeChannel
    ? channelMembers.some(m => m.user_id === user?.id && m.role === 'admin')
    : false

  useEffect(() => {
    if (workspaces.length === 0) return
    if (workspaceId) {
      const ws = workspaces.find(w => w.id === workspaceId)
      if (ws) setActiveWorkspace(ws)
    } else if (!activeWorkspace) {
      setActiveWorkspace(workspaces[0])
    }
  }, [workspaces, workspaceId, activeWorkspace, setActiveWorkspace])

  useEffect(() => {
    if (activeWorkspace && !chLoading && channelId) {
      const all = [...channels, ...dmChannels]
      const found = all.find(c => c.id === channelId)
      if (found) {
        setActiveChannel(found)
        return
      }
    }
    if (activeWorkspace && !chLoading && !channelId) {
      const lastChannel = localStorage.getItem(`chat-last-channel-${activeWorkspace.id}`)
      if (lastChannel) {
        const all = [...channels, ...dmChannels]
        const found = all.find(c => c.id === lastChannel)
        if (found) setActiveChannel(found)
      }
    }
  }, [activeWorkspace, channels, dmChannels, chLoading, channelId, setActiveChannel])

  useEffect(() => {
    if (activeChannel) {
      localStorage.setItem(`chat-last-channel-${activeWorkspace?.id}`, activeChannel.id)
    }
  }, [activeChannel, activeWorkspace])

  const handleSelectChannel = useCallback(async (channel: ChatChannel) => {
    setActiveChannel(channel)
    await updateLastRead()
  }, [setActiveChannel, updateLastRead])

  const handleSend = useCallback(async (text: string, files: File[]) => {
    if (!text.trim() && files.length === 0) return
    const result = await sendMessage({ body: text }, files.length > 0 ? files : undefined)
    if (result.data && activeWorkspace) {
      await notifyMentions(text, activeChannel?.id ?? '', activeWorkspace.id)
    }
  }, [sendMessage, notifyMentions, activeChannel, activeWorkspace])

  const handleReply = useCallback((message: any) => {
    setActiveThread(message)
  }, [setActiveThread])

  const handleLoadChannelMembers = useCallback(async (channelId: string) => {
    const m = await fetchMembers(channelId)
    setChannelMembers(m)
  }, [fetchMembers])

  const handleSearchSelect = useCallback((result: SearchResult) => {
    const targetChannel = [...channels, ...dmChannels].find(c => c.id === result.channel.id)
    if (targetChannel) {
      setActiveChannel(targetChannel)
    }
  }, [channels, dmChannels, setActiveChannel])

  if (wsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">💬</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome to Chat</h1>
          <p className="text-muted-foreground">Create your first workspace to get started</p>
          <CreateWorkspaceDialog
            open={createWorkspaceOpen}
            onOpenChange={setCreateWorkspaceOpen}
            onCreate={createWorkspace}
          />
          <Button onClick={() => setCreateWorkspaceOpen(true)}>Create Workspace</Button>
        </div>
      </div>
    )
  }

  const currentUserPresence = activeWorkspace
    ? presenceMap[user?.id ?? ''] ?? null
    : null

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="flex flex-col w-60 bg-card border-r border-border shrink-0">
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            onSelect={setActiveWorkspace}
            onCreate={() => setCreateWorkspaceOpen(true)}
            onSettings={() => setWorkspaceSettingsOpen(true)}
          />
          <div className="flex-1 overflow-y-auto ide-scrollbar py-2">
            <ChannelList
              channels={channels}
              activeChannelId={activeChannel?.id ?? null}
              onSelect={handleSelectChannel}
              onCreateChannel={() => setCreateChannelOpen(true)}
              unreadCounts={unreadCounts}
            />
            <DirectMessageList
              dmChannels={dmChannels}
              activeChannelId={activeChannel?.id ?? null}
              onSelect={handleSelectChannel}
              onStartDM={() => {}}
              unreadCounts={unreadCounts}
            />
          </div>
          <UserStatusSection
            displayName={profile?.display_name ?? user?.email ?? null}
            avatarUrl={profile?.avatar_url ?? null}
            presence={currentUserPresence}
            onStatusClick={() => setUserStatusOpen(true)}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {!sidebarOpen && (
          <div className="h-12 flex items-center px-4 border-b border-border">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        )}
        {activeChannel ? (
          <>
            <ChannelHeader
              channel={activeChannel}
              memberCount={channelMembers.length}
              members={channelMembers}
              onSearch={() => setSearchOpen(true)}
              onDetails={() => { handleLoadChannelMembers(activeChannel.id); setChannelDetailsOpen(true) }}
            />
            <MessageList
              messages={messages}
              channel={activeChannel}
              loading={msgLoading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onReply={handleReply}
              onDelete={deleteMessage}
              onAddReaction={addReaction}
              onRemoveReaction={removeReaction}
            />
            <MessageInput
              onSend={handleSend}
              sending={sending}
              placeholder={`Message #${activeChannel.name}`}
              mentionSuggestions={mentionSuggestions}
              onMentionSearch={(q) => searchUsers(q, activeChannel.id)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💬</span>
              </div>
              <h2 className="text-xl font-semibold">{activeWorkspace?.name ?? 'Chat'}</h2>
              <p className="text-sm text-muted-foreground mt-1">Select a channel or start a new conversation</p>
            </div>
          </div>
        )}
      </div>

      {threadPanelOpen && activeThread && (
        <ThreadPanel
          parentMessage={activeThread}
          onClose={() => setThreadPanelOpen(false)}
        />
      )}

      <CreateChannelDialog
        open={createChannelOpen}
        onOpenChange={setCreateChannelOpen}
        onCreate={createChannel}
      />
      <CreateWorkspaceDialog
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
        onCreate={createWorkspace}
      />
      <WorkspaceSettingsDialog
        open={workspaceSettingsOpen}
        onOpenChange={setWorkspaceSettingsOpen}
        workspace={activeWorkspace}
        onUpdate={updateWorkspace}
      />
      <ChannelDetailsDialog
        open={channelDetailsOpen}
        onOpenChange={setChannelDetailsOpen}
        channel={activeChannel}
        members={channelMembers}
        onUpdate={updateChannel}
        onLeave={leaveChannel}
        onDelete={deleteChannel}
        isAdmin={isAdmin}
      />
      <InvitePeopleDialog
        open={invitePeopleOpen}
        onOpenChange={setInvitePeopleOpen}
        channelId={activeChannel?.id ?? ''}
        workspaceId={activeWorkspace?.id ?? ''}
        onInvite={joinChannel}
      />
      <SetUserStatusDialog
        open={userStatusOpen}
        onOpenChange={setUserStatusOpen}
        currentStatus={currentUserPresence?.status ?? 'offline'}
        currentEmoji={currentUserPresence?.custom_status_emoji ?? null}
        currentText={currentUserPresence?.custom_status_text ?? null}
        onUpdate={updateCustomStatus}
      />
      <ChatSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        workspaceId={activeWorkspace?.id ?? null}
        onSelectMessage={handleSearchSelect}
      />
    </div>
  )
}
