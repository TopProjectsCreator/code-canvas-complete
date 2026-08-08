import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const handlers: Record<string, (payload: Record<string, unknown>) => Promise<void> | void> = {};
  const send = vi.fn();
  const toast = vi.fn();
  const channel = {
    on: vi.fn((_type: string, opts: { event: string }, handler: (payload: Record<string, unknown>) => Promise<void> | void) => {
      handlers[opts.event] = handler;
      return channel;
    }),
    send,
    subscribe: vi.fn((cb: (status: string) => void) => {
      setTimeout(() => cb('SUBSCRIBED'), 0);
      return channel;
    }),
  };
  const supabase = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
  return { handlers, send, toast, channel, supabase };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks.supabase }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import { useVoiceVideoRoom } from '@/hooks/useVoiceVideoRoom';

function createTrack(kind: 'audio' | 'video') {
  return { kind, enabled: true, stop: vi.fn() };
}

function createStream(tracks: ReturnType<typeof createTrack>[]) {
  const list = [...tracks];
  return {
    list,
    getTracks: () => list,
    getAudioTracks: () => list.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => list.filter((t) => t.kind === 'video'),
    addTrack: (track: ReturnType<typeof createTrack>) => list.push(track),
    removeTrack: (track: ReturnType<typeof createTrack>) => {
      const index = list.indexOf(track);
      if (index >= 0) list.splice(index, 1);
    },
  };
}

interface MockTrack {
  kind: string;
  track: { kind: string };
}

class MockRTCPeerConnection {
  signalingState: RTCSignalingState = 'stable';
  connectionState: RTCPeerConnectionState = 'connected';
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  senders: MockTrack[] = [];
  receivers: { track: { kind: string; enabled: boolean } }[] = [];
  onnegotiationneeded: (() => void) | null = null;
  onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  constructor() {
    rtpcInstances.push(this);
  }

  addTrack(track: { kind: string }, _stream: unknown) {
    this.senders.push({ kind: track.kind, track });
    this.scheduleNegotiation();
  }

  removeTrack(sender: MockTrack) {
    this.senders = this.senders.filter((s) => s !== sender);
    this.scheduleNegotiation();
  }

  getSenders() {
    return this.senders;
  }

  getReceivers() {
    return this.receivers;
  }

  private scheduleNegotiation() {
    setTimeout(() => {
      if (this.signalingState === 'stable' && this.onnegotiationneeded) {
        this.onnegotiationneeded();
      }
    }, 0);
  }

  createOffer() {
    return Promise.resolve({ type: 'offer' as const, sdp: `offer-senders:${this.senders.length}` });
  }

  createAnswer() {
    return Promise.resolve({ type: 'answer' as const, sdp: `answer-senders:${this.senders.length}` });
  }

  setLocalDescription(desc: RTCSessionDescriptionInit) {
    this.localDescription = desc;
    this.signalingState = desc.type === 'offer' ? 'have-local-offer' : 'stable';
    return Promise.resolve();
  }

  setRemoteDescription(desc: RTCSessionDescriptionInit) {
    this.remoteDescription = desc;
    this.signalingState = desc.type === 'offer' ? 'have-remote-offer' : 'stable';
    return Promise.resolve();
  }

  addIceCandidate() {
    return Promise.resolve();
  }

  close() {}
}

