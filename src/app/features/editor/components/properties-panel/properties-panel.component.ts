import {
  Component,
  inject,
  output,
  computed,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  PdfAnnotation,
  ShapeAnnotation,
  TextAnnotation,
  HighlightAnnotation,
  CommentAnnotation,
  DrawingAnnotation,
  ImageAnnotation,
  SignatureAnnotation,
  StampAnnotation,
  ShapeKind,
  BlendMode,
  AspectRatioMode,
  DrawingMode,
  SelectMode,
  EraserMode,
  EraserTarget,
  IconStyleType,
  ResizeMode,
} from '../../../../core/models/pdf.models';
import {
  SHAPE_CATEGORIES,
  SHAPE_DEFINITIONS,
  ICON_CATEGORIES,
  ICON_DEFINITIONS,
  ALL_SHAPE_DEFINITIONS,
  ICON_STYLE_OPTIONS,
} from '../../../../core/constants/shapes';
import { PanelSectionComponent } from '../../../../shared/components/panel/panel-section.component';
import { measureTextAnnotation } from '../../../../core/utilities/text-measure.util';
import { EditorStateService } from '../../state/editor-state.service';
import { EditorPagesService } from '../../state/editor-pages.service';
import { EditorTextEditService } from '../../services/editor-text-edit.service';
import type {
  TextRun,
  TextRunStyleOverrides,
} from '../../../../core/services/pdf/content-edit/text-run.model';
import { resolveFontStyles } from '../../../../core/utilities/font-matcher.util';

type StrokeStyle = 'solid' | 'dashed' | 'dotted';

interface ColorSwatch {
  readonly value: string;
  readonly label: string;
}

