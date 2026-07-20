import { usePresenceTracker } from '@/hooks/usePresenceTracker';

export function PresenceTrackerMount() {
  usePresenceTracker();
  return null;
}
