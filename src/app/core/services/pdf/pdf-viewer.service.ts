import { Injectable } from '@angular/core';

export interface PageSize {
  readonly width: number;
  readonly height: number;
}

export interface Cancellable {
  cancel(): void;
  readonly promise: Promise<unknown>;
}

// Structural types for the pdf.js document / page proxy that ngx-extended-pdf-viewer
// hands to us via its `pagesLoaded` event. ngx owns the single pdf.js instance at
// runtime (the only pdf.js used by the app). These minimal shapes are enough
// for sizing, text extraction and canvas rendering.
interface PdfjsViewport {
  readonly width: number;
  readonly height: number;
}
interface PdfjsTextItem {
  readonly str?: string;
}
interface PdfjsRenderTask {
  cancel(): void;
  readonly promise: Promise<void>;
}
interface PdfjsPage {
  getViewport(params: { scale: number; rotation?: number }): PdfjsViewport;
  getTextContent(): Promise<{ items: readonly PdfjsTextItem[] }>;
  render(params: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfjsViewport;
  }): PdfjsRenderTask;
}
interface PdfjsDocument {
  readonly numPages: number;
  getPage(index: number): Promise<PdfjsPage>;
}

@Injectable({ providedIn: 'root' })
export class PdfViewerService {
  private doc: PdfjsDocument | null = null;

  get pageCount(): number {
    return this.doc?.numPages ?? 0;
  }

  get loaded(): boolean {
    return this.doc !== null;
  }

  /** Called from the editor once ngx-extended-pdf-viewer has loaded the document. */
  setDocument(doc: unknown): void {
    this.doc = doc as PdfjsDocument;
  }

  reset(): void {
    this.doc = null;
  }

  private async getPage(pageIndex: number): Promise<PdfjsPage> {
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
      await page
        .render({ canvas, canvasContext: ctx, viewport })
        .promise.catch(() => undefined);
    } catch {
      /* render cancelled or failed */
    }
  }

  async getPageText(pageIndex: number): Promise<string> {
    const page = await this.getPage(pageIndex);
    const content = await page.getTextContent();
    return content.items
      .filter((it) => typeof it.str === 'string')
      .map((it) => it.str ?? '')
      .join(' ');
  }
}
