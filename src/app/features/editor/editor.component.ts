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
import { Router, RouterLink } from '@angular/router';
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
  ShapeKind,
  TextAnnotation,
  HighlightAnnotation,
  ImageAnnotation,
  SignatureAnnotation,
  StampAnnotation,
  BlendMode,
  AspectRatioMode,
  IconStyleType,
} from '../../core/models/pdf.models';
import {
  SHAPE_CATEGORIES,
  SHAPE_DEFINITIONS,
  ICON_CATEGORIES,
  ICON_DEFINITIONS,
  ALL_SHAPE_DEFINITIONS,
  ICON_STYLE_OPTIONS,
} from '../../core/constants/shapes';
import { LoadedFile } from '../../core/models/file.models';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { SignatureModalComponent, SignatureResult } from '../../shared/components/signature-modal/signature-modal.component';
import { StampModalComponent, StampResult } from '../../shared/components/stamp-modal/stamp-modal.component';
import { ExportModalComponent } from '../../shared/components/export-modal/export-modal.component';
import { DetailedExportOptions, ExportProgressUpdate, sanitizePdfFilename } from '../../core/models/export.models';
import { FileService } from '../../core/services/file/file.service';
import { DownloadService } from '../../core/services/download/download.service';
import { PdfViewerService, PageSize } from '../../core/services/pdf/pdf-viewer.service';
import { PdfExportService } from '../../core/services/pdf/pdf-export.service';
import { ToastService } from '../../core/services/toast.service';
import { DialogService } from '../../core/services/dialog.service';
import { DocumentStorageService } from '../../core/services/storage/document-storage.service';
import { RecentFilesService, RecentFileEntry } from '../../core/services/storage/recent-files.service';
import { formatRelativeTime } from '../../core/utilities/time.util';
import { PdfPageComponent } from './components/pdf-page/pdf-page.component';
import { EditorOverlayComponent } from './components/editor-overlay/editor-overlay.component';
import { PropertiesPanelComponent } from './components/properties-panel/properties-panel.component';
import { PagesPanelComponent } from './components/pages-panel/pages-panel.component';
import { EditorPage } from './models/editor-page.model';
import { EditorPagesService } from './state/editor-pages.service';
import { EditorStateService } from './state/editor-state.service';

