import * as pdfjsLib from 'pdfjs-dist';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  PDFDocumentLoadingTask,
} from 'pdfjs-dist';
import { Injectable } from '@angular/core';
import { RawTextItem } from '../../models/pdf.models';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function applyTransform(
  x: number,
  y: number,
  m: readonly number[],
): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

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
  private readonly rawTextCache = new Map<number, RawTextItem[]>();
  /** Serializes render() calls per canvas so a cancelled render releases the
   *  canvas before the next one starts (PDF.js forbids concurrent renders on
   *  the same canvas, which otherwise blanks pages during navigation). */
  private readonly renderLocks = new WeakMap<HTMLCanvasElement, Promise<void>>();

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
    const viewport0 = viewport;
    const run = async () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(viewport0.width * dpr));
      canvas.height = Math.max(1, Math.floor(viewport0.height * dpr));
      canvas.style.width = `${Math.floor(viewport0.width)}px`;
      canvas.style.height = `${Math.floor(viewport0.height)}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const prev = renderTaskRef?.task;
      if (prev) {
        prev.cancel();
        try {
          await prev.promise;
        } catch {
          /* previous render cancelled */
        }
      }
      const task = page.render({ canvas, canvasContext: ctx, viewport: viewport0 });
      if (renderTaskRef) {
        renderTaskRef.task = task as unknown as Cancellable;
      }
      try {
        await task.promise;
      } catch {
        /* render cancelled or failed */
      }
    };
    const chain = (this.renderLocks.get(canvas) ?? Promise.resolve()).then(
      run,
      run,
    );
    this.renderLocks.set(canvas, chain);
    await chain;
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
    const run = async () => {
      try {
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch {
        /* render cancelled or failed */
      }
    };
    const chain = (this.renderLocks.get(canvas) ?? Promise.resolve()).then(
      run,
      run,
    );
    this.renderLocks.set(canvas, chain);
    await chain;
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

  /**
   * Extracts positioned text runs for a page (cached). Geometry is reported
   * in the page's unrotated PDF user space so callers can re-project it to
   * any display scale/rotation.
   */
  async getPageRawTextItems(pageIndex: number): Promise<RawTextItem[]> {
    const cached = this.rawTextCache.get(pageIndex);
    if (cached) {
      return cached;
    }
    const page = await this.getPage(pageIndex);
    const content = await page.getTextContent();
    const source = content.items as Array<{
      str?: string;
      transform?: number[];
      width?: number;
      height?: number;
    }>;
    const result: RawTextItem[] = [];
    let index = 0;
    for (const it of source) {
      if (typeof it.str !== 'string' || !it.str.trim() || !it.transform) {
        continue;
      }
      const transform = it.transform;
      const w = it.width ?? 0;
      const h = it.height ?? 0;
      const corners = [
        applyTransform(0, 0, transform),
        applyTransform(w, 0, transform),
        applyTransform(0, h, transform),
        applyTransform(w, h, transform),
      ];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const baseline = applyTransform(0, 0, transform);
      const fontSize = Math.hypot(transform[0], transform[1]) || h || 12;
      result.push({
        id: `t${pageIndex}-${index++}`,
        str: it.str,
        transform,
        width: w,
        height: h,
        pdfRect: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y },
        baseline: { x: baseline[0], y: baseline[1] },
        fontSize,
      });
    }
    this.rawTextCache.set(pageIndex, result);
    return result;
  }

  /** Returns the PDF.js viewport transform that maps PDF user space to display pixels. */
  async getViewportTransform(
    pageIndex: number,
    scale: number,
    rotation = 0,
  ): Promise<number[]> {
    const page = await this.getPage(pageIndex);
    const viewport = page.getViewport({ scale, rotation });
    return Array.from(viewport.transform);
  }

  destroy(): void {
    void this.task?.destroy();
    this.task = null;
    this.doc = null;
    this.rawTextCache.clear();
  }
}
