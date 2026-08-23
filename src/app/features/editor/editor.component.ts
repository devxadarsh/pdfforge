import {
  Component,
  signal,
  computed,
  effect,
  inject,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass, KeyValuePipe } from '@angular/common';
import { HostListener } from '@angular/core';
import { EDITOR_TOOLS } from '../../core/constants/tools';
import { PdfToolId, SignatureResult, DigitalSignatureRequest } from '../../core/models/pdf.models';
import { LoadedFile } from '../../core/models/file.models';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { FileService } from '../../core/services/file/file.service';
import { DownloadService } from '../../core/services/download/download.service';
import { PdfViewerService, PageSize } from '../../core/services/pdf/pdf-viewer.service';
import { PdfExportService } from '../../core/services/pdf/pdf-export.service';
import { PdfSignService } from '../../core/services/pdf/pdf-sign.service';
import { ToastService } from '../../core/services/toast.service';
import { SignatureBridgeService } from '../../core/services/signature-bridge.service';
import { PdfPageComponent } from './components/pdf-page/pdf-page.component';
import { PageThumbnailComponent } from './components/page-thumbnail/page-thumbnail.component';
import { EditorOverlayComponent } from './components/editor-overlay/editor-overlay.component';
import { PropertiesPanelComponent } from './components/properties-panel/properties-panel.component';
import { SignatureDialogComponent } from './components/signature-dialog/signature-dialog.component';
import { StampDialogComponent } from './components/stamp-dialog/stamp-dialog.component';
import { EditorPagesService } from './state/editor-pages.service';
import { EditorStateService } from './state/editor-state.service';
import { EditorHistoryService } from './state/editor-history.service';

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
    EditorOverlayComponent,
    PropertiesPanelComponent,
    SignatureDialogComponent,
    StampDialogComponent,
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent {
  private readonly files = inject(FileService);
  private readonly viewer = inject(PdfViewerService);
  private readonly exporter = inject(PdfExportService);
  private readonly signer = inject(PdfSignService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);
  private readonly signatureBridge = inject(SignatureBridgeService);
  readonly pagesStore = inject(EditorPagesService);
  readonly state = inject(EditorStateService);
  readonly history = inject(EditorHistoryService);

  readonly exporting = signal(false);

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

  private readonly stageRef = viewChild<ElementRef<HTMLDivElement>>('stage');
  private readonly imageInputRef =
    viewChild<ElementRef<HTMLInputElement>>('imageInput');
  readonly stageSize = signal<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  readonly signatureOpen = signal(false);
  readonly stampOpen = signal(false);
  readonly baseSizes = signal<Map<number, PageSize>>(new Map());

  private loadedRef: LoadedFile | null = null;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private dragId: string | null = null;
  private ro?: ResizeObserver;

  readonly pagesList = this.pagesStore.pages;
  readonly totalPages = this.pagesStore.pagesCount;
  readonly currentPageNumber = computed(() => this.pagesStore.currentIndex() + 1);
  readonly currentSourceIndex = computed(
    () => this.pagesStore.currentPage()?.sourceIndex ?? -1,
  );
  readonly currentRotation = computed(
    () => this.pagesStore.currentPage()?.rotation ?? 0,
  );
  readonly selectedCount = this.pagesStore.selectedCount;

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

    effect(
      () => {
        this.pagesStore.currentId();
        this.state.clearSelection();
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const stage = this.stageRef()?.nativeElement;
        this.ro?.disconnect();
        this.ro = undefined;
        if (!stage) {
          return;
        }
        const update = () =>
          this.stageSize.set({
            width: stage.clientWidth,
            height: stage.clientHeight,
          });
        this.ro = new ResizeObserver(update);
        this.ro.observe(stage);
        update();
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const file = this.files.currentFiles()[0];
        const pending = this.signatureBridge.pending();
        if (!file || !pending) {
          return;
        }
        this.state.setPendingMedia({
          kind: 'signature',
          dataUrl: pending.dataUrl,
          naturalWidth: pending.width,
          naturalHeight: pending.height,
        });
        this.state.setTool('signature');
        this.signatureBridge.clear();
        this.toasts.info('Click on the page to place your signature.');
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const file = this.files.currentFiles()[0];
        const pending = this.signatureBridge.pendingDigital();
        if (!file || !pending) {
          return;
        }
        this.state.setDigitalSignature(pending);
        this.signatureBridge.clear();
        this.toasts.success(
          'Digital ID loaded. The PDF will be cryptographically signed on export.',
        );
      },
      { allowSignalWrites: true },
    );
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  selectTool(id: PdfToolId): void {
    if (id === 'image') {
      this.openImagePicker();
      return;
    }
    if (id === 'signature') {
      this.signatureOpen.set(true);
      return;
    }
    if (id === 'stamp') {
      this.stampOpen.set(true);
      return;
    }
    this.state.setTool(id);
  }

  private openImagePicker(): void {
    this.imageInputRef()?.nativeElement.click();
  }

  onImageFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        this.state.setPendingMedia({
          kind: 'image',
          dataUrl,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
        this.state.setTool('image');
        this.toasts.info('Click on the page to place the image.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  onSignatureResult(result: SignatureResult | null): void {
    this.signatureOpen.set(false);
    if (!result) {
      return;
    }
    this.state.setPendingMedia({
      kind: 'signature',
      dataUrl: result.dataUrl,
      naturalWidth: result.width,
      naturalHeight: result.height,
    });
    this.state.setTool('signature');
    this.toasts.info('Click on the page to place the signature.');
  }

  onDigitalResult(result: DigitalSignatureRequest | null): void {
    this.signatureOpen.set(false);
    if (!result) {
      return;
    }
    this.state.setDigitalSignature(result);
    this.toasts.success(
      'Digital ID loaded. The PDF will be cryptographically signed when you export.',
    );
  }

  onStampResult(result: { text: string; color: string } | null): void {
    this.stampOpen.set(false);
    if (!result) {
      return;
    }
    this.state.setPendingMedia({ kind: 'stamp', text: result.text, color: result.color });
    this.state.setTool('stamp');
    this.toasts.info('Click on the page to place the stamp.');
  }

  private async load(file: LoadedFile): Promise<void> {
    this.loading.set(true);
    this.state.reset();
    try {
      const count = await this.viewer.load(file.data);
      this.docName.set(file.name);
      this.pagesStore.init(count);
      this.history.reset();
      this.clearSearch();
      this.loadedRef = file;
      void this.prefetch(count);
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

  /* History */
  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable)
    ) {
      return;
    }
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
    } else if (key === 'y') {
      event.preventDefault();
      this.redo();
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
      let bytes = await this.exporter.exportDocument(
        new Uint8Array(file.data.slice(0)),
        pages,
        { title: file.name.replace(/\.pdf$/i, '') },
      );
      const digital = this.state.digitalSignature();
      if (digital) {
        bytes = await this.signer.sign(bytes, digital);
      }
      const base = file.name.replace(/\.pdf$/i, '');
      this.downloads.download(
        new Blob([bytes], { type: 'application/pdf' }),
        `${base}-edited.pdf`,
      );
      this.toasts.success(
        digital ? 'Exported and cryptographically signed the PDF.' : 'Exported the edited PDF.',
      );
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
    this.state.zoomIn();
  }

  zoomOut(): void {
    this.state.zoomOut();
  }

  setFit(mode: 'width' | 'page'): void {
    this.state.setFit(mode);
  }

  resetZoom(): void {
    this.state.resetZoom();
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
