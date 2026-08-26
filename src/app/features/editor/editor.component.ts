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
import { NgClass, KeyValuePipe } from '@angular/common';
import { HostListener } from '@angular/core';
import {
  NgxExtendedPdfViewerModule,
  NgxExtendedPdfViewerService,
  FindResultMatchesCount,
  AnnotationEditorType,
  AnnotationEditorEvent,
  EditorAnnotation,
} from 'ngx-extended-pdf-viewer';
import { EDITOR_TOOLS } from '../../core/constants/tools';
import {
  PdfToolId,
  SignatureResult,
  DigitalSignatureRequest,
  AnnotationStyleKind,
  AnnotationStyle,
  NgxAnnotationView,
  NgxAnnotationPatch,
} from '../../core/models/pdf.models';
import { LoadedFile } from '../../core/models/file.models';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { FileService } from '../../core/services/file/file.service';
import { DownloadService } from '../../core/services/download/download.service';
import { PdfViewerService, PageSize } from '../../core/services/pdf/pdf-viewer.service';
import { PdfExportService, ExportTextEdit } from '../../core/services/pdf/pdf-export.service';
import { PdfSignService } from '../../core/services/pdf/pdf-sign.service';
import { ToastService } from '../../core/services/toast.service';
import { SignatureBridgeService } from '../../core/services/signature-bridge.service';
import { PageThumbnailComponent } from './components/page-thumbnail/page-thumbnail.component';
import { PropertiesPanelComponent } from './components/properties-panel/properties-panel.component';
import { SignatureDialogComponent } from './components/signature-dialog/signature-dialog.component';
import { StampDialogComponent } from './components/stamp-dialog/stamp-dialog.component';
import { EditorPagesService } from './state/editor-pages.service';
import { EditorStateService } from './state/editor-state.service';
import { EditorHistoryService } from './state/editor-history.service';

