import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/lib/chat/chatTypes';
import { useChatMessages } from '@/hooks/useChatMessages';
import { ThreadPanel } from '@/components/chat/MainPanel/ThreadPanel';

const mocks = vi.hoisted(() => ({
  realtimeInsertHandler: null as ((payload: { new: Record<string, unknown> }) => void) | null,
  from: vi.fn(),
  profileMaybeSingle: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('@/lib/chat/chatRealtime', () => ({
  subscribeToChannelMessages: (
    _channelId: string,
    onInsert: (payload: { new: Record<string, unknown> }) => void,
  ) => {
    mocks.realtimeInsertHandler = onInsert;
    return { unsubscribe: mocks.unsubscribe };
  },
}));

vi.mock('@/lib/chat/chatHelpers', () => ({
  formatMessageTime: () => 'now',
  formatMessageBody: (body: string) => body,
}));

beforeEach(() => {
  mocks.realtimeInsertHandler = null;
  mocks.unsubscribe.mockClear();
  mocks.profileMaybeSingle.mockReset();
  mocks.profileMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.from.mockReset();
  mocks.from.mockImplementation((table: string) => {
    if (table === 'chat_messages') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      };
    }

    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: mocks.profileMaybeSingle,
          })),
        })),
      };
    }

    return {};
  });
});

describe('chat realtime profile fallback', () => {
  it('keeps new channel messages visible when profile lookup returns no row', async () => {
    const { result } = renderHook(() => useChatMessages('channel-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      mocks.realtimeInsertHandler?.({
        new: {
          id: 'msg-1',
          channel_id: 'channel-1',
          user_id: 'user-missing-profile',
          parent_id: null,
          body: 'hello world',
          body_html: null,
          is_pinned: false,
          is_edited: false,
          created_at: '2026-08-31T00:00:00.000Z',
          updated_at: '2026-08-31T00:00:00.000Z',
        },
      });
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]).toMatchObject({
      id: 'msg-1',
      body: 'hello world',
      profile: undefined,
      reply_count: 0,
    });
  });

  it('keeps new thread replies visible when profile lookup returns no row', async () => {
    const parentMessage: ChatMessage = {
      id: 'parent-1',
      channel_id: 'channel-1',
      user_id: 'user-parent',
      parent_id: null,
      body: 'Parent message',
      body_html: null,
      is_pinned: false,
      is_edited: false,
      created_at: '2026-08-31T00:00:00.000Z',
      updated_at: '2026-08-31T00:00:00.000Z',
      profile: {
        id: 'profile-parent',
        user_id: 'user-parent',
        display_name: 'Parent',
        avatar_url: null,
      },
    };

    render(<ThreadPanel parentMessage={parentMessage} onClose={() => {}} />);

    await waitFor(() => expect(mocks.realtimeInsertHandler).not.toBeNull());

    act(() => {
      mocks.realtimeInsertHandler?.({
        new: {
          id: 'reply-1',
          channel_id: 'channel-1',
          user_id: 'user-missing-profile',
          parent_id: 'parent-1',
          body: 'Thread reply',
          body_html: null,
          is_pinned: false,
          is_edited: false,
          created_at: '2026-08-31T00:01:00.000Z',
          updated_at: '2026-08-31T00:01:00.000Z',
        },
      });
    });

    await waitFor(() => expect(screen.getByText('Thread reply')).toBeInTheDocument());
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
