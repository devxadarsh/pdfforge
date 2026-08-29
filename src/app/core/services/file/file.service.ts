import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { verifyPdfMagic } from '../../utilities/file.util';
import { LoadedFile } from '../../models/file.models';
import { DownloadService } from '../download/download.service';
import { DocumentStorageService } from '../storage/document-storage.service';

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly downloader = inject(DownloadService);
  private readonly storage = inject(DocumentStorageService);

  readonly currentFiles = signal<LoadedFile[]>([]);

  pickFile(multiple = false): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.multiple = multiple;
      input.addEventListener('change', () => {
        const files = input.files ? Array.from(input.files) : [];
        resolve(files);
      });
      input.addEventListener('cancel', () => resolve([]));
      input.click();
    });
  }

  async loadFiles(files: ReadonlyArray<File>): Promise<LoadedFile[]> {
    const loaded: LoadedFile[] = [];
    for (const file of files) {
      try {
        const validated = await verifyPdfMagic(file);
        const data = await file.arrayBuffer();
        loaded.push({
          file: validated.file,
          name: validated.name,
          sizeBytes: validated.sizeBytes,
          data,
          loadedAt: Date.now(),
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'The file could not be read.';
        this.toasts.error(`${file.name}: ${message}`);
      }
    }
    if (loaded.length) {
      this.currentFiles.set(loaded);
      // Persist the first file so it survives a page reload
      void this.storage.saveDocument(loaded[0].name, loaded[0].data);
    }
    return loaded;
  }

  /**
   * Attempt to restore the last-opened document from IndexedDB.
   * Returns `true` if a document was successfully restored.
   */
  async restoreLastDocument(): Promise<boolean> {
    const stored = await this.storage.loadDocument();
    if (!stored) {
      return false;
    }
    const blob = new Blob([stored.data], { type: 'application/pdf' });
    const file = new File([blob], stored.name, { type: 'application/pdf' });
    const loaded: LoadedFile = {
      file,
      name: stored.name,
      sizeBytes: stored.data.byteLength,
      data: stored.data,
      loadedAt: Date.now(),
    };
    this.currentFiles.set([loaded]);
    return true;
  }

  setCurrent(files: ReadonlyArray<LoadedFile>): void {
    this.currentFiles.set([...files]);
  }

  clearCurrent(): void {
    this.currentFiles.set([]);
    void this.storage.clearDocument();
  }

  async openInEditor(files: ReadonlyArray<File>): Promise<boolean> {
    const loaded = await this.loadFiles(files);
    if (loaded.length) {
      void this.router.navigate(['/editor']);
      return true;
    }
    return false;
  }

  download(data: Blob | File, filename: string): void {
    this.downloader.download(data, filename);
  }
}
