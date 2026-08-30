import { Injectable } from '@angular/core';
import { StoredEditorState } from '../../models/file.models';

/** Key used inside the IndexedDB object store. */
const DOC_KEY = 'last';

/** IndexedDB database name. */
const DB_NAME = 'pdfforge-docs';

/** Object store that holds the persisted document. */
const STORE_NAME = 'last-document';

/** Schema version — bump when the store structure changes. */
const DB_VERSION = 2;

const RECENT_STORE = 'recent-files';

export interface StoredDocument {
  readonly name: string;
  readonly data: ArrayBuffer;
  readonly storedAt: number;
  readonly editorState?: StoredEditorState;
}

/**
 * Lightweight IndexedDB wrapper that persists the last-opened PDF document
 * and its full editor state (annotations + pages) so it can be restored after a page reload.
 *
 * All data stays entirely local in the browser — nothing is uploaded.
 */
@Injectable({ providedIn: 'root' })
export class DocumentStorageService {
  /**
   * Opens (or creates) the IndexedDB database.
   * The promise is cached so concurrent callers share the same connection.
   */
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
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

  /** Persist the current document's raw bytes, filename, and editor state. */
  async saveDocument(
    name: string,
    data: ArrayBuffer,
    editorState?: StoredEditorState,
  ): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: StoredDocument = {
        name,
        data,
        storedAt: Date.now(),
        editorState,
      };

      store.put(record, DOC_KEY);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      console.warn('[DocumentStorage] Could not save document to IndexedDB.');
    }
  }

  /** Retrieve the last-stored document, or `null` if none exists. */
  async loadDocument(): Promise<StoredDocument | null> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(DOC_KEY);

      return await new Promise<StoredDocument | null>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      console.warn('[DocumentStorage] Could not load document from IndexedDB.');
      return null;
    }
  }

  /** Remove the persisted document. */
  async clearDocument(): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(DOC_KEY);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      console.warn('[DocumentStorage] Could not clear document from IndexedDB.');
    }
  }
}
