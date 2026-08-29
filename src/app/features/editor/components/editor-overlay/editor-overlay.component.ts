import {
  Component,
  ElementRef,
  viewChild,
  signal,
  computed,
  inject,
  input,
  effect,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  PdfToolId,
  PdfAnnotation,
  ShapeAnnotation,
  TextAnnotation,
  HighlightAnnotation,
  CommentAnnotation,
  DrawingAnnotation,
  Point,
  Rect,
  EraserTarget,
  TextTransform,
} from '../../../../core/models/pdf.models';
import { EditorStateService } from '../../state/editor-state.service';

type MarkType =
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'highlight'
  | 'underline'
  | 'strikethrough';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DraftMark {
  type: MarkType;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Padding (in overlay/SVG units == CSS px) around text annotations. */
const TEXT_PAD_X = 10;
const TEXT_PAD_Y = 8;
const TEXT_LINE_HEIGHT = 1.35;
const TEXT_BACKGROUND_PADDING = 6;

function isRectIntersecting(r1: Rect, r2: Rect): boolean {
  return !(
    r2.x > r1.x + r1.width ||
    r2.x + r2.width < r1.x ||
    r2.y > r1.y + r1.height ||
    r2.y + r2.height < r1.y
  );
}

function isPointInPolygon(p: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function isAnnotationInPolygon(a: PdfAnnotation, polygon: Point[]): boolean {
  if (a.type === 'drawing') {
    if (a.points.some((p) => isPointInPolygon(p, polygon))) {
      return true;
    }
  }
  const corners: Point[] = [
    { x: a.rect.x, y: a.rect.y },
    { x: a.rect.x + a.rect.width, y: a.rect.y },
    { x: a.rect.x + a.rect.width, y: a.rect.y + a.rect.height },
    { x: a.rect.x, y: a.rect.y + a.rect.height },
    { x: a.rect.x + a.rect.width / 2, y: a.rect.y + a.rect.height / 2 },
  ];
  return corners.some((p) => isPointInPolygon(p, polygon));
}

@Component({
  selector: 'app-editor-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-overlay.component.html',
  styleUrl: './editor-overlay.component.scss',
  host: {
    '[style.touchAction]': 'touchAction()',
  },
})
export class EditorOverlayComponent implements OnDestroy {
  protected readonly Math = Math;
  readonly state = inject(EditorStateService);
  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly textEditorRef =
    viewChild<ElementRef<HTMLTextAreaElement>>('textEditor');

  readonly pageId = input.required<string>();
  readonly pageIndex = input.required<number>();
  readonly annotations = input<PdfAnnotation[]>([]);
  readonly tool = input<PdfToolId>('select');
  readonly selectedId = input<string | null>(null);
  readonly width = input.required<number>();
  readonly height = input.required<number>();

  readonly touchAction = computed(() => {
    const t = this.tool();
    if (t === 'hand' || t === 'select') {
      return 'pan-x pan-y pinch-zoom';
    }
    return 'none';
  });

  /** Text annotation currently being edited inline. */
  readonly editingId = signal<string | null>(null);
  readonly editingText = computed(() => {
    const id = this.editingId();
    const a = this.annotations().find((it) => it.id === id);
    return a && a.type === 'text' ? a : null;
  });

  readonly draft = signal<DraftMark | null>(null);
  readonly draftBox = signal<Rect | null>(null);
  readonly draftLasso = signal<Point[] | null>(null);
  readonly draftDrawing = signal<{
    color: string;
    strokeWidth: number;
    points: Point[];
  } | null>(null);

  private currentSvg: SVGSVGElement | null = null;

  private onNativeTouchStart = (event: TouchEvent): void => {
    if (this.tool() !== 'hand' && this.tool() !== 'select') {
      const target = event.target as Element | null;
      if (
        target?.closest('.handle') ||
        target?.closest('.handles') ||
        target?.closest('.sel') ||
        target?.closest('.ann-item')
      ) {
        event.stopPropagation();
      }
    }
  };

  private onNativeTouchMove = (event: TouchEvent): void => {
    if (
      this.resizeId !== null ||
      this.multiDragStart !== null ||
      this.isDrawing ||
      this.isErasing ||
      this.draft() !== null ||
      this.draftBox() !== null ||
      this.draftLasso() !== null
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  constructor() {
    effect(() => {
      const svg = this.svgRef()?.nativeElement;
      if (this.currentSvg && this.currentSvg !== svg) {
        this.currentSvg.removeEventListener('touchstart', this.onNativeTouchStart);
        this.currentSvg.removeEventListener('touchmove', this.onNativeTouchMove);
      }
      this.currentSvg = svg ?? null;
      if (svg) {
        svg.addEventListener('touchstart', this.onNativeTouchStart, { passive: false });
        svg.addEventListener('touchmove', this.onNativeTouchMove, { passive: false });
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAutoScroll();
    if (this.currentSvg) {
      this.currentSvg.removeEventListener('touchstart', this.onNativeTouchStart);
      this.currentSvg.removeEventListener('touchmove', this.onNativeTouchMove);
      this.currentSvg = null;
    }
  }

  private autoScrollRaf: number | null = null;
  private lastPointerClientPos: { clientX: number; clientY: number } | null = null;

  private checkAutoScroll(event: PointerEvent): void {
    this.lastPointerClientPos = { clientX: event.clientX, clientY: event.clientY };
    const svg = this.svgRef()?.nativeElement;
    const stage = svg?.closest('.editor__canvas-stage') as HTMLElement | null;
    if (!stage) {
      this.stopAutoScroll();
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const edgeThreshold = 60;
    let vx = 0;
    let vy = 0;

    if (event.clientY > stageRect.bottom - edgeThreshold) {
      const delta = event.clientY - (stageRect.bottom - edgeThreshold);
      vy = Math.min(26, Math.max(5, Math.round((delta / edgeThreshold) * 22)));
    } else if (event.clientY < stageRect.top + edgeThreshold) {
      const delta = (stageRect.top + edgeThreshold) - event.clientY;
      vy = -Math.min(26, Math.max(5, Math.round((delta / edgeThreshold) * 22)));
    }

    if (event.clientX > stageRect.right - edgeThreshold) {
      const delta = event.clientX - (stageRect.right - edgeThreshold);
      vx = Math.min(26, Math.max(5, Math.round((delta / edgeThreshold) * 22)));
    } else if (event.clientX < stageRect.left + edgeThreshold) {
      const delta = (stageRect.left + edgeThreshold) - event.clientX;
      vx = -Math.min(26, Math.max(5, Math.round((delta / edgeThreshold) * 22)));
    }

    if (vx !== 0 || vy !== 0) {
      this.startAutoScroll(stage, vx, vy);
    } else {
      this.stopAutoScroll();
    }
  }

  private startAutoScroll(stage: HTMLElement, vx: number, vy: number): void {
    this.stopAutoScroll();
    const step = () => {
      if (!this.draftBox() && !this.draftLasso()) {
        this.stopAutoScroll();
        return;
      }
      if (vx !== 0) stage.scrollLeft += vx;
      if (vy !== 0) stage.scrollTop += vy;

      // Dynamically expand box selection as stage scrolls
      if (this.lastPointerClientPos && this.start) {
        const svg = this.svgRef()?.nativeElement;
        if (svg) {
          const rect = svg.getBoundingClientRect();
          const x = this.lastPointerClientPos.clientX - rect.left;
          const y = this.lastPointerClientPos.clientY - rect.top;
          if (this.draftBox()) {
            this.draftBox.set({
              x: Math.min(this.start.x, x),
              y: Math.min(this.start.y, y),
              width: Math.abs(x - this.start.x),
              height: Math.abs(y - this.start.y),
            });
          } else if (this.draftLasso()) {
            this.draftLasso.update((pts) => (pts ? [...pts, { x, y }] : [{ x, y }]));
          }
        }
      }
      this.autoScrollRaf = requestAnimationFrame(step);
    };
    this.autoScrollRaf = requestAnimationFrame(step);
  }

  private stopAutoScroll(): void {
    if (this.autoScrollRaf !== null) {
      cancelAnimationFrame(this.autoScrollRaf);
      this.autoScrollRaf = null;
    }
  }

  private start: { x: number; y: number } | null = null;
  private dragId: string | null = null;
  private dragOffset = { x: 0, y: 0 };
  private multiDragStart: Array<{
    id: string;
    x: number;
    y: number;
    points?: Point[];
  }> | null = null;
  private dragPivot = { x: 0, y: 0 };
  private hasMovedDuringDrag = false;
  private lastTap = { time: 0, id: '' };

  private resizeId: string | null = null;
  private resizeHandle: Handle | null = null;
  private resizeStart: {
    x: number;
    y: number;
    rect: { x: number; y: number; width: number; height: number };
  } | null = null;

  private isDrawing = false;
  private isErasing = false;

  readonly eraserPos = signal<{ x: number; y: number } | null>(null);
  readonly baseEraserRadius = computed(() => this.state.eraserSize() / 2);
  readonly eraserRadius = computed(
    () => (this.state.eraserSize() / 2) * this.state.eraserTolerance(),
  );
  readonly cutSizePx = computed(
    () =>
      Math.round(
        this.state.eraserSize() * this.state.eraserTolerance() * 10,
      ) / 10,
  );

  readonly multiSelectionBounds = computed<Rect | null>(() => {
    const ids = this.state.selectedIds();
    if (ids.length <= 1) {
      return null;
    }
    const idSet = new Set(ids);
    const selected = this.annotations().filter((a) => idSet.has(a.id));
    if (selected.length <= 1) {
      return null;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const a of selected) {
      minX = Math.min(minX, a.rect.x);
      maxX = Math.max(maxX, a.rect.x + a.rect.width);
      minY = Math.min(minY, a.rect.y);
      maxY = Math.max(maxY, a.rect.y + a.rect.height);
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  });

  readonly isGroupSelected = computed(() => {
    const list = this.state.getSelectedList(this.pageId());
    if (list.length < 2) {
      return false;
    }
    const firstGroupId = list[0].groupId;
    return Boolean(
      firstGroupId && list.every((a) => a.groupId === firstGroupId),
    );
  });

  onContextMenu(event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey || this.tool() === 'select') {
      event.preventDefault();
    }
  }

  isSelected(id: string): boolean {
    return this.state.selectedIds().includes(id);
  }

  readonly arrowMarkers = computed(() =>
    this.annotations().filter(
      (a): a is ShapeAnnotation =>
        a.type === 'shape' && a.kind === 'arrow',
    ),
  );

  readonly interactive = computed(() => {
    const t = this.tool();
    if (t === 'hand') {
      return false;
    }
    if (t !== 'select') {
      return true;
    }
    return this.selectedId() !== null || this.annotations().length > 0;
  });

  readonly isDrawingTool = computed(() => {
    const t = this.tool();
    return (
      t === 'pen' ||
      t === 'freehand' ||
      t === 'eraser' ||
      t === 'rectangle' ||
      t === 'circle' ||
      t === 'arrow' ||
      t === 'line' ||
      t === 'highlight' ||
      t === 'underline' ||
      t === 'strikethrough'
    );
  });

  readonly cursor = computed<'crosshair' | 'default' | 'none'>(() => {
    const t = this.tool();
    if (t === 'eraser') {
      return 'none'; // custom circular SVG eraser cursor is drawn
    }
    return t !== 'select' && t !== 'hand' ? 'crosshair' : 'default';
  });

  private localPoint(event: PointerEvent): { x: number; y: number } {
    const svg = this.svgRef()?.nativeElement;
    if (!svg) {
      return { x: event.offsetX, y: event.offsetY };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private hitTest(x: number, y: number): PdfAnnotation | null {
    const list = this.annotations();
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      const r = a.rect;
      if (
        x >= r.x - 2 &&
        x <= r.x + r.width + 2 &&
        y >= r.y - 2 &&
        y <= r.y + r.height + 2
      ) {
        return a;
      }
    }
    return null;
  }

  private shouldErase(a: PdfAnnotation, target: EraserTarget): boolean {
    if (a.locked) {
      return false;
    }
    if (target === 'drawing') {
      return a.type === 'drawing';
    }
    if (target === 'highlight') {
      return (
        a.type === 'highlight' ||
        a.type === 'underline' ||
        a.type === 'strikethrough'
      );
    }
    return true;
  }

  private calcDrawingRect(points: Point[], strokeWidth: number): Rect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return {
      x: Math.max(0, minX - strokeWidth),
      y: Math.max(0, minY - strokeWidth),
      width: Math.max(10, maxX - minX + strokeWidth * 2),
      height: Math.max(10, maxY - minY + strokeWidth * 2),
    };
  }

  private resamplePoints(points: readonly Point[], step = 2): Point[] {
    if (points.length < 2) {
      return [...points];
    }
    const result: Point[] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist > step) {
        const count = Math.floor(dist / step);
        for (let j = 1; j <= count; j++) {
          const t = j / (count + 1);
          result.push({
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
          });
        }
      }
      result.push(p2);
    }
    return result;
  }

  private eraseAt(x: number, y: number): void {
    const mode = this.state.eraserMode();
    const target = this.state.eraserTarget();
    const radius = this.eraserRadius();
    const list = this.annotations();

    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      if (!this.shouldErase(a, target)) {
        continue;
      }
      const r = a.rect;
      const margin = radius + 4;
      const inBox =
        x >= r.x - margin &&
        x <= r.x + r.width + margin &&
        y >= r.y - margin &&
        y <= r.y + r.height + margin;

      if (!inBox) {
        continue;
      }

      if (a.type === 'drawing') {
        const threshold = radius + a.strokeWidth / 2;
        if (mode === 'stroke') {
          // Whole-stroke erase
          const hitPoint = a.points.some(
            (p) => Math.hypot(p.x - x, p.y - y) <= threshold,
          );
          if (hitPoint) {
            this.state.removeAnnotation(a.id);
            return;
          }
        } else {
          // Precision / segment erase with dense sub-pixel sampling
          const dense = this.resamplePoints(a.points, 2);
          const segments: Point[][] = [];
          let current: Point[] = [];
          let erasedAny = false;

          for (const p of dense) {
            if (Math.hypot(p.x - x, p.y - y) > threshold) {
              current.push(p);
            } else {
              erasedAny = true;
              if (current.length >= 2) {
                segments.push(current);
              }
              current = [];
            }
          }
          if (current.length >= 2) {
            segments.push(current);
          }

          if (!erasedAny) {
            continue;
          }

          if (segments.length === 0) {
            this.state.removeAnnotation(a.id);
            return;
          }

          // Update first segment into existing annotation
          const firstPts = segments[0];
          this.state.updateAnnotation(a.id, {
            points: firstPts,
            rect: this.calcDrawingRect(firstPts, a.strokeWidth),
          });

          // Add additional segments as new DrawingAnnotations
          for (let s = 1; s < segments.length; s++) {
            const extraPts = segments[s];
            const extraAnn: DrawingAnnotation = {
              ...a,
              id: crypto.randomUUID(),
              points: extraPts,
              rect: this.calcDrawingRect(extraPts, a.strokeWidth),
              createdAt: Date.now(),
            };
            this.state.addAnnotation(this.pageId(), extraAnn, false);
          }
          return;
        }
      } else {
        // Shapes, text, highlights
        this.state.removeAnnotation(a.id);
        return;
      }
    }
  }

  onPointerDown(event: PointerEvent): void {
    const { x, y } = this.localPoint(event);
    const t = this.tool();

    if (this.editingId()) {
      this.stopEditing();
    }

    if (t === 'eraser') {
      this.state.selectAnnotation(null);
      this.isErasing = true;
      this.eraseAt(x, y);
      this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
      return;
    }

    if (t === 'pen' || t === 'freehand') {
      this.isDrawing = true;
      const color =
        t === 'freehand'
          ? this.state.freehandColor()
          : this.state.penColor();
      const strokeWidth =
        t === 'freehand'
          ? this.state.freehandStrokeWidth()
          : this.state.penStrokeWidth();
      this.draftDrawing.set({ color, strokeWidth, points: [{ x, y }] });
      this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
      return;
    }

    if (t === 'select' || t === 'text') {
      const hit = this.hitTest(x, y);
      if (hit) {
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        const isDoubleTap =
          now - this.lastTap.time < 380 && this.lastTap.id === hit.id;
        this.lastTap = { time: now, id: hit.id };

        // Double click / double tap to edit text inline at any time (preserve existing text)
        if (hit.type === 'text' && !hit.locked && isDoubleTap) {
          const caret = this.caretIndexFromX(hit.text, x, hit);
          this.startEditing(hit, caret, false);
          return;
        }

        const isCurrentlySelected = this.state.selectedIds().includes(hit.id);
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          this.state.toggleAnnotationSelection(hit.id);
        } else if (!isCurrentlySelected) {
          this.state.selectAnnotation(hit.id);
        }

        // Initialize synchronized multi-drag for all selected items
        const selected = this.state.getSelectedList(this.pageId());
        this.multiDragStart = selected
          .filter((a) => !a.locked)
          .map((a) => ({
            id: a.id,
            x: a.rect.x,
            y: a.rect.y,
            points:
              a.type === 'drawing'
                ? a.points.map((p) => ({ ...p }))
                : undefined,
          }));
        this.dragPivot = { x, y };
        this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
        return;
      } else if (t === 'select') {
        if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
          this.state.clearSelection();
        }
        this.start = { x, y };
        const mode = this.state.selectMode();
        if (mode === 'none') {
          // Click-only mode: no drag marquee
          return;
        } else if (mode === 'lasso') {
          this.draftLasso.set([{ x, y }]);
        } else {
          this.draftBox.set({ x, y, width: 0, height: 0 });
        }
        this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
        return;
      } else if (t === 'text') {
        this.createText(x, y);
        return;
      }
    }

    if (
      t === 'rectangle' ||
      t === 'circle' ||
      t === 'arrow' ||
      t === 'line' ||
      t === 'highlight' ||
      t === 'underline' ||
      t === 'strikethrough'
    ) {
      this.start = { x, y };
      this.draft.set({ type: t, x, y, width: 0, height: 0 });
      this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
    } else if (t === 'comment') {
      this.createComment(x, y);
    }
  }

  onHandleDown(event: PointerEvent, handle: Handle): void {
    event.stopPropagation();
    event.preventDefault();
    const ann = this.annotations().find((it) => it.id === this.selectedId());
    if (!ann || ann.locked) {
      return;
    }
    this.state.pushHistorySnapshot('Resize Object');
    const p = this.localPoint(event);
    this.resizeId = ann.id;
    this.resizeHandle = handle;
    this.resizeStart = {
      x: p.x,
      y: p.y,
      rect: { ...ann.rect },
    };
    this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
  }

  /** Maps a resize handle to the correct directional cursor (drag icon). */
  handleCursor(h: Handle): string {
    switch (h) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
    }
  }

  onPointerLeave(): void {
    this.stopAutoScroll();
    this.eraserPos.set(null);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.tool() === 'eraser') {
      const { x, y } = this.localPoint(event);
      this.eraserPos.set({ x, y });
      if (this.isErasing) {
        this.eraseAt(x, y);
      }
      return;
    }
    if (this.eraserPos()) {
      this.eraserPos.set(null);
    }

    if (this.isDrawing) {
      event.preventDefault();
      event.stopPropagation();
      const { x, y } = this.localPoint(event);
      const cur = this.draftDrawing();
      if (cur) {
        const pts = cur.points;
        const last = pts[pts.length - 1];
        const dist = Math.hypot(x - last.x, y - last.y);
        if (dist >= 2) {
          this.draftDrawing.set({ ...cur, points: [...pts, { x, y }] });
        }
      }
      return;
    }

    if (this.resizeId && this.resizeHandle && this.resizeStart) {
      event.preventDefault();
      event.stopPropagation();
      const a = this.annotations().find((it) => it.id === this.resizeId);
      if (!a) {
        return;
      }
      const { x, y } = this.localPoint(event);
      const dx = x - this.resizeStart.x;
      const dy = y - this.resizeStart.y;
      const h = this.resizeHandle;
      let { x: rx, y: ry, width: rw, height: rh } = this.resizeStart.rect;
      if (h.includes('w')) {
        rx += dx;
        rw -= dx;
      }
      if (h.includes('e')) {
        rw += dx;
      }
      if (h.includes('n')) {
        ry += dy;
        rh -= dy;
      }
      if (h.includes('s')) {
        rh += dy;
      }
      if (rw < 8) {
        rw = 8;
      }
      if (rh < 8) {
        rh = 8;
      }
      if (a.type === 'drawing') {
        const origRect = this.resizeStart.rect;
        const sx = rw / Math.max(1, origRect.width);
        const sy = rh / Math.max(1, origRect.height);
        const scaledPts = a.points.map((p) => ({
          x: rx + (p.x - origRect.x) * sx,
          y: ry + (p.y - origRect.y) * sy,
        }));
        this.state.updateAnnotation(
          a.id,
          {
            rect: { x: rx, y: ry, width: rw, height: rh },
            points: scaledPts,
          },
          false,
        );
      } else {
        this.state.updateAnnotation(
          a.id,
          {
            rect: { x: rx, y: ry, width: rw, height: rh },
          },
          false,
        );
      }
      return;
    }

    if (this.multiDragStart && this.multiDragStart.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      if (!this.hasMovedDuringDrag) {
        this.state.pushHistorySnapshot('Move Object');
        this.hasMovedDuringDrag = true;
      }
      const { x, y } = this.localPoint(event);
      const dx = x - this.dragPivot.x;
      const dy = y - this.dragPivot.y;
      for (const item of this.multiDragStart) {
        const a = this.annotations().find((it) => it.id === item.id);
        if (!a) {
          continue;
        }
        const newX = Math.round(item.x + dx);
        const newY = Math.round(item.y + dy);
        if (a.type === 'drawing' && item.points) {
          this.state.updateAnnotation(
            a.id,
            {
              rect: { ...a.rect, x: newX, y: newY },
              points: item.points.map((p) => ({
                x: Math.round(p.x + dx),
                y: Math.round(p.y + dy),
              })),
            },
            false,
          );
        } else {
          this.state.updateAnnotation(
            a.id,
            {
              rect: { ...a.rect, x: newX, y: newY },
            },
            false,
          );
        }
      }
      return;
    }

    if (this.draftBox() && this.start) {
      event.preventDefault();
      event.stopPropagation();
      const { x, y } = this.localPoint(event);
      this.draftBox.set({
        x: Math.min(this.start.x, x),
        y: Math.min(this.start.y, y),
        width: Math.abs(x - this.start.x),
        height: Math.abs(y - this.start.y),
      });
      this.checkAutoScroll(event);
      return;
    }

    if (this.draftLasso()) {
      event.preventDefault();
      event.stopPropagation();
      const { x, y } = this.localPoint(event);
      this.draftLasso.update((pts) => (pts ? [...pts, { x, y }] : [{ x, y }]));
      this.checkAutoScroll(event);
      return;
    }

    if (this.draft() && this.start) {
      const { x, y } = this.localPoint(event);
      const d = this.draft()!;
      this.draft.set({
        ...d,
        x: Math.min(this.start.x, x),
        y: Math.min(this.start.y, y),
        width: Math.abs(x - this.start.x),
        height: Math.abs(y - this.start.y),
      });
    }
  }

  onPointerUp(event: PointerEvent): void {
    this.stopAutoScroll();
    this.svgRef()?.nativeElement.releasePointerCapture?.(event.pointerId);
    if (this.isErasing) {
      this.isErasing = false;
      return;
    }
    if (this.isDrawing) {
      this.isDrawing = false;
      const cur = this.draftDrawing();
      this.draftDrawing.set(null);
      if (cur && cur.points.length >= 2) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const p of cur.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        const pad = cur.strokeWidth;
        const ann: DrawingAnnotation = {
          id: crypto.randomUUID(),
          type: 'drawing',
          kind: this.tool() === 'freehand' ? 'freehand' : 'pen',
          pageIndex: this.pageIndex(),
          rect: {
            x: Math.max(0, minX - pad),
            y: Math.max(0, minY - pad),
            width: Math.max(10, maxX - minX + pad * 2),
            height: Math.max(10, maxY - minY + pad * 2),
          },
          rotation: 0,
          opacity: 1,
          createdAt: Date.now(),
          color: cur.color,
          strokeWidth: cur.strokeWidth,
          points: cur.points,
        };
        const mode = this.state.drawingMode();
        if (mode === 'autoselect') {
          this.state.addAnnotation(this.pageId(), ann, true);
          this.state.setTool('select');
          this.state.selectAnnotation(ann.id);
        } else {
          // Natural ink mode: add annotation silently without showing borders or switching tools
          this.state.addAnnotation(this.pageId(), ann, false);
          this.state.selectAnnotation(null);
        }
      }
      return;
    }
    if (this.resizeId) {
      this.resizeId = null;
      this.resizeHandle = null;
      this.resizeStart = null;
      return;
    }
    if (this.multiDragStart) {
      this.multiDragStart = null;
      this.hasMovedDuringDrag = false;
    }
    if (this.draftBox()) {
      const box = this.draftBox()!;
      this.draftBox.set(null);
      this.start = null;
      if (box.width >= 3 || box.height >= 3) {
        const hitIds = this.annotations()
          .filter((a) => isRectIntersecting(a.rect, box))
          .map((a) => a.id);
        this.state.selectAnnotations(
          hitIds,
          event.shiftKey || event.ctrlKey || event.metaKey,
        );
      }
      return;
    }
    if (this.draftLasso()) {
      const lasso = this.draftLasso()!;
      this.draftLasso.set(null);
      this.start = null;
      if (lasso.length >= 3) {
        const hitIds = this.annotations()
          .filter((a) => isAnnotationInPolygon(a, lasso))
          .map((a) => a.id);
        this.state.selectAnnotations(
          hitIds,
          event.shiftKey || event.ctrlKey || event.metaKey,
        );
      }
      return;
    }
    if (this.draft()) {
      const d = this.draft()!;
      this.draft.set(null);
      this.start = null;
      if (d.width < 4 && d.height < 4) {
        return;
      }
      if (
        d.type === 'highlight' ||
        d.type === 'underline' ||
        d.type === 'strikethrough'
      ) {
        this.commitHighlight(d);
      } else {
        this.commitShape(d);
      }
    }
  }

  /** Double-click a text annotation to edit it inline at the cursor. */
  onDblClick(event: MouseEvent): void {
    const { x, y } = this.localPoint(event as unknown as PointerEvent);
    const hit = this.hitTest(x, y);
    if (hit && hit.type === 'text' && !hit.locked) {
      const caret = this.caretIndexFromX(hit.text, x, hit);
      this.startEditing(hit, caret);
    }
  }

  private startEditing(
    a: TextAnnotation,
    caret?: number,
    selectAll = false,
  ): void {
    this.state.pushHistorySnapshot('Edit Text');
    this.editingId.set(a.id);
    this.state.selectAnnotation(a.id);
    setTimeout(() => {
      const el = this.textEditorRef()?.nativeElement;
      if (!el) {
        return;
      }
      el.value = a.text;
      el.focus();
      if (selectAll) {
        el.setSelectionRange(0, a.text.length);
      } else {
        const pos =
          typeof caret === 'number'
            ? Math.max(0, Math.min(caret, a.text.length))
            : a.text.length;
        el.setSelectionRange(pos, pos);
      }
    }, 40);
  }

  onEditInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    const id = this.editingId();
    if (!id) {
      return;
    }
    const text = el.value;
    const cur = this.annotations().find((it) => it.id === id);
    if (!cur || cur.type !== 'text') {
      return;
    }
    const m = this.measureText(
      text,
      cur.fontSize,
      cur.fontWeight >= 700,
      cur.fontFamily,
      cur.italic,
      cur.transform,
      cur.lineHeight ?? TEXT_LINE_HEIGHT,
      cur.letterSpacing ?? 0,
    );
    this.state.updateAnnotation(
      id,
      {
        text,
        rect: { ...cur.rect, width: m.width, height: m.height },
      },
      false,
    );
  }

  stopEditing(): void {
    this.editingId.set(null);
  }

  onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.stopEditing();
    }
  }

  transformText(text: string, transform?: TextTransform): string {
    if (!transform || transform === 'none') {
      return text;
    }
    if (transform === 'uppercase') {
      return text.toUpperCase();
    }
    if (transform === 'lowercase') {
      return text.toLowerCase();
    }
    if (transform === 'capitalize') {
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return text;
  }

  private caretIndexFromX(
    text: string,
    clickX: number,
    a: TextAnnotation,
  ): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const rel = clickX - (a.rect.x + TEXT_PAD_X);
    if (!ctx) {
      return 0;
    }
    ctx.font = `${a.italic ? 'italic ' : ''}${a.fontWeight >= 700 ? 'bold ' : ''}${a.fontSize}px ${a.fontFamily}`;
    let acc = 0;
    for (let i = 0; i < text.length; i++) {
      const w = ctx.measureText(text[i]).width + (a.letterSpacing ?? 0);
      if (acc + w / 2 >= rel) {
        return i;
      }
      acc += w;
    }
    return text.length;
  }

  private measureText(
    text: string,
    fontSize: number,
    bold: boolean,
    fontFamily = 'sans-serif',
    italic = false,
    transform?: TextTransform,
    lineHeight = TEXT_LINE_HEIGHT,
    letterSpacing = 0,
  ): { width: number; height: number } {
    const transformed = this.transformText(text, transform);
    const lines = transformed.split('\n');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
      let maxW = 0;
      for (const line of lines) {
        const baseW = ctx.measureText(line || ' ').width;
        const spacingExtra = letterSpacing * Math.max(0, line.length - 1);
        const w = baseW + spacingExtra;
        if (w > maxW) {
          maxW = w;
        }
      }
      return {
        width: Math.max(20, Math.ceil(maxW) + TEXT_PAD_X * 2),
        height: Math.ceil(
          lines.length * fontSize * lineHeight + TEXT_PAD_Y * 2,
        ),
      };
    }
    const approx = Math.max(...lines.map((l) => l.length)) * (fontSize * 0.6 + letterSpacing);
    return {
      width: Math.max(20, Math.ceil(approx) + TEXT_PAD_X * 2),
      height: Math.ceil(
        lines.length * fontSize * lineHeight + TEXT_PAD_Y * 2,
      ),
    };
  }

  /** Split a text annotation's content into rendered lines. */
  textLines(text: string): string[] {
    return text.split('\n');
  }

  /** X coordinate of the text anchor for the given alignment/padding. */
  textAnchorX(a: TextAnnotation): number {
    if (a.align === 'center') {
      return a.rect.x + a.rect.width / 2;
    }
    if (a.align === 'right') {
      return a.rect.x + a.rect.width - TEXT_PAD_X;
    }
    return a.rect.x + TEXT_PAD_X;
  }

  textBackgroundPadding(a: TextAnnotation): number {
    return a.backgroundColor && a.backgroundColor !== 'transparent'
      ? a.backgroundPadding ?? TEXT_BACKGROUND_PADDING
      : 0;
  }

  /** Line of dashes (or null) for the given shape's stroke style. */
  strokeDashFor(a: ShapeAnnotation): string | null {
    const style = a.strokeStyle ?? 'solid';
    if (style === 'dashed') {
      return `${Math.max(2, a.strokeWidth * 2)} ${Math.max(2, a.strokeWidth * 2)}`;
    }
    if (style === 'dotted') {
      return `${Math.max(1, a.strokeWidth)} ${Math.max(2, a.strokeWidth * 2)}`;
    }
    return null;
  }

  /** Build a rotation transform centered on the annotation's bounding box. */
  rotateTransform(a: { rect: { x: number; y: number; width: number; height: number }; rotation: number }): string | null {
    if (!a.rotation) {
      return null;
    }
    const cx = a.rect.x + a.rect.width / 2;
    const cy = a.rect.y + a.rect.height / 2;
    return `rotate(${a.rotation} ${cx} ${cy})`;
  }

  /** Baseline Y for the line at `lineIndex` (0-based) within the box. */
  lineBaselineY(a: TextAnnotation, lineIndex: number): number {
    const lh = a.lineHeight ?? TEXT_LINE_HEIGHT;
    return (
      a.rect.y + TEXT_PAD_Y + a.fontSize + lineIndex * a.fontSize * lh
    );
  }

  private createText(x: number, y: number): void {
    const text = 'Text';
    const fontSize = 16;
    const m = this.measureText(text, fontSize, false, 'sans-serif');
    const ann: TextAnnotation = {
      id: crypto.randomUUID(),
      type: 'text',
      pageIndex: this.pageIndex(),
      rect: { x, y, width: m.width, height: m.height },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      text,
      fontFamily: 'sans-serif',
      fontSize,
      fontWeight: 400,
      italic: false,
      underline: false,
      align: 'left',
      color: '#111111',
    };
    this.state.addAnnotation(this.pageId(), ann);
    // Drop straight into inline editing at the drop point, and revert to the
    // select tool so the next click commits rather than spawning another text.
    this.state.setTool('select');
    this.startEditing(ann, ann.text.length, true);
  }

  private createComment(x: number, y: number): void {
    const size = 22;
    const ann: CommentAnnotation = {
      id: crypto.randomUUID(),
      type: 'comment',
      pageIndex: this.pageIndex(),
      rect: { x: x - size / 2, y: y - size / 2, width: size, height: size },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      text: 'New comment',
      author: 'You',
    };
    this.state.addAnnotation(this.pageId(), ann);
    this.state.setTool('select');
    this.state.selectAnnotation(ann.id);
  }

  pointsToSvgPath(points: readonly Point[]): string {
    if (!points || points.length === 0) {
      return '';
    }
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
    }
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }
    if (this.state.penSmoothing() === 'none') {
      return (
        `M ${points[0].x} ${points[0].y} ` +
        points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(' ')
      );
    }
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      d += ` Q ${p0.x} ${p0.y}, ${mx} ${my}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  private commitShape(d: DraftMark): void {
    const isLineOrArrow = d.type === 'arrow' || d.type === 'line';
    const ann: ShapeAnnotation = {
      id: crypto.randomUUID(),
      type: 'shape',
      kind: d.type as ShapeAnnotation['kind'],
      pageIndex: this.pageIndex(),
      rect: { x: d.x, y: d.y, width: d.width, height: d.height },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      strokeColor: '#2563eb',
      fillColor: isLineOrArrow ? 'transparent' : 'rgba(37,99,235,0.12)',
      strokeWidth: 2,
      strokeStyle: 'solid',
    };
    this.state.addAnnotation(this.pageId(), ann);
    this.state.setTool('select');
    this.state.selectAnnotation(ann.id);
  }

  private commitHighlight(d: DraftMark): void {
    const color =
      d.type === 'highlight'
        ? '#fde047'
        : d.type === 'underline'
          ? '#2563eb'
          : '#ef4444';
    const ann: HighlightAnnotation = {
      id: crypto.randomUUID(),
      type: d.type as HighlightAnnotation['type'],
      pageIndex: this.pageIndex(),
      rect: { x: d.x, y: d.y, width: d.width, height: d.height },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      color,
      quote: '',
    };
    this.state.addAnnotation(this.pageId(), ann);
    this.state.setTool('select');
    this.state.selectAnnotation(ann.id);
  }
}
