import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const MODEL = 'onnx-community/gemma-3-270m-it-ONNX@q4f16';

const mocks = vi.hoisted(() => ({
  offlineInitialize: vi.fn(),
  offlineChat: vi.fn(),
  providerChat: vi.fn(),
}));

vi.mock('@/services/offlineLLM', () => ({
  getOfflineModeEnabled: () => localStorage.getItem('canvas-offline-mode-enabled') === '1',
  getSavedOfflineModel: () => localStorage.getItem('canvas-offline-model') || 'onnx-community/Qwen3.5-0.8B-ONNX',
  offlineLLM: { initialize: mocks.offlineInitialize, chat: mocks.offlineChat },
  setOfflineModeEnabled: (v: boolean) => localStorage.setItem('canvas-offline-mode-enabled', v ? '1' : '0'),
  setSavedOfflineModel: (m: string) => localStorage.setItem('canvas-offline-model', m),
  getChatOnlyMode: () => false,
  setChatOnlyMode: () => {},
  getDownloadedOfflineModels: () => [],
  offlineModelUpdatedEvent: 'canvas-offline-model-updated',
  offlineDownloads: { subscribe: () => () => {} },
  prepareOfflineAudio: vi.fn(),
  prepareOfflineVideoImages: vi.fn(),
  getOfflineThinkingEnabled: () => false,
  setOfflineThinkingEnabled: () => {},
}));

vi.mock('@/integrations/ai/provider', () => ({
  createAIProvider: () => ({
    allowsBYOK: false,
    chat: mocks.providerChat,
    generateImage: vi.fn(),
    generateMusic: vi.fn(),
  }),
}));

vi.mock('@/integrations/auth/provider', () => ({
  // A signed-in session: with the old fall-through bug, the online branch
  // would proceed all the way to the cloud provider call.
  createAuthProvider: () => ({ getSession: async () => ({ session: { access_token: 'test-token' } }) }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import { useAgentChat } from '@/hooks/useAgentChat';

describe('offline routing (no silent cloud fallback)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('canvas-offline-mode-enabled', '1');
    localStorage.setItem('canvas-offline-model', MODEL);
    vi.clearAllMocks();
  });

  it('never calls the cloud provider when the offline model fails to load', async () => {
    mocks.offlineInitialize.mockRejectedValueOnce(new Error('boom-runtime-missing'));
    const { result } = renderHook(() => useAgentChat({}));
    await act(async () => {
      await result.current.sendMessage('Tell me a joke about robots');
    });
    expect(mocks.providerChat).not.toHaveBeenCalled();
    const err = result.current.messages.find(
      m => m.role === 'assistant' && m.content.includes('Offline mode error')
    );
    expect(err).toBeDefined();
    expect(err!.content).toContain('boom-runtime-missing');
    expect(err!.modelSource).toBe('local');
  });

  it('uses the local reply and tags it local when the offline model works', async () => {
    mocks.offlineInitialize.mockResolvedValueOnce(undefined);
    mocks.offlineChat.mockResolvedValueOnce('Local hi');
    const { result } = renderHook(() => useAgentChat({}));
    await act(async () => {
      await result.current.sendMessage('Tell me a joke about robots');
    });
    expect(mocks.providerChat).not.toHaveBeenCalled();
    const last = [...result.current.messages].reverse().find(m => m.role === 'assistant');
    expect(last!.content).toContain('Local hi');
    expect(last!.modelSource).toBe('local');
  });
});
