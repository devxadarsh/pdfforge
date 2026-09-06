import { Injectable } from '@angular/core';

export interface PageSize {
  readonly width: number;
  readonly height: number;
}

export interface Cancellable {
  cancel(): void;
  readonly promise: Promise<unknown>;
}

export interface PdfTextSpan {
  readonly str: string;
  readonly dir?: string;
  readonly transform: readonly number[];
  readonly width: number;
  readonly height: number;
}

export interface PdfPageTextData {
  readonly spans: readonly PdfTextSpan[];
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly rotation: number;
  readonly viewport: any;
}

/**
 * Calculates the exact normalized bounding box ([0, 1] relative to viewport width/height)
 * for a matching character range within a PDF text span.
 */
export function calcMatchNormRect(
  span: PdfTextSpan,
  charStart: number,
  charEnd: number,
  viewport: any,
  offscreenCtx: CanvasRenderingContext2D | null,
): { x: number; y: number; width: number; height: number } {
  const str = span.str;
  const strLen = str.length;
  if (strLen === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const safeStart = Math.max(0, Math.min(charStart, strLen));
  const safeEnd = Math.max(safeStart, Math.min(charEnd, strLen));

  const fontHeight =
    span.height > 0
      ? span.height
      : Math.hypot(span.transform[2], span.transform[3]) ||
        Math.hypot(span.transform[0], span.transform[1]) ||
        12;

  let startFrac = 0;
  let endFrac = 1;

  if (offscreenCtx) {
    offscreenCtx.font = `${Math.round(fontHeight)}px sans-serif`;
    const totalW = offscreenCtx.measureText(str).width;
    if (totalW > 0) {
      startFrac = offscreenCtx.measureText(str.slice(0, safeStart)).width / totalW;
      endFrac = offscreenCtx.measureText(str.slice(0, safeEnd)).width / totalW;
    } else {
      startFrac = safeStart / strLen;
      endFrac = safeEnd / strLen;
    }
  } else {
    startFrac = safeStart / strLen;
    endFrac = safeEnd / strLen;
  }

  const spanWidth = span.width > 0 ? span.width : fontHeight * 0.6 * strLen;
  const localXStart = startFrac * spanWidth;
  const localXEnd = endFrac * spanWidth;
  const localYBottom = -0.15 * fontHeight;
  const localYTop = 0.85 * fontHeight;

  const a = span.transform[0];
  const b = span.transform[1];
  const c = span.transform[2];
  const d = span.transform[3];
  const tx = span.transform[4];
  const ty = span.transform[5];

  const hAB = Math.hypot(a, b) || 1;
  const ux = a / hAB;
  const uy = b / hAB;
  const hCD = Math.hypot(c, d) || 1;
  const vx = c / hCD;
  const vy = d / hCD;

  const toPdfPoint = (lx: number, ly: number): [number, number] => [
    tx + lx * ux + ly * vx,
    ty + lx * uy + ly * vy,
  ];

  const c1 = toPdfPoint(localXStart, localYBottom);
  const c2 = toPdfPoint(localXEnd, localYBottom);
  const c3 = toPdfPoint(localXEnd, localYTop);
  const c4 = toPdfPoint(localXStart, localYTop);

  const toViewPoint = (p: [number, number]): [number, number] => {
    if (viewport && typeof viewport.convertToViewportPoint === 'function') {
      return viewport.convertToViewportPoint(p[0], p[1]);
    }
    const t = viewport?.transform;
    if (t && t.length >= 6) {
      return [t[0] * p[0] + t[2] * p[1] + t[4], t[1] * p[0] + t[3] * p[1] + t[5]];
    }
    return [p[0], (viewport?.height || 0) - p[1]];
  };

  const v1 = toViewPoint(c1);
  const v2 = toViewPoint(c2);
  const v3 = toViewPoint(c3);
  const v4 = toViewPoint(c4);

  const minX = Math.min(v1[0], v2[0], v3[0], v4[0]);
  const maxX = Math.max(v1[0], v2[0], v3[0], v4[0]);
  const minY = Math.min(v1[1], v2[1], v3[1], v4[1]);
  const maxY = Math.max(v1[1], v2[1], v3[1], v4[1]);

  const vpW = viewport?.width || 1;
  const vpH = viewport?.height || 1;

  return {
    x: Math.max(0, minX / vpW),
    y: Math.max(0, minY / vpH),
    width: Math.max(0.002, (maxX - minX) / vpW),
    height: Math.max(0.004, (maxY - minY) / vpH),
  };
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
  readonly dir?: string;
  readonly transform?: readonly number[];
  readonly width?: number;
  readonly height?: number;
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
  private textDataCache = new Map<string, PdfPageTextData>();

  get pageCount(): number {
    return this.doc?.numPages ?? 0;
  }

  get loaded(): boolean {
    return this.doc !== null;
  }

  /** Called from the editor once ngx-extended-pdf-viewer has loaded the document. */
  setDocument(doc: unknown): void {
    this.doc = doc as PdfjsDocument;
    this.textDataCache.clear();
  }

  reset(): void {
    this.doc = null;
    this.textDataCache.clear();
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

  async getPageTextData(pageIndex: number, rotation = 0): Promise<PdfPageTextData> {
    const key = `${pageIndex}-${rotation}`;
    const cached = this.textDataCache.get(key);
    if (cached) {
      return cached;
    }
    const page = await this.getPage(pageIndex);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1, rotation });
    const spans: PdfTextSpan[] = [];
    for (const raw of content.items) {
      if (raw && typeof (raw as any).str === 'string') {
        const it = raw as any;
        spans.push({
          str: it.str,
          dir: it.dir,
          transform: it.transform || [1, 0, 0, 1, 0, 0],
          width: typeof it.width === 'number' ? it.width : 0,
          height: typeof it.height === 'number' ? it.height : 0,
        });
      }
    }
    const result: PdfPageTextData = {
      spans,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      rotation,
      viewport,
    };
    this.textDataCache.set(key, result);
    return result;
  }
}
