import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceMeta {
  user_id: string;
  email?: string;
  display_name?: string;
  online_at?: string;
  path?: string;
}

type Listener = (state: Record<string, PresenceMeta>) => void;

let channel: RealtimeChannel | null = null;
let refCount = 0;
let currentKey: string | null = null;
let currentTrack: PresenceMeta | null = null;
const listeners = new Set<Listener>();

function snapshot(): Record<string, PresenceMeta> {
  if (!channel) return {};
  const state = channel.presenceState<PresenceMeta>();
  const flat: Record<string, PresenceMeta> = {};
  for (const key of Object.keys(state)) {
    const metas = state[key];
    if (metas && metas.length) flat[key] = metas[metas.length - 1];
  }
  return flat;
}

function notify() {
  const s = snapshot();
  listeners.forEach((l) => l(s));
}

function ensureChannel(key: string) {
  if (channel && currentKey === key) return channel;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  currentKey = key;
  const ch = supabase.channel('online-users', {
    config: { presence: { key } },
  });
  ch.on('presence', { event: 'sync' }, notify)
    .on('presence', { event: 'join' }, notify)
    .on('presence', { event: 'leave' }, notify)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && currentTrack) {
        await ch.track(currentTrack);
      }
    });
  channel = ch;
  return ch;
}

export function acquirePresence(key: string, track: PresenceMeta | null): () => void {
  refCount++;
  if (track) currentTrack = track;
  const ch = ensureChannel(key);
  // If already subscribed and we now have track data, push it.
  if (track && ch.state === 'joined') {
    void ch.track(track);
  }
  return () => {
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
      currentKey = null;
      currentTrack = null;
    }
  };
}

export function subscribePresence(cb: Listener): () => void {
  listeners.add(cb);
  cb(snapshot());
  return () => {
    listeners.delete(cb);
  };
}