let rtpcInstances: MockRTCPeerConnection[] = [];
let getUserMediaCalls = 0;
const getUserMediaMock = vi.fn((_opts: { audio: boolean; video: boolean }) => {
  getUserMediaCalls += 1;
  if (getUserMediaCalls === 1) {
    return Promise.resolve(createStream([createTrack('audio')]));
  }
  return Promise.resolve(createStream([createTrack('video')]));
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  vi.clearAllMocks();
  rtpcInstances = [];
  getUserMediaCalls = 0;

  vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection);
  vi.stubGlobal(
    'MediaStream',
    class {
      tracks: ReturnType<typeof createTrack>[];
      constructor(tracks: ReturnType<typeof createTrack>[]) {
        this.tracks = tracks;
      }
      getTracks() {
        return this.tracks;
      }
    },
  );
  vi.stubGlobal(
    'RTCSessionDescription',
    class {
      type: string;
      sdp?: string;
      constructor(init: { type: string; sdp?: string }) {
        this.type = init.type;
        this.sdp = init.sdp;
      }
    },
  );
  vi.stubGlobal('RTCIceCandidate', class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } });

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: getUserMediaMock },
  });

  mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } } });
  mocks.supabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { display_name: 'Alice' } }),
      }),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useVoiceVideoRoom video renegotiation', () => {
  it('renegotiates the SDP offer when video is toggled on', async () => {
    const { result } = renderHook(() => useVoiceVideoRoom('proj-1', 'room-1'));

    await act(async () => {
      await result.current.joinRoom();
    });
    await act(flush);

    await act(async () => {
      await mocks.handlers['join']?.({ payload: { userId: 'user-b', displayName: 'Bob' } });
    });
    await act(flush);

    let offers = mocks.send.mock.calls.filter(([msg]) => (msg as { event?: string })?.event === 'offer');
    expect(offers).toHaveLength(1);
    expect(offers[0][0]).toMatchObject({
      type: 'broadcast',
      event: 'offer',
      payload: { targetUserId: 'user-b', userId: 'user-a' },
    });
    expect(offers[0][0].payload.offer.sdp).toBe('offer-senders:1');

    await act(async () => {
      await mocks.handlers['answer']?.({
        payload: { answer: { type: 'answer', sdp: 'answer-1' }, userId: 'user-b', targetUserId: 'user-a' },
      });
    });

    await act(async () => {
      await result.current.toggleVideo();
    });
    await act(flush);

    offers = mocks.send.mock.calls.filter(([msg]) => (msg as { event?: string })?.event === 'offer');
    expect(offers).toHaveLength(2);
    expect(offers[1][0].payload.offer.sdp).toBe('offer-senders:2');
    expect(result.current.videoEnabled).toBe(true);
  });

  it('reuses the existing peer connection for renegotiation offers', async () => {
    const { result } = renderHook(() => useVoiceVideoRoom('proj-1', 'room-1'));

    await act(async () => {
      await result.current.joinRoom();
    });
    await act(flush);

    await act(async () => {
      await mocks.handlers['join']?.({ payload: { userId: 'user-b', displayName: 'Bob' } });
    });
    await act(flush);

    await act(async () => {
      await mocks.handlers['answer']?.({
        payload: { answer: { type: 'answer', sdp: 'answer-1' }, userId: 'user-b', targetUserId: 'user-a' },
      });
    });

    await act(async () => {
      await mocks.handlers['offer']?.({
        payload: {
          offer: { type: 'offer', sdp: 'offer-senders:2' },
          userId: 'user-b',
          displayName: 'Bob',
          targetUserId: 'user-a',
        },
      });
    });
    await act(flush);

    const answers = mocks.send.mock.calls.filter(([msg]) => (msg as { event?: string })?.event === 'answer');
    expect(answers).toHaveLength(1);
    expect(answers[0][0]).toMatchObject({
      type: 'broadcast',
      event: 'answer',
      payload: { targetUserId: 'user-b', userId: 'user-a' },
    });
    expect(rtpcInstances).toHaveLength(1);
  });

  it('stops the mic tracks when the component unmounts while the permission prompt is pending', async () => {
    let pendingResolve: ((stream: ReturnType<typeof createStream>) => void) | null = null;
    const pendingStream = createStream([createTrack('audio')]);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(() => new Promise((resolve) => { pendingResolve = resolve as never; })),
      },
    });

    const { result, unmount } = renderHook(() => useVoiceVideoRoom('proj-1', 'room-1'));

    const joinPromise = result.current.joinRoom();
    await act(flush);

    unmount(); // cleanup runs while localStreamRef.current is still null

    // Browser resolves the permission prompt after the component is gone
    await act(async () => {
      pendingResolve?.(pendingStream);
    });
    await act(async () => {
      await joinPromise;
    });

    const stopMock = pendingStream.getTracks()[0].stop as unknown as ReturnType<typeof vi.fn>;
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('stops the camera tracks if the user leaves the room while the camera prompt is pending', async () => {
    // getUserMedia: 1st call (mic) resolves immediately; 2nd call (camera) stays pending
    let cameraResolve: ((stream: ReturnType<typeof createStream>) => void) | null = null;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn((_opts: { audio: boolean; video: boolean }) => {
          if (_opts.video) {
            return new Promise((resolve) => { cameraResolve = resolve as never; });
          }
          return Promise.resolve(createStream([createTrack('audio')]));
        }),
      },
    });

    const { result } = renderHook(() => useVoiceVideoRoom('proj-1', 'room-1'));

    await act(async () => {
      await result.current.joinRoom();
    });
    await act(flush);

    const cameraStream = createStream([createTrack('video')]);
    const togglePromise = result.current.toggleVideo();
    await act(flush);

    // User leaves the room while the camera prompt is still visible
    await act(async () => {
      result.current.leaveRoom();
    });

    // Camera permission resolves after the user has already left
    await act(async () => {
      cameraResolve?.(cameraStream);
    });
    await act(async () => {
      await togglePromise;
    });

    const stopMock = cameraStream.getTracks()[0].stop as unknown as ReturnType<typeof vi.fn>;
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(result.current.videoEnabled).toBe(false);
  });
});
