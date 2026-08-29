import {
  Component,
  signal,
  computed,
  effect,
  inject,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass, KeyValuePipe } from '@angular/common';
import {
  NgxExtendedPdfViewerModule,
  PagesLoadedEvent,
} from 'ngx-extended-pdf-viewer';
import { EDITOR_TOOLS } from '../../core/constants/tools';
import { PdfToolId } from '../../core/models/pdf.models';
import { LoadedFile } from '../../core/models/file.models';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { FileService } from '../../core/services/file/file.service';
import { DownloadService } from '../../core/services/download/download.service';
import { PdfViewerService, PageSize } from '../../core/services/pdf/pdf-viewer.service';
import { PdfExportService } from '../../core/services/pdf/pdf-export.service';
import { ToastService } from '../../core/services/toast.service';
import { PdfPageComponent } from './components/pdf-page/pdf-page.component';
import { EditorOverlayComponent } from './components/editor-overlay/editor-overlay.component';
import { PropertiesPanelComponent } from './components/properties-panel/properties-panel.component';
import { PagesPanelComponent } from './components/pages-panel/pages-panel.component';
import { EditorPagesService } from './state/editor-pages.service';
import { EditorStateService } from './state/editor-state.service';

@Component({
    selector: 'app-editor',
  standalone: true,
  imports: [
    RouterLink,
    NgClass,
    KeyValuePipe,
    NgxExtendedPdfViewerModule,
    FileDropzoneComponent,
    PdfPageComponent,
    EditorOverlayComponent,
    PropertiesPanelComponent,
    PagesPanelComponent,
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent implements OnDestroy {
  private readonly files = inject(FileService);
  private readonly viewer = inject(PdfViewerService);
  private readonly exporter = inject(PdfExportService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);
  readonly pagesStore = inject(EditorPagesService);
  readonly state = inject(EditorStateService);

  readonly exporting = signal(false);
  readonly isFullscreen = signal(false);
  /** Session-level workspace preferences; collapsed panels remain as icon rails. */
  readonly pagesPanelCollapsed = signal(false);
  readonly propertiesPanelCollapsed = signal(false);

  /** Blob URL handed to ngx-extended-pdf-viewer to load the document. */
  readonly docSrc = signal<string | null>(null);
  private docUrl: string | null = null;

  readonly tools = EDITOR_TOOLS;

  readonly toolGroups = computed(() => {
    const groups: Record<string, typeof this.tools> = {};
    for (const t of this.tools) {
      (groups[t.group] ??= []).push(t);
    }
    return groups;
  });
  readonly docName = signal<string | null>(null);
  readonly loading = signal(false);
  readonly searchQuery = signal('');
  readonly searchHits = signal<number[]>([]);
  readonly searchTotal = signal(0);
  readonly searchHitIndex = signal(-1);

  private readonly editorRef = viewChild<ElementRef<HTMLDivElement>>('editor');
  private readonly stageRef = viewChild<ElementRef<HTMLDivElement>>('stage');
  readonly stageSize = signal<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  readonly baseSizes = signal<Map<number, PageSize>>(new Map());

  private loadedRef: LoadedFile | null = null;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private ro?: ResizeObserver;
  private lastAnnotationViewport:
    | { pageId: string; width: number; height: number }
    | null = null;

  readonly totalPages = this.pagesStore.pagesCount;
  readonly currentPageNumber = computed(() => this.pagesStore.currentIndex() + 1);
  readonly currentSourceIndex = computed(
    () => this.pagesStore.currentPage()?.sourceIndex ?? -1,
  );
  readonly currentRotation = computed(
    () => this.pagesStore.currentPage()?.rotation ?? 0,
  );

  readonly currentPageId = computed(() => this.pagesStore.currentId());
  readonly currentAnnotations = computed(() =>
    this.state.annotationsFor(this.currentPageId()),
  );

  readonly displaySize = computed<{
    width: number;
    height: number;
    scale: number;
  } | null>(() => {
    const idx = this.currentSourceIndex();
    if (idx < 0) {
      return null;
    }
    const base = this.baseSizes().get(idx);
    if (!base) {
      return null;
    }
    const rot = this.currentRotation();
    const rotatedW = rot % 180 === 0 ? base.width : base.height;
    const rotatedH = rot % 180 === 0 ? base.height : base.width;
    const stage = this.stageSize();
    const fit = this.state.fitMode();
    let scale: number;
    if (fit === 'width') {
      scale = (stage.width - 32) / rotatedW;
    } else if (fit === 'page') {
      scale = Math.min(
        (stage.width - 32) / rotatedW,
        (stage.height - 32) / rotatedH,
      );
    } else {
      scale = this.state.zoom();
    }
    scale = Math.max(0.1, scale);
    return { width: rotatedW * scale, height: rotatedH * scale, scale };
  });

  readonly zoomLabel = computed(() => {
    if (this.state.fitMode() === 'width') {
      return 'Fit width';
    }
    if (this.state.fitMode() === 'page') {
      return 'Fit page';
    }
    return `${Math.round(this.state.zoom() * 100)}%`;
  });

  readonly searchCountLabel = computed(() => {
    if (!this.searchQuery().trim()) {
      return '';
    }
    const total = this.searchTotal();
    const pageCount = this.searchHits().length;
    if (total === 0) {
      return 'No matches';
    }
    const matches = `${total} match${total !== 1 ? 'es' : ''}`;
    const pages = `${pageCount} page${pageCount !== 1 ? 's' : ''}`;
    return `${matches} · ${pages}`;
  });

  readonly eraserSvgSize = computed(() => {
    const s = Math.max(
      this.state.eraserSize(),
      this.state.eraserSize() * this.state.eraserTolerance(),
    );
    return s + 24;
  });

  readonly eraserSvgViewBox = computed(() => {
    const s = this.eraserSvgSize();
    const half = s / 2;
    return `-${half} -${half} ${s} ${s}`;
  });

  constructor() {
    effect(() => {
      const file = this.files.currentFiles()[0];
      if (!file || this.loadedRef === file) {
        return;
      }
      void this.load(file);
    });

    effect(() => {
      this.pagesStore.currentId();
      this.state.clearSelection();
    });

    // Annotation rectangles use the same coordinate system as the PDF overlay.
    // Reproject them whenever fit-width/fit-page changes the rendered page.
    effect(() => {
      const pageId = this.currentPageId();
      const size = this.displaySize();
      if (!pageId || !size) {
        this.lastAnnotationViewport = null;
        return;
      }

      const previous = this.lastAnnotationViewport;
      if (previous?.pageId === pageId) {
        this.state.scaleAnnotations(
          pageId,
          size.width / previous.width,
          size.height / previous.height,
        );
      }
      this.lastAnnotationViewport = {
        pageId,
        width: size.width,
        height: size.height,
      };
    });

    // The canvas stage is conditionally rendered only once a document is open,
    // so it does not exist at ngAfterViewInit. Re-create the ResizeObserver
    // whenever the stage element appears or disappears.
    effect(() => {
      this.stageRef();
      this.observeStage();
    });
  }

  private observeStage(): void {
    const stage = this.stageRef()?.nativeElement;
    this.ro?.disconnect();
    this.ro = undefined;
    if (!stage) {
      return;
    }
    this.ro = new ResizeObserver(() => {
      this.stageSize.set({
        width: stage.clientWidth,
        height: stage.clientHeight,
      });
    });
    this.ro.observe(stage);
    this.stageSize.set({
      width: stage.clientWidth,
      height: stage.clientHeight,
    });
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    if (this.docUrl) {
      URL.revokeObjectURL(this.docUrl);
      this.docUrl = null;
    }
    this.viewer.reset();
  }

  selectTool(id: PdfToolId): void {
    this.state.setTool(id);
  }

  async toggleFullscreen(): Promise<void> {
    const editor = this.editorRef()?.nativeElement;
    if (!editor) {
      return;
    }
    try {
      if (document.fullscreenElement === editor) {
        await document.exitFullscreen();
      } else {
        await editor.requestFullscreen();
      }
    } catch {
      this.toasts.error('Fullscreen mode is not available in this browser.');
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(document.fullscreenElement === this.editorRef()?.nativeElement);
  }

  togglePagesPanel(): void {
    this.pagesPanelCollapsed.update((collapsed) => !collapsed);
  }

  togglePropertiesPanel(): void {
    this.propertiesPanelCollapsed.update((collapsed) => !collapsed);
  }

  private async load(file: LoadedFile): Promise<void> {
    this.loadedRef = file;
    this.loading.set(true);
    this.state.reset();
    this.viewer.reset();
    if (this.docUrl) {
      URL.revokeObjectURL(this.docUrl);
    }
    this.docUrl = URL.createObjectURL(
      new File([file.data], file.name, { type: 'application/pdf' }),
    );
    this.docName.set(null);
    this.docSrc.set(this.docUrl);
  }

  onPagesLoaded(event: PagesLoadedEvent): void {
    const doc = (event as unknown as { source: { pdfDocument: unknown } })
      .source.pdfDocument;
    this.viewer.setDocument(doc);
    const count = event.pagesCount;
    this.docName.set(this.loadedRef?.name ?? null);
    this.pagesStore.init(count);
    this.clearSearch();
    void this.prefetch(count);
    if (this.loadedRef) {
      this.toasts.success(`Opened ${this.loadedRef.name}`);
    }
    this.loading.set(false);
  }

  private async prefetch(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      try {
        const size = await this.viewer.getPageSize(i, 0);
        this.baseSizes.update((m) => new Map(m).set(i, size));
      } catch {
        /* ignore per-page size errors */
      }
    }
  }

  /* Page navigation */
  nextPage(): void {
    const idx = this.pagesStore.currentIndex();
    const pages = this.pagesStore.pages();
    if (idx < pages.length - 1) {
      this.pagesStore.setCurrent(pages[idx + 1].id);
    }
  }

  prevPage(): void {
    const idx = this.pagesStore.currentIndex();
    if (idx > 0) {
      this.pagesStore.setCurrent(this.pagesStore.pages()[idx - 1].id);
    }
  }

  async exportPdf(): Promise<void> {
    const file = this.files.currentFiles()[0];
    if (!file) {
      this.toasts.error('No document is loaded.');
      return;
    }
    this.exporting.set(true);
    try {
      const pages = this.pagesStore
        .pages()
        .map((p) => ({ sourceIndex: p.sourceIndex, rotation: p.rotation }));
      const bytes = await this.exporter.exportDocument(
        new Uint8Array(file.data.slice(0)),
        pages,
        { title: file.name.replace(/\.pdf$/i, '') },
      );
      const base = file.name.replace(/\.pdf$/i, '');
      this.downloads.download(
        new Blob([bytes], { type: 'application/pdf' }),
        `${base}-edited.pdf`,
      );
      this.toasts.success('Exported the edited PDF.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not export the document.';
      this.toasts.error(message);
    } finally {
      this.exporting.set(false);
    }
  }

  /* Zoom */
  zoomIn(): void {
    this.zoomBy(1.1);
  }

  zoomOut(): void {
    this.zoomBy(1 / 1.1);
  }

  /** Applies a relative zoom from the current rendered page scale. */
  private zoomBy(factor: number): void {
    const current = this.displaySize()?.scale ?? this.state.zoom();
    this.state.setZoom(current * factor);
  }

  /** Ctrl/Cmd + wheel also receives trackpad pinch gestures in modern browsers. */
  onWorkspaceWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    const factor = Math.min(
      1.2,
      Math.max(0.8, Math.exp(-event.deltaY * 0.001)),
    );
    this.zoomBy(factor);
  }

  setFit(mode: 'width' | 'page'): void {
    this.state.setFit(mode);
  }

  resetZoom(): void {
    this.state.resetZoom();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isFullscreen()) {
      void document.exitFullscreen();
      return;
    }

    const hasZoomModifier = event.ctrlKey || event.metaKey;
    const isZoomIn = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd';
    const isZoomOut = event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract';
    if (hasZoomModifier && (isZoomIn || isZoomOut)) {
      event.preventDefault();
      this.zoomBy(isZoomIn ? 1.1 : 1 / 1.1);
      return;
    }

    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }
    const id = this.state.selectedId();
    if (!id) {
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.state.removeAnnotation(id);
      return;
    }

    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === 'ArrowLeft') dx = -step;
      if (event.key === 'ArrowRight') dx = step;
      if (event.key === 'ArrowUp') dy = -step;
      if (event.key === 'ArrowDown') dy = step;
      this.state.nudgeAnnotation(id, dx, dy);
    }
  }

  /* Search */
  onSearch(value: string): void {
    this.searchQuery.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.runSearch(value), 300);
  }

  private async runSearch(query: string): Promise<void> {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.clearSearch();
      return;
    }
    const pages = this.pagesStore.pages();
    const hits: number[] = [];
    let total = 0;
    for (let i = 0; i < pages.length; i++) {
      const text = (await this.viewer.getPageText(pages[i].sourceIndex)).toLowerCase();
      let found = 0;
      let pos = text.indexOf(q);
      while (pos !== -1) {
        found++;
        pos = text.indexOf(q, pos + q.length);
      }
      if (found > 0) {
        hits.push(i);
        total += found;
      }
    }
    this.searchHits.set(hits);
    this.searchTotal.set(total);
    this.searchHitIndex.set(hits.length ? 0 : -1);
    if (hits.length) {
      this.pagesStore.setCurrent(pages[hits[0]].id);
    }
  }

  searchNext(): void {
    const hits = this.searchHits();
    if (!hits.length) {
      return;
    }
    const idx = (this.searchHitIndex() + 1) % hits.length;
    this.searchHitIndex.set(idx);
    this.pagesStore.setCurrent(this.pagesStore.pages()[hits[idx]].id);
  }

  searchPrev(): void {
    const hits = this.searchHits();
    if (!hits.length) {
      return;
    }
    const idx = (this.searchHitIndex() - 1 + hits.length) % hits.length;
    this.searchHitIndex.set(idx);
    this.pagesStore.setCurrent(this.pagesStore.pages()[hits[idx]].id);
  }

  private clearSearch(): void {
    this.searchQuery.set('');
    this.searchHits.set([]);
    this.searchTotal.set(0);
    this.searchHitIndex.set(-1);
  }
}
