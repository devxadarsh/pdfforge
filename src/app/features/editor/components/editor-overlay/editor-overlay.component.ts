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
} from '../../../../core/models/pdf.models';
import { EditorStateService } from '../../state/editor-state.service';

interface DraftShape {
  kind: 'rectangle' | 'circle' | 'arrow';
  x: number;
  y: number;
  width: number;
  height: number;
}

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
          } @else if (a.kind === 'arrow') {
            <line
              [attr.x1]="a.rect.x"
              [attr.y1]="a.rect.y"
              [attr.x2]="a.rect.x + a.rect.width"
              [attr.y2]="a.rect.y + a.rect.height"
              [attr.stroke]="a.strokeColor"
              [attr.stroke-width]="a.strokeWidth"
              [attr.opacity]="a.opacity"
              [attr.marker-end]="'url(#ah-' + a.id + ')'"
            />
          }
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
        }

        @if (a.id === selectedId()) {
          <rect
            class="sel"
            [attr.x]="a.rect.x - 3"
            [attr.y]="a.rect.y - 3"
            [attr.width]="a.rect.width + 6"
            [attr.height]="a.rect.height + 6"
          />
        }
      }

      @if (draft(); as d) {
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
        } @else if (d.kind === 'arrow') {
          <line
            class="draft"
            [attr.x1]="d.x"
            [attr.y1]="d.y"
            [attr.x2]="d.x + d.width"
            [attr.y2]="d.y + d.height"
          />
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
      .draft {
        fill: rgba(37, 99, 235, 0.12);
        stroke: #2563eb;
        stroke-width: 2;
        stroke-dasharray: 5 4;
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

  readonly draft = signal<DraftShape | null>(null);
  private start: { x: number; y: number } | null = null;
  private dragId: string | null = null;
  private dragOffset = { x: 0, y: 0 };

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

    if (t === 'rectangle' || t === 'circle' || t === 'arrow') {
      this.start = { x, y };
      this.draft.set({ kind: t, x, y, width: 0, height: 0 });
      this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
    } else if (t === 'text') {
      this.createText(x, y);
    }
  }

  onPointerMove(event: PointerEvent): void {
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
    this.svgRef()?.nativeElement.releasePointerCapture?.(event.pointerId);
    if (this.dragId) {
      this.dragId = null;
      return;
    }
    if (this.draft()) {
      const d = this.draft()!;
      this.draft.set(null);
      this.start = null;
      if (d.width < 3 && d.height < 3) {
        return;
      }
      this.commitShape(d);
    }
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

  private commitShape(d: DraftShape): void {
    const ann: ShapeAnnotation = {
      id: crypto.randomUUID(),
      type: 'shape',
      kind: d.kind,
      pageIndex: this.pageIndex(),
      rect: { x: d.x, y: d.y, width: d.width, height: d.height },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      strokeColor: '#2563eb',
      fillColor: d.kind === 'arrow' ? 'transparent' : 'rgba(37,99,235,0.12)',
      strokeWidth: 2,
    };
    this.state.addAnnotation(this.pageId(), ann);
  }
}
