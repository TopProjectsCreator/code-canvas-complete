/**
 * Offline storage service using IndexedDB.
 * Saves canvas projects locally when offline and syncs when back online.
 */
import { FileNode } from '@/types/ide';

const DB_NAME = 'canvas-offline';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';

export interface OfflineProject {
  /** Local key: `offline-${Date.now()}` or existing project id */
  id: string;
  name: string;
  language: string;
  files: FileNode[];
  description?: string;
  /** If set, this project should be synced to this remote project id */
  remoteProjectId?: string;
  /** True when the project has unsaved changes to push */
  dirty: boolean;
  updatedAt: string;
  createdAt: string;
}

// Templates that fully work offline (no server-side execution needed)
export const OFFLINE_CAPABLE_TEMPLATES = [
  'blank', 'html', 'react', 'automation', 'secureops',
  'arduino', 'ftc', 'rtf', 'word', 'powerpoint', 'excel',
  'video', 'audio', 'cad', 'scratch',
] as const;

export function isOfflineCapable(template: string): boolean {
  return (OFFLINE_CAPABLE_TEMPLATES as readonly string[]).includes(template);
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode) {
  return db.transaction(store, mode).objectStore(store);
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── CRUD ───────────────────────────────────────────────

export async function saveOfflineProject(project: OfflineProject): Promise<void> {
  const db = await openDB();
  await wrap(tx(db, STORE_PROJECTS, 'readwrite').put(project));
}

export async function getOfflineProject(id: string): Promise<OfflineProject | undefined> {
  const db = await openDB();
  return wrap(tx(db, STORE_PROJECTS, 'readonly').get(id));
}

export async function listOfflineProjects(): Promise<OfflineProject[]> {
  const db = await openDB();
  return wrap(tx(db, STORE_PROJECTS, 'readonly').getAll());
}

export async function deleteOfflineProject(id: string): Promise<void> {
  const db = await openDB();
  await wrap(tx(db, STORE_PROJECTS, 'readwrite').delete(id));
}

export async function getDirtyProjects(): Promise<OfflineProject[]> {
  const all = await listOfflineProjects();
  return all.filter((p) => p.dirty);
}

export async function markProjectClean(id: string): Promise<void> {
  const project = await getOfflineProject(id);
  if (project) {
    project.dirty = false;
    await saveOfflineProject(project);
  }
}

// ─── Online status ──────────────────────────────────────

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineStatusChange(cb: (online: boolean) => void): () => void {
  const onOnline = () => cb(true);
  const onOffline = () => cb(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
