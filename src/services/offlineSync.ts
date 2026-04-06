/**
 * Sync service: pushes dirty offline projects to the user's account when online.
 */
import {
  getDirtyProjects,
  markProjectClean,
  onOnlineStatusChange,
  isOnline,
  OfflineProject,
  deleteOfflineProject,
} from './offlineStorage';
import { createDataProvider } from '@/integrations/data/provider';

let syncing = false;
let cleanupFn: (() => void) | null = null;

/**
 * Attempt to sync all dirty offline projects for the given user.
 * Returns the number of projects synced.
 */
export async function syncDirtyProjects(userId: string): Promise<number> {
  if (syncing || !isOnline()) return 0;
  syncing = true;
  let count = 0;

  try {
    const dirty = await getDirtyProjects();
    if (dirty.length === 0) return 0;

    const dataProvider = createDataProvider();

    for (const project of dirty) {
      try {
        if (project.remoteProjectId) {
          // Update existing
          await dataProvider.updateProject({
            id: project.remoteProjectId,
            user_id: userId,
            name: project.name,
            files: project.files,
            language: project.language,
            description: project.description || null,
            is_public: false,
          });
          await markProjectClean(project.id);
        } else {
          // Create new
          const created = await dataProvider.createProject({
            user_id: userId,
            name: project.name,
            files: project.files,
            language: project.language,
            description: project.description || null,
            is_public: false,
          });
          // Link the offline project to the remote one, then remove offline copy
          await deleteOfflineProject(project.id);
          // Return the remote id via a custom event so the IDE can update
          window.dispatchEvent(
            new CustomEvent('offline-project-synced', {
              detail: { offlineId: project.id, remoteProject: created },
            }),
          );
        }
        count++;
      } catch (err) {
        console.warn('[offlineSync] Failed to sync project', project.id, err);
      }
    }
  } finally {
    syncing = false;
  }
  return count;
}

/**
 * Start listening for online events and auto-sync when connectivity returns.
 */
export function startAutoSync(getUserId: () => string | null): void {
  stopAutoSync();

  // Sync on startup if already online
  const uid = getUserId();
  if (uid && isOnline()) {
    syncDirtyProjects(uid);
  }

  cleanupFn = onOnlineStatusChange(async (online) => {
    if (online) {
      const uid = getUserId();
      if (uid) {
        const n = await syncDirtyProjects(uid);
        if (n > 0) {
          window.dispatchEvent(new CustomEvent('offline-sync-complete', { detail: { count: n } }));
        }
      }
    }
  });
}

export function stopAutoSync(): void {
  cleanupFn?.();
  cleanupFn = null;
}
