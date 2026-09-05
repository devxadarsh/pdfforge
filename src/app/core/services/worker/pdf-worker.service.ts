import { Injectable, OnDestroy } from '@angular/core';
import * as Comlink from 'comlink';
import type {
  PdfWorkerApi,
  WorkerFileInfo,
  WorkerPermissions,
} from '../../../workers/pdf.worker';

@Injectable({ providedIn: 'root' })
export class PdfWorkerService implements OnDestroy {
  private worker: Worker | null = null;
  private api: Comlink.Remote<PdfWorkerApi> | null = null;

  private getApi(): Comlink.Remote<PdfWorkerApi> {
    if (!this.api) {
      try {
        this.worker = new Worker(
          new URL('../../../workers/pdf.worker', import.meta.url),
          { type: 'module' },
        );
        this.api = Comlink.wrap<PdfWorkerApi>(this.worker);
      } catch (err) {
        console.warn('[PdfWorkerService] Failed to initialize Web Worker:', err);
        throw err;
      }
    }
    return this.api;
  }

  async mergePdfs(files: WorkerFileInfo[]): Promise<Uint8Array> {
    const api = this.getApi();
    return await api.mergePdfs(files);
  }

  async splitPdf(sourceBytes: Uint8Array, ranges: number[][]): Promise<Uint8Array[]> {
    const api = this.getApi();
    return await api.splitPdf(sourceBytes, ranges);
  }

  async compressPdf(
    sourceBytes: Uint8Array,
    level: 'recommended' | 'strong' | 'extreme',
  ): Promise<Uint8Array> {
    const api = this.getApi();
    return await api.compressPdf(sourceBytes, level);
  }

  async protectPdf(
    sourceBytes: Uint8Array,
    userPassword: string,
    ownerPassword?: string,
    permissions?: WorkerPermissions,
  ): Promise<Uint8Array> {
    const api = this.getApi();
    return await api.protectPdf(sourceBytes, userPassword, ownerPassword, permissions);
  }

  async unlockPdf(sourceBytes: Uint8Array, password: string): Promise<Uint8Array> {
    const api = this.getApi();
    return await api.unlockPdf(sourceBytes, password);
  }

  ngOnDestroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.api = null;
    }
  }
}