import { MobileTooltipDirective } from '../../shared/directives/mobile-tooltip.directive';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    RouterLink,
    NgClass,
    KeyValuePipe,
    NgxExtendedPdfViewerModule,
    FileDropzoneComponent,
    SignatureModalComponent,
    StampModalComponent,
    ExportModalComponent,
    PdfPageComponent,
    EditorOverlayComponent,
    PropertiesPanelComponent,
    PagesPanelComponent,
    MobileTooltipDirective,
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
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly storage = inject(DocumentStorageService);
  private readonly recentFiles = inject(RecentFilesService);
  readonly pagesStore = inject(EditorPagesService);
  readonly state = inject(EditorStateService);

  readonly exporting = signal(false);
  readonly isFullscreen = signal(false);
  /** Session-level workspace preferences; collapsed panels remain as icon rails. */
  readonly pagesPanelCollapsed = signal(false);
  readonly propertiesPanelCollapsed = signal(false);

  /** Recent file entries for landing page and dropdown. */
  readonly recentEntries = signal<RecentFileEntry[]>([]);
  /** Controls visibility of the recent files dropdown on desktop. */
  readonly showRecentDropdown = signal(false);
  readonly recentSearch = signal<string>('');

  readonly currentDocName = computed(
    () => this.files.currentFiles()[0]?.name ?? '',
  );

  readonly filteredRecentEntries = computed(() => {
    const q = this.recentSearch().trim().toLowerCase();
    const currentName = this.currentDocName().trim().toLowerCase();
    let list = this.recentEntries();

    // Filter out the currently opened file
    if (currentName) {
      list = list.filter((e) => e.name.toLowerCase() !== currentName);
    }

    if (!q) {
      return list;
    }
    return list.filter((e) => e.name.toLowerCase().includes(q));
  });

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

  readonly selectedImageAnnotation = computed<ImageAnnotation | null>(() => {
    const ann = this.selectedAnnotation();
    return ann && ann.type === 'image' ? (ann as ImageAnnotation) : null;
  });

  readonly selectedSignatureAnnotation = computed<SignatureAnnotation | null>(() => {
    const ann = this.selectedAnnotation();
    return ann && ann.type === 'signature' ? (ann as SignatureAnnotation) : null;
  });

  readonly mobileBlendModes: ReadonlyArray<{ value: BlendMode; label: string }> = [
    { value: 'normal', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'darken', label: 'Darken' },
    { value: 'lighten', label: 'Lighten' },
    { value: 'difference', label: 'Diff' },
  ];

  readonly mobileRatioModes: ReadonlyArray<{ value: AspectRatioMode; label: string }> = [
    { value: 'free', label: 'Free' },
    { value: 'original', label: 'Orig' },
    { value: '1:1', label: '1:1' },
    { value: '4:3', label: '4:3' },
    { value: '16:9', label: '16:9' },
    { value: '3:2', label: '3:2' },
  ];

  setImageBlendMode(mode: BlendMode): void {
    const img = this.selectedImageAnnotation() || this.selectedSignatureAnnotation();
    if (img && !img.locked) {
      this.state.updateAnnotation(img.id, { blendMode: mode });
    }
  }

  setImageAspectRatioMode(mode: AspectRatioMode): void {
    const img = this.selectedImageAnnotation();
    if (!img || img.locked) return;
    const updates: Partial<ImageAnnotation> = {
      aspectRatioMode: mode,
      lockAspectRatio: mode !== 'free',
    };
    let ratio: number | null = null;
    if (mode === 'original') {
      ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
    } else if (mode === '1:1') {
      ratio = 1;
    } else if (mode === '4:3') {
      ratio = 4 / 3;
    } else if (mode === '16:9') {
      ratio = 16 / 9;
    } else if (mode === '3:2') {
      ratio = 3 / 2;
    }

    if (ratio && ratio > 0) {
      const currentW = img.rect.width;
      const newH = Math.round(currentW / ratio);
      updates.rect = { ...img.rect, height: newH };
    }

    this.state.updateAnnotation(img.id, updates);
  }

  toggleImageLockRatio(): void {
    const img = this.selectedImageAnnotation() || this.selectedSignatureAnnotation();
    if (img && !img.locked) {
      this.state.updateAnnotation(img.id, { lockAspectRatio: !img.lockAspectRatio });
    }
  }

  toggleImageFlipH(): void {
    const img = this.selectedImageAnnotation();
    if (img && !img.locked) {
      this.state.updateAnnotation(img.id, { flipHorizontal: !img.flipHorizontal });
    }
  }

  toggleImageFlipV(): void {
    const img = this.selectedImageAnnotation();
    if (img && !img.locked) {
      this.state.updateAnnotation(img.id, { flipVertical: !img.flipVertical });
    }
  }

  resetImageSize(): void {
    const img = this.selectedImageAnnotation();
    if (img && !img.locked) {
      const nw = img.naturalWidth || 200;
      const nh = img.naturalHeight || 150;
      this.state.updateAnnotation(img.id, {
        rect: { ...img.rect, width: nw, height: nh },
        aspectRatioMode: 'original',
        lockAspectRatio: true,
      });
    }
  }

  setTextFontSize(size: number): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      this.state.updateAnnotation(textAnn.id, { fontSize: size } as Partial<TextAnnotation>);
    }
    this.state.setTextFontSize(size);
  }

  setTextFontFamily(family: string): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      this.state.updateAnnotation(textAnn.id, { fontFamily: family } as Partial<TextAnnotation>);
    }
    this.state.setTextFontFamily(family);
  }

  toggleTextBold(): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      const nextWeight = textAnn.fontWeight >= 700 ? 400 : 700;
      this.state.updateAnnotation(textAnn.id, { fontWeight: nextWeight } as Partial<TextAnnotation>);
    }
    this.state.toggleTextBold();
  }

  toggleTextItalic(): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      this.state.updateAnnotation(textAnn.id, { italic: !textAnn.italic } as Partial<TextAnnotation>);
    }
    this.state.toggleTextItalic();
  }

  toggleTextUnderline(): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      this.state.updateAnnotation(textAnn.id, { underline: !textAnn.underline } as Partial<TextAnnotation>);
    }
  }

  setTextAlign(align: 'left' | 'center' | 'right'): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      this.state.updateAnnotation(textAnn.id, { align } as Partial<TextAnnotation>);
    }
  }

  rotateSelectedAnnotation(deg = 90): void {
    const sel = this.selectedAnnotation();
    if (sel && !sel.locked) {
      const nextRot = ((sel.rotation || 0) + deg) % 360;
      this.state.updateAnnotation(sel.id, { rotation: nextRot });
    }
  }

  setTextColor(color: string): void {
    const textAnn = this.selectedTextAnnotation();
    if (textAnn && !textAnn.locked) {
      this.state.updateAnnotation(textAnn.id, { color } as Partial<TextAnnotation>);
    }
    this.state.setTextColor(color);
  }

  setShapeStrokeColor(color: string): void {
    const sel = this.selectedAnnotation();
    if (sel && sel.type === 'shape' && !sel.locked) {
      this.state.updateAnnotation(sel.id, { strokeColor: color } as Partial<ShapeAnnotation>);
    }
    this.state.setShapeStrokeColor(color);
  }

  setShapeStrokeWidth(w: number): void {
    const sel = this.selectedAnnotation();
    if (sel && sel.type === 'shape' && !sel.locked) {
      this.state.updateAnnotation(sel.id, { strokeWidth: w } as Partial<ShapeAnnotation>);
    }
    this.state.setShapeStrokeWidth(w);
  }

  toggleShapeFill(): void {
    const sel = this.selectedAnnotation();
    if (sel && sel.type === 'shape' && !sel.locked) {
      const current = (sel as ShapeAnnotation).fillColor;
      const isTransparent = !current || current === 'transparent';
      const nextFill = isTransparent ? 'rgba(37,99,235,0.12)' : 'transparent';
      this.state.updateAnnotation(sel.id, { fillColor: nextFill } as Partial<ShapeAnnotation>);
    }
    this.state.toggleShapeFill();
  }

  setShapeFillColor(color: string): void {
    const sel = this.selectedAnnotation();
    if (sel && sel.type === 'shape' && !sel.locked) {
      this.state.updateAnnotation(sel.id, { fillColor: color } as Partial<ShapeAnnotation>);
    }
    this.state.setShapeFillColor(color);
  }

  setHighlightColor(color: string): void {
    const sel = this.selectedAnnotation();
    if (
      sel &&
      (sel.type === 'highlight' || sel.type === 'underline' || sel.type === 'strikethrough') &&
      !sel.locked
    ) {
      this.state.updateAnnotation(sel.id, { color } as Partial<HighlightAnnotation>);
    }
    const t = this.state.tool();
    if (t === 'underline') {
      this.state.setUnderlineColor(color);
    } else if (t === 'strikethrough') {
      this.state.setStrikethroughColor(color);
    } else {
      this.state.setHighlightColor(color);
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
  readonly shapeCategories = SHAPE_CATEGORIES;
  readonly shapeDefinitions = SHAPE_DEFINITIONS;
  readonly shapeMenuOpen = signal<boolean>(false);
  readonly selectedShapeCategory = signal<string>('all');
  readonly shapeSearchQuery = signal<string>('');

  readonly iconCategories = ICON_CATEGORIES;
  readonly iconDefinitions = ICON_DEFINITIONS;
  readonly iconMenuOpen = signal<boolean>(false);
  readonly selectedIconCategory = signal<string>('all');
  readonly iconSearchQuery = signal<string>('');

  readonly activeShapeDefinition = computed(() => {
    const sel = this.selectedAnnotation();
    const k = (sel && sel.type === 'shape' ? sel.kind : this.state.shapeKind()) || 'rectangle';
    return this.shapeDefinitions.find((s) => s.id === k) || ALL_SHAPE_DEFINITIONS.find((s) => s.id === k) || this.shapeDefinitions[0];
  });

  readonly activeIconDefinition = computed(() => {
    const sel = this.selectedAnnotation();
    const k = (sel && sel.type === 'shape' && sel.renderMode === 'icon' ? sel.kind : this.state.iconKind()) || 'ui-browser';
    return this.iconDefinitions.find((s) => s.id === k) || ALL_SHAPE_DEFINITIONS.find((s) => s.id === k) || this.iconDefinitions[0];
  });

  readonly filteredShapes = computed(() => {
    const q = this.shapeSearchQuery().trim().toLowerCase();
    const cat = this.selectedShapeCategory();
    return this.shapeDefinitions.filter((s) => {
      const matchCat = cat === 'all' || s.category === cat;
      const matchQuery = !q || s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  });

  readonly filteredIcons = computed(() => {
    const q = this.iconSearchQuery().trim().toLowerCase();
    const cat = this.selectedIconCategory();
    return this.iconDefinitions.filter((s) => {
      const matchCat = cat === 'all' || s.category === cat;
      const matchQuery = !q || s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  });

  readonly mobileCategoryShapes = computed(() => {
    const cat = this.selectedShapeCategory();
    if (cat === 'all') {
      return this.shapeDefinitions;
    }
    return this.shapeDefinitions.filter((s) => s.category === cat);
  });

  readonly mobileCategoryIcons = computed(() => {
    const cat = this.selectedIconCategory();
    if (cat === 'all') {
      return this.iconDefinitions;
    }
    return this.iconDefinitions.filter((s) => s.category === cat);
  });

  readonly mobileCategoryLabel = computed(() => {
    const catId = this.selectedShapeCategory();
    if (catId === 'all') return 'All';
    const c = this.shapeCategories.find((cat) => cat.id === catId);
    return c ? c.label : catId;
  });

  readonly mobileIconCategoryLabel = computed(() => {
    const catId = this.selectedIconCategory();
    if (catId === 'all') return 'All';
    const c = this.iconCategories.find((cat) => cat.id === catId);
    return c ? c.label : catId;
  });

  setMobileShapeCategory(catId: string): void {
    this.selectedShapeCategory.set(catId);
    const catShapes = catId === 'all' ? this.shapeDefinitions : this.shapeDefinitions.filter((s) => s.category === catId);
    if (catShapes.length > 0 && !catShapes.some((s) => s.id === this.state.shapeKind())) {
      this.state.setShapeKind(catShapes[0].id);
      const sel = this.selectedAnnotation();
      if (sel && sel.type === 'shape') {
        this.state.updateAnnotation(sel.id, { kind: catShapes[0].id, renderMode: 'shape' });
      }
    }
  }

  setMobileIconCategory(catId: string): void {
    this.selectedIconCategory.set(catId);
    const catIcons = catId === 'all' ? this.iconDefinitions : this.iconDefinitions.filter((s) => s.category === catId);
    if (catIcons.length > 0 && !catIcons.some((s) => s.id === this.state.iconKind())) {
      this.state.setIconKind(catIcons[0].id);
      const sel = this.selectedAnnotation();
      if (sel && sel.type === 'shape') {
        this.state.updateAnnotation(sel.id, { kind: catIcons[0].id, renderMode: 'icon' });
      }
    }
  }

  openCategoryShapes(catId: string): void {
    this.selectedShapeCategory.set(catId);
    this.shapeSearchQuery.set('');
    this.shapeMenuOpen.set(true);
  }

  openCategoryIcons(catId: string): void {
    this.selectedIconCategory.set(catId);
    this.iconSearchQuery.set('');
    this.iconMenuOpen.set(true);
  }

  toggleShapeMenu(): void {
    this.shapeMenuOpen.update((v) => !v);
  }

  closeShapeMenu(): void {
    this.shapeMenuOpen.set(false);
  }

  toggleIconMenu(): void {
    this.iconMenuOpen.update((v) => !v);
  }

  closeIconMenu(): void {
    this.iconMenuOpen.set(false);
  }

  onShapeToolClick(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    this.selectTool('shape');
    if (!isMobile) {
      this.propertiesPanelCollapsed.set(false);
      this.closeShapeMenu();
    } else {
      this.closeShapeMenu();
    }
  }

  onIconToolClick(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    this.selectTool('icon');
    if (!isMobile) {
      this.propertiesPanelCollapsed.set(false);
      this.closeIconMenu();
    } else {
      this.closeIconMenu();
    }
  }

  selectShapeKind(kind: ShapeKind): void {
    this.state.setShapeKind(kind);
    const sel = this.selectedAnnotation();
    if (sel && sel.type === 'shape') {
      this.state.updateAnnotation(sel.id, { kind, renderMode: 'shape' });
    }
    this.state.setTool('shape');
    this.closeShapeMenu();
  }

  selectShapeKindMobile(kind: ShapeKind): void {
    this.state.setShapeKind(kind);
    const sel = this.selectedAnnotation();
    if (sel && sel.type === 'shape') {
      this.state.updateAnnotation(sel.id, { kind, renderMode: 'shape' });
    }
    this.state.setTool('shape');
  }

  selectIconKind(kind: ShapeKind): void {
    this.state.setIconKind(kind);
    const sel = this.selectedAnnotation();
    if (sel && sel.type === 'shape') {
      this.state.updateAnnotation(sel.id, { kind, renderMode: 'icon' });
    }
    this.state.setTool('icon');
    this.closeIconMenu();
  }

  selectIconKindMobile(kind: ShapeKind): void {
    this.state.setIconKind(kind);
    const sel = this.selectedAnnotation();
    if (sel && sel.type === 'shape') {
      this.state.updateAnnotation(sel.id, { kind, renderMode: 'icon' });
    }
    this.state.setTool('icon');
  }

  toggleAnnotationRenderMode(ann: ShapeAnnotation): void {
    const next = (ann.renderMode || 'shape') === 'icon' ? 'shape' : 'icon';
    this.state.updateAnnotation(ann.id, { renderMode: next });
  }

  readonly iconStyleOptions = ICON_STYLE_OPTIONS;

  setAnnotationIconStyle(ann: ShapeAnnotation, style: IconStyleType): void {
    this.state.updateAnnotation(ann.id, { iconStyle: style });
  }

  getAnnotationIconStyle(ann: ShapeAnnotation): IconStyleType {
    return ann.iconStyle || this.state.iconStyle() || 'outlined';
  }

  iconLabelOf(kind: ShapeKind): string {
    const s = this.iconDefinitions.find((def) => def.id === kind) || ALL_SHAPE_DEFINITIONS.find((def) => def.id === kind);
    return s ? s.label : kind;
  }

  shapeLabelOf(kind: ShapeKind): string {
    const s = this.shapeDefinitions.find((def) => def.id === kind) || ALL_SHAPE_DEFINITIONS.find((def) => def.id === kind);
    return s ? s.label : kind;
  }

  getShapeIconClass(ann: ShapeAnnotation): string {
    const s = ALL_SHAPE_DEFINITIONS.find((def) => def.id === ann.kind);
    return s ? s.icon : 'fa-solid fa-shapes';
  }

  toggleAnnotationResizeMode(ann: ShapeAnnotation): void {
    const curr = ann.resizeMode || this.state.resizeMode();
    const next = curr === 'fixed' ? 'free' : 'fixed';
    this.state.updateAnnotation(ann.id, { resizeMode: next });
  }

  readonly docName = signal<string | null>(null);
  readonly loading = signal(false);
  readonly searchQuery = signal('');
  readonly searchHits = signal<number[]>([]);
  readonly searchTotal = signal(0);
  readonly searchHitIndex = signal(-1);

  private readonly editorRef = viewChild<ElementRef<HTMLDivElement>>('editor');
  private readonly stageRef = viewChild<ElementRef<HTMLDivElement>>('stage');
  private readonly pagesStackRef = viewChild<ElementRef<HTMLElement>>('pagesStack');
  readonly imageInputRef = viewChild<ElementRef<HTMLInputElement>>('imageFileInput');
  readonly isSignatureModalOpen = signal<boolean>(false);
  readonly isStampModalOpen = signal<boolean>(false);
  readonly isExportModalOpen = signal<boolean>(false);
  readonly exportProgress = signal<ExportProgressUpdate | null>(null);
  readonly defaultExportFilename = computed<string>(() => {
    const name = this.docName();
    if (!name) return 'document-edited.pdf';
    return name.replace(/\.pdf$/i, '') + '-edited.pdf';
  });
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
    const isMobile = stage.width < 768;
    const minZoom = isMobile ? 0.4 : 0.1;
    const maxZoom = isMobile ? 3.5 : 5.0;
    scale = Math.min(maxZoom, Math.max(minZoom, scale));
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

  readonly pinchLiveZoom = signal<number | null>(null);

  readonly renderWindow = computed(() => {
    const curr = this.pagesStore.currentIndex();
    const total = this.pagesStore.pagesCount();
    if (curr < 0 || total === 0) {
      return { min: 0, max: 2 };
    }
    return {
      min: Math.max(0, curr - 1),
      max: Math.min(total - 1, curr + 1),
    };
  });

  isPageInRenderWindow(idx: number): boolean {
    const w = this.renderWindow();
    return idx >= w.min && idx <= w.max;
  }

  readonly zoomLabel = computed(() => {
    const live = this.pinchLiveZoom();
    if (live !== null) {
      return `${Math.round(live * 100)}%`;
    }
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
        return this.activeShapeDefinition().icon;
      case 'icon':
        return this.activeIconDefinition().icon;
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
        return 'fa-solid fa-crop-simple';
    }
  }

  readonly currentToolName = computed(() => {
    const pending = this.state.pendingPlacement();
    if (pending) {
      return pending.type === 'image' ? 'Place Image' : 'Place Stamp';
    }
    const t = this.state.tool();
    const match = EDITOR_TOOLS.find((tool) => tool.id === t);
    return match ? `${match.label} Tool` : 'Tool';
  });

  readonly currentToolIcon = computed(() => {
    const pending = this.state.pendingPlacement();
    if (pending) {
      return pending.type === 'image' ? 'fa-solid fa-image' : 'fa-solid fa-stamp';
    }
    const t = this.state.tool();
    return this.getAnnotationIcon(t);
  });

  readonly currentToolHint = computed(() => {
    const pending = this.state.pendingPlacement();
    if (pending) {
      return pending.type === 'image'
        ? 'Tap page to place image'
        : 'Tap page to place stamp';
    }
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
      case 'shape':
        return 'Drag or tap to place shape';
      case 'icon':
        return 'Drag or tap to place icon';
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
      t === 'shape' ||
      t === 'icon' ||
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

    // Load recent files list from IndexedDB for landing page and dropdown
    void this.loadRecentEntries();

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

  // ── Recent Files & File Switching ──────────────────────────────────

  /** Load recent file entries from IndexedDB. */
  async loadRecentEntries(): Promise<void> {
    const entries = await this.recentFiles.getAll();
    this.recentEntries.set(entries);
  }

  /** Format a timestamp as relative time for display. */
  getRelativeTime(timestamp: number): string {
    return formatRelativeTime(timestamp);
  }

  /** Toggle the recent files dropdown on desktop. */
  toggleRecentDropdown(): void {
    if (!this.showRecentDropdown()) {
      void this.loadRecentEntries();
    }
    this.showRecentDropdown.update((v) => !v);
  }

  /** Close the recent files dropdown. */
  closeRecentDropdown(): void {
    this.showRecentDropdown.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.showRecentDropdown() && !target?.closest('.editor__open-file-group')) {
      this.showRecentDropdown.set(false);
    }
    if (
      this.shapeMenuOpen() &&
      !target?.closest('.editor__tool-dropdown-wrap') &&
      !target?.closest('.editor__bottomsheet--shapes') &&
      !target?.closest('.editor__dp-pill') &&
      !target?.closest('.pf-shape-popover')
    ) {
      this.shapeMenuOpen.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    this.state.setSaveLocallyHandler(() => this.saveDocumentLocally());
    await this.loadRecentEntries();
  }

  /**
   * Saves the current document and all edits locally to IndexedDB & Recent Files.
   * Resets the dirty/modified state without downloading to disk.
   */
  async saveDocumentLocally(): Promise<boolean> {
    const file = this.files.currentFiles()[0];
    if (!file) {
      return false;
    }
    try {
      const pages = this.pagesStore.pages().map((p) => ({ ...p }));
      const pageSpecs = pages.map((p) => {
        const pageSize = this.baseSizes().get(p.sourceIndex) || { width: 595, height: 842 };
        const anns = this.state.annotationsFor(p.id);
        return {
          sourceIndex: p.sourceIndex,
          rotation: p.rotation,
          annotations: anns,
          baseWidth: pageSize.width,
          baseHeight: pageSize.height,
        };
      });
      const bytes = await this.exporter.exportDocument(
        new Uint8Array(file.data.slice(0)),
        pageSpecs,
        { title: file.name.replace(/\.pdf$/i, '') },
      );

      const editorState = {
        pages,
        annotations: this.state.getSerializedAnnotations(),
        currentId: this.pagesStore.currentId(),
      };

      // Save into RecentFilesService and DocumentStorageService in IndexedDB
      await this.recentFiles.addOrUpdate(
        file.name,
        bytes.buffer,
        bytes.byteLength,
        pages.length,
        editorState,
      );
      await this.storage.saveDocument(file.name, bytes.buffer, editorState);

      // Update current loaded file in memory so future edits build upon saved state
      const updatedBlob = new Blob([bytes.buffer], { type: 'application/pdf' });
      const updatedFile = new File([updatedBlob], file.name, { type: 'application/pdf' });
      const updatedLoaded: LoadedFile = {
        file: updatedFile,
        name: file.name,
        sizeBytes: bytes.byteLength,
        data: bytes.buffer,
        loadedAt: Date.now(),
        editorState,
      };
      this.files.setCurrent([updatedLoaded]);
      this.state.markSaved();
      await this.loadRecentEntries();
      this.toasts.success(`Saved "${file.name}" and all edits locally in browser.`);
      return true;
    } catch (err) {
      console.error('[Editor] Could not save document locally:', err);
      const message =
        err instanceof Error ? err.message : 'Could not save changes locally.';
      this.toasts.error(message);
      return false;
    }
  }

  /**
   * Open a new file with unsaved-changes guard.
   * Used by the "Open File" button on desktop and mobile.
   */
  async openNewFile(): Promise<void> {
    if (this.state.modified()) {
      const result = await this.dialog.confirm({
        title: 'Unsaved Changes',
        message:
          'You have unsaved edits in this document. What would you like to do?',
        confirmLabel: 'Save & Open',
        secondaryLabel: "Don't Save",
        cancelLabel: 'Cancel',
        destructive: false,
      });

      if (!result.confirmed && !result.secondary) {
        // User clicked Cancel
        return;
      }

      if (result.confirmed) {
        // User clicked "Save & Open" — save locally without downloading
        const saved = await this.saveDocumentLocally();
        if (!saved) {
          return; // Abort switching if save failed
        }
      }
      // If secondary ("Don't Save"), fall through to file picker
    }

    const picked = await this.files.pickFile(false);
    if (picked.length > 0) {
      await this.files.loadFiles(picked);
    }
  }

  /**
   * Open a specific recent file entry with unsaved-changes guard.
   * If it matches the stored document in IndexedDB, restores it directly.
   * Otherwise opens file picker to reload the document from disk.
   */
  async openRecentFile(entry: RecentFileEntry): Promise<void> {
    if (this.state.modified()) {
      const result = await this.dialog.confirm({
        title: 'Unsaved Changes',
        message:
          'You have unsaved edits in this document. What would you like to do?',
        confirmLabel: 'Save & Open',
        secondaryLabel: "Don't Save",
        cancelLabel: 'Cancel',
        destructive: false,
      });

      if (!result.confirmed && !result.secondary) {
        return;
      }

      if (result.confirmed) {
        const saved = await this.saveDocumentLocally();
        if (!saved) {
          return; // Abort switching if save failed
        }
      }
    }

    // 1. Load document data directly from RecentFilesService
    const recentDoc = await this.recentFiles.getFileData(entry.id) ?? await this.recentFiles.getFileDataByName(entry.name);
    if (recentDoc && recentDoc.data) {
      const blob = new Blob([recentDoc.data], { type: 'application/pdf' });
      const file = new File([blob], recentDoc.name, { type: 'application/pdf' });
      const loaded: LoadedFile = {
        file,
        name: recentDoc.name,
        sizeBytes: recentDoc.data.byteLength,
        data: recentDoc.data,
        loadedAt: Date.now(),
        editorState: recentDoc.editorState,
      };
      this.files.setCurrent([loaded]);
      return;
    }

    // 2. Fallback: Check last-document in storage
    const lastDoc = await this.storage.loadDocument();
    if (lastDoc && lastDoc.name.toLowerCase() === entry.name.toLowerCase()) {
      const blob = new Blob([lastDoc.data], { type: 'application/pdf' });
      const file = new File([blob], lastDoc.name, { type: 'application/pdf' });
      const loaded: LoadedFile = {
        file,
        name: lastDoc.name,
        sizeBytes: lastDoc.data.byteLength,
        data: lastDoc.data,
        loadedAt: Date.now(),
        editorState: lastDoc.editorState,
      };
      this.files.setCurrent([loaded]);
      return;
    }

    // 3. Fallback: Prompt user if file data is not available in storage
    this.toasts.info(`Please select "${entry.name}" from your device to reopen.`);
    const picked = await this.files.pickFile(false);
    if (picked.length > 0) {
      await this.files.loadFiles(picked);
    }
  }

  /** Toggle pinned state for a recent file entry. */
  async togglePin(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.recentFiles.togglePin(id);
    await this.loadRecentEntries();
  }

  onRecentSearchInput(value: string): void {
    this.recentSearch.set(value);
  }

  /** Remove a file from the recent list. */
  async removeRecentEntry(id: string): Promise<void> {
    await this.recentFiles.remove(id);
    await this.loadRecentEntries();
  }

  /** Clear all recent file entries. */
  async clearRecentEntries(): Promise<void> {
    await this.recentFiles.clearAll();
    this.recentEntries.set([]);
  }

  /** Browser close/reload protection when document has unsaved changes. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.state.modified()) {
      event.preventDefault();
    }
  }

  /** Navigate to /tools with unsaved-changes confirmation. */
  async onToolsClick(event: MouseEvent): Promise<void> {
    if (this.state.modified()) {
      event.preventDefault();
      const result = await this.dialog.confirm({
        title: 'Unsaved Changes',
        message:
          'You have unsaved edits in this document. What would you like to do before leaving?',
        confirmLabel: 'Save & Leave',
        secondaryLabel: "Don't Save",
        cancelLabel: 'Cancel',
        destructive: false,
      });

      if (!result.confirmed && !result.secondary) {
        return;
      }

      if (result.confirmed) {
        const saved = await this.saveDocumentLocally();
        if (!saved) {
          return;
        }
      }
      void this.router.navigate(['/tools']);
    }
  }

  private currentStageElement: HTMLElement | null = null;
  private isPinchActive = false;
  private pinchStartDist = 0;
  private pinchStartScale = 1;
  private pinchCurrentScale = 1;
  private pinchTargetPageId = '';
  private pinchFocalPageX = 0;
  private pinchFocalPageY = 0;
  private pinchStartFocalDocX = 0;
  private pinchStartFocalDocY = 0;
  private pinchCurrentMidX = 0;
  private pinchCurrentMidY = 0;
  private pinchInitialStackLeft = 0;
  private pinchInitialStackTop = 0;
  private pinchRafId: number | null = null;

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
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (dist < 5) {
        return;
      }
      event.preventDefault();

      const stage = this.stageRef()?.nativeElement;
      const stack = this.pagesStackRef()?.nativeElement;
      if (!stage || !stack) {
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const stackRect = stack.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      // Find the page element directly under the pinch midpoint, or the closest active page
      let targetWrapper = document
        .elementFromPoint(midX, midY)
        ?.closest('.editor__page-wrapper') as HTMLElement | null;

      if (!targetWrapper) {
        const activeId = this.pagesStore.currentId();
        targetWrapper = activeId
          ? stage.querySelector<HTMLElement>(`#page-wrapper-${activeId}`)
          : stage.querySelector<HTMLElement>('.editor__page-wrapper');
      }

      const pageId =
        targetWrapper?.getAttribute('data-page-id') ||
        this.pagesStore.currentId() ||
        '';
      const pageFrame = targetWrapper?.querySelector<HTMLElement>(
        '.editor__page-frame',
      );
      const pageRect = pageFrame
        ? pageFrame.getBoundingClientRect()
        : stackRect;

      const currentScale = this.displaySize()?.scale ?? this.state.zoom();

      // Focal point relative to the specific target page
      const focalPageX = (midX - pageRect.left) / currentScale;
      const focalPageY = (midY - pageRect.top) / currentScale;

      // Physical document coordinates relative to the pages stack root (for live GPU transform)
      const focalDocX = (midX - stackRect.left) / currentScale;
      const focalDocY = (midY - stackRect.top) / currentScale;

      this.isPinchActive = true;
      this.pinchStartDist = dist;
      this.pinchStartScale = currentScale;
      this.pinchCurrentScale = currentScale;
      this.pinchTargetPageId = pageId;
      this.pinchFocalPageX = focalPageX;
      this.pinchFocalPageY = focalPageY;
      this.pinchStartFocalDocX = focalDocX;
      this.pinchStartFocalDocY = focalDocY;
      this.pinchCurrentMidX = midX;
      this.pinchCurrentMidY = midY;
      this.pinchInitialStackLeft = stackRect.left;
      this.pinchInitialStackTop = stackRect.top;
      this.pinchLiveZoom.set(currentScale);

      stack.classList.add('editor__pages-stack--pinching');
    }
  };

  private onTouchMove = (event: TouchEvent): void => {
    if (this.isPinchActive && event.touches.length === 2) {
      event.preventDefault();
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / this.pinchStartDist;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const minZoom = isMobile ? 0.4 : 0.25;
      const maxZoom = isMobile ? 3.5 : 5.0;
      this.pinchCurrentScale = Math.min(maxZoom, Math.max(minZoom, this.pinchStartScale * ratio));
      this.pinchCurrentMidX = (t1.clientX + t2.clientX) / 2;
      this.pinchCurrentMidY = (t1.clientY + t2.clientY) / 2;
      this.pinchLiveZoom.set(this.pinchCurrentScale);

      if (!this.pinchRafId) {
        this.pinchRafId = requestAnimationFrame(() => {
          this.pinchRafId = null;
          this.applyPinchTransform();
        });
      }
    }
  };

  private applyPinchTransform(): void {
    if (!this.isPinchActive) {
      return;
    }
    const stack = this.pagesStackRef()?.nativeElement;
    if (!stack) {
      return;
    }

    const effectiveRatio = this.pinchCurrentScale / this.pinchStartScale;
    const localFocalX = this.pinchStartFocalDocX * this.pinchStartScale;
    const localFocalY = this.pinchStartFocalDocY * this.pinchStartScale;

    const tx = this.pinchCurrentMidX - this.pinchInitialStackLeft - localFocalX * effectiveRatio;
    const ty = this.pinchCurrentMidY - this.pinchInitialStackTop - localFocalY * effectiveRatio;

    stack.style.transformOrigin = '0 0';
    stack.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${effectiveRatio})`;
  }

  private onTouchEnd = (event: TouchEvent): void => {
    if (this.isPinchActive && event.touches.length < 2) {
      this.isPinchActive = false;
      this.pinchLiveZoom.set(null);
      if (this.pinchRafId) {
        cancelAnimationFrame(this.pinchRafId);
        this.pinchRafId = null;
      }

      const stage = this.stageRef()?.nativeElement;
      const stack = this.pagesStackRef()?.nativeElement;
      if (!stage || !stack) {
        return;
      }

      const finalScale = this.pinchCurrentScale;
      const targetPageId = this.pinchTargetPageId;
      const focalPageX = this.pinchFocalPageX;
      const focalPageY = this.pinchFocalPageY;
      const releaseMidX = this.pinchCurrentMidX;
      const releaseMidY = this.pinchCurrentMidY;

      // Prevent onStageScroll from interfering during commit
      this.isAutoScrolling = true;

      // Clean up temporary GPU styles
      stack.style.transform = '';
      stack.style.transformOrigin = '';
      stack.classList.remove('editor__pages-stack--pinching');

      // Commit final scale and active page
      this.state.setZoom(finalScale);
      if (targetPageId) {
        this.pagesStore.setCurrent(targetPageId);
      }

      // Synchronize exact scroll position after DOM layout renders new page sizes
      requestAnimationFrame(() => {
        const targetWrapper = targetPageId
          ? stage.querySelector<HTMLElement>(`#page-wrapper-${targetPageId}`)
          : null;

        if (targetWrapper) {
          const frame = targetWrapper.querySelector<HTMLElement>(
            '.editor__page-frame',
          );
          const frameRect = frame
            ? frame.getBoundingClientRect()
            : targetWrapper.getBoundingClientRect();

          // Compute exact scroll delta needed to keep focal point under fingers
          const currentFocalScreenX = frameRect.left + focalPageX * finalScale;
          const currentFocalScreenY = frameRect.top + focalPageY * finalScale;

          const deltaX = currentFocalScreenX - releaseMidX;
          const deltaY = currentFocalScreenY - releaseMidY;

          stage.scrollLeft = Math.max(0, Math.round(stage.scrollLeft + deltaX));
          stage.scrollTop = Math.max(0, Math.round(stage.scrollTop + deltaY));
        }

        setTimeout(() => {
          this.isAutoScrolling = false;
          if (targetPageId) {
            this.pagesStore.setCurrent(targetPageId);
          }
        }, 60);
      });
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
    if (this.pinchRafId) {
      cancelAnimationFrame(this.pinchRafId);
      this.pinchRafId = null;
    }
    if (this.scrollRafId) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
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
    if (id === 'image') {
      const input = this.imageInputRef()?.nativeElement;
      if (input) {
        input.value = '';
        input.click();
      }
      return;
    }
    if (id === 'signature') {
      this.isSignatureModalOpen.set(true);
      return;
    }
    if (id === 'stamp') {
      this.isStampModalOpen.set(true);
      return;
    }
    if (id === 'shape') {
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      if (!isMobile) {
        this.propertiesPanelCollapsed.set(false);
      }
    }
    this.state.setTool(id);
  }

  async onImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.toasts.error('Please select a valid image file (PNG, JPEG, WebP, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const pageId = this.pagesStore.currentId() ?? 'p0';
        const pageIndex = this.pagesStore.currentIndex();
        const pageSize = this.baseSizes().get(pageIndex) || { width: 595, height: 842 };

        const naturalW = img.naturalWidth || 200;
        const naturalH = img.naturalHeight || 150;
        const aspect = naturalW / Math.max(1, naturalH);

        let targetW = Math.min(260, naturalW);
        let targetH = targetW / aspect;
        if (targetH > 220) {
          targetH = 220;
          targetW = targetH * aspect;
        }

        this.state.setPendingPlacement({
          type: 'image',
          dataUrl,
          naturalWidth: naturalW,
          naturalHeight: naturalH,
          width: Math.round(targetW),
          height: Math.round(targetH),
        });
        this.state.setTool('image');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  onSignatureSelected(result: SignatureResult): void {
    this.isSignatureModalOpen.set(false);
    const pageId = this.pagesStore.currentId() ?? 'p0';
    const pageIndex = this.pagesStore.currentIndex();
    const pageSize = this.baseSizes().get(pageIndex) || { width: 595, height: 842 };

    const posX = Math.max(20, Math.round((pageSize.width - result.width) / 2));
    const posY = Math.max(40, Math.round((pageSize.height - result.height) / 2));

    const ann: SignatureAnnotation = {
      id: crypto.randomUUID(),
      type: 'signature',
      pageIndex,
      rect: {
        x: posX,
        y: posY,
        width: result.width,
        height: result.height,
      },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      dataUrl: result.dataUrl,
      naturalWidth: result.width,
      naturalHeight: result.height,
    };

    this.state.addAnnotation(pageId, ann);
    this.state.setTool('select');
    this.state.selectAnnotation(ann.id);
    this.toasts.success('Signature placed on page.');
  }

  onStampSelected(result: StampResult): void {
    this.isStampModalOpen.set(false);
    const stampW = Math.max(160, Math.min(260, result.text.length * 14 + 40));
    const stampH = 54;

    this.state.setPendingPlacement({
      type: 'stamp',
      text: result.text,
      color: result.color,
      width: stampW,
      height: stampH,
    });
    this.state.setTool('stamp');
  }

  cancelPendingPlacement(): void {
    this.state.setPendingPlacement(null);
    this.state.setTool('select');
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
    this.isAutoScrolling = true;
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

    // If we have saved editor state (pages and annotations), restore them!
    const savedState = this.loadedRef?.editorState;
    if (savedState && savedState.pages && savedState.pages.length > 0) {
      this.pagesStore.restoreState(
        savedState.pages.map((p) => ({ ...p })),
        undefined,
        savedState.currentId,
      );
      if (savedState.annotations) {
        this.state.restoreAnnotations(savedState.annotations);
      }
    } else {
      this.pagesStore.init(count);
    }

    this.clearSearch();
    void this.prefetch(count);
    if (this.loadedRef) {
      this.toasts.success(`Opened ${this.loadedRef.name}`);
      // Register in recent files and reset dirty state
      void this.recentFiles.addOrUpdate(
        this.loadedRef.name,
        this.loadedRef.data,
        this.loadedRef.sizeBytes,
        count,
        savedState,
      ).then(() => this.loadRecentEntries());
      this.state.markSaved();
    }
    this.loading.set(false);

    // Ensure document always starts on page 1 or saved active page with top scroll
    this.isAutoScrolling = true;
    const initialPageId =
      (savedState?.currentId && this.pagesStore.pages().some((p) => p.id === savedState.currentId))
        ? savedState.currentId
        : this.pagesStore.pages()[0]?.id;

    if (initialPageId) {
      this.pagesStore.setCurrent(initialPageId);
    }

    setTimeout(() => {
      const stage = this.stageRef()?.nativeElement;
      if (stage) {
        stage.scrollTop = 0;
        stage.scrollLeft = 0;
      }
      if (initialPageId) {
        this.pagesStore.setCurrent(initialPageId);
      }
      setTimeout(() => {
        this.isAutoScrolling = false;
      }, 100);
    }, 50);
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

  openExportModal(): void {
    if (!this.docName()) {
      this.toasts.warning('Please open a PDF document first.');
      return;
    }
    this.isExportModalOpen.set(true);
  }

  closeExportModal(): void {
    if (this.exporting()) return;
    this.isExportModalOpen.set(false);
    this.exportProgress.set(null);
  }

  async confirmExportModal(options: DetailedExportOptions): Promise<boolean> {
    const file = this.files.currentFiles()[0];
    if (!file) {
      this.toasts.error('No document is loaded.');
      return false;
    }
    this.exporting.set(true);
    this.state.setIsExporting(true);
    try {
      const allPages = this.pagesStore.pages();
      let targetPages = allPages;

      if (options.pageRange === 'current') {
        const curId = this.pagesStore.currentId();
        const cur = allPages.find((p) => p.id === curId) || allPages[0];
        targetPages = cur ? [cur] : allPages;
      } else if (options.pageRange === 'selected') {
        const selIds = this.pagesStore.selected();
        if (selIds.size > 0) {
          targetPages = allPages.filter((p) => selIds.has(p.id));
        }
      }

      const pageSpecs = targetPages.map((p) => {
        const pageSize = this.baseSizes().get(p.sourceIndex) || { width: 595, height: 842 };
        const anns = this.state.annotationsFor(p.id);
        return {
          sourceIndex: p.sourceIndex,
          rotation: p.rotation,
          annotations: anns,
          baseWidth: pageSize.width,
          baseHeight: pageSize.height,
        };
      });

      const bytes = await this.exporter.exportDocument(
        new Uint8Array(file.data.slice(0)),
        pageSpecs,
        options,
        (progress) => {
          this.exportProgress.set(progress);
        },
      );

      const editorState = {
        pages: this.pagesStore.pages().map((p) => ({ ...p })),
        annotations: this.state.getSerializedAnnotations(),
        currentId: this.pagesStore.currentId(),
      };
      await this.recentFiles.addOrUpdate(
        file.name,
        bytes.buffer,
        bytes.byteLength,
        pageSpecs.length,
        editorState,
      );
      await this.storage.saveDocument(file.name, bytes.buffer, editorState);

      const downloadFilename = sanitizePdfFilename(options.filename);
      this.downloads.download(
        new Blob([bytes], { type: 'application/pdf' }),
        downloadFilename,
      );
      this.toasts.success(`Exported "${downloadFilename}" successfully!`);
      this.state.markSaved();
      this.closeExportModal();
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not export the document.';
      this.toasts.error(message);
      return false;
    } finally {
      this.exporting.set(false);
      this.state.setIsExporting(false);
      this.exportProgress.set(null);
    }
  }

  async exportPdf(): Promise<boolean> {
    this.openExportModal();
    return true;
  }

  /* Zoom */
  zoomIn(): void {
    this.zoomBy(1.1);
  }

  zoomOut(): void {
    this.zoomBy(1 / 1.1);
  }

  private zoomBy(factor: number, clientX?: number, clientY?: number): void {
    const stage = this.stageRef()?.nativeElement;
    const current = this.displaySize()?.scale ?? this.state.zoom();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const minZoom = isMobile ? 0.4 : 0.25;
    const maxZoom = isMobile ? 3.5 : 5.0;
    const next = Math.min(maxZoom, Math.max(minZoom, current * factor));
    if (!stage) {
      this.state.setZoom(next);
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const focalScreenX =
      typeof clientX === 'number'
        ? clientX
        : stageRect.left + stageRect.width / 2;
    const focalScreenY =
      typeof clientY === 'number'
        ? clientY
        : stageRect.top + stageRect.height / 2;

    // Find the page under focal point or current active page
    let targetWrapper = document
      .elementFromPoint(focalScreenX, focalScreenY)
      ?.closest('.editor__page-wrapper') as HTMLElement | null;

    if (!targetWrapper) {
      const activeId = this.pagesStore.currentId();
      targetWrapper = activeId
        ? stage.querySelector<HTMLElement>(`#page-wrapper-${activeId}`)
        : stage.querySelector<HTMLElement>('.editor__page-wrapper');
    }

    const targetPageId =
      targetWrapper?.getAttribute('data-page-id') ||
      this.pagesStore.currentId() ||
      '';
    const pageFrame = targetWrapper?.querySelector<HTMLElement>(
      '.editor__page-frame',
    );
    const frameRect = pageFrame
      ? pageFrame.getBoundingClientRect()
      : stageRect;

    const focalPageX = (focalScreenX - frameRect.left) / current;
    const focalPageY = (focalScreenY - frameRect.top) / current;

    this.isAutoScrolling = true;
    this.state.setZoom(next);
    if (targetPageId) {
      this.pagesStore.setCurrent(targetPageId);
    }

    requestAnimationFrame(() => {
      const updatedWrapper = targetPageId
        ? stage.querySelector<HTMLElement>(`#page-wrapper-${targetPageId}`)
        : null;
      if (updatedWrapper) {
        const frame = updatedWrapper.querySelector<HTMLElement>(
          '.editor__page-frame',
        );
        const fRect = frame
          ? frame.getBoundingClientRect()
          : updatedWrapper.getBoundingClientRect();

        const currentFocalScreenX = fRect.left + focalPageX * next;
        const currentFocalScreenY = fRect.top + focalPageY * next;

        const deltaX = currentFocalScreenX - focalScreenX;
        const deltaY = currentFocalScreenY - focalScreenY;

        stage.scrollLeft = Math.max(0, Math.round(stage.scrollLeft + deltaX));
        stage.scrollTop = Math.max(0, Math.round(stage.scrollTop + deltaY));
      }

      setTimeout(() => {
        this.isAutoScrolling = false;
        if (targetPageId) {
          this.pagesStore.setCurrent(targetPageId);
        }
      }, 60);
    });
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
    this.zoomBy(factor, event.clientX, event.clientY);
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
  private scrollRafId: number | null = null;

  onStageScroll(event: Event): void {
    if (this.isAutoScrolling) {
      return;
    }

    if (this.scrollRafId === null) {
      this.scrollRafId = requestAnimationFrame(() => {
        this.scrollRafId = null;
        this.detectActivePageInViewport();
      });
    }
  }

  private detectActivePageInViewport(): void {
    const stage = this.stageRef()?.nativeElement;
    if (!stage || this.isAutoScrolling) {
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const centerX = stageRect.left + stageRect.width / 2;
    const centerY = stageRect.top + stageRect.height / 2;

    const el = document.elementFromPoint(centerX, centerY);
    const wrapper = el?.closest('.editor__page-wrapper') as HTMLElement | null;

    if (wrapper) {
      const pageId = wrapper.getAttribute('data-page-id');
      if (pageId && pageId !== this.pagesStore.currentId()) {
        this.pagesStore.setCurrent(pageId);
      }
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
    if (event.key === 'Escape') {
      if (this.state.pendingPlacement()) {
        this.cancelPendingPlacement();
        return;
      }
      if (this.isFullscreen()) {
        void document.exitFullscreen();
        return;
      }
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

    // Ctrl/Cmd+O — Open new file
    if (hasZoomModifier && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      void this.openNewFile();
      return;
    }

    // Ctrl/Cmd+S — Save (export) current document
    if (hasZoomModifier && event.key.toLowerCase() === 's' && !event.shiftKey) {
      event.preventDefault();
      if (this.docName()) {
        void this.exportPdf();
      }
      return;
    }

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

    const hasModifier = event.ctrlKey || event.metaKey;
    const selectedIds = this.state.selectedIds();

    if (!hasModifier && !isInput && selectedIds.length === 0) {
      const k = event.key.toLowerCase();
      if (k === 'v') { this.selectTool('select'); return; }
      if (k === 'h') { this.selectTool('hand'); return; }
      if (k === 't') { this.selectTool('text'); return; }
      if (k === 'p') { this.selectTool('pen'); return; }
      if (k === 'e') { this.selectTool('eraser'); return; }
      if (k === 's') { this.onShapeToolClick(); return; }
      if (k === 'i') { this.onIconToolClick(); return; }
    }

    if (selectedIds.length === 0) {
      return;
    }

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
