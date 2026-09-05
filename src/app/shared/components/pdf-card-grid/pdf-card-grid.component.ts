import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  viewChildren,
  viewChild,
  ElementRef,
  ChangeDetectorRef,
  inject,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxExtendedPdfViewerModule, PagesLoadedEvent } from 'ngx-extended-pdf-viewer';

export interface PageCardItem {
  pageNumber: number; // 1-indexed
  rendered: boolean;
  rendering: boolean;
  aspectRatio: number; // width / height
}

interface PdfJsPage {
  getViewport(params: { scale: number; rotation?: number }): { width: number; height: number };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}

interface PdfJsDocument {
  numPages: number;
  getPage(pageIndex: number): Promise<PdfJsPage>;
}

@Component({
  selector: 'app-pdf-card-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxExtendedPdfViewerModule],
  templateUrl: './pdf-card-grid.component.html',
  styleUrl: './pdf-card-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfCardGridComponent implements OnDestroy {
  private readonly cdRef = inject(ChangeDetectorRef);

  /** PDF source: Blob URL, ArrayBuffer, or string URL */
  readonly src = input.required<string>();

  /** Initial/current pages in row: 1, 2, 3, 4, or 5 */
  readonly initialPagesPerRow = input<number>(2);

  /** Whether cards are interactive/selectable */
  readonly selectable = input<boolean>(false);

  /** List of selected page numbers (1-indexed) */
  readonly selectedPages = input<number[]>([]);

  /** Maximum height of the scroll container */
  readonly maxHeight = input<string>('650px');

  /** Show top toolbar with count and dropdown */
  readonly showToolbar = input<boolean>(true);

  /** Emits when a page selection is toggled */
  readonly pageToggle = output<number>();

  /** Emits when a page is clicked */
  readonly pageClick = output<number>();

  /** Emits when the document is loaded with total page count */
  readonly pagesLoaded = output<number>();

  /** Emitted when "Select All" is clicked from toolbar */
  readonly selectAllPages = output<void>();

  /** Emitted when "Clear All" is clicked from toolbar */
  readonly clearAllPages = output<void>();

  // State
  readonly pagesPerRow = signal<1 | 2 | 3 | 4 | 5>(2);
  readonly pages = signal<PageCardItem[]>([]);
  readonly totalCount = signal<number>(0);
  readonly isLoading = signal<boolean>(true);

  private pdfDoc: PdfJsDocument | null = null;
  private observer: IntersectionObserver | null = null;

  readonly canvasRefs = viewChildren<ElementRef<HTMLCanvasElement>>('pageCanvas');
  readonly scrollContainerRef = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  constructor() {
    // Sync initialPagesPerRow input
    effect(
      () => {
        const initial = this.initialPagesPerRow();
        if (initial >= 1 && initial <= 5) {
          this.pagesPerRow.set(initial as 1 | 2 | 3 | 4 | 5);
        }
      },
      { allowSignalWrites: true },
    );

    // Reset when src changes
    effect(
      () => {
        const newSrc = this.src();
        if (newSrc) {
          this.isLoading.set(true);
          this.pages.set([]);
          this.pdfDoc = null;
          this.disconnectObserver();
        }
      },
      { allowSignalWrites: true },
    );

    // Watch canvas elements and observe them
    effect(() => {
      const canvases = this.canvasRefs();
      if (canvases.length > 0 && this.pdfDoc) {
        this.setupObserver();
        canvases.forEach((c) => {
          const pageNum = Number(c.nativeElement.getAttribute('data-page'));
          const pageItem = this.pages()[pageNum - 1];
          if (pageItem && !pageItem.rendered) {
            this.observer?.observe(c.nativeElement);
          }
        });
      }
    });
  }

  setPagesPerRow(val: number | string): void {
    const num = Number(val);
    if (num >= 1 && num <= 5) {
      this.pagesPerRow.set(num as 1 | 2 | 3 | 4 | 5);
    }
  }

  onPdfLoaded(event: PagesLoadedEvent): void {
    const doc =
      (event as unknown as { source?: { pdfDocument?: PdfJsDocument } })?.source?.pdfDocument ||
      (window as unknown as { PDFViewerApplication?: { pdfDocument?: PdfJsDocument } })
        .PDFViewerApplication?.pdfDocument;

    if (!doc) {
      this.isLoading.set(false);
      return;
    }

    this.pdfDoc = doc;
    const count = doc.numPages || event.pagesCount;
    this.totalCount.set(count);
    this.pagesLoaded.emit(count);

    // Build page items
    const items: PageCardItem[] = Array.from({ length: count }, (_, i) => ({
      pageNumber: i + 1,
      rendered: false,
      rendering: false,
      aspectRatio: 0.707, // standard portrait default
    }));

    this.pages.set(items);
    this.isLoading.set(false);
    this.cdRef.markForCheck();
  }

  private setupObserver(): void {
    if (this.observer) return;

    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: render first 10 pages immediately
      this.renderInitialBatch();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute('data-page'));
            if (pageNum) {
              void this.renderPage(pageNum, entry.target as HTMLCanvasElement);
            }
          }
        }
      },
      {
        root: this.scrollContainerRef()?.nativeElement || null,
        rootMargin: '350px 0px 350px 0px',
        threshold: 0.01,
      },
    );
  }

  private disconnectObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private async renderPage(pageNum: number, canvas: HTMLCanvasElement): Promise<void> {
    if (!this.pdfDoc) return;
    const idx = pageNum - 1;
    const items = this.pages();
    const pageItem = items[idx];
    if (!pageItem || pageItem.rendered || pageItem.rendering) return;

    pageItem.rendering = true;
    this.observer?.unobserve(canvas);

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const unscaled = page.getViewport({ scale: 1 });
      const ratio = unscaled.width / unscaled.height;
      pageItem.aspectRatio = ratio;

      // Calculate scale: render with high clarity (target ~800px width for standard letter/A4)
      const scale = Math.max(1, Math.min(2.5, 800 / unscaled.width));
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
      pageItem.rendered = true;
      this.cdRef.markForCheck();
    } catch (err) {
      console.warn(`[PdfCardGrid] Render failed for page ${pageNum}:`, err);
    } finally {
      pageItem.rendering = false;
    }
  }

  private renderInitialBatch(): void {
    const canvases = this.canvasRefs();
    const limit = Math.min(canvases.length, 10);
    for (let i = 0; i < limit; i++) {
      const c = canvases[i].nativeElement;
      const pageNum = Number(c.getAttribute('data-page'));
      if (pageNum) {
        void this.renderPage(pageNum, c);
      }
    }
  }

  readonly highlightedPage = signal<number | null>(null);

  isPageSelected(pageNum: number): boolean {
    return this.selectedPages().includes(pageNum);
  }

  onCardClick(pageNum: number): void {
    if (this.selectable()) {
      this.pageToggle.emit(pageNum);
    }
    this.pageClick.emit(pageNum);
  }

  scrollToPage(pageNum: number): void {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;

    const target = container.querySelector(`[data-page-card="${pageNum}"]`) as HTMLElement;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.highlightedPage.set(pageNum);
      setTimeout(() => {
        if (this.highlightedPage() === pageNum) {
          this.highlightedPage.set(null);
        }
      }, 1600);

      // Prioritize rendering target canvas immediately if not yet completed
      const canvas = target.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        void this.renderPage(pageNum, canvas);
      }
    }
  }

  ngOnDestroy(): void {
    this.disconnectObserver();
  }
}