function hexToRgbArray(hex: string): number[] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbArrayToHex(rgb: unknown): string {
  if (!Array.isArray(rgb) || rgb.length < 3) {
    return '#1c1b1b';
  }
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

function toNgxView(a: Record<string, unknown>): NgxAnnotationView | null {
  const type = a['annotationType'] as number | undefined;
  const id = (a['id'] as string | undefined) ?? '';
  const pageIndex = (a['pageIndex'] as number | undefined) ?? 0;
  if (!id) {
    return null;
  }
  let kind: NgxAnnotationView['kind'];
  switch (type) {
    case 3:
      kind = 'text';
      break;
    case 9:
      kind = 'highlight';
      break;
    case 13:
      kind = 'stamp';
      break;
    case 15:
      kind = 'ink';
      break;
    case 16:
      kind = 'comment';
      break;
    default:
      kind = 'image';
  }
  const text =
    (a['value'] as string) ?? (a['content'] as string) ?? '';
  return {
    id,
    kind,
    color: rgbArrayToHex(a['color']),
    opacity: (a['opacity'] as number) ?? 1,
    fontSize: (a['fontSize'] as number) ?? 16,
    thickness: (a['thickness'] as number) ?? 2,
    text,
    pageIndex,
  };
}

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    NgClass,
    KeyValuePipe,
    NgxExtendedPdfViewerModule,
    FileDropzoneComponent,
    PageThumbnailComponent,
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
  private readonly pdfViewer = inject(NgxExtendedPdfViewerService);

  readonly exporting = signal(false);
  readonly viewbarVisible = signal(true);

  /** Blob URL of the loaded PDF, fed to <ngx-extended-pdf-viewer>. */
  readonly pdfSrc = signal<string | null>(null);
  readonly ngxReady = signal(false);
  private readonly pendingSearch = signal<string | null>(null);

  /** Whether the ngx hand tool (pan/drag) is active. */
  readonly handToolOn = signal(false);

  /** Live ngx editor annotations (text/highlight/ink/popup/stamp/image). */
  readonly ngxAnnotations = signal<NgxAnnotationView[]>([]);
  readonly selectedNgxId = signal<string | null>(null);

  /** The currently selected ngx annotation (for the properties inspector). */
  readonly selectedNgxAnnotation = computed(
    () =>
      this.ngxAnnotations().find((a) => a.id === this.selectedNgxId()) ??
      null,
  );

  /** Maps a toolbar tool to a pdf.js annotation editor mode (when applicable). */
  private readonly editorModeTools: Partial<Record<PdfToolId, number>> = {
    text: AnnotationEditorType.FREETEXT,
    highlight: AnnotationEditorType.HIGHLIGHT,
    pen: AnnotationEditorType.INK,
    freehand: AnnotationEditorType.INK,
    comment: AnnotationEditorType.POPUP,
  };

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

  /** 1-based document page number (source order) for <ngx-extended-pdf-viewer>. */
  readonly ngxPage = computed(() => this.currentSourceIndex() + 1);

  /** Zoom value understood by ngx-extended-pdf-viewer. */
  readonly ngxZoom = computed<string | number>(() => {
    const fit = this.state.fitMode();
    if (fit === 'width') {
      return 'page-width';
    }
    if (fit === 'page') {
      return 'page-fit';
    }
    return Math.round(this.state.zoom() * 100);
  });

  /** Rotation accepted by ngx-extended-pdf-viewer (literal union). */
  readonly ngxRotation = computed<0 | 90 | 180 | 270>(
    () => (this.currentRotation() % 360) as 0 | 90 | 180 | 270,
  );

  readonly searchCountLabel = computed(() => {
    if (!this.searchQuery().trim()) {
      return '';
    }
    const total = this.searchTotal();
    const pageCount = this.searchHits().length;
    if (total === 0) {
      return 'No matches';
    }
    const current = this.searchHitIndex();
    const pages = `${pageCount} page${pageCount !== 1 ? 's' : ''}`;
    if (current > 0) {
      return `Match ${current} / ${total} · ${pages}`;
    }
    const matches = `${total} match${total !== 1 ? 'es' : ''}`;
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
        this.signatureBridge.clear();
        this.addImageAnnotation(
          pending.dataUrl,
          pending.width,
          pending.height,
        );
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
    const src = this.pdfSrc();
    if (src) {
      URL.revokeObjectURL(src);
    }
  }

  private setPdfSrc(data: ArrayBuffer): void {
    const prev = this.pdfSrc();
    if (prev) {
      URL.revokeObjectURL(prev);
    }
    const blob = new Blob([data], { type: 'application/pdf' });
    this.pdfSrc.set(URL.createObjectURL(blob));
    this.ngxReady.set(false);
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
    if (id === 'hand') {
      this.handToolOn.set(true);
      this.state.setTool('hand');
      this.activateEditorMode(AnnotationEditorType.NONE);
      return;
    }
    if (id === 'select') {
      this.handToolOn.set(false);
      this.state.setTool('select');
      this.activateEditorMode(AnnotationEditorType.NONE);
      return;
    }
    const mode = this.editorModeTools[id];
    if (mode !== undefined) {
      this.handToolOn.set(false);
      this.state.setTool(id);
      this.activateEditorMode(mode);
      this.applyStyleToEditor(id as AnnotationStyleKind);
      return;
    }
    this.handToolOn.set(false);
    this.applyActionTool(id);
  }

  /** Switches the live annotation editor mode in the ngx viewer. */
  private activateEditorMode(mode: number): void {
    if (!this.ngxReady()) {
      this.toasts.info('The document is still loading. Try again in a moment.');
      return;
    }
    this.pdfViewer.switchAnnotationEdtorMode(mode);
  }

  /** Pushes the saved style defaults for a tool into the ngx editor so newly
   * drawn annotations adopt the chosen color/size/opacity/thickness. */
  private applyStyleToEditor(kind: AnnotationStyleKind): void {
    if (!this.ngxReady()) {
      return;
    }
    const s = this.state.style(kind);
    if (kind === 'text') {
      this.pdfViewer.editorFontSize = s.fontSize;
      this.pdfViewer.editorFontColor = s.color;
    } else if (kind === 'highlight') {
      this.pdfViewer.editorHighlightColor = s.color;
      this.pdfViewer.editorHighlightThickness = s.thickness;
    } else if (kind === 'pen' || kind === 'freehand') {
      this.pdfViewer.editorInkColor = s.color;
      this.pdfViewer.editorInkThickness = s.thickness;
      this.pdfViewer.editorInkOpacity = s.opacity;
    }
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
        this.addImageAnnotation(dataUrl, img.naturalWidth, img.naturalHeight);
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
    this.addImageAnnotation(result.dataUrl, result.width, result.height);
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
    this.addStamp(result.text, result.color);
  }

  /* ---- Annotation creation (delegated to ngx-extended-pdf-viewer) ---- */

  private currentPageSize(): PageSize | null {
    const idx = this.currentSourceIndex();
    if (idx < 0) {
      return null;
    }
    return this.baseSizes().get(idx) ?? null;
  }

  /** Adds an image (signature / uploaded image) as a real stamp annotation. */
  private addImageAnnotation(
    dataUrl: string,
    naturalWidth: number,
    naturalHeight: number,
  ): void {
    const size = this.currentPageSize();
    const idx = this.currentSourceIndex();
    if (!size || idx < 0) {
      this.toasts.error('Open a document before adding media.');
      return;
    }
    const maxWidth = 200;
    const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
    const w = naturalWidth * scale;
    const h = naturalHeight * scale;
    const left = size.width / 2 - w / 2;
    const bottom = size.height / 2 - h / 2;
    void this.pdfViewer
      .addImageToAnnotationLayer({
        urlOrDataUrl: dataUrl,
        page: idx,
        left,
        bottom,
        right: left + w,
        top: bottom + h,
        rotation: 0,
      })
      .then(() => {
        this.toasts.success(`Added to page ${idx + 1}`);
        this.state.setTool('select');
        this.activateEditorMode(AnnotationEditorType.NONE);
      })
      .catch(() => this.toasts.error('Could not add the image.'));
  }

  /** Adds a vector shape / text rendered to SVG as a real stamp annotation. */
  private addSvgAnnotation(svg: string, width: number, height: number): void {
    const size = this.currentPageSize();
    const idx = this.currentSourceIndex();
    if (!size || idx < 0) {
      this.toasts.error('Open a document before adding annotations.');
      return;
    }
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const left = size.width / 2 - width / 2;
    const bottom = size.height / 2 - height / 2;
    void this.pdfViewer
      .addImageToAnnotationLayer({
        urlOrDataUrl: dataUrl,
        page: idx,
        left,
        bottom,
        right: left + width,
        top: bottom + height,
        rotation: 0,
      })
      .then(() => {
        this.toasts.success(`Added to page ${idx + 1}`);
        this.state.setTool('select');
        this.activateEditorMode(AnnotationEditorType.NONE);
      })
      .catch(() => this.toasts.error('Could not add the annotation.'));
  }

  private addShape(kind: string): void {
    const styleKind: AnnotationStyleKind =
      kind === 'underline'
        ? 'underline'
        : kind === 'strikethrough'
          ? 'strikethrough'
          : 'pen';
    const s = this.state.style(styleKind);
    const ink = s.color;
    const sw = Math.max(1, s.thickness);
    const op = s.opacity;
    const wrap = (inner: string) => `<g opacity="${op}">${inner}</g>`;
    switch (kind) {
      case 'rectangle': {
        const w = 220;
        const h = 140;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${wrap(`<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`)}</svg>`;
        this.addSvgAnnotation(svg, w, h);
        break;
      }
      case 'circle': {
        const w = 160;
        const h = 160;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${wrap(`<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 1}" ry="${h / 2 - 1}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`)}</svg>`;
        this.addSvgAnnotation(svg, w, h);
        break;
      }
      case 'line': {
        const w = 220;
        const h = 6;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${wrap(`<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="${ink}" stroke-width="${sw}"/>`)}</svg>`;
        this.addSvgAnnotation(svg, w, h);
        break;
      }
      case 'arrow': {
        const w = 220;
        const h = 12;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${wrap(`<line x1="0" y1="${h / 2}" x2="${w - 10}" y2="${h / 2}" stroke="${ink}" stroke-width="${sw}"/><polygon points="${w - 2},${h / 2} ${w - 10},${h / 2 - 5} ${w - 10},${h / 2 + 5}" fill="${ink}"/>`)}</svg>`;
        this.addSvgAnnotation(svg, w, h);
        break;
      }
      case 'underline': {
        const w = 220;
        const h = 4;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${wrap(`<line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}" stroke="${ink}" stroke-width="${sw}"/>`)}</svg>`;
        this.addSvgAnnotation(svg, w, h);
        break;
      }
      case 'strikethrough': {
        const w = 220;
        const h = 4;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${wrap(`<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="${ink}" stroke-width="${sw}"/>`)}</svg>`;
        this.addSvgAnnotation(svg, w, h);
        break;
      }
      default:
        break;
    }
  }

  private addStamp(text: string, color: string): void {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const fontSize = 18;
    const w = Math.max(80, escaped.length * fontSize * 0.6 + 16);
    const h = fontSize * 1.6;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="8" y="${h * 0.75}" font-family="sans-serif" font-size="${fontSize}" font-weight="700" fill="${color}">${escaped}</text></svg>`;
    this.addSvgAnnotation(svg, w, h);
  }

  private applyActionTool(id: PdfToolId): void {
    if (id === 'eraser') {
      this.erasePageAnnotations();
      return;
    }
    this.addShape(id);
  }

  private erasePageAnnotations(): void {
    const idx = this.currentSourceIndex();
    if (idx < 0) {
      this.toasts.error('Open a document first.');
      return;
    }
    this.pdfViewer.removeEditorAnnotations((a: object) => {
      const rec = a as { pageIndex?: number };
      return rec.pageIndex === idx;
    });
    this.toasts.success(`Cleared annotations on page ${idx + 1}`);
  }

  /* ---- Live ngx annotation tracking + properties ---- */

  /** Handles annotation editor events emitted by ngx-extended-pdf-viewer. */
  onAnnotationEvent(event: AnnotationEditorEvent): void {
    if (
      event.id &&
      [
        'added',
        'commit',
        'colorChanged',
        'fontSizeChanged',
        'thicknessChanged',
        'opacityChanged',
        'sizeChanged',
        'moved',
      ].includes(event.type)
    ) {
      this.selectedNgxId.set(event.id);
    }
    if (event.type === 'removed' && this.selectedNgxId() === event.id) {
      this.selectedNgxId.set(null);
    }
    this.scheduleAnnotationRefresh();
  }

  selectNgxAnnotation(id: string): void {
    this.selectedNgxId.set(id);
  }

  /** Commits a style default change from the properties panel. */
  onStyleChange(kind: AnnotationStyleKind, patch: Partial<AnnotationStyle>): void {
    this.state.updateStyle(kind, patch);
    const active = this.state.tool();
    const toolToStyle: Partial<Record<PdfToolId, AnnotationStyleKind>> = {
      text: 'text',
      highlight: 'highlight',
      pen: 'pen',
      freehand: 'freehand',
      comment: 'comment',
    };
    if (toolToStyle[active] === kind) {
      this.applyStyleToEditor(kind);
    }
  }

  async updateNgxAnnotation(id: string, patch: NgxAnnotationPatch): Promise<void> {
    const list = this.pdfViewer.getSerializedAnnotations();
    const current = list?.find((a) => (a as { id?: string }).id === id);
    if (!current) {
      return;
    }
    const next = { ...current } as Record<string, unknown>;
    if (patch.color !== undefined) {
      next['color'] = hexToRgbArray(patch.color);
    }
    if (patch.opacity !== undefined) {
      next['opacity'] = patch.opacity;
    }
    if (patch.fontSize !== undefined) {
      next['fontSize'] = patch.fontSize;
    }
    if (patch.thickness !== undefined) {
      next['thickness'] = patch.thickness;
    }
    if (patch.text !== undefined) {
      if (next['annotationType'] === 3) {
        next['value'] = patch.text;
      } else if (next['annotationType'] === 16) {
        next['content'] = patch.text;
      }
    }
    this.pdfViewer.removeEditorAnnotations(
      (a: object) => (a as { id?: string }).id === id,
    );
    await this.pdfViewer.addEditorAnnotation(next as unknown as EditorAnnotation);
    const refreshed = this.pdfViewer.getSerializedAnnotations() ?? [];
    const match = refreshed.find(
      (a) =>
        (a as { annotationType?: number }).annotationType ===
          (current as { annotationType?: number }).annotationType &&
        (a as { pageIndex?: number }).pageIndex ===
          (current as { pageIndex?: number }).pageIndex &&
        ((a as { value?: string }).value ?? (a as { content?: string }).content) ===
          ((next['value'] as string) ??
            (next['content'] as string) ??
            (current as { value?: string }).value ??
            (current as { content?: string }).content),
    );
    this.selectedNgxId.set(match?.id ?? null);
    this.refreshAnnotations();
  }

  deleteNgxAnnotation(id: string): void {
    this.pdfViewer.removeEditorAnnotations(
      (a: object) => (a as { id?: string }).id === id,
    );
    if (this.selectedNgxId() === id) {
      this.selectedNgxId.set(null);
    }
    this.scheduleAnnotationRefresh();
  }

  private refreshAnnotations(): void {
    const raw = this.pdfViewer.getSerializedAnnotations();
    if (!raw) {
      this.ngxAnnotations.set([]);
      return;
    }
    const views = raw
      .map((a) => toNgxView(a as Record<string, unknown>))
      .filter((v): v is NgxAnnotationView => v !== null);
    this.ngxAnnotations.set(views);
  }

  private refreshTimer?: ReturnType<typeof setTimeout>;
  private scheduleAnnotationRefresh(): void {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refreshAnnotations(), 120);
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
      this.setPdfSrc(file.data);
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

  toggleTextEdit(): void {
    this.state.toggleTextEdit();
  }

  toggleViewbar(): void {
    this.viewbarVisible.update((v) => !v);
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
    const key = event.key;
    if (key === 'Delete' || key === 'Backspace') {
      const id = this.state.selectedId();
      if (id) {
        event.preventDefault();
        this.state.removeAnnotation(id);
        return;
      }
      if (this.pagesStore.selectedCount() > 0) {
        event.preventDefault();
        this.pagesStore.deleteSelected();
        return;
      }
    }
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) {
      return;
    }
    const lower = key.toLowerCase();
    if (lower === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
    } else if (lower === 'y') {
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
      let baseBytes = new Uint8Array(file.data.slice(0));
      if (this.ngxReady()) {
        const annotations = this.pdfViewer.getSerializedAnnotations();
        if (annotations && annotations.length) {
          try {
            const blob = await this.pdfViewer.getCurrentDocumentAsBlob();
            if (blob) {
              baseBytes = new Uint8Array(await blob.arrayBuffer());
            }
          } catch {
            /* keep original bytes if the serialized export fails */
          }
        }
      }
      const display = this.displaySize();
      const scale = display?.scale ?? 1;
      const pages = this.pagesStore.pages().map((p) => {
        const base = this.baseSizes().get(p.sourceIndex);
        return {
          sourceIndex: p.sourceIndex,
          rotation: p.rotation,
          width: base?.width ?? 0,
          height: base?.height ?? 0,
          scale,
          annotations: [],
        };
      });
      let bytes = await this.exporter.exportDocument(baseBytes, pages, {
        title: file.name.replace(/\.pdf$/i, ''),
        textEdits: [],
      });
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

  private async buildTextEdits(): Promise<ExportTextEdit[]> {
    const overrides = this.state.getTextOverrides();
    const edits: ExportTextEdit[] = [];
    for (const [pageIndex, pageMap] of overrides) {
      let raw: Awaited<ReturnType<PdfViewerService['getPageRawTextItems']>>;
      try {
        raw = await this.viewer.getPageRawTextItems(pageIndex);
      } catch {
        continue;
      }
      const rawById = new Map(raw.map((r) => [r.id, r]));
      for (const [id, str] of pageMap) {
        const item = rawById.get(id);
        if (!item || str === item.str) {
          continue;
        }
        edits.push({
          pageIndex,
          box: item.pdfRect,
          baseline: item.baseline,
          fontSize: item.fontSize,
          text: str,
          removed: str === '',
        });
      }
    }
    return edits;
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

  /* Search (delegated to ngx-extended-pdf-viewer's FindController) */
  onSearch(value: string): void {
    this.searchQuery.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.runSearch(value), 300);
  }

  private runSearch(query: string): void {
    const q = query.trim();
    if (!q) {
      this.clearSearch();
      return;
    }
    this.searchQuery.set(q);
    if (this.ngxReady()) {
      this.pdfViewer.find(q, { findMultiple: true, highlightAll: true });
    } else {
      this.pendingSearch.set(q);
    }
  }

  searchNext(): void {
    this.pdfViewer.findNext();
  }

  searchPrev(): void {
    this.pdfViewer.findPrevious();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.pendingSearch.set(null);
    this.searchTotal.set(0);
    this.searchHits.set([]);
    this.searchHitIndex.set(-1);
    if (this.ngxReady()) {
      this.pdfViewer.find('');
    }
  }

  /* ngx-extended-pdf-viewer integration */
  onNgxLoaded(): void {
    this.ngxReady.set(true);
    this.refreshAnnotations();
    // Re-apply the active tool's style defaults once the viewer is ready.
    const active = this.state.tool();
    if (active === 'text' || active === 'highlight' || active === 'pen' || active === 'freehand' || active === 'comment') {
      this.applyStyleToEditor(active as AnnotationStyleKind);
    }
    const pending = this.pendingSearch();
    if (pending) {
      this.pendingSearch.set(null);
      this.runSearch(pending);
    }
  }

  onNgxPageChange(page: number): void {
    const target = this.pagesStore
      .pages()
      .find((p) => p.sourceIndex === page - 1);
    if (target) {
      this.pagesStore.setCurrent(target.id);
    }
  }

  onFindCount(event: FindResultMatchesCount): void {
    this.searchTotal.set(event.total);
    this.searchHits.set(Array.isArray(event.matches) ? event.matches : []);
    const current = event.current ?? -1;
    this.searchHitIndex.set(current > 0 ? current : -1);
  }
}
