import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { StoredEditorState } from '../../models/file.models';

/** Key used inside the IndexedDB object store. */
const DOC_KEY = 'last';

/** IndexedDB database name. */
export const DB_NAME = 'pdfforge-docs';

/** Object store that holds the persisted document. */
export const STORE_NAME = 'last-document';

/** Schema version — bump when the store structure changes. */
export const DB_VERSION = 2;

export const RECENT_STORE = 'recent-files';

export interface StoredDocument {
  readonly name: string;
  readonly data: ArrayBuffer;
  readonly storedAt: number;
  readonly editorState?: StoredEditorState;
}

export interface PdfForgeDBSchema extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: StoredDocument;
  };
  [RECENT_STORE]: {
    key: string;
    value: any;
  };
}

/**
 * Modernized IndexedDB wrapper using `idb` that persists the last-opened PDF document
 * and its full editor state (annotations + pages) so it can be restored after a page reload.
 *
 * All data stays entirely local in the browser — nothing is uploaded.
 */
@Injectable({ providedIn: 'root' })
export class DocumentStorageService {
  private dbPromise: Promise<IDBPDatabase<PdfForgeDBSchema>> | null = null;

  private getDb(): Promise<IDBPDatabase<PdfForgeDBSchema>> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = openDB<PdfForgeDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(RECENT_STORE)) {
          db.createObjectStore(RECENT_STORE, { keyPath: 'id' });
        }
      },
      blocked() {
        console.warn('[DocumentStorage] IndexedDB upgrade blocked by another tab.');
      },
      blocking() {
        console.warn('[DocumentStorage] IndexedDB connection is blocking a newer version.');
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

  /** Persist the current document's raw bytes, filename, and editor state. */
  async saveDocument(
    name: string,
    data: ArrayBuffer,
    editorState?: StoredEditorState,
  ): Promise<void> {
    try {
      const db = await this.getDb();
      const record: StoredDocument = {
        name,
        data,
        storedAt: Date.now(),
        editorState,
      };
      await db.put(STORE_NAME, record, DOC_KEY);
    } catch (err) {
      console.warn('[DocumentStorage] Could not save document to IndexedDB via idb:', err);
    }
  }

  /** Retrieve the last-stored document, or `null` if none exists. */
  async loadDocument(): Promise<StoredDocument | null> {
    try {
      const db = await this.getDb();
      const result = await db.get(STORE_NAME, DOC_KEY);
      return result ?? null;
    } catch (err) {
      console.warn('[DocumentStorage] Could not load document from IndexedDB via idb:', err);
      return null;
    }
  }

  /** Remove the persisted document. */
  async clearDocument(): Promise<void> {
    try {
      const db = await this.getDb();
      await db.delete(STORE_NAME, DOC_KEY);
    } catch (err) {
      console.warn('[DocumentStorage] Could not clear document from IndexedDB via idb:', err);
    }
  }
}
