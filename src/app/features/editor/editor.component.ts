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
import {
  PdfToolId,
  DrawingMode,
  PdfAnnotation,
  DrawingAnnotation,
  ShapeAnnotation,
  TextAnnotation,
  HighlightAnnotation,
} from '../../core/models/pdf.models';
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
import { EditorPage } from './models/editor-page.model';
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

  readonly penColorSwatches = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#f97316'];
  readonly highlightColorSwatches = ['#fde047', '#86efac', '#7dd3fc', '#fca5a5', '#fdba74', '#d8b4fe'];
  readonly shapeColorSwatches = ['#2563eb', '#111827', '#dc2626', '#16a34a', '#9333ea', '#f59e0b'];
  readonly strokeWidthPresets = [2, 4, 8, 14];
  readonly eraserSizePresets = [8, 16, 24, 36, 48];
  readonly textFontSizePresets = [12, 14, 16, 20, 24, 32];
  readonly fontOptions = [
    { label: 'Sans', value: 'sans-serif' },
    { label: 'Serif', value: 'serif' },
    { label: 'Mono', value: 'monospace' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times', value: "'Times New Roman', serif" },
    { label: 'Courier', value: "'Courier New', monospace" },
  ];

  readonly selectedTextAnnotation = computed<TextAnnotation | null>(() => {
    const list = this.state.getSelectedList(this.currentPageId());
    if (list.length === 1 && list[0].type === 'text') {
      return list[0] as TextAnnotation;
    }
    return null;
  });

  readonly selectedAnnotation = computed<PdfAnnotation | null>(() => {
    const list = this.state.getSelectedList(this.currentPageId());
    return list.length === 1 ? list[0] : null;
  });

  setTextFontSize(size: number): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      this.state.updateAnnotation(textAnn.id, { fontSize: size } as Partial<TextAnnotation>);
    }
  }

  setTextFontFamily(family: string): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      this.state.updateAnnotation(textAnn.id, { fontFamily: family } as Partial<TextAnnotation>);
    }
  }

  toggleTextBold(): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      const nextWeight = (textAnn.fontWeight >= 700) ? 400 : 700;
      this.state.updateAnnotation(textAnn.id, { fontWeight: nextWeight } as Partial<TextAnnotation>);
    }
  }

  toggleTextItalic(): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      this.state.updateAnnotation(textAnn.id, { italic: !textAnn.italic } as Partial<TextAnnotation>);
    }
  }

  readonly hasQuickProps = computed(() => {
    const t = this.state.tool();
    const hasSelection = this.state.selectedIds().length > 0;
    return (
      hasSelection ||
      t === 'pen' ||
      t === 'freehand' ||
      t === 'eraser' ||
      t === 'highlight' ||
      t === 'underline' ||
      t === 'strikethrough' ||
      t === 'rectangle' ||
      t === 'circle' ||
      t === 'arrow' ||
      t === 'line' ||
      t === 'text' ||
      t === 'select'
    );
  });

  setPenColor(c: string): void {
    this.state.setPenColor(c);
  }
  setPenWidth(w: number): void {
    this.state.setPenStrokeWidth(w);
  }
  setFreehandColor(c: string): void {
    this.state.setFreehandColor(c);
  }
  setFreehandWidth(w: number): void {
    this.state.setFreehandStrokeWidth(w);
  }
  setEraserSize(s: number): void {
    this.state.setEraserSize(s);
  }
  setEraserMode(m: 'segment' | 'stroke'): void {
    this.state.setEraserMode(m);
  }
  setEraserTarget(t: 'all' | 'drawing' | 'highlight'): void {
    this.state.setEraserTarget(t);
  }
  setSelectMode(m: 'none' | 'box' | 'lasso'): void {
    this.state.setSelectMode(m);
  }
  selectAllAnnotations(): void {
    this.state.selectAllAnnotations(this.currentPageId());
  }
  clearSelection(): void {
    this.state.selectAnnotation(null);
  }
  setDrawingMode(m: DrawingMode): void {
    this.state.setDrawingMode(m);
  }

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

  getPageDisplaySize(page: EditorPage): { width: number; height: number; scale: number } {
    const idx = page.sourceIndex;
    const base = this.baseSizes().get(idx) ?? { width: 595.28, height: 841.89 };
    const rot = page.rotation;
    const rotatedW = rot % 180 === 0 ? base.width : base.height;
    const rotatedH = rot % 180 === 0 ? base.height : base.width;
    const stage = this.stageSize();
    const fit = this.state.fitMode();
    let scale: number;
    if (fit === 'width') {
      const padding = stage.width < 768 ? 36 : 48;
      scale = Math.max(0.1, (stage.width - padding) / rotatedW);
    } else if (fit === 'page') {
      const paddingX = stage.width < 768 ? 36 : 48;
      const paddingY = stage.width < 768 ? 32 : 48;
      scale = Math.min(
        (stage.width - paddingX) / rotatedW,
        (stage.height - paddingY) / rotatedH,
      );
    } else {
      scale = this.state.zoom();
    }
    scale = Math.max(0.1, scale);
    return { width: Math.round(rotatedW * scale), height: Math.round(rotatedH * scale), scale };
  }

  readonly displaySize = computed<{
    width: number;
    height: number;
    scale: number;
  } | null>(() => {
    const curr = this.pagesStore.currentPage();
    return curr ? this.getPageDisplaySize(curr) : null;
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

  getAnnotationIcon(type: string): string {
    switch (type) {
      case 'hand':
        return 'fa-solid fa-hand';
      case 'select':
        return 'fa-solid fa-arrow-pointer';
      case 'pen':
        return 'fa-solid fa-pen';
      case 'freehand':
        return 'fa-solid fa-paintbrush';
      case 'eraser':
        return 'fa-solid fa-eraser';
      case 'rectangle':
        return 'fa-regular fa-square';
      case 'circle':
        return 'fa-regular fa-circle';
      case 'arrow':
        return 'fa-solid fa-arrow-right';
      case 'line':
        return 'fa-solid fa-minus';
      case 'text':
        return 'fa-solid fa-font';
      case 'drawing':
        return 'fa-solid fa-pen-nib';
      case 'shape':
        return 'fa-regular fa-square';
      case 'highlight':
        return 'fa-solid fa-highlighter';
      case 'underline':
        return 'fa-solid fa-underline';
      case 'strikethrough':
        return 'fa-solid fa-strikethrough';
      case 'comment':
        return 'fa-solid fa-comment';
      case 'image':
        return 'fa-solid fa-image';
      case 'signature':
        return 'fa-solid fa-signature';
      case 'stamp':
        return 'fa-solid fa-stamp';
      default:
        return 'fa-solid fa-vector-square';
    }
  }

  readonly currentToolName = computed(() => {
    const t = this.state.tool();
    const match = EDITOR_TOOLS.find((tool) => tool.id === t);
    return match ? `${match.label} Tool` : 'Tool';
  });

  readonly currentToolIcon = computed(() => {
    const t = this.state.tool();
    return this.getAnnotationIcon(t);
  });

  readonly currentToolHint = computed(() => {
    const t = this.state.tool();
    const selCount = this.state.selectedIds().length;
    if (selCount > 0) {
      return selCount === 1 ? '1 item selected' : `${selCount} items selected`;
    }
    switch (t) {
      case 'hand':
        return 'Pan & Pinch to zoom';
      case 'select':
        return 'Tap or drag box to select';
      case 'pen':
        return 'Natural ink pen';
      case 'freehand':
        return 'Freehand sketch';
      case 'eraser':
        return 'Cut segments or erase strokes';
      case 'text':
        return 'Tap page to add text';
      case 'highlight':
        return 'Highlight text area';
      case 'underline':
        return 'Underline text area';
      case 'strikethrough':
        return 'Strikethrough text area';
      case 'rectangle':
        return 'Draw rectangle';
      case 'circle':
        return 'Draw circle';
      case 'arrow':
        return 'Draw arrow';
      case 'line':
        return 'Draw line';
      default:
        return 'Active mode';
    }
  });

  readonly hasDrawingPanel = computed(() => {
    const t = this.state.tool();
    const hasSelection = this.state.selectedIds().length > 0;
    return (
      hasSelection ||
      t === 'select' ||
      t === 'pen' ||
      t === 'freehand' ||
      t === 'eraser' ||
      t === 'highlight' ||
      t === 'underline' ||
      t === 'strikethrough' ||
      t === 'rectangle' ||
      t === 'circle' ||
      t === 'arrow' ||
      t === 'line' ||
      t === 'text'
    );
  });

  readonly activePropertiesSummary = computed(() => {
    const tool = this.state.tool();
    const pageId = this.currentPageId();
    const selectedList = this.state.getSelectedList(pageId);
    const selectedCount = selectedList.length;

    if (selectedCount > 0) {
      const first = selectedList[0];
      const hasGroup = selectedList.some((a) => Boolean(a.groupId));
      const groupId = first.groupId;
      const allSameGroup =
        Boolean(hasGroup && groupId) &&
        selectedList.every((a) => a.groupId === groupId);
      const isLocked = selectedList.every((a) => a.locked);

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const a of selectedList) {
        minX = Math.min(minX, a.rect.x);
        minY = Math.min(minY, a.rect.y);
        maxX = Math.max(maxX, a.rect.x + a.rect.width);
        maxY = Math.max(maxY, a.rect.y + a.rect.height);
      }
      const width = Math.round(maxX - minX);
      const height = Math.round(maxY - minY);

      return {
        type: 'selection' as const,
        tool,
        title:
          selectedCount === 1
            ? `Selected ${first.type.charAt(0).toUpperCase() + first.type.slice(1)}`
            : `${selectedCount} objects selected`,
        icon:
          selectedCount === 1
            ? this.getAnnotationIcon(first.type)
            : 'fa-solid fa-object-group',
        groupLabel: allSameGroup
          ? `Group (${groupId})`
          : hasGroup
            ? 'Mixed group'
            : 'Ungrouped',
        bounds: { x: Math.round(minX), y: Math.round(minY), width, height },
        isLocked,
        selectedCount,
        first,
      };
    }

    switch (tool) {
      case 'pen':
        return {
          type: 'pen' as const,
          tool,
          title: 'Pen Tool',
          icon: 'fa-solid fa-pen-nib',
          color: this.state.penColor(),
          strokeWidth: this.state.penStrokeWidth(),
          smoothing: this.state.penSmoothing(),
          drawingMode: this.state.drawingMode(),
          drawingModeLabel:
            this.state.drawingMode() === 'continuous'
              ? 'Natural Ink'
              : 'Border Area',
        };
      case 'freehand':
        return {
          type: 'freehand' as const,
          tool,
          title: 'Freehand Tool',
          icon: 'fa-solid fa-paintbrush',
          color: this.state.freehandColor(),
          strokeWidth: this.state.freehandStrokeWidth(),
          smoothing: this.state.penSmoothing(),
          drawingMode: this.state.drawingMode(),
          drawingModeLabel:
            this.state.drawingMode() === 'continuous'
              ? 'Natural Ink'
              : 'Border Area',
        };
      case 'eraser':
        return {
          type: 'eraser' as const,
          tool,
          title: 'Eraser Tool',
          icon: 'fa-solid fa-eraser',
          size: this.state.eraserSize(),
          eraserMode: this.state.eraserMode(),
          eraserModeLabel:
            this.state.eraserMode() === 'segment'
              ? 'Cut / Segment'
              : 'Whole Stroke',
          target: this.state.eraserTarget(),
          targetLabel:
            this.state.eraserTarget() === 'all'
              ? 'All Objects'
              : this.state.eraserTarget() === 'drawing'
                ? 'Ink Only'
                : 'Highlights',
        };
      case 'rectangle':
      case 'circle':
      case 'arrow':
      case 'line':
        return {
          type: 'shape' as const,
          tool,
          title:
            tool === 'rectangle'
              ? 'Rectangle Tool'
              : tool === 'circle'
                ? 'Circle Tool'
                : tool === 'arrow'
                  ? 'Arrow Tool'
                  : 'Line Tool',
          icon:
            tool === 'rectangle'
              ? 'fa-regular fa-square'
              : tool === 'circle'
                ? 'fa-regular fa-circle'
                : tool === 'arrow'
                  ? 'fa-solid fa-arrow-right'
                  : 'fa-solid fa-minus',
          strokeColor: '#000000',
          strokeWidth: 2,
          shapeKind: tool,
        };
      case 'text':
        return {
          type: 'text' as const,
          tool,
          title: 'Text Tool',
          icon: 'fa-solid fa-font',
          fontFamily: 'Inter',
          fontSize: 16,
          align: 'left',
          color: '#111827',
        };
      case 'highlight':
      case 'underline':
      case 'strikethrough':
        return {
          type: 'markup' as const,
          tool,
          title:
            tool === 'highlight'
              ? 'Highlight Tool'
              : tool === 'underline'
                ? 'Underline Tool'
                : 'Strikethrough Tool',
          icon:
            tool === 'highlight'
              ? 'fa-solid fa-highlighter'
              : tool === 'underline'
                ? 'fa-solid fa-underline'
                : 'fa-solid fa-strikethrough',
          color:
            tool === 'highlight'
              ? '#fef08a'
              : tool === 'underline'
                ? '#3b82f6'
                : '#ef4444',
          opacity: 0.6,
        };
      case 'hand':
        return {
          type: 'hand' as const,
          tool,
          title: 'Hand Tool',
          icon: 'fa-solid fa-hand',
          description: 'Drag or pinch to pan and explore page',
        };
      default:
        return {
          type: 'default' as const,
          tool,
          title: 'Select Tool',
          icon: 'fa-solid fa-arrow-pointer',
          annotationsCount: this.currentAnnotations().length,
          description:
            this.currentAnnotations().length > 0
              ? `${this.currentAnnotations().length} annotation${this.currentAnnotations().length !== 1 ? 's' : ''} on page`
              : 'Click on any annotation or drag to select',
        };
    }
  });

  constructor() {
    effect(() => {
      const file = this.files.currentFiles()[0];
      if (!file || this.loadedRef === file) {
        return;
      }
      void this.load(file);
    });

    document.addEventListener('touchstart', this.onGlobalTouchStart, { passive: false });
    document.addEventListener('touchmove', this.onGlobalTouchStart, { passive: false });

    // On mobile, default to click-only selection (no drag marquee)
    if (window.innerWidth < 768) {
      this.state.setSelectMode('none');
    }

    // Auto-restore last-opened document from IndexedDB on page reload.
    // Runs once on init — if no file is currently loaded, attempt to
    // restore the persisted document so it seamlessly survives a reload.
    if (this.files.currentFiles().length === 0) {
      void this.files.restoreLastDocument();
    }

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

    // Bridge export trigger from header / menu bar
    effect(() => {
      const trigger = this.state.exportTrigger();
      if (trigger > 0) {
        void this.exportPdf();
      }
    });
  }

  readonly isMobileSearchOpen = signal(false);

  toggleMobileSearch(): void {
    this.isMobileSearchOpen.update((v) => !v);
  }

  closeMobileSearch(): void {
    this.isMobileSearchOpen.set(false);
  }

  readonly Math = Math;

  toggleDrawingMode(): void {
    const next: DrawingMode =
      this.state.drawingMode() === 'continuous' ? 'autoselect' : 'continuous';
    this.state.setDrawingMode(next);
  }

  toggleEraserMode(): void {
    const next = this.state.eraserMode() === 'segment' ? 'stroke' : 'segment';
    this.state.setEraserMode(next);
  }

  openPropertiesSheet(): void {
    this.state.setMobilePropertiesOpen(true);
  }

  closePropertiesSheet(): void {
    this.state.setMobilePropertiesOpen(false);
  }

  getAnnotationColor(a: PdfAnnotation | undefined): string | null {
    if (!a) return null;
    if (a.type === 'drawing') return a.color;
    if (a.type === 'shape') return a.strokeColor;
    if (a.type === 'text') return a.color;
    if (a.type === 'highlight' || a.type === 'underline' || a.type === 'strikethrough') return a.color;
    return null;
  }

  getAnnotationStrokeWidth(a: PdfAnnotation | undefined): number | null {
    if (!a) return null;
    if (a.type === 'drawing') return a.strokeWidth;
    if (a.type === 'shape') return a.strokeWidth;
    return null;
  }

  setSelectionColor(c: string): void {
    const pageId = this.currentPageId();
    const list = this.state.getSelectedList(pageId);
    if (list.length === 0) return;
    for (const a of list) {
      if (a.locked) continue;
      if (a.type === 'drawing') {
        this.state.updateAnnotation(a.id, { color: c } as Partial<DrawingAnnotation>);
      } else if (a.type === 'shape') {
        this.state.updateAnnotation(a.id, { strokeColor: c } as Partial<ShapeAnnotation>);
      } else if (a.type === 'text') {
        this.state.updateAnnotation(a.id, { color: c } as Partial<TextAnnotation>);
      } else if (a.type === 'highlight' || a.type === 'underline' || a.type === 'strikethrough') {
        this.state.updateAnnotation(a.id, { color: c } as Partial<HighlightAnnotation>);
      }
    }
  }

  setSelectionWidth(w: number): void {
    const pageId = this.currentPageId();
    const list = this.state.getSelectedList(pageId);
    if (list.length === 0) return;
    for (const a of list) {
      if (a.locked) continue;
      if (a.type === 'drawing') {
        this.state.updateAnnotation(a.id, { strokeWidth: w } as Partial<DrawingAnnotation>);
      } else if (a.type === 'shape') {
        this.state.updateAnnotation(a.id, { strokeWidth: w } as Partial<ShapeAnnotation>);
      }
    }
  }

  deleteSelected(): void {
    this.state.deleteSelected(this.currentPageId());
  }

  duplicateSelected(): void {
    this.state.duplicateSelected(this.currentPageId());
  }

  toggleLockSelected(): void {
    const pageId = this.currentPageId();
    const list = this.state.getSelectedList(pageId);
    if (list.length === 1) {
      this.state.toggleLock(list[0].id);
    } else {
      this.state.toggleBatchLock(pageId);
    }
  }

  bringSelectedToFront(): void {
    this.state.bringSelectedToFront(this.currentPageId());
  }

  sendSelectedToBack(): void {
    this.state.sendSelectedToBack(this.currentPageId());
  }

  groupSelected(): void {
    this.state.groupSelected(this.currentPageId());
  }

  ungroupSelected(): void {
    this.state.ungroupSelected(this.currentPageId());
  }

  openPagesSheet(): void {
    this.state.setMobilePagesOpen(true);
  }

  closePagesSheet(): void {
    this.state.setMobilePagesOpen(false);
  }

  private currentStageElement: HTMLElement | null = null;
  private pinchStartDist: number | null = null;
  private pinchStartScale = 1;
  private pinchStartMidpoint: { x: number; y: number; scrollLeft: number; scrollTop: number } | null = null;

  private onGlobalTouchStart = (event: TouchEvent): void => {
    if (event.touches.length >= 2) {
      const target = event.target as Element | null;
      const insideStage = target?.closest('.editor__canvas-stage');
      if (!insideStage) {
        event.preventDefault();
      }
    }
  };

  private onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length === 2) {
      // 2 fingers pinch start
      event.preventDefault();
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      this.pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      this.pinchStartScale = this.displaySize()?.scale ?? this.state.zoom();
      const stage = this.stageRef()?.nativeElement;
      if (stage) {
        this.pinchStartMidpoint = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
          scrollLeft: stage.scrollLeft,
          scrollTop: stage.scrollTop,
        };
      }
    }
  };

  private onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length === 2 && this.pinchStartDist && this.pinchStartDist > 0) {
      event.preventDefault();
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = currentDist / this.pinchStartDist;
      
      const newScale = Math.min(5.0, Math.max(0.15, this.pinchStartScale * ratio));
      this.state.setZoom(newScale);

      // Smooth pan while pinching
      const stage = this.stageRef()?.nativeElement;
      if (stage && this.pinchStartMidpoint) {
        const currentMidX = (t1.clientX + t2.clientX) / 2;
        const currentMidY = (t1.clientY + t2.clientY) / 2;
        const dx = currentMidX - this.pinchStartMidpoint.x;
        const dy = currentMidY - this.pinchStartMidpoint.y;
        stage.scrollLeft = this.pinchStartMidpoint.scrollLeft - dx;
        stage.scrollTop = this.pinchStartMidpoint.scrollTop - dy;
      }
    }
  };

  private onTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length < 2) {
      this.pinchStartDist = null;
      this.pinchStartMidpoint = null;
    }
  };

  private observeStage(): void {
    const stage = this.stageRef()?.nativeElement;
    if (this.currentStageElement && this.currentStageElement !== stage) {
      this.currentStageElement.removeEventListener('touchstart', this.onTouchStart);
      this.currentStageElement.removeEventListener('touchmove', this.onTouchMove);
      this.currentStageElement.removeEventListener('touchend', this.onTouchEnd);
      this.currentStageElement.removeEventListener('touchcancel', this.onTouchEnd);
    }
    this.ro?.disconnect();
    this.ro = undefined;
    if (!stage) {
      this.currentStageElement = null;
      return;
    }
    this.currentStageElement = stage;
    stage.addEventListener('touchstart', this.onTouchStart, { passive: false });
    stage.addEventListener('touchmove', this.onTouchMove, { passive: false });
    stage.addEventListener('touchend', this.onTouchEnd, { passive: false });
    stage.addEventListener('touchcancel', this.onTouchEnd, { passive: false });

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
    document.removeEventListener('touchstart', this.onGlobalTouchStart);
    document.removeEventListener('touchmove', this.onGlobalTouchStart);
    if (this.currentStageElement) {
      this.currentStageElement.removeEventListener('touchstart', this.onTouchStart);
      this.currentStageElement.removeEventListener('touchmove', this.onTouchMove);
      this.currentStageElement.removeEventListener('touchend', this.onTouchEnd);
      this.currentStageElement.removeEventListener('touchcancel', this.onTouchEnd);
      this.currentStageElement = null;
    }
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
  scrollToPage(pageId: string, smooth = true): void {
    const stage = this.stageRef()?.nativeElement;
    const el = document.getElementById(`page-wrapper-${pageId}`);
    if (stage && el) {
      this.isAutoScrolling = true;
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
      setTimeout(() => {
        this.isAutoScrolling = false;
      }, 400);
    }
  }

  onPageSelectFromPanel(pageId: string): void {
    this.scrollToPage(pageId);
    if (this.state.mobilePagesOpen()) {
      this.closePagesSheet();
    }
  }

  nextPage(): void {
    const idx = this.pagesStore.currentIndex();
    const pages = this.pagesStore.pages();
    if (idx < pages.length - 1) {
      const nextId = pages[idx + 1].id;
      this.pagesStore.setCurrent(nextId);
      this.scrollToPage(nextId);
    }
  }

  prevPage(): void {
    const idx = this.pagesStore.currentIndex();
    if (idx > 0) {
      const prevId = this.pagesStore.pages()[idx - 1].id;
      this.pagesStore.setCurrent(prevId);
      this.scrollToPage(prevId);
    }
  }

  async exportPdf(): Promise<void> {
    const file = this.files.currentFiles()[0];
    if (!file) {
      this.toasts.error('No document is loaded.');
      return;
    }
    this.exporting.set(true);
    this.state.setIsExporting(true);
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
      this.state.setIsExporting(false);
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

  toggleFit(): void {
    const current = this.state.fitMode();
    const next = current === 'width' ? 'page' : 'width';
    this.state.setFit(next);
  }

  resetZoom(): void {
    this.state.resetZoom();
  }

  readonly isPanning = signal(false);
  readonly isSpacePanning = signal(false);
  private panStart: { x: number; y: number; scrollLeft: number; scrollTop: number } | null = null;

  onStagePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      return;
    }
    const isHand =
      this.state.tool() === 'hand' ||
      this.isSpacePanning() ||
      event.button === 1;
    if (!isHand) {
      return;
    }
    const stage = this.stageRef()?.nativeElement;
    if (!stage) {
      return;
    }
    this.isPanning.set(true);
    this.panStart = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop,
    };
    stage.setPointerCapture?.(event.pointerId);
  }

  onStagePointerMove(event: PointerEvent): void {
    if (!this.isPanning() || !this.panStart) {
      return;
    }
    const stage = this.stageRef()?.nativeElement;
    if (!stage) {
      return;
    }
    const dx = event.clientX - this.panStart.x;
    const dy = event.clientY - this.panStart.y;
    stage.scrollLeft = this.panStart.scrollLeft - dx;
    stage.scrollTop = this.panStart.scrollTop - dy;
  }

  private isAutoScrolling = false;

  onStageScroll(event: Event): void {
    const stage = this.stageRef()?.nativeElement;
    if (!stage || this.isAutoScrolling) {
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const centerY = stageRect.top + stageRect.height / 2;

    const pageElements = stage.querySelectorAll<HTMLElement>('.editor__page-wrapper');
    let closestPageId: string | null = null;
    let minDistance = Infinity;

    for (let i = 0; i < pageElements.length; i++) {
      const el = pageElements[i];
      const rect = el.getBoundingClientRect();
      const pageCenterY = rect.top + rect.height / 2;
      const dist = Math.abs(pageCenterY - centerY);
      if (dist < minDistance) {
        minDistance = dist;
        closestPageId = el.getAttribute('data-page-id');
      }
    }

    if (closestPageId && closestPageId !== this.pagesStore.currentId()) {
      this.pagesStore.setCurrent(closestPageId);
    }
  }

  onPagePointerDown(pageId: string): void {
    if (this.pagesStore.currentId() !== pageId) {
      this.pagesStore.setCurrent(pageId);
    }
  }

  onStagePointerUp(event: PointerEvent): void {
    if (this.isPanning()) {
      this.isPanning.set(false);
      this.panStart = null;
      const stage = this.stageRef()?.nativeElement;
      stage?.releasePointerCapture?.(event.pointerId);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isFullscreen()) {
      void document.exitFullscreen();
      return;
    }

    const target = event.target as HTMLElement | null;
    const isInput =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);

    if (event.code === 'Space' && !isInput && !this.isSpacePanning()) {
      event.preventDefault();
      this.isSpacePanning.set(true);
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

    if (isInput) {
      return;
    }

    // Undo / Redo keyboard shortcuts
    const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
    const isRedo = (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey));
    if (isUndo) {
      event.preventDefault();
      const res = this.state.undo();
      if (res.success && res.description) {
        this.toasts.info(`Undone: ${res.description}`);
      }
      return;
    }
    if (isRedo) {
      event.preventDefault();
      const res = this.state.redo();
      if (res.success && res.description) {
        this.toasts.info(`Redone: ${res.description}`);
      }
      return;
    }

    const selectedIds = this.state.selectedIds();
    if (selectedIds.length === 0) {
      return;
    }

    const hasModifier = event.ctrlKey || event.metaKey;

    if (hasModifier && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      const pageId = this.currentPageId();
      if (event.shiftKey) {
        this.state.ungroupSelected(pageId);
      } else if (event.altKey) {
        this.state.regroupSelected(pageId);
      } else {
        this.state.groupSelected(pageId);
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.state.deleteSelected(this.currentPageId());
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
      for (const id of selectedIds) {
        this.state.nudgeAnnotation(id, dx, dy);
      }
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyup(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.isSpacePanning.set(false);
      if (this.isPanning()) {
        this.isPanning.set(false);
        this.panStart = null;
      }
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
      const targetId = pages[hits[0]].id;
      this.pagesStore.setCurrent(targetId);
      this.scrollToPage(targetId);
    }
  }

  searchNext(): void {
    const hits = this.searchHits();
    if (!hits.length) {
      return;
    }
    const idx = (this.searchHitIndex() + 1) % hits.length;
    this.searchHitIndex.set(idx);
    const targetId = this.pagesStore.pages()[hits[idx]].id;
    this.pagesStore.setCurrent(targetId);
    this.scrollToPage(targetId);
  }

  searchPrev(): void {
    const hits = this.searchHits();
    if (!hits.length) {
      return;
    }
    const idx = (this.searchHitIndex() - 1 + hits.length) % hits.length;
    this.searchHitIndex.set(idx);
    const targetId = this.pagesStore.pages()[hits[idx]].id;
    this.pagesStore.setCurrent(targetId);
    this.scrollToPage(targetId);
  }

  private clearSearch(): void {
    this.searchQuery.set('');
    this.searchHits.set([]);
    this.searchTotal.set(0);
    this.searchHitIndex.set(-1);
  }
}
