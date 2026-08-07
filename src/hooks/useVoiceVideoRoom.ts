import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface VoiceVideoPeer {
  userId: string;
  displayName: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface PeerConnection {
  pc: RTCPeerConnection;
  userId: string;
  displayName: string;
}

export function useVoiceVideoRoom(projectId: string | undefined, roomName: string) {
  const { toast } = useToast();
  const [isInRoom, setIsInRoom] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<VoiceVideoPeer[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const displayNameRef = useRef('User');
  const userIdRef = useRef('');
  const roomNameRef = useRef(roomName);
  roomNameRef.current = roomName;
  const audioEnabledRef = useRef(audioEnabled);
  const videoEnabledRef = useRef(videoEnabled);
  const mountedRef = useRef(true);
  const isTogglingRef = useRef(false);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    videoEnabledRef.current = videoEnabled;
  }, [videoEnabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const updatePeersList = useCallback(() => {
    const peerList: VoiceVideoPeer[] = [];
    peerConnectionsRef.current.forEach((pc, userId) => {
      const streams: MediaStream[] = [];
      pc.pc.getReceivers().forEach((receiver) => {
        if (receiver.track && receiver.track.kind === 'audio' && receiver.track.enabled) {
          streams.push(new MediaStream([receiver.track]));
        }
      });
      pc.pc.getReceivers().forEach((receiver) => {
        if (receiver.track && receiver.track.kind === 'video') {
          const existing = streams.find((s) => s.getVideoTracks().length === 0);
          if (existing) {
            existing.addTrack(receiver.track);
          } else {
            streams.push(new MediaStream([receiver.track]));
          }
        }
      });
      const stream = streams.length > 0 ? streams[0] : null;
      peerList.push({
        userId,
        displayName: pc.displayName,
        stream,
        audioEnabled: true,
        videoEnabled: true,
      });
    });
    setPeers(peerList);
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId: string, targetDisplayName: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      const existing = peerConnectionsRef.current.get(targetUserId);
      if (existing) {
        existing.pc.close();
        peerConnectionsRef.current.delete(targetUserId);
      }

      peerConnectionsRef.current.set(targetUserId, { pc, userId: targetUserId, displayName: targetDisplayName });

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { candidate: event.candidate, targetUserId, userId: userIdRef.current },
          });
        }
      };

      pc.ontrack = (_event) => {
        updatePeersList();
      };

      pc.onnegotiationneeded = async () => {
        try {
          if (pc.signalingState !== 'stable') return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'offer',
              payload: { offer, targetUserId, userId: userIdRef.current, displayName: displayNameRef.current },
            });
          }
        } catch { /* peer disconnected before offer completed */ }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peerConnectionsRef.current.delete(targetUserId);
          updatePeersList();
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      return pc;
    },
    [updatePeersList],
  );

  const joinRoom = useCallback(async () => {
    if (!projectId || !roomNameRef.current) return;
    setConnecting(true);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        toast({ title: 'Not signed in', description: 'Sign in to use voice/video rooms.', variant: 'destructive' });
        setConnecting(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      userIdRef.current = user.id;
      displayNameRef.current = profile?.display_name || user.email?.split('@')[0] || 'User';

      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Microphone request timed out')), 10000))
      ]);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const channelName = `webrtc:${projectId}:${roomNameRef.current}`;
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'join' }, async ({ payload }) => {
          try {
            const msg = payload as { userId: string; displayName: string };
            if (msg.userId === userIdRef.current) return;
            createPeerConnection(msg.userId, msg.displayName);
          } catch { /* peer disconnected before offer completed */ }
        })
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          try {
            const msg = payload as { offer: RTCSessionDescriptionInit; userId: string; displayName: string; targetUserId: string };
            if (msg.targetUserId !== userIdRef.current) return;
            const pc = peerConnectionsRef.current.get(msg.userId)?.pc ?? createPeerConnection(msg.userId, msg.displayName);
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'answer',
              payload: { answer, targetUserId: msg.userId, userId: userIdRef.current },
            });
          } catch { /* peer disconnected before answer completed */ }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          try {
            const msg = payload as { answer: RTCSessionDescriptionInit; userId: string; targetUserId: string };
            if (msg.targetUserId !== userIdRef.current) return;
            const pc = peerConnectionsRef.current.get(msg.userId);
            if (pc) {
              await pc.pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
            }
          } catch { /* stale answer, peer likely disconnected */ }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          try {
            const msg = payload as { candidate: RTCIceCandidateInit; userId: string; targetUserId: string };
            if (msg.targetUserId !== userIdRef.current) return;
            const pc = peerConnectionsRef.current.get(msg.userId);
            if (pc) {
              await pc.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
          } catch { /* ICE candidate for disconnected peer */ }
        })
        .on('broadcast', { event: 'leave' }, ({ payload }) => {
          const msg = payload as { userId: string };
          const pc = peerConnectionsRef.current.get(msg.userId);
          if (pc) {
            pc.pc.close();
            peerConnectionsRef.current.delete(msg.userId);
            updatePeersList();
          }
        })
        .on('broadcast', { event: 'mute-state' }, ({ payload }) => {
          const msg = payload as { userId: string; audioEnabled: boolean; videoEnabled: boolean };
          setPeers((prev) => prev.map((p) => (p.userId === msg.userId ? { ...p, audioEnabled: msg.audioEnabled, videoEnabled: msg.videoEnabled } : p)));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'join',
              payload: { userId: userIdRef.current, displayName: displayNameRef.current },
            });
            if (!mountedRef.current) return;
            setIsInRoom(true);
            setConnecting(false);
          }
        });
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        toast({ title: 'Microphone access denied', description: 'Allow microphone access to join voice/video rooms.', variant: 'destructive' });
      } else {
        toast({ title: 'Failed to join room', description: msg, variant: 'destructive' });
      }
      setConnecting(false);
    }
  }, [projectId, createPeerConnection, toast, updatePeersList]);

  const leaveRoom = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'leave',
        payload: { userId: userIdRef.current },
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.pc.close());
    peerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setPeers([]);
    setIsInRoom(false);
    setConnecting(false);
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const enabled = audioTrack.enabled;
        setAudioEnabled(enabled);
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'mute-state',
            payload: { userId: userIdRef.current, audioEnabled: enabled, videoEnabled: videoEnabledRef.current },
          });
        }
      }
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current || isTogglingRef.current) return;
    isTogglingRef.current = true;

    try {
      const willBeEnabled = !videoEnabledRef.current;

      if (willBeEnabled) {
        try {
          const videoStream = await Promise.race([
            navigator.mediaDevices.getUserMedia({ audio: false, video: true }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Camera request timed out')), 10000))
          ]);
          const videoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(videoTrack);
          setVideoEnabled(true);

          peerConnectionsRef.current.forEach((pc) => {
            pc.pc.addTrack(videoTrack, localStreamRef.current!);
          });

          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'mute-state',
              payload: { userId: userIdRef.current, audioEnabled: audioEnabledRef.current, videoEnabled: true },
            });
          }
        } catch {
          toast({ title: 'Camera access denied', description: 'Allow camera access to enable video.', variant: 'destructive' });
        }
      } else {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
          localStreamRef.current.removeTrack(videoTrack);
          setVideoEnabled(false);

          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              pc.pc.removeTrack(sender);
            }
          });

          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'mute-state',
              payload: { userId: userIdRef.current, audioEnabled: audioEnabledRef.current, videoEnabled: false },
            });
          }
        }
      }
    } finally {
      isTogglingRef.current = false;
    }
  }, [toast]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      peerConnectionsRef.current.forEach((pc) => pc.pc.close());
      peerConnectionsRef.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return {
    isInRoom,
    localStream,
    peers,
    audioEnabled,
    videoEnabled,
    connecting,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
  };
}
