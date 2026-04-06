import { useCallback, useEffect, useRef } from 'react';
import { FileNode } from '@/types/ide';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  saveOfflineProject,
  getOfflineProject,
  listOfflineProjects,
  isOnline,
  isOfflineCapable,
  OfflineProject,
} from '@/services/offlineStorage';
import { startAutoSync, syncDirtyProjects } from '@/services/offlineSync';

export function useOfflineProject() {
  const { user } = useAuth();
  const { toast } = useToast();
  const syncStarted = useRef(false);

  // Start auto-sync once
  useEffect(() => {
    if (!syncStarted.current) {
      syncStarted.current = true;
      startAutoSync(() => user?.id ?? null);
    }
  }, [user]);

  // Listen for sync completion
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      toast({
        title: 'Projects synced',
        description: `${detail.count} offline project(s) saved to your account.`,
      });
    };
    window.addEventListener('offline-sync-complete', handler);
    return () => window.removeEventListener('offline-sync-complete', handler);
  }, [toast]);

  const saveLocally = useCallback(
    async (
      files: FileNode[],
      language: string,
      name: string,
      localId?: string,
      remoteProjectId?: string,
    ) => {
      if (!isOfflineCapable(language)) return null;

      const id = localId || `offline-${Date.now()}`;
      const now = new Date().toISOString();
      const existing = localId ? await getOfflineProject(localId) : undefined;

      const project: OfflineProject = {
        id,
        name,
        language,
        files,
        remoteProjectId,
        dirty: true,
        updatedAt: now,
        createdAt: existing?.createdAt ?? now,
      };

      await saveOfflineProject(project);

      // If online and user is authenticated, try immediate sync
      if (isOnline() && user?.id) {
        syncDirtyProjects(user.id);
      }

      return id;
    },
    [user],
  );

  const loadLocal = useCallback(async (id: string) => {
    return getOfflineProject(id);
  }, []);

  const listLocal = useCallback(async () => {
    return listOfflineProjects();
  }, []);

  return { saveLocally, loadLocal, listLocal, isOfflineCapable };
}
