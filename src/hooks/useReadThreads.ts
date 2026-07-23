import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'threads:readMap:v1';

type ReadMap = Record<string, string>; // threadId -> ISO timestamp of last read

function loadMap(): ReadMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReadMap) : {};
  } catch {
    return {};
  }
}

function saveMap(map: ReadMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function useReadThreads() {
  const [readMap, setReadMap] = useState<ReadMap>(() => loadMap());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setReadMap(loadMap());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isUnread = useCallback(
    (threadId: string, updatedAt: string) => {
      const last = readMap[threadId];
      if (!last) return true;
      return new Date(updatedAt).getTime() > new Date(last).getTime();
    },
    [readMap],
  );

  const markRead = useCallback((threadId: string, updatedAt?: string) => {
    setReadMap((prev) => {
      const stamp = updatedAt ?? new Date().toISOString();
      if (prev[threadId] === stamp) return prev;
      const next = { ...prev, [threadId]: stamp };
      saveMap(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback((threads: { id: string; updated_at: string }[]) => {
    setReadMap((prev) => {
      const next = { ...prev };
      const now = new Date().toISOString();
      for (const t of threads) {
        next[t.id] = t.updated_at || now;
      }
      saveMap(next);
      return next;
    });
  }, []);

  return { isUnread, markRead, markAllRead };
}
