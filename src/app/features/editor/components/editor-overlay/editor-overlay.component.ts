import {
  Component,
  ElementRef,
  viewChild,
  signal,
  computed,
  inject,
  input,
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
  ImageAnnotation,
  SignatureAnnotation,
  StampAnnotation,
  PendingMedia,
  Point,
  Rect,
} from '../../../../core/models/pdf.models';
import { EditorStateService } from '../../state/editor-state.service';

type ShapeDraftKind =
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'line';

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DraftShape {
  kind: ShapeDraftKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DraftDrawing {
  kind: 'pen' | 'freehand';
  points: Point[];
}

type Draft = DraftShape | DraftDrawing;

@Component({
  selector: 'app-editor-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      #svg
      class="overlay"
      [attr.width]="width()"
      [attr.height]="height()"
      [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
      [class.overlay--interactive]="interactive()"
      [style.pointerEvents]="interactive() ? 'auto' : 'none'"
      [style.cursor]="cursor()"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
    >
      <defs>
        @for (a of arrowMarkers(); track a.id) {
          <marker
            [id]="'ah-' + a.id"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,3 L0,6 Z" [attr.fill]="a.strokeColor" />
          </marker>
        }
      </defs>

      @for (a of annotations(); track a.id) {
        @if (a.type === 'shape') {
          @if (a.kind === 'rectangle') {
            <rect
              [attr.x]="a.rect.x"
              [attr.y]="a.rect.y"
              [attr.width]="a.rect.width"
              [attr.height]="a.rect.height"
              [attr.fill]="a.fillColor"
              [attr.stroke]="a.strokeColor"
              [attr.stroke-width]="a.strokeWidth"
              [attr.opacity]="a.opacity"
            />
          } @else if (a.kind === 'circle') {
            <ellipse
              [attr.cx]="a.rect.x + a.rect.width / 2"
              [attr.cy]="a.rect.y + a.rect.height / 2"
              [attr.rx]="a.rect.width / 2"
              [attr.ry]="a.rect.height / 2"
              [attr.fill]="a.fillColor"
              [attr.stroke]="a.strokeColor"
              [attr.stroke-width]="a.strokeWidth"
              [attr.opacity]="a.opacity"
            />
          } @else if (a.kind === 'line' || a.kind === 'arrow') {
            <line
              [attr.x1]="a.rect.x"
              [attr.y1]="a.rect.y"
              [attr.x2]="a.rect.x + a.rect.width"
              [attr.y2]="a.rect.y + a.rect.height"
              [attr.stroke]="a.strokeColor"
              [attr.stroke-width]="a.strokeWidth"
              [attr.opacity]="a.opacity"
              [attr.marker-end]="a.kind === 'arrow' ? 'url(#ah-' + a.id + ')' : null"
            />
          }
        } @else if (a.type === 'drawing') {
          <polyline
            [attr.points]="pointsString(a.points)"
            fill="none"
            [attr.stroke]="a.color"
            [attr.stroke-width]="a.strokeWidth"
            [attr.opacity]="a.opacity"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        } @else if (a.type === 'text') {
          <text
            [attr.x]="a.rect.x"
            [attr.y]="a.rect.y + a.fontSize"
            [attr.font-size]="a.fontSize"
            [attr.fill]="a.color"
            [attr.opacity]="a.opacity"
            [attr.font-style]="a.italic ? 'italic' : 'normal'"
            [attr.text-decoration]="a.underline ? 'underline' : 'none'"
            font-family="sans-serif"
          >
            {{ a.text }}
          </text>
        } @else if (a.type === 'highlight') {
          <rect
            [attr.x]="a.rect.x"
            [attr.y]="a.rect.y"
            [attr.width]="a.rect.width"
            [attr.height]="a.rect.height"
            [attr.fill]="a.color"
            [attr.fill-opacity]="0.4"
            [attr.opacity]="a.opacity"
          />
        } @else if (a.type === 'underline') {
          <line
            [attr.x1]="a.rect.x"
            [attr.y1]="a.rect.y + a.rect.height"
            [attr.x2]="a.rect.x + a.rect.width"
            [attr.y2]="a.rect.y + a.rect.height"
            [attr.stroke]="a.color"
            [attr.stroke-width]="2"
            [attr.opacity]="a.opacity"
          />
        } @else if (a.type === 'strikethrough') {
          <line
            [attr.x1]="a.rect.x"
            [attr.y1]="a.rect.y + a.rect.height / 2"
            [attr.x2]="a.rect.x + a.rect.width"
            [attr.y2]="a.rect.y + a.rect.height / 2"
            [attr.stroke]="a.color"
            [attr.stroke-width]="2"
            [attr.opacity]="a.opacity"
          />
        } @else if (a.type === 'comment') {
          <circle
            [attr.cx]="a.rect.x + a.rect.width / 2"
            [attr.cy]="a.rect.y + a.rect.height / 2"
            r="9"
            fill="#facc15"
            stroke="#b45309"
            stroke-width="1.5"
            [attr.opacity]="a.opacity"
          />
          <text
            [attr.x]="a.rect.x + a.rect.width / 2"
            [attr.y]="a.rect.y + a.rect.height / 2 + 4"
            text-anchor="middle"
            font-size="11"
            font-weight="700"
            fill="#7c2d12"
          >
            C
          </text>
        } @else if (a.type === 'image' || a.type === 'signature') {
          <image
            [attr.href]="a.dataUrl"
            [attr.x]="a.rect.x"
            [attr.y]="a.rect.y"
            [attr.width]="a.rect.width"
            [attr.height]="a.rect.height"
            [attr.opacity]="a.opacity"
            preserveAspectRatio="none"
            [attr.transform]="rotateTransform(a)"
          />
        } @else if (a.type === 'stamp') {
          <g [attr.transform]="rotateTransform(a)">
            <rect
              [attr.x]="a.rect.x"
              [attr.y]="a.rect.y"
              [attr.width]="a.rect.width"
              [attr.height]="a.rect.height"
              rx="6"
              fill="none"
              [attr.stroke]="a.color"
              stroke-width="3"
              [attr.opacity]="a.opacity"
            />
            <text
              [attr.x]="a.rect.x + a.rect.width / 2"
              [attr.y]="a.rect.y + a.rect.height / 2"
              text-anchor="middle"
              dominant-baseline="central"
              [attr.fill]="a.color"
              font-size="18"
              font-weight="700"
              [attr.opacity]="a.opacity"
            >
              {{ a.text }}
            </text>
          </g>
        }

        @if (a.id === selectedId()) {
          <g [attr.transform]="rotateTransform(a)" class="sel-group">
            <rect
              class="sel"
              [attr.x]="a.rect.x - 3"
              [attr.y]="a.rect.y - 3"
              [attr.width]="a.rect.width + 6"
              [attr.height]="a.rect.height + 6"
            />
            <rect
              class="handle h-nw"
              [attr.x]="a.rect.x - 4"
              [attr.y]="a.rect.y - 4"
              [attr.width]="8"
              [attr.height]="8"
              (pointerdown)="onHandleDown($event, 'nw', a)"
            />
            <rect
              class="handle h-n"
              [attr.x]="a.rect.x + a.rect.width / 2 - 4"
              [attr.y]="a.rect.y - 4"
              [attr.width]="8"
              [attr.height]="8"
              (pointerdown)="onHandleDown($event, 'n', a)"
            />
            <rect
              class="handle h-ne"
              [attr.x]="a.rect.x + a.rect.width - 4"
              [attr.y]="a.rect.y - 4"
              [attr.width]="8"
              [attr.height]="8"
              (pointerdown)="onHandleDown($event, 'ne', a)"
            />
            <rect
              class="handle h-e"
              [attr.x]="a.rect.x + a.rect.width - 4"
              [attr.y]="a.rect.y + a.rect.height / 2 - 4"
              [attr.width]="8"
              [attr.height]="8"
              (pointerdown)="onHandleDown($event, 'e', a)"
            />
            <rect
              class="handle h-se"
              [attr.x]="a.rect.x + a.rect.width - 4"
              [attr.y]="a.rect.y + a.rect.height - 4"
              [attr.width]="8"
              [attr.height]="8"
              (pointerdown)="onHandleDown($event, 'se', a)"
            />
            <rect
              class="handle h-s"
              [attr.x]="a.rect.x + a.rect.width / 2 - 4"
              [attr.y]="a.rect.y + a.rect.height - 4"
              [attr.width]="8"
              [attr.height]="8"
              (pointerdown)="onHandleDown($event, 's', a)"
            />
            <rect
              class="handle h-sw"
              [attr.x]="a.rect.x - 4"
              [attr.y]="a.rect.y + a.rect.height - 4"
              [attr.width]="8"
              [attr.height]="8"
              (pointerdown)="onHandleDown($event, 'sw', a)"
            />
            <rect
              class="handle h-w"
              [attr.x]="a.rect.x - 4"
              [attr.y]="a.rect.y + a.rect.height / 2 - 4"
              [attr.width]="8"
              [attr.height]="8"
              (pointerdown)="onHandleDown($event, 'w', a)"
            />
          </g>
        }
      }

      @if (draft(); as d) {
        @if (d.kind === 'pen' || d.kind === 'freehand') {
          <polyline
            class="draft draft--stroke"
            [attr.points]="pointsString(d.points)"
            fill="none"
          />
        } @else {
          @if (d.kind === 'rectangle') {
            <rect
              class="draft"
              [attr.x]="d.x"
              [attr.y]="d.y"
              [attr.width]="d.width"
              [attr.height]="d.height"
            />
          } @else if (d.kind === 'circle') {
            <ellipse
              class="draft"
              [attr.cx]="d.x + d.width / 2"
              [attr.cy]="d.y + d.height / 2"
              [attr.rx]="d.width / 2"
              [attr.ry]="d.height / 2"
            />
          } @else if (
            d.kind === 'arrow' ||
            d.kind === 'line'
          ) {
            <line
              class="draft draft--stroke"
              [attr.x1]="d.x"
              [attr.y1]="d.y"
              [attr.x2]="d.x + d.width"
              [attr.y2]="d.y + d.height"
            />
          } @else if (d.kind === 'highlight') {
            <rect
              class="draft draft--fill"
              [attr.x]="d.x"
              [attr.y]="d.y"
              [attr.width]="d.width"
              [attr.height]="d.height"
            />
          } @else if (d.kind === 'underline') {
            <line
              class="draft draft--stroke"
              [attr.x1]="d.x"
              [attr.y1]="d.y + d.height"
              [attr.x2]="d.x + d.width"
              [attr.y2]="d.y + d.height"
            />
          } @else if (d.kind === 'strikethrough') {
            <line
              class="draft draft--stroke"
              [attr.x1]="d.x"
              [attr.y1]="d.y + d.height / 2"
              [attr.x2]="d.x + d.width"
              [attr.y2]="d.y + d.height / 2"
            />
          }
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
        position: absolute;
        inset: 0;
      }
      .overlay {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
        user-select: none;
      }
      .sel {
        fill: none;
        stroke: #2563eb;
        stroke-dasharray: 4 3;
        stroke-width: 1.5;
      }
      .handle {
        fill: #ffffff;
        stroke: #2563eb;
        stroke-width: 1.5;
        width: 8px;
        height: 8px;
      }
      .h-nw,
      .h-se {
        cursor: nwse-resize;
      }
      .h-ne,
      .h-sw {
        cursor: nesw-resize;
      }
      .h-n,
      .h-s {
        cursor: ns-resize;
      }
      .h-e,
      .h-w {
        cursor: ew-resize;
      }
      .draft {
        fill: rgba(37, 99, 235, 0.12);
        stroke: #2563eb;
        stroke-width: 2;
        stroke-dasharray: 5 4;
      }
      .draft--fill {
        fill: rgba(255, 224, 102, 0.4);
        stroke: #ca8a04;
      }
      .draft--stroke {
        fill: none;
        stroke: #2563eb;
        stroke-width: 2;
      }
    `,
  ],
})
export class EditorOverlayComponent {
  private readonly state = inject(EditorStateService);
  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');

  readonly pageId = input.required<string>();
  readonly pageIndex = input.required<number>();
  readonly annotations = input<PdfAnnotation[]>([]);
  readonly tool = input<PdfToolId>('select');
  readonly selectedId = input<string | null>(null);
  readonly width = input.required<number>();
  readonly height = input.required<number>();

  readonly draft = signal<Draft | null>(null);
  private start: { x: number; y: number } | null = null;
  private dragId: string | null = null;
  private dragOffset = { x: 0, y: 0 };
  private erasing = false;
  private resizing: {
    id: string;
    handle: HandleId;
    start: PdfAnnotation;
    startRect: Rect;
    startX: number;
    startY: number;
    rotation: number;
  } | null = null;

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

  readonly cursor = computed<'crosshair' | 'default'>(() => {
    const t = this.tool();
    return t !== 'select' && t !== 'hand' ? 'crosshair' : 'default';
  });

  pointsString(points: ReadonlyArray<Point>): string {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  }

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

  onPointerDown(event: PointerEvent): void {
    const { x, y } = this.localPoint(event);
    const t = this.tool();

    if (t === 'select' || t === 'hand') {
      const hit = this.hitTest(x, y);
      if (hit) {
        this.dragId = hit.id;
        this.dragOffset = { x: x - hit.rect.x, y: y - hit.rect.y };
        this.state.selectAnnotation(hit.id);
        this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
      } else {
        this.state.selectAnnotation(null);
      }
      return;
    }

    if (
      t === 'rectangle' ||
      t === 'circle' ||
      t === 'arrow' ||
      t === 'highlight' ||
      t === 'underline' ||
      t === 'strikethrough' ||
      t === 'line'
    ) {
      this.start = { x, y };
      this.draft.set({ kind: t, x, y, width: 0, height: 0 });
      this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
      return;
    }

    if (t === 'pen' || t === 'freehand') {
      this.draft.set({ kind: t, points: [{ x, y }] });
      this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
      return;
    }

    if (t === 'text') {
      this.createText(x, y);
      return;
    }

    if (t === 'comment') {
      this.createComment(x, y);
      return;
    }

    if (t === 'image' || t === 'signature' || t === 'stamp') {
      const pending = this.state.pendingMedia();
      if (pending) {
        this.placeMedia(pending, x, y);
        this.state.setPendingMedia(null);
        this.state.setTool('select');
      }
      return;
    }

    if (t === 'eraser') {
      this.erasing = true;
      this.eraseAt(x, y);
      this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (this.resizing) {
      this.resizeTo(event);
      return;
    }

    if (this.dragId) {
      const a = this.annotations().find((it) => it.id === this.dragId);
      if (!a) {
        return;
      }
      const { x, y } = this.localPoint(event);
      this.state.updateAnnotation(a.id, {
        rect: { ...a.rect, x: x - this.dragOffset.x, y: y - this.dragOffset.y },
      });
      return;
    }

    if (this.erasing) {
      const { x, y } = this.localPoint(event);
      this.eraseAt(x, y);
      return;
    }

    const d = this.draft();
    if (!d) {
      return;
    }

    const { x, y } = this.localPoint(event);
    if (d.kind === 'pen' || d.kind === 'freehand') {
      this.draft.set({ kind: d.kind, points: [...d.points, { x, y }] });
      return;
    }

    if (this.start) {
      const shape = d as DraftShape;
      this.draft.set({
        ...shape,
        x: Math.min(this.start.x, x),
        y: Math.min(this.start.y, y),
        width: Math.abs(x - this.start.x),
        height: Math.abs(y - this.start.y),
      });
    }
  }

  onPointerUp(event: PointerEvent): void {
    this.svgRef()?.nativeElement.releasePointerCapture?.(event.pointerId);
    if (this.resizing) {
      this.resizing = null;
      return;
    }
    if (this.dragId) {
      this.dragId = null;
      return;
    }
    if (this.erasing) {
      this.erasing = false;
      return;
    }
    const d = this.draft();
    if (!d) {
      return;
    }
    this.draft.set(null);
    this.start = null;
    if (d.kind === 'pen' || d.kind === 'freehand') {
      if (d.points.length > 1) {
        this.commitDrawing(d);
      }
      return;
    }
    const shape = d as DraftShape;
    if (shape.width < 3 && shape.height < 3) {
      return;
    }
    if (
      shape.kind === 'rectangle' ||
      shape.kind === 'circle' ||
      shape.kind === 'arrow' ||
      shape.kind === 'line'
    ) {
      this.commitShape(shape);
    } else {
      this.commitHighlight(shape);
    }
  }

  private eraseAt(x: number, y: number): void {
    const hit = this.hitTest(x, y);
    if (hit) {
      this.state.removeAnnotation(hit.id);
    }
  }

  onHandleDown(event: PointerEvent, handle: HandleId, a: PdfAnnotation): void {
    event.stopPropagation();
    const p = this.localPoint(event);
    this.resizing = {
      id: a.id,
      handle,
      start: a,
      startRect: { ...a.rect },
      startX: p.x,
      startY: p.y,
      rotation: a.rotation,
    };
    this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
  }

  private resizeTo(event: PointerEvent): void {
    const r = this.resizing;
    if (!r) {
      return;
    }
    const p = this.localPoint(event);
    let dx = p.x - r.startX;
    let dy = p.y - r.startY;
    if (r.rotation) {
      const rad = (-r.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      dx = lx;
      dy = ly;
    }
    const MIN = 8;
    const hasW = r.handle.includes('w');
    const hasE = r.handle.includes('e');
    const hasN = r.handle.includes('n');
    const hasS = r.handle.includes('s');
    let { x, y, width, height } = r.startRect;
    if (hasW) {
      width = r.startRect.width - dx;
      x = r.startRect.x + dx;
    }
    if (hasE) {
      width = r.startRect.width + dx;
    }
    if (hasN) {
      height = r.startRect.height - dy;
      y = r.startRect.y + dy;
    }
    if (hasS) {
      height = r.startRect.height + dy;
    }
    if (width < MIN) {
      if (hasW) {
        x = r.startRect.x + r.startRect.width - MIN;
      }
      width = MIN;
    }
    if (height < MIN) {
      if (hasN) {
        y = r.startRect.y + r.startRect.height - MIN;
      }
      height = MIN;
    }
    const patch: Partial<PdfAnnotation> = { rect: { x, y, width, height } };
    if (r.start.type === 'text' && r.startRect.height > 0) {
      const scale = height / r.startRect.height;
      const fontSize = Math.max(6, Math.round(r.start.fontSize * scale));
      (patch as Partial<TextAnnotation>).fontSize = fontSize;
    }
    this.state.updateAnnotation(r.id, patch);
  }

  private createText(x: number, y: number): void {
    const ann: TextAnnotation = {
      id: crypto.randomUUID(),
      type: 'text',
      pageIndex: this.pageIndex(),
      rect: { x, y, width: 180, height: 40 },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      text: 'Text',
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 400,
      italic: false,
      underline: false,
      align: 'left',
      color: '#111111',
    };
    this.state.addAnnotation(this.pageId(), ann);
  }

  private createComment(x: number, y: number): void {
    const ann: CommentAnnotation = {
      id: crypto.randomUUID(),
      type: 'comment',
      pageIndex: this.pageIndex(),
      rect: { x: x - 9, y: y - 9, width: 18, height: 18 },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      text: 'New comment',
      author: 'You',
    };
    this.state.addAnnotation(this.pageId(), ann);
  }

  private commitShape(d: DraftShape): void {
    const kind =
      d.kind === 'circle'
        ? 'circle'
        : d.kind === 'arrow'
          ? 'arrow'
          : d.kind === 'line'
            ? 'line'
            : 'rectangle';
    const ann: ShapeAnnotation = {
      id: crypto.randomUUID(),
      type: 'shape',
      kind,
      pageIndex: this.pageIndex(),
      rect: { x: d.x, y: d.y, width: d.width, height: d.height },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      strokeColor: '#2563eb',
      fillColor: kind === 'line' || kind === 'arrow' ? 'transparent' : 'rgba(37,99,235,0.12)',
      strokeWidth: 2,
    };
    this.state.addAnnotation(this.pageId(), ann);
  }

  private commitHighlight(d: DraftShape): void {
    const type = d.kind as 'highlight' | 'underline' | 'strikethrough';
    const color =
      type === 'highlight' ? '#ffe066' : type === 'underline' ? '#2563eb' : '#ef4444';
    const ann: HighlightAnnotation = {
      id: crypto.randomUUID(),
      type,
      pageIndex: this.pageIndex(),
      rect: { x: d.x, y: d.y, width: d.width, height: d.height },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      color,
      quote: '',
    };
    this.state.addAnnotation(this.pageId(), ann);
  }

  private commitDrawing(d: DraftDrawing): void {
    const points = d.points;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const ann: DrawingAnnotation = {
      id: crypto.randomUUID(),
      type: 'drawing',
      kind: d.kind,
      pageIndex: this.pageIndex(),
      rect: {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
      },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      color: '#111111',
      strokeWidth: 2,
      points,
    };
    this.state.addAnnotation(this.pageId(), ann);
  }

  private placeMedia(p: PendingMedia, x: number, y: number): void {
    const pageId = this.pageId();
    const pageIndex = this.pageIndex();
    if (p.kind === 'stamp') {
      const width = 170;
      const height = 64;
      const ann: StampAnnotation = {
        id: crypto.randomUUID(),
        type: 'stamp',
        pageIndex,
        rect: { x: x - width / 2, y: y - height / 2, width, height },
        rotation: 0,
        opacity: 1,
        createdAt: Date.now(),
        text: p.text ?? 'APPROVED',
        color: p.color ?? '#dc2626',
      };
      this.state.addAnnotation(pageId, ann);
      return;
    }
    const natW = p.naturalWidth ?? 220;
    const natH = p.naturalHeight ?? 140;
    const maxW = 240;
    const scale = natW > maxW ? maxW / natW : 1;
    const width = Math.max(20, natW * scale);
    const height = Math.max(20, natH * scale);
    const base = {
      id: crypto.randomUUID(),
      pageIndex,
      rect: { x: x - width / 2, y: y - height / 2, width, height },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
    };
    if (p.kind === 'image') {
      const ann: ImageAnnotation = {
        ...base,
        type: 'image',
        dataUrl: p.dataUrl ?? '',
        naturalWidth: natW,
        naturalHeight: natH,
      };
      this.state.addAnnotation(pageId, ann);
    } else {
      const ann: SignatureAnnotation = {
        ...base,
        type: 'signature',
        dataUrl: p.dataUrl ?? '',
        naturalWidth: natW,
        naturalHeight: natH,
      };
      this.state.addAnnotation(pageId, ann);
    }
  }

  rotateTransform(a: PdfAnnotation): string {
    if (!a.rotation) {
      return '';
    }
    const cx = a.rect.x + a.rect.width / 2;
    const cy = a.rect.y + a.rect.height / 2;
    return `rotate(${a.rotation} ${cx} ${cy})`;
  }
}
