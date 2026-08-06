import { useParams } from '@/lib/router-compat'
import { ChatProvider } from '@/contexts/ChatContext'
import { ChatLayout } from '@/components/chat/ChatLayout'
import { Seo } from '@/components/Seo'

const ChatPage = () => {
  const { workspaceId, channelId } = useParams<{ workspaceId?: string; channelId?: string }>()

  return (
    <ChatProvider>
      <Seo
        title="Chat | Code Canvas"
        description="Team chat and collaboration — channels, direct messages, threads, and more."
        path="/chat"
      />
      <ChatLayout workspaceId={workspaceId} channelId={channelId} />
    </ChatProvider>
  )
}

export default ChatPage
