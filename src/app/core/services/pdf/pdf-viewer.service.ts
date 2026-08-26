import * as pdfjsLib from 'pdfjs-dist';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  PDFDocumentLoadingTask,
} from 'pdfjs-dist';
import { Injectable } from '@angular/core';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.mjs';

export interface Cancellable {
  cancel(): void;
  readonly promise: Promise<unknown>;
}

export interface PageSize {
  readonly width: number;
  readonly height: number;
}

@Injectable({ providedIn: 'root' })
export class PdfViewerService {
  private doc: PDFDocumentProxy | null = null;
  private task: PDFDocumentLoadingTask | null = null;

  get pageCount(): number {
    return this.doc?.numPages ?? 0;
  }

  async load(data: ArrayBuffer): Promise<number> {
    this.destroy();
    const task = pdfjsLib.getDocument({ data: data.slice(0) });
    this.task = task;
    this.doc = await task.promise;
    return this.doc.numPages;
  }

  private async getPage(pageIndex: number): Promise<PDFPageProxy> {
    if (!this.doc) {
      throw new Error('No PDF document is loaded.');
    }
    return this.doc.getPage(pageIndex + 1);
  }

  async getPageSize(pageIndex: number, rotation = 0): Promise<PageSize> {
    const page = await this.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1, rotation });
    return { width: viewport.width, height: viewport.height };
  }

  async renderPage(
    canvas: HTMLCanvasElement,
    pageIndex: number,
    scale: number,
    renderTaskRef?: { task: Cancellable | null },
    rotation = 0,
  ): Promise<void> {
    const page = await this.getPage(pageIndex);
    const viewport = page.getViewport({ scale, rotation });
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderTaskRef?.task?.cancel();
    const task = page.render({ canvas, canvasContext: ctx, viewport });
    if (renderTaskRef) {
      renderTaskRef.task = task as unknown as Cancellable;
    }
    try {
      await task.promise;
    } catch {
      /* render cancelled or failed */
    }
  }

  async renderThumbnail(
    canvas: HTMLCanvasElement,
    pageIndex: number,
    scale: number,
    rotation = 0,
  ): Promise<void> {
    const page = await this.getPage(pageIndex);
    const viewport = page.getViewport({ scale, rotation });
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    try {
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    } catch {
      /* render cancelled or failed */
    }
  }

  async getPageText(pageIndex: number): Promise<string> {
    const page = await this.getPage(pageIndex);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string }>;
    return items
      .filter((it) => typeof it.str === 'string')
      .map((it) => it.str ?? '')
      .join(' ');
  }

  destroy(): void {
    void this.task?.destroy();
    this.task = null;
    this.doc = null;
  }
}