const TEXT_COLOR_SWATCHES: ReadonlyArray<ColorSwatch> = [
  { value: '#000000', label: 'Black' },
  { value: '#1e293b', label: 'Slate' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#dc2626', label: 'Red' },
  { value: '#16a34a', label: 'Green' },
  { value: '#9333ea', label: 'Purple' },
  { value: '#d97706', label: 'Amber' },
  { value: '#ffffff', label: 'White' },
];

/** Convert a hex color like `#2563eb` (or `#25`) into an `rgba()` string. */
function withAlpha(hex: string, alpha: number): string {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) {
    return hex;
  }
  const raw = m[1];
  const expand =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = parseInt(expand, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const BACKGROUND_SWATCHES: ReadonlyArray<ColorSwatch> = [
  { value: '#ffffff', label: 'White / Document Canvas' },
  { value: '#fef08a', label: 'Light Yellow' },
  { value: '#fde047', label: 'Yellow' },
  { value: '#bbf7d0', label: 'Light Green' },
  { value: '#bfdbfe', label: 'Light Blue' },
  { value: '#fecaca', label: 'Light Red' },
  { value: '#fed7aa', label: 'Light Orange' },
  { value: '#e9d5ff', label: 'Light Purple' },
];

const HIGHLIGHT_SWATCHES: ReadonlyArray<ColorSwatch> = [
  { value: '#fde047', label: 'Yellow' },
  { value: '#86efac', label: 'Green' },
  { value: '#7dd3fc', label: 'Blue' },
  { value: '#fca5a5', label: 'Red' },
  { value: '#fdba74', label: 'Orange' },
  { value: '#d8b4fe', label: 'Purple' },
];

const SHAPE_SWATCHES: ReadonlyArray<ColorSwatch> = [
  { value: '#2563eb', label: 'Blue' },
  { value: '#111827', label: 'Black' },
  { value: '#dc2626', label: 'Red' },
  { value: '#16a34a', label: 'Green' },
  { value: '#9333ea', label: 'Purple' },
  { value: '#f59e0b', label: 'Amber' },
];

import { MobileTooltipDirective } from '../../../../shared/directives/mobile-tooltip.directive';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [DecimalPipe, PanelSectionComponent, MobileTooltipDirective],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent {
  readonly state = inject(EditorStateService);
  private readonly pages = inject(EditorPagesService);
  readonly textEdit = inject(EditorTextEditService);

  readonly collapse = output<void>();

  readonly activeTool = this.state.tool;
  readonly selectMode = this.state.selectMode;
  readonly selectedIds = this.state.selectedIds;
  readonly selectedList = computed(() =>
    this.state.getSelectedList(this.pages.currentId()),
  );
  readonly hasGroupInSelection = computed(() =>
    this.state.hasGroupInSelection(this.pages.currentId()),
  );
  readonly canRegroup = computed(() =>
    this.state.canRegroup(this.pages.currentId()),
  );
  readonly isGrouped = computed(() => {
    const list = this.selectedList();
    if (list.length < 2) {
      return false;
    }
    const gid = list[0].groupId;
    return Boolean(gid && list.every((a) => a.groupId === gid));
  });

  readonly drawingMode = this.state.drawingMode;
  readonly penColor = this.state.penColor;
  readonly penStrokeWidth = this.state.penStrokeWidth;
  readonly freehandColor = this.state.freehandColor;
  readonly freehandStrokeWidth = this.state.freehandStrokeWidth;
  readonly penSmoothing = this.state.penSmoothing;

  readonly eraserMode = this.state.eraserMode;
  readonly eraserSize = this.state.eraserSize;
  readonly eraserTolerance = this.state.eraserTolerance;
  readonly eraserTarget = this.state.eraserTarget;
  readonly effectiveCutSize = computed(
    () =>
      Math.round(
        this.state.eraserSize() * this.state.eraserTolerance() * 10,
      ) / 10,
  );

  readonly selected = computed(() =>
    this.state.getSelected(this.pages.currentId()),
  );
  readonly toolLabel = computed(() => {
    const t = this.state.tool();
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
  readonly toolIcon = computed(() => {
    const map: Record<string, string> = {
      select: 'fa-solid fa-arrow-pointer',
      hand: 'fa-solid fa-hand',
      text: 'fa-solid fa-font',
      highlight: 'fa-solid fa-highlighter',
      underline: 'fa-solid fa-underline',
      strikethrough: 'fa-solid fa-strikethrough',
      pen: 'fa-solid fa-pen',
      freehand: 'fa-solid fa-pen-ruler',
      eraser: 'fa-solid fa-eraser',
      rectangle: 'fa-solid fa-square',
      circle: 'fa-solid fa-circle',
      arrow: 'fa-solid fa-arrow-right',
      line: 'fa-solid fa-slash',
      image: 'fa-solid fa-image',
      signature: 'fa-solid fa-signature',
      stamp: 'fa-solid fa-stamp',
      comment: 'fa-solid fa-comment',
    };
    return map[this.state.tool()] ?? 'fa-solid fa-pen';
  });

  /** Web-safe font families available for text annotations. */
  readonly fontOptions: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Sans Serif', value: 'sans-serif' },
    { label: 'Serif', value: 'serif' },
    { label: 'Monospace', value: 'monospace' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: "'Times New Roman', serif" },
    { label: 'Palatino', value: "'Palatino Linotype', 'Book Antiqua', serif" },
    { label: 'Courier New', value: "'Courier New', monospace" },
    { label: 'Comic Sans MS', value: "'Comic Sans MS', cursive" },
    { label: 'Impact', value: 'Impact, sans-serif' },
  ];

  readonly backgroundSwatches = BACKGROUND_SWATCHES;
  readonly fontSizeStep = signal<number>(0.5);
  readonly highlightSwatches = HIGHLIGHT_SWATCHES;
  readonly shapeSwatches = SHAPE_SWATCHES;
  readonly textColorSwatches = TEXT_COLOR_SWATCHES;

  readonly strokeStyles: ReadonlyArray<{ value: StrokeStyle; label: string }> = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
  ];

  /** Whether the selected annotation currently has a fill (i.e. not transparent). */
  readonly hasFill = computed(() => {
    const ann = this.selected();
    if (!ann || ann.type !== 'shape') {
      return false;
    }
    return ann.fillColor && ann.fillColor !== 'transparent';
  });

  readonly shapeCategories = SHAPE_CATEGORIES;
  readonly shapeDefinitions = SHAPE_DEFINITIONS;
  readonly propsShapeCategory = signal<string>('all');

  readonly iconCategories = ICON_CATEGORIES;
  readonly iconDefinitions = ICON_DEFINITIONS;
  readonly propsIconCategory = signal<string>('all');

  readonly shapeKind = this.state.shapeKind;
  readonly iconKind = this.state.iconKind;
  readonly shapeStrokeColor = this.state.shapeStrokeColor;
  readonly shapeFillColor = this.state.shapeFillColor;
  readonly shapeFillEnabled = this.state.shapeFillEnabled;
  readonly shapeStrokeWidth = this.state.shapeStrokeWidth;
  readonly shapeRenderMode = this.state.shapeRenderMode;

  setToolShapeKind(kind: ShapeKind): void {
    this.state.setShapeKind(kind);
  }

  setToolIconKind(kind: ShapeKind): void {
    this.state.setIconKind(kind);
  }

  setToolRenderMode(mode: 'shape' | 'icon'): void {
    this.state.setShapeRenderMode(mode);
  }

  setToolStrokeColor(color: string): void {
    this.state.setShapeStrokeColor(color);
  }

  setToolStrokeWidth(w: number): void {
    this.state.setShapeStrokeWidth(w);
  }

  toggleToolShapeFill(): void {
    this.state.toggleShapeFill();
  }

  setToolFillColor(color: string): void {
    this.state.setShapeFillColor(color);
  }

  readonly propsFilteredShapes = computed(() => {
    const cat = this.propsShapeCategory();
    return this.shapeDefinitions.filter((s) => cat === 'all' || s.category === cat);
  });

  readonly propsFilteredIcons = computed(() => {
    const cat = this.propsIconCategory();
    return this.iconDefinitions.filter((s) => cat === 'all' || s.category === cat);
  });

  onHorizontalWheel(event: WheelEvent): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      return;
    }
    const el = event.currentTarget as HTMLElement | null;
    if (el && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      el.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  }

  shapeLabelOf(kind: ShapeKind): string {
    const s = ALL_SHAPE_DEFINITIONS.find((def) => def.id === kind);
    return s ? s.label : kind;
  }

  iconLabelOf(kind: ShapeKind): string {
    const s = this.iconDefinitions.find((def) => def.id === kind) || ALL_SHAPE_DEFINITIONS.find((def) => def.id === kind);
    return s ? s.label : kind;
  }

  resizeModeOf(ann: PdfAnnotation): ResizeMode {
    return (ann as any).resizeMode || this.state.resizeMode();
  }

  setAnnotationResizeMode(ann: PdfAnnotation, mode: ResizeMode): void {
    this.state.updateAnnotation(ann.id, { resizeMode: mode } as any);
  }

  resizeModeLabel(mode: ResizeMode): string {
    if (mode === 'fixed') return 'Fixed 1:1';
    if (mode === 'item') return 'Item Ratio';
    return 'Free Hand';
  }

  readonly iconStyleOptions = ICON_STYLE_OPTIONS;

  iconStyleOf(ann: PdfAnnotation): IconStyleType {
    return (ann as ShapeAnnotation).iconStyle || this.state.iconStyle() || 'outlined';
  }

  setAnnotationIconStyle(ann: PdfAnnotation, style: IconStyleType): void {
    this.state.updateAnnotation(ann.id, { iconStyle: style } as any);
  }

  isIconAnnotation(ann: PdfAnnotation): boolean {
    return ann.type === 'shape' && (ann as ShapeAnnotation).renderMode === 'icon';
  }

  setShapeKind(ann: PdfAnnotation, kind: ShapeKind): void {
    if (ann.type === 'shape') {
      this.state.updateAnnotation(ann.id, { kind, renderMode: 'shape' });
    }
  }

  setIconKind(ann: PdfAnnotation, kind: ShapeKind): void {
    if (ann.type === 'shape') {
      this.state.updateAnnotation(ann.id, { kind, renderMode: 'icon' });
    }
  }

  setRenderMode(ann: PdfAnnotation, mode: 'shape' | 'icon'): void {
    if (ann.type === 'shape') {
      this.state.updateAnnotation(ann.id, { renderMode: mode });
    }
  }

  /** Whether the selected annotation is a shape that can carry a fill. */
  readonly canFill = computed(() => {
    const ann = this.selected();
    if (!ann || ann.type !== 'shape') {
      return false;
    }
    return ann.kind !== 'line';
  });

  /** Whether the selected annotation is a shape whose stroke style is editable. */
  readonly canStrokeStyle = computed(() => {
    const ann = this.selected();
    return !!ann && ann.type === 'shape';
  });

  /** Index of the selected annotation within its page (used for z-order UI). */
  readonly selectionIndex = computed<number>(() => {
    const ann = this.selected();
    if (!ann) {
      return -1;
    }
    const pageId = this.pages.currentId();
    const list = this.state.annotationsFor(pageId);
    return list.findIndex((a) => a.id === ann.id);
  });

  readonly selectionTotal = computed<number>(() => {
    const pageId = this.pages.currentId();
    return this.state.annotationsFor(pageId).length;
  });

  readonly canBringForward = computed(
    () => this.selectionIndex() >= 0 && this.selectionIndex() < this.selectionTotal() - 1,
  );
  readonly canSendBackward = computed(() => this.selectionIndex() > 0);

  iconOf(ann: PdfAnnotation): string {
    if (ann.type === 'text') {
      return 'fa-solid fa-font';
    }
    if (ann.type === 'shape') {
      const match = this.shapeDefinitions.find((s) => s.id === ann.kind);
      return match ? match.icon : 'fa-solid fa-shapes';
    }
    if (ann.type === 'highlight') {
      return 'fa-solid fa-highlighter';
    }
    if (ann.type === 'underline') {
      return 'fa-solid fa-underline';
    }
    if (ann.type === 'strikethrough') {
      return 'fa-solid fa-strikethrough';
    }
    if (ann.type === 'image') {
      return 'fa-solid fa-image';
    }
    if (ann.type === 'signature') {
      return 'fa-solid fa-signature';
    }
    if (ann.type === 'stamp') {
      return 'fa-solid fa-stamp';
    }
    if (ann.type === 'comment') {
      return 'fa-solid fa-comment';
    }
    if (ann.type === 'drawing') {
      return (ann as DrawingAnnotation).kind === 'freehand'
        ? 'fa-solid fa-pen-ruler'
        : 'fa-solid fa-pen';
    }
    return 'fa-solid fa-pen';
  }

  titleOf(ann: PdfAnnotation): string {
    if (ann.type === 'text') {
      return 'Text';
    }
    if (ann.type === 'image') {
      return 'Image';
    }
    if (ann.type === 'signature') {
      return 'Signature';
    }
    if (ann.type === 'stamp') {
      return 'Stamp';
    }
    if (ann.type === 'shape') {
      return ann.kind.charAt(0).toUpperCase() + ann.kind.slice(1);
    }
    if (ann.type === 'drawing') {
      return (ann as DrawingAnnotation).kind === 'freehand'
        ? 'Freehand'
        : 'Pen Drawing';
    }
    if (ann.type === 'highlight') {
      return 'Highlight';
    }
    if (ann.type === 'underline') {
      return 'Underline';
    }
    if (ann.type === 'strikethrough') {
      return 'Strikethrough';
    }
    if (ann.type === 'comment') {
      return 'Comment';
    }
    return ann.type;
  }

  readonly stampColorPresets = [
    '#dc2626',
    '#16a34a',
    '#2563eb',
    '#ea580c',
    '#9333ea',
    '#0d9488',
    '#4b5563',
    '#111827',
  ];

  readonly stampTextPresets = [
    'APPROVED',
    'REJECTED',
    'CONFIDENTIAL',
    'DRAFT',
    'FINAL',
    'PAID',
    'VOID',
    'COMPLETED',
    'FOR REVIEW',
    'URGENT',
  ];

  setStampText(ann: PdfAnnotation, text: string): void {
    if (ann.locked) return;
    this.state.updateAnnotation(ann.id, { text: text.trim().toUpperCase() } as Partial<StampAnnotation>);
  }

  setStampColor(ann: PdfAnnotation, color: string): void {
    if (ann.locked) return;
    this.state.updateAnnotation(ann.id, { color } as Partial<StampAnnotation>);
  }

  applyStampPreset(ann: PdfAnnotation, presetText: string): void {
    if (ann.locked) return;
    const colors: Record<string, string> = {
      APPROVED: '#16a34a',
      PAID: '#16a34a',
      COMPLETED: '#0d9488',
      FINAL: '#2563eb',
      DRAFT: '#ea580c',
      CONFIDENTIAL: '#dc2626',
      REJECTED: '#dc2626',
      VOID: '#991b1b',
      'FOR REVIEW': '#9333ea',
      URGENT: '#e11d48',
    };
    const color = colors[presetText] || '#dc2626';
    this.state.updateAnnotation(ann.id, { text: presetText, color } as Partial<StampAnnotation>);
  }

  readonly blendModes: ReadonlyArray<{ value: BlendMode; label: string; description: string }> = [
    { value: 'normal', label: 'Normal', description: 'Standard layer rendering' },
    { value: 'multiply', label: 'Multiply', description: 'Blends ink onto page, removes white backgrounds' },
    { value: 'screen', label: 'Screen', description: 'Lightens and removes dark backgrounds' },
    { value: 'overlay', label: 'Overlay', description: 'High-contrast composite blend' },
    { value: 'darken', label: 'Darken', description: 'Retains darker pixels' },
    { value: 'lighten', label: 'Lighten', description: 'Retains lighter pixels' },
    { value: 'color-burn', label: 'Color Burn', description: 'Deepens colors' },
    { value: 'hard-light', label: 'Hard Light', description: 'Vivid overlay effect' },
    { value: 'difference', label: 'Difference', description: 'Inverts colors based on background' },
  ];

  readonly aspectRatioOptions: ReadonlyArray<{ value: AspectRatioMode; label: string; title: string }> = [
    { value: 'free', label: 'Free', title: 'Freeform resize' },
    { value: 'original', label: 'Orig', title: 'Original aspect ratio' },
    { value: '1:1', label: '1:1', title: '1:1 Square' },
    { value: '4:3', label: '4:3', title: '4:3 Standard' },
    { value: '16:9', label: '16:9', title: '16:9 Widescreen' },
    { value: '3:2', label: '3:2', title: '3:2 Photo' },
  ];

  setBlendMode(ann: ImageAnnotation | SignatureAnnotation, mode: BlendMode): void {
    if (ann.locked) return;
    this.state.updateAnnotation(ann.id, { blendMode: mode });
  }

  setAspectRatioMode(ann: ImageAnnotation, mode: AspectRatioMode): void {
    if (ann.locked) return;
    const updates: Partial<ImageAnnotation> = {
      aspectRatioMode: mode,
      lockAspectRatio: mode !== 'free',
    };
    let ratio: number | null = null;
    if (mode === 'original') {
      ratio = ann.naturalWidth && ann.naturalHeight ? ann.naturalWidth / ann.naturalHeight : null;
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
      const currentW = ann.rect.width;
      const newH = Math.round(currentW / ratio);
      updates.rect = { ...ann.rect, height: newH };
    }

    this.state.updateAnnotation(ann.id, updates);
  }

  toggleLockAspectRatio(ann: ImageAnnotation | SignatureAnnotation): void {
    if (ann.locked) return;
    const current = !!ann.lockAspectRatio;
    this.state.updateAnnotation(ann.id, { lockAspectRatio: !current });
  }

  toggleFlipHorizontal(ann: ImageAnnotation): void {
    if (ann.locked) return;
    this.state.updateAnnotation(ann.id, { flipHorizontal: !ann.flipHorizontal });
  }

  toggleFlipVertical(ann: ImageAnnotation): void {
    if (ann.locked) return;
    this.state.updateAnnotation(ann.id, { flipVertical: !ann.flipVertical });
  }

  resetImageToOriginalSize(ann: ImageAnnotation): void {
    if (ann.locked) return;
    const nw = ann.naturalWidth || 200;
    const nh = ann.naturalHeight || 150;
    this.state.updateAnnotation(ann.id, {
      rect: { ...ann.rect, width: nw, height: nh },
      aspectRatioMode: 'original',
      lockAspectRatio: true,
    });
  }

  readonly Math = Math;

  setRectX(ann: PdfAnnotation, x: number): void {
    if (ann.locked || !Number.isFinite(x)) return;
    const dx = x - ann.rect.x;
    if (ann.type === 'drawing') {
      this.state.updateAnnotation(ann.id, {
        rect: { ...ann.rect, x: Math.round(x) },
        points: ann.points.map((p) => ({ x: Math.round(p.x + dx), y: p.y })),
      } as Partial<DrawingAnnotation>);
    } else {
      this.state.updateAnnotation(ann.id, {
        rect: { ...ann.rect, x: Math.round(x) },
      });
    }
  }

  setRectY(ann: PdfAnnotation, y: number): void {
    if (ann.locked || !Number.isFinite(y)) return;
    const dy = y - ann.rect.y;
    if (ann.type === 'drawing') {
      this.state.updateAnnotation(ann.id, {
        rect: { ...ann.rect, y: Math.round(y) },
        points: ann.points.map((p) => ({ x: p.x, y: Math.round(p.y + dy) })),
      } as Partial<DrawingAnnotation>);
    } else {
      this.state.updateAnnotation(ann.id, {
        rect: { ...ann.rect, y: Math.round(y) },
      });
    }
  }

  setRectWidth(ann: PdfAnnotation, w: number): void {
    if (ann.locked || !Number.isFinite(w) || w < 4) return;
    this.state.updateAnnotation(ann.id, {
      rect: { ...ann.rect, width: Math.round(w) },
    });
  }

  setRectHeight(ann: PdfAnnotation, h: number): void {
    if (ann.locked || !Number.isFinite(h) || h < 4) return;
    this.state.updateAnnotation(ann.id, {
      rect: { ...ann.rect, height: Math.round(h) },
    });
  }

  setDrawingColor(ann: PdfAnnotation, color: string): void {
    this.state.updateAnnotation(ann.id, { color } as Partial<DrawingAnnotation>);
  }

  setDrawingStrokeWidth(ann: PdfAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 1 && n <= 64) {
      this.state.updateAnnotation(ann.id, { strokeWidth: n } as Partial<DrawingAnnotation>);
    }
  }

  toColor(value?: string): string {
    if (!value) return '#000000';
    if (value.startsWith('#')) {
      if (value.length === 4) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      }
      return value.slice(0, 7);
    }
    const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbMatch) {
      const r = Number(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = Number(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = Number(rgbMatch[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return '#000000';
  }

  /** Visual stroke style — defaults to 'solid' for shapes created before the field existed. */
  strokeStyleOf(ann: ShapeAnnotation): StrokeStyle {
    return ann.strokeStyle ?? 'solid';
  }

  setStrokeStyle(ann: ShapeAnnotation, style: StrokeStyle): void {
    this.state.updateAnnotation(ann.id, { strokeStyle: style });
  }

  setText(ann: PdfAnnotation, value: string): void {
    if (ann.type === 'text') {
      const m = measureTextAnnotation({ ...ann, text: value });
      this.state.updateAnnotation(ann.id, {
        text: value,
        rect: { ...ann.rect, width: m.width, height: m.height },
      } as Partial<TextAnnotation>);
    }
  }

  setFontSize(ann: PdfAnnotation, value: string): void {
    const n = parseFloat(value);
    if (!Number.isNaN(n) && n >= 4 && ann.type === 'text') {
      const clean = Math.round(n * 100) / 100;
      const m = measureTextAnnotation({ ...ann, fontSize: clean });
      this.state.updateAnnotation(ann.id, {
        fontSize: clean,
        rect: { ...ann.rect, width: m.width, height: m.height },
      } as Partial<TextAnnotation>);
    }
  }

  setColor(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, { color: value } as Partial<TextAnnotation>);
  }

  setFontFamily(ann: PdfAnnotation, value: string): void {
    if (ann.type === 'text') {
      const m = measureTextAnnotation({ ...ann, fontFamily: value });
      this.state.updateAnnotation(ann.id, {
        fontFamily: value,
        rect: { ...ann.rect, width: m.width, height: m.height },
      } as Partial<TextAnnotation>);
    }
  }

  toggleBold(ann: TextAnnotation): void {
    const nextWeight = ann.fontWeight >= 700 ? 400 : 700;
    const m = measureTextAnnotation({ ...ann, fontWeight: nextWeight });
    this.state.updateAnnotation(ann.id, {
      fontWeight: nextWeight,
      rect: { ...ann.rect, width: m.width, height: m.height },
    });
  }

  toggleItalic(ann: TextAnnotation): void {
    const nextItalic = !ann.italic;
    const m = measureTextAnnotation({ ...ann, italic: nextItalic });
    this.state.updateAnnotation(ann.id, {
      italic: nextItalic,
      rect: { ...ann.rect, width: m.width, height: m.height },
    });
  }

  toggleUnderline(ann: TextAnnotation): void {
    this.state.updateAnnotation(ann.id, { underline: !ann.underline });
  }

  setAlign(ann: TextAnnotation, align: 'left' | 'center' | 'right'): void {
    this.state.updateAnnotation(ann.id, { align });
  }

  toggleLock(ann: PdfAnnotation, event?: MouseEvent): void {
    event?.stopPropagation();
    this.state.toggleLock(ann.id);
  }

  setTransform(ann: TextAnnotation, transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'): void {
    const next = ann.transform === transform ? 'none' : transform;
    const m = measureTextAnnotation({ ...ann, transform: next });
    this.state.updateAnnotation(ann.id, {
      transform: next,
      rect: { ...ann.rect, width: m.width, height: m.height },
    });
  }

  hasTextBackground(ann: TextAnnotation): boolean {
    return !!ann.backgroundColor && ann.backgroundColor !== 'transparent';
  }

  setTextBackgroundEnabled(ann: TextAnnotation, enabled: boolean): void {
    if (!enabled) {
      this.state.updateAnnotation(ann.id, { backgroundColor: 'transparent' });
      return;
    }
    this.state.updateAnnotation(ann.id, {
      backgroundColor: ann.backgroundColor && ann.backgroundColor !== 'transparent' ? ann.backgroundColor : '#fef08a',
      backgroundPadding: ann.backgroundPadding ?? 0,
    });
  }

  setTextBackground(ann: TextAnnotation, color: string): void {
    this.state.updateAnnotation(ann.id, { backgroundColor: color });
  }

  setTextBackgroundPadding(ann: TextAnnotation, value: string): void {
    const padding = Number(value);
    if (!Number.isNaN(padding) && padding >= 0 && padding <= 24) {
      this.state.updateAnnotation(ann.id, { backgroundPadding: padding });
    }
  }

  setLineHeight(ann: TextAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 1 && n <= 3) {
      const m = measureTextAnnotation({ ...ann, lineHeight: n });
      this.state.updateAnnotation(ann.id, {
        lineHeight: n,
        rect: { ...ann.rect, width: m.width, height: m.height },
      });
    }
  }

  setLetterSpacing(ann: TextAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      const m = measureTextAnnotation({ ...ann, letterSpacing: n });
      this.state.updateAnnotation(ann.id, {
        letterSpacing: n,
        rect: { ...ann.rect, width: m.width, height: m.height },
      });
    }
  }

  setStroke(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      strokeColor: value,
    } as Partial<ShapeAnnotation>);
  }

  setHighlightColor(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      color: value,
    } as Partial<HighlightAnnotation>);
  }

  setComment(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      text: value,
    } as Partial<CommentAnnotation>);
  }

  setFill(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      fillColor: value,
    } as Partial<ShapeAnnotation>);
  }

  setFillEnabled(ann: ShapeAnnotation, enabled: boolean): void {
    if (!enabled) {
      this.state.updateAnnotation(ann.id, { fillColor: 'transparent' });
      return;
    }
    if (!ann.fillColor || ann.fillColor === 'transparent') {
      this.state.updateAnnotation(ann.id, {
        fillColor: withAlpha(ann.strokeColor, 0.18),
      });
    }
  }

  setStrokeWidth(ann: PdfAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      this.state.updateAnnotation(ann.id, {
        strokeWidth: n,
      } as Partial<ShapeAnnotation>);
    }
  }

  getOpacityPercent(ann: PdfAnnotation): number {
    return Math.round((ann.opacity ?? 1) * 100);
  }

  setOpacityPercent(ann: PdfAnnotation, value: number | string): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      const clamped = Math.max(0, Math.min(100, n)) / 100;
      this.state.updateAnnotation(ann.id, { opacity: clamped });
    }
  }

  setOpacity(ann: PdfAnnotation, value: string): void {
    this.setOpacityPercent(ann, Number(value) * 100);
  }



  setRotation(ann: PdfAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      this.state.updateAnnotation(ann.id, { rotation: n });
    }
  }

  rotate90(ann: PdfAnnotation): void {
    const next = (((ann.rotation + 90) % 360) + 360) % 360;
    this.state.updateAnnotation(ann.id, { rotation: next });
  }

  rotateNeg90(ann: PdfAnnotation): void {
    let next = ((ann.rotation - 90) % 360 + 360) % 360;
    if (next === 360) {
      next = 0;
    }
    this.state.updateAnnotation(ann.id, { rotation: next });
  }

  resetRotation(ann: PdfAnnotation): void {
    this.state.updateAnnotation(ann.id, { rotation: 0 });
  }

  bringForward(ann: PdfAnnotation): void {
    this.state.reorderAnnotation(ann.id, 1);
  }

  sendBackward(ann: PdfAnnotation): void {
    this.state.reorderAnnotation(ann.id, -1);
  }

  bringToFront(ann: PdfAnnotation): void {
    this.state.bringToFront(ann.id);
  }

  sendToBack(ann: PdfAnnotation): void {
    this.state.sendToBack(ann.id);
  }

  duplicate(ann: PdfAnnotation): void {
    this.state.duplicateAnnotation(ann.id);
  }

  delete(ann: PdfAnnotation): void {
    this.state.removeAnnotation(ann.id);
  }

  setEraserMode(mode: EraserMode): void {
    this.state.setEraserMode(mode);
  }

  setEraserSize(size: number | string): void {
    const n = Number(size);
    if (!Number.isNaN(n)) {
      this.state.setEraserSize(n);
    }
  }

  setEraserTolerance(tol: number | string): void {
    const n = Number(tol);
    if (!Number.isNaN(n)) {
      this.state.setEraserTolerance(n);
    }
  }

  onEraserSliderStart(): void {
    this.state.triggerEraserPreview(true);
  }

  onEraserSliderEnd(): void {
    this.state.hideEraserPreview();
  }

  setEraserTarget(target: EraserTarget): void {
    this.state.setEraserTarget(target);
  }

  setDrawingMode(mode: DrawingMode): void {
    this.state.setDrawingMode(mode);
  }

  setPenColor(c: string): void {
    this.state.setPenColor(c);
  }

  setPenStrokeWidth(w: number | string): void {
    const n = Number(w);
    if (!Number.isNaN(n)) {
      this.state.setPenStrokeWidth(n);
    }
  }

  setFreehandColor(c: string): void {
    this.state.setFreehandColor(c);
  }

  setFreehandStrokeWidth(w: number | string): void {
    const n = Number(w);
    if (!Number.isNaN(n)) {
      this.state.setFreehandStrokeWidth(n);
    }
  }

  setPenSmoothing(s: 'none' | 'medium' | 'high'): void {
    this.state.setPenSmoothing(s);
  }

  selectInkArea(): void {
    this.state.selectDrawingsArea(this.pages.currentId());
  }

  setSelectMode(mode: SelectMode): void {
    this.state.setSelectMode(mode);
  }

  selectAll(): void {
    this.state.selectAllAnnotations(this.pages.currentId());
  }

  clearSelection(): void {
    this.state.clearSelection();
  }

  deleteSelected(): void {
    this.state.deleteSelected(this.pages.currentId());
  }

  duplicateSelected(): void {
    this.state.duplicateSelected(this.pages.currentId());
  }

  alignSelected(
    alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
  ): void {
    this.state.alignSelected(this.pages.currentId(), alignment);
  }

  setBatchOpacityPercent(opacity: number | string): void {
    const n = Number(opacity);
    if (!Number.isNaN(n)) {
      const clamped = Math.max(0, Math.min(100, n)) / 100;
      this.state.setBatchOpacity(this.pages.currentId(), clamped);
    }
  }

  setBatchOpacity(opacity: number | string): void {
    this.setBatchOpacityPercent(opacity);
  }

  toggleBatchLock(): void {
    this.state.toggleBatchLock(this.pages.currentId());
  }

  groupSelected(): void {
    this.state.groupSelected(this.pages.currentId());
  }

  ungroupSelected(): void {
    this.state.ungroupSelected(this.pages.currentId());
  }

  regroupSelected(): void {
    this.state.regroupSelected(this.pages.currentId());
  }

  distributeSelected(axis: 'horizontal' | 'vertical'): void {
    this.state.distributeSelected(this.pages.currentId(), axis);
  }

  bringSelectedToFront(): void {
    this.state.bringSelectedToFront(this.pages.currentId());
  }

  sendSelectedToBack(): void {
    this.state.sendSelectedToBack(this.pages.currentId());
  }

  clearCurrentPage(): void {
    const id = this.pages.currentId();
    if (id) {
      this.state.clearPageAnnotations(id);
    }
  }

  // ─── PDF Content Text Edit Adjustments ──────────────────────────────────────

  getRunText(run: TextRun): string {
    return run.text;
  }

  updateRunText(run: TextRun, newText: string): void {
    if (run.text === newText) return;
    this.textEdit.applyEdit({ runId: run.id, newText }, true);
  }

  getRunFontSize(run: TextRun): number {
    const raw = run.styleOverrides?.fontSize ?? run.fontSize;
    if (!Number.isFinite(raw) || raw <= 0) return 12;
    return Math.round(raw * 100) / 100;
  }

  setRunFontSize(run: TextRun, value: string | number): void {
    const n = parseFloat(String(value));
    if (!Number.isNaN(n) && n >= 4 && n <= 140) {
      const clean = Math.round(n * 100) / 100;
      this.textEdit.updateActiveRunStyle({ fontSize: clean });
    }
  }

  stepRunFontSize(run: TextRun, delta: number): void {
    const current = this.getRunFontSize(run);
    const next = Math.max(4, Math.min(140, Math.round((current + delta) * 100) / 100));
    this.setRunFontSize(run, next);
  }

  setFontSizeStep(value: string | number): void {
    const n = parseFloat(String(value));
    if (!Number.isNaN(n) && n > 0) {
      this.fontSizeStep.set(n);
    }
  }

  getDetectedFontFamily(run: TextRun): string {
    const styles = resolveFontStyles(run.fontName || run.fontResource);
    return styles.fontFamily;
  }

  getDetectedFontLabel(run: TextRun): string {
    const styles = resolveFontStyles(run.fontName || run.fontResource);
    return styles.cleanName;
  }

  getRunFontFamily(run: TextRun): string {
    if (run.styleOverrides?.fontFamily) {
      return run.styleOverrides.fontFamily;
    }
    return this.getDetectedFontFamily(run);
  }

  setRunFontFamily(run: TextRun, family: string): void {
    this.textEdit.updateActiveRunStyle({ fontFamily: family });
  }

  isRunBold(run: TextRun): boolean {
    if (run.styleOverrides?.fontWeight !== undefined) {
      const w = run.styleOverrides.fontWeight;
      return w === 'bold' || Number(w) >= 700;
    }
    const styles = resolveFontStyles(run.fontName || run.fontResource);
    return styles.fontWeight === 'bold' || Number(styles.fontWeight) >= 700;
  }

  toggleRunBold(run: TextRun): void {
    const nextBold = !this.isRunBold(run);
    this.textEdit.updateActiveRunStyle({
      fontWeight: nextBold ? 700 : 400,
    });
  }

  isRunItalic(run: TextRun): boolean {
    if (run.styleOverrides?.fontStyle !== undefined) {
      return run.styleOverrides.fontStyle === 'italic';
    }
    const styles = resolveFontStyles(run.fontName || run.fontResource);
    return styles.fontStyle === 'italic';
  }

  toggleRunItalic(run: TextRun): void {
    const nextItalic = !this.isRunItalic(run);
    this.textEdit.updateActiveRunStyle({
      fontStyle: nextItalic ? 'italic' : 'normal',
    });
  }

  isRunUnderline(run: TextRun): boolean {
    return Boolean(run.styleOverrides?.underline);
  }

  toggleRunUnderline(run: TextRun): void {
    this.textEdit.updateActiveRunStyle({
      underline: !this.isRunUnderline(run),
    });
  }

  getRunColor(run: TextRun): string {
    if (run.styleOverrides?.color) return run.styleOverrides.color;
    return EditorTextEditService.pdfColorToCss(run.color);
  }

  setRunColor(run: TextRun, color: string): void {
    this.textEdit.updateActiveRunStyle({ color });
  }

  getRunLetterSpacing(run: TextRun): number {
    if (run.styleOverrides?.letterSpacing !== undefined) {
      return run.styleOverrides.letterSpacing;
    }
    return run.charSpacing ?? 0;
  }

  setRunLetterSpacing(run: TextRun, value: string | number): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      this.textEdit.updateActiveRunStyle({ letterSpacing: n });
    }
  }

  getRunLineHeight(run: TextRun): number {
    return run.styleOverrides?.lineHeight ?? 1.2;
  }

  setRunLineHeight(run: TextRun, value: string | number): void {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 0.8 && n <= 3.5) {
      this.textEdit.updateActiveRunStyle({ lineHeight: Math.round(n * 10) / 10 });
    }
  }

  getRunPaddingX(run: TextRun): number {
    return run.styleOverrides?.paddingX ?? 0;
  }

  setRunPaddingX(run: TextRun, value: string | number): void {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) {
      this.textEdit.updateActiveRunStyle({ paddingX: n });
    }
  }

  getRunPaddingY(run: TextRun): number {
    return run.styleOverrides?.paddingY ?? 0;
  }

  setRunPaddingY(run: TextRun, value: string | number): void {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) {
      this.textEdit.updateActiveRunStyle({ paddingY: n });
    }
  }

  getRunMarginX(run: TextRun): number {
    return run.styleOverrides?.marginX ?? 0;
  }

  setRunMarginX(run: TextRun, value: string | number): void {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= -200 && n <= 200) {
      this.textEdit.updateActiveRunStyle({ marginX: n });
    }
  }

  getRunMarginY(run: TextRun): number {
    return run.styleOverrides?.marginY ?? 0;
  }

  setRunMarginY(run: TextRun, value: string | number): void {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= -200 && n <= 200) {
      this.textEdit.updateActiveRunStyle({ marginY: n });
    }
  }

  resetRunOffsets(): void {
    this.textEdit.updateActiveRunStyle({ marginX: 0, marginY: 0 });
  }

  isRunBackgroundEnabled(run: TextRun): boolean {
    return Boolean(run.styleOverrides?.backgroundEnabled);
  }

  setRunBackgroundEnabled(run: TextRun, enabled: boolean): void {
    this.textEdit.updateActiveRunStyle({
      backgroundEnabled: enabled,
      backgroundColor: run.styleOverrides?.backgroundColor || '#ffffff',
    });
  }

  getRunBackgroundColor(run: TextRun): string {
    return run.styleOverrides?.backgroundColor || '#ffffff';
  }

  setRunBackgroundColor(run: TextRun, color: string): void {
    this.textEdit.updateActiveRunStyle({
      backgroundEnabled: true,
      backgroundColor: color,
    });
  }

  getRunAlign(run: TextRun): 'left' | 'center' | 'right' {
    return run.styleOverrides?.textAlign ?? 'left';
  }

  setRunAlign(run: TextRun, align: 'left' | 'center' | 'right'): void {
    this.textEdit.updateActiveRunStyle({ textAlign: align });
  }

  getRunTransform(run: TextRun): 'none' | 'uppercase' | 'lowercase' | 'capitalize' {
    return run.styleOverrides?.textTransform ?? 'none';
  }

  setRunTransform(run: TextRun, transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'): void {
    const next = this.getRunTransform(run) === transform ? 'none' : transform;
    this.textEdit.updateActiveRunStyle({ textTransform: next });
  }

  getRunOpacity(run: TextRun): number {
    return Math.round((run.styleOverrides?.opacity ?? 1) * 100);
  }

  setRunOpacity(run: TextRun, value: string | number): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      const clamped = Math.max(10, Math.min(100, n)) / 100;
      this.textEdit.updateActiveRunStyle({ opacity: clamped });
    }
  }

  resetRunStyling(): void {
    this.textEdit.resetActiveRunStyle();
  }

  finishTextEditing(): void {
    this.textEdit.deactivate();
  }
}
