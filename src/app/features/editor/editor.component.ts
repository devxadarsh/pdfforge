import {
  Component,
  signal,
  computed,
  effect,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass, KeyValuePipe } from '@angular/common';
import { EDITOR_TOOLS } from '../../core/constants/tools';
import { PdfToolId } from '../../core/models/pdf.models';
import { LoadedFile } from '../../core/models/file.models';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { FileService } from '../../core/services/file/file.service';
import { DownloadService } from '../../core/services/download/download.service';
import { PdfViewerService } from '../../core/services/pdf/pdf-viewer.service';
import { PdfExportService } from '../../core/services/pdf/pdf-export.service';
import { ToastService } from '../../core/services/toast.service';
import { PdfPageComponent } from './components/pdf-page/pdf-page.component';
import { PageThumbnailComponent } from './components/page-thumbnail/page-thumbnail.component';
import { EditorPagesService } from './state/editor-pages.service';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    RouterLink,
    NgClass,
    KeyValuePipe,
    FileDropzoneComponent,
    PdfPageComponent,
    PageThumbnailComponent,
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent {
  private readonly files = inject(FileService);
  private readonly viewer = inject(PdfViewerService);
  private readonly exporter = inject(PdfExportService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);
  readonly pagesStore = inject(EditorPagesService);

  readonly exporting = signal(false);

  readonly tools = EDITOR_TOOLS;
  readonly activeTool = signal<PdfToolId>('select');

  readonly toolGroups = computed(() => {
    const groups: Record<string, typeof this.tools> = {};
    for (const t of this.tools) {
      (groups[t.group] ??= []).push(t);
    }
    return groups;
  });
  readonly docName = signal<string | null>(null);
  readonly loading = signal(false);
  readonly zoom = signal(1);
  readonly fitMode = signal<'none' | 'width' | 'page'>('width');
  readonly searchQuery = signal('');
  readonly searchHits = signal<number[]>([]);
  readonly searchTotal = signal(0);
  readonly searchHitIndex = signal(-1);

  private loadedRef: LoadedFile | null = null;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private dragId: string | null = null;

  readonly pagesList = this.pagesStore.pages;
  readonly totalPages = this.pagesStore.pagesCount;
  readonly currentPageNumber = computed(() => this.pagesStore.currentIndex() + 1);
  readonly currentSourceIndex = computed(
    () => this.pagesStore.currentPage()?.sourceIndex ?? 0,
  );
  readonly currentRotation = computed(
    () => this.pagesStore.currentPage()?.rotation ?? 0,
  );
  readonly selectedCount = this.pagesStore.selectedCount;

  readonly zoomLabel = computed(() => {
    if (this.fitMode() === 'width') {
      return 'Fit width';
    }
    if (this.fitMode() === 'page') {
      return 'Fit page';
    }
    return `${Math.round(this.zoom() * 100)}%`;
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

  constructor() {
    effect(
      () => {
        const file = this.files.currentFiles()[0];
        if (!file || this.loadedRef === file) {
          return;
        }
        void this.load(file);
      },
      { allowSignalWrites: true },
    );
  }

  selectTool(id: PdfToolId): void {
    this.activeTool.set(id);
  }

  private async load(file: LoadedFile): Promise<void> {
    this.loading.set(true);
    try {
      const count = await this.viewer.load(file.data);
      this.docName.set(file.name);
      this.pagesStore.init(count);
      this.zoom.set(1);
      this.fitMode.set('width');
      this.clearSearch();
      this.loadedRef = file;
      this.toasts.success(`Opened ${file.name}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not open the PDF.';
      this.toasts.error(message);
      this.docName.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /* Page navigation */
  selectPage(id: string, event?: MouseEvent): void {
    this.pagesStore.select(id, event);
  }

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

  /* Page management actions */
  selectAll(): void {
    this.pagesStore.selectAll();
  }

  clearSelection(): void {
    this.pagesStore.clearSelection();
  }

  deleteSelected(): void {
    this.pagesStore.deleteSelected();
  }

  duplicateSelected(): void {
    this.pagesStore.duplicateSelected();
  }

  rotateLeft(): void {
    this.pagesStore.rotateSelected(-90);
  }

  rotateRight(): void {
    this.pagesStore.rotateSelected(90);
  }

  extractSelected(): void {
    void this.pagesStore.extractSelected();
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

  /* Drag and drop reordering */
  onDragStart(id: string): void {
    this.dragId = id;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(id: string): void {
    if (this.dragId && this.dragId !== id) {
      const targetIndex = this.pagesStore
        .pages()
        .findIndex((p) => p.id === id);
      if (targetIndex >= 0) {
        this.pagesStore.move(this.dragId, targetIndex);
      }
    }
    this.dragId = null;
  }

  /* Zoom */
  zoomIn(): void {
    this.fitMode.set('none');
    this.zoom.update((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));
  }

  zoomOut(): void {
    this.fitMode.set('none');
    this.zoom.update((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100));
  }

  setFit(mode: 'width' | 'page'): void {
    this.fitMode.set(mode);
  }

  resetZoom(): void {
    this.zoom.set(1);
    this.fitMode.set('width');
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
      const text = (
        await this.viewer.getPageText(pages[i].sourceIndex)
      ).toLowerCase();
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
