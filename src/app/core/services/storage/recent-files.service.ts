import { Injectable } from '@angular/core';
import { StoredEditorState } from '../../models/file.models';

/** 30 days in milliseconds. */
const EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000;

/** IndexedDB database name (shared with DocumentStorageService). */
const DB_NAME = 'pdfforge-docs';
const DB_VERSION = 2;
const RECENT_STORE = 'recent-files';

export interface RecentFileEntry {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly lastOpenedAt: number;
  readonly pageCount?: number;
  readonly pinned?: boolean;
  readonly hasData?: boolean;
}

export interface RecentFileRecord {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly lastOpenedAt: number;
  readonly pageCount?: number;
  readonly pinned?: boolean;
  readonly data?: ArrayBuffer;
  readonly editorState?: StoredEditorState;
}

/**
 * Manages recently opened PDF files, raw document bytes, and full editor state (annotations + pages) in IndexedDB.
 * Persists document bytes and edits locally so files can be reopened immediately with all edits intact.
 *
 * Automatically purges unpinned entries older than 30 days to free space.
 * Pinned entries never expire and stay at the top.
 *
 * All data stays 100% private and local in the browser — nothing is uploaded.
 */
@Injectable({ providedIn: 'root' })
export class RecentFilesService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('last-document')) {
          db.createObjectStore('last-document');
        }
        if (!db.objectStoreNames.contains(RECENT_STORE)) {
          db.createObjectStore(RECENT_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Add a file to the recent list with its raw PDF data and optional editor state (annotations + pages).
   * Deduplicates by filename while preserving pinned status and updating bytes & edits.
   */
  async addOrUpdate(
    name: string,
    data: ArrayBuffer,
    sizeBytes: number,
    pageCount?: number,
    editorState?: StoredEditorState,
  ): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const store = tx.objectStore(RECENT_STORE);

      const all = await this.getAllRecordsFromStore(store);
      const existing = all.find(
        (e) => e.name.toLowerCase() === name.toLowerCase(),
      );

      const record: RecentFileRecord = {
        id: existing?.id ?? crypto.randomUUID(),
        name,
        data,
        sizeBytes: sizeBytes || data.byteLength,
        lastOpenedAt: Date.now(),
        pageCount: pageCount ?? existing?.pageCount,
        pinned: existing?.pinned ?? false,
        editorState: editorState ?? existing?.editorState,
      };

      store.put(record);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      console.warn('[RecentFiles] Could not store recent file in IndexedDB.');
    }
  }

  /**
   * Retrieve full document record including `data: ArrayBuffer` and `editorState` by ID.
   * Updates `lastOpenedAt` to the current timestamp.
   */
  async getFileData(id: string): Promise<RecentFileRecord | null> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const store = tx.objectStore(RECENT_STORE);

      const request = store.get(id);
      const record = await new Promise<RecentFileRecord | null>(
        (resolve, reject) => {
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => reject(request.error);
        },
      );

      if (record && record.data) {
        // Update timestamp to bring to top
        const updated: RecentFileRecord = {
          ...record,
          lastOpenedAt: Date.now(),
        };
        store.put(updated);

        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        return updated;
      }

      return record;
    } catch {
      console.warn('[RecentFiles] Could not load file data for ID:', id);
      return null;
    }
  }

  /**
   * Retrieve full document record including `data: ArrayBuffer` and `editorState` by file name.
   */
  async getFileDataByName(name: string): Promise<RecentFileRecord | null> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const store = tx.objectStore(RECENT_STORE);

      const all = await this.getAllRecordsFromStore(store);
      const match = all.find(
        (e) => e.name.toLowerCase() === name.toLowerCase() && e.data,
      );

      if (match) {
        const updated: RecentFileRecord = {
          ...match,
          lastOpenedAt: Date.now(),
        };
        store.put(updated);

        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        return updated;
      }

      return null;
    } catch {
      console.warn('[RecentFiles] Could not load file data for name:', name);
      return null;
    }
  }

  /**
   * Toggle pinned/favorite state for a recent file entry.
   * Returns the new pinned state.
   */
  async togglePin(id: string): Promise<boolean> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const store = tx.objectStore(RECENT_STORE);

      const all = await this.getAllRecordsFromStore(store);
      const entry = all.find((e) => e.id === id);
      if (!entry) {
        return false;
      }

      const updated: RecentFileRecord = {
        ...entry,
        pinned: !entry.pinned,
      };

      store.put(updated);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      return Boolean(updated.pinned);
    } catch {
      console.warn('[RecentFiles] Could not toggle pin for entry.');
      return false;
    }
  }

  /**
   * Get all recent file entries (metadata only) sorted by pinned status first,
   * then by lastOpenedAt descending.
   * Auto-purges unpinned entries older than 30 days. Pinned entries are retained indefinitely.
   */
  async getAll(): Promise<RecentFileEntry[]> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const store = tx.objectStore(RECENT_STORE);

      const all = await this.getAllRecordsFromStore(store);
      const cutoff = Date.now() - EXPIRATION_MS;

      // Remove expired unpinned entries
      const expired = all.filter((e) => !e.pinned && e.lastOpenedAt < cutoff);
      for (const entry of expired) {
        store.delete(entry.id);
      }

      // Filter valid entries (either pinned or within 30-day window)
      const valid = all.filter((e) => e.pinned || e.lastOpenedAt >= cutoff);

      // Sort: pinned first (newest to oldest), then unpinned (newest to oldest)
      valid.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.lastOpenedAt - a.lastOpenedAt;
      });

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Map to lightweight metadata entries (excluding raw ArrayBuffer to save memory)
      return valid.map((r) => ({
        id: r.id,
        name: r.name,
        sizeBytes: r.sizeBytes,
        lastOpenedAt: r.lastOpenedAt,
        pageCount: r.pageCount,
        pinned: r.pinned,
        hasData: Boolean(r.data && r.data.byteLength > 0),
      }));
    } catch {
      console.warn('[RecentFiles] Could not load recent files from IndexedDB.');
      return [];
    }
  }

  /** Remove a single recent file entry by ID. */
  async remove(id: string): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const store = tx.objectStore(RECENT_STORE);
      store.delete(id);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      console.warn('[RecentFiles] Could not remove recent file entry.');
    }
  }

  /** Clear all recent file entries (both pinned and unpinned). */
  async clearAll(): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const store = tx.objectStore(RECENT_STORE);
      store.clear();

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      console.warn('[RecentFiles] Could not clear recent files.');
    }
  }

  private getAllRecordsFromStore(
    store: IDBObjectStore,
  ): Promise<RecentFileRecord[]> {
    return new Promise<RecentFileRecord[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () =>
        resolve((request.result as RecentFileRecord[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  }
}
