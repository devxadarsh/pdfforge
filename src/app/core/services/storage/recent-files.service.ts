import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { StoredEditorState } from '../../models/file.models';

/** 30 days in milliseconds. */
const EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000;

/** IndexedDB database name (shared with DocumentStorageService). */
const DB_NAME = 'pdfforge-docs';
const DB_VERSION = 2;
const RECENT_STORE = 'recent-files';
const LAST_DOC_STORE = 'last-document';

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

interface RecentFilesDBSchema extends DBSchema {
  [LAST_DOC_STORE]: {
    key: string;
    value: any;
  };
  [RECENT_STORE]: {
    key: string;
    value: RecentFileRecord;
  };
}

/**
 * Modernized IndexedDB manager using `idb` for recently opened PDF files, raw document bytes,
 * and full editor state (annotations + pages).
 * Persists document bytes and edits locally so files can be reopened immediately with all edits intact.
 *
 * Automatically purges unpinned entries older than 30 days to free space.
 * Pinned entries never expire and stay at the top.
 *
 * All data stays 100% private and local in the browser — nothing is uploaded.
 */
@Injectable({ providedIn: 'root' })
export class RecentFilesService {
  private dbPromise: Promise<IDBPDatabase<RecentFilesDBSchema>> | null = null;

  private getDb(): Promise<IDBPDatabase<RecentFilesDBSchema>> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = openDB<RecentFilesDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(LAST_DOC_STORE)) {
          db.createObjectStore(LAST_DOC_STORE);
        }
        if (!db.objectStoreNames.contains(RECENT_STORE)) {
          db.createObjectStore(RECENT_STORE, { keyPath: 'id' });
        }
      },
      terminated: () => {
        this.dbPromise = null;
      },
    }).catch((err) => {
      this.dbPromise = null;
      throw err;
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
      const db = await this.getDb();
      const all = await db.getAll(RECENT_STORE);
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

      await db.put(RECENT_STORE, record);
    } catch (err) {
      console.warn('[RecentFiles] Could not store recent file in IndexedDB via idb:', err);
    }
  }

  /**
   * Retrieve full document record including `data: ArrayBuffer` and `editorState` by ID.
   * Updates `lastOpenedAt` to the current timestamp.
   */
  async getFileData(id: string): Promise<RecentFileRecord | null> {
    try {
      const db = await this.getDb();
      const record = await db.get(RECENT_STORE, id);

      if (record && record.data) {
        const updated: RecentFileRecord = {
          ...record,
          lastOpenedAt: Date.now(),
        };
        await db.put(RECENT_STORE, updated);
        return updated;
      }

      return record ?? null;
    } catch (err) {
      console.warn('[RecentFiles] Could not load file data for ID:', id, err);
      return null;
    }
  }

  /**
   * Retrieve full document record including `data: ArrayBuffer` and `editorState` by file name.
   */
  async getFileDataByName(name: string): Promise<RecentFileRecord | null> {
    try {
      const db = await this.getDb();
      const all = await db.getAll(RECENT_STORE);
      const match = all.find(
        (e) => e.name.toLowerCase() === name.toLowerCase() && e.data,
      );

      if (match) {
        const updated: RecentFileRecord = {
          ...match,
          lastOpenedAt: Date.now(),
        };
        await db.put(RECENT_STORE, updated);
        return updated;
      }

      return null;
    } catch (err) {
      console.warn('[RecentFiles] Could not load file data for name:', name, err);
      return null;
    }
  }

  /**
   * Toggle pinned/favorite state for a recent file entry.
   * Returns the new pinned state.
   */
  async togglePin(id: string): Promise<boolean> {
    try {
      const db = await this.getDb();
      const entry = await db.get(RECENT_STORE, id);
      if (!entry) {
        return false;
      }

      const updated: RecentFileRecord = {
        ...entry,
        pinned: !entry.pinned,
      };

      await db.put(RECENT_STORE, updated);
      return Boolean(updated.pinned);
    } catch (err) {
      console.warn('[RecentFiles] Could not toggle pin for entry:', err);
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
      const db = await this.getDb();
      const all = await db.getAll(RECENT_STORE);
      const cutoff = Date.now() - EXPIRATION_MS;

      // Remove expired unpinned entries
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const expired = all.filter((e) => !e.pinned && e.lastOpenedAt < cutoff);
      for (const entry of expired) {
        void tx.store.delete(entry.id);
      }
      await tx.done;

      // Filter valid entries (either pinned or within 30-day window)
      const valid = all.filter((e) => e.pinned || e.lastOpenedAt >= cutoff);

      // Sort: pinned first (newest to oldest), then unpinned (newest to oldest)
      valid.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.lastOpenedAt - a.lastOpenedAt;
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
    } catch (err) {
      console.warn('[RecentFiles] Could not load recent files from IndexedDB via idb:', err);
      return [];
    }
  }

  /** Remove a single recent file entry by ID. */
  async remove(id: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db.delete(RECENT_STORE, id);
    } catch (err) {
      console.warn('[RecentFiles] Could not remove recent file entry via idb:', err);
    }
  }

  /** Clear all recent file entries (both pinned and unpinned). */
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDb();
      await db.clear(RECENT_STORE);
    } catch (err) {
      console.warn('[RecentFiles] Could not clear recent files via idb:', err);
    }
  }
}
