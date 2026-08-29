import {
  Component,
  inject,
  output,
  computed,
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
  DrawingMode,
  SelectMode,
  EraserMode,
  EraserTarget,
} from '../../../../core/models/pdf.models';
import { PanelSectionComponent } from '../../../../shared/components/panel/panel-section.component';
import { EditorStateService } from '../../state/editor-state.service';
import { EditorPagesService } from '../../state/editor-pages.service';

type StrokeStyle = 'solid' | 'dashed' | 'dotted';

interface ColorSwatch {
  readonly value: string;
  readonly label: string;
}

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

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [DecimalPipe, PanelSectionComponent],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent {
  private readonly state = inject(EditorStateService);
  private readonly pages = inject(EditorPagesService);

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

  readonly highlightSwatches = HIGHLIGHT_SWATCHES;
  readonly shapeSwatches = SHAPE_SWATCHES;

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

  /** Whether the selected annotation is a shape that can carry a fill. */
  readonly canFill = computed(() => {
    const ann = this.selected();
    if (!ann || ann.type !== 'shape') {
      return false;
    }
    return ann.kind !== 'arrow' && ann.kind !== 'line';
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
      if (ann.kind === 'rectangle') {
        return 'fa-solid fa-square';
      }
      if (ann.kind === 'circle') {
        return 'fa-solid fa-circle';
      }
      if (ann.kind === 'line') {
        return 'fa-solid fa-slash';
      }
      if (ann.kind === 'arrow') {
        return 'fa-solid fa-arrow-right';
      }
      return 'fa-solid fa-shapes';
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

  setDrawingColor(ann: PdfAnnotation, color: string): void {
    this.state.updateAnnotation(ann.id, { color } as Partial<DrawingAnnotation>);
  }

  setDrawingStrokeWidth(ann: PdfAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 1 && n <= 64) {
      this.state.updateAnnotation(ann.id, { strokeWidth: n } as Partial<DrawingAnnotation>);
    }
  }

  toColor(value: string): string {
    if (value.startsWith('#')) {
      return value;
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
    this.state.updateAnnotation(ann.id, { text: value } as Partial<TextAnnotation>);
  }

  setFontSize(ann: PdfAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      this.state.updateAnnotation(ann.id, {
        fontSize: n,
      } as Partial<TextAnnotation>);
    }
  }

  setColor(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, { color: value } as Partial<TextAnnotation>);
  }

  setFontFamily(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      fontFamily: value,
    } as Partial<TextAnnotation>);
  }

  toggleBold(ann: TextAnnotation): void {
    this.state.updateAnnotation(ann.id, {
      fontWeight: ann.fontWeight >= 700 ? 400 : 700,
    });
  }

  toggleItalic(ann: TextAnnotation): void {
    this.state.updateAnnotation(ann.id, { italic: !ann.italic });
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
    this.state.updateAnnotation(ann.id, { transform: next });
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
      backgroundPadding: ann.backgroundPadding ?? 6,
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
      this.state.updateAnnotation(ann.id, { lineHeight: n });
    }
  }

  setLetterSpacing(ann: TextAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      this.state.updateAnnotation(ann.id, { letterSpacing: n });
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

  setAuthor(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      author: value,
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

  setOpacity(ann: PdfAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      this.state.updateAnnotation(ann.id, { opacity: n });
    }
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

  setBatchOpacity(opacity: number | string): void {
    const n = Number(opacity);
    if (!Number.isNaN(n)) {
      this.state.setBatchOpacity(this.pages.currentId(), n);
    }
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
}
