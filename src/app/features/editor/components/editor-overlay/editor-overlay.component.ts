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
} from '../../../../core/models/pdf.models';
import { EditorStateService } from '../../state/editor-state.service';

type MarkType =
  | 'rectangle'
  | 'circle'
  | 'arrow'
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

@Component({
  selector: 'app-editor-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-overlay.component.html',
  styleUrl: './editor-overlay.component.scss',
})
export class EditorOverlayComponent {
  private readonly state = inject(EditorStateService);
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

  /** Text annotation currently being edited inline. */
  readonly editingId = signal<string | null>(null);
  readonly editingText = computed(() => {
    const id = this.editingId();
    const a = this.annotations().find((it) => it.id === id);
    return a && a.type === 'text' ? a : null;
  });

  readonly draft = signal<DraftMark | null>(null);
  private start: { x: number; y: number } | null = null;
  private dragId: string | null = null;
  private dragOffset = { x: 0, y: 0 };
  private resizeId: string | null = null;
  private resizeHandle: Handle | null = null;
  private resizeStart: {
    x: number;
    y: number;
    rect: { x: number; y: number; width: number; height: number };
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

    if (this.editingId()) {
      this.stopEditing();
    }

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
      t === 'strikethrough'
    ) {
      this.start = { x, y };
      this.draft.set({ type: t, x, y, width: 0, height: 0 });
      this.svgRef()?.nativeElement.setPointerCapture?.(event.pointerId);
    } else if (t === 'text') {
      this.createText(x, y);
    } else if (t === 'comment') {
      this.createComment(x, y);
    }
  }

  onHandleDown(event: PointerEvent, handle: Handle): void {
    event.stopPropagation();
    const ann = this.annotations().find((it) => it.id === this.selectedId());
    if (!ann) {
      return;
    }
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

  onPointerMove(event: PointerEvent): void {
    if (this.resizeId && this.resizeHandle && this.resizeStart) {
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
      this.state.updateAnnotation(a.id, {
        rect: { x: rx, y: ry, width: rw, height: rh },
      });
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
    if (this.resizeId) {
      this.resizeId = null;
      this.resizeHandle = null;
      this.resizeStart = null;
      return;
    }
    if (this.dragId) {
      this.dragId = null;
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
    if (hit && hit.type === 'text') {
      const caret = this.caretIndexFromX(hit.text, x, hit);
      this.startEditing(hit, caret);
    }
  }

  private startEditing(
    a: TextAnnotation,
    caret: number,
    selectAll = false,
  ): void {
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
        const pos = Math.max(0, Math.min(caret, a.text.length));
        el.setSelectionRange(pos, pos);
      }
    });
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
    );
    this.state.updateAnnotation(id, {
      text,
      rect: { ...cur.rect, width: m.width, height: m.height },
    });
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
      const w = ctx.measureText(text[i]).width;
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
  ): { width: number; height: number } {
    const lines = text.split('\n');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
      let maxW = 0;
      for (const line of lines) {
        const w = ctx.measureText(line || ' ').width;
        if (w > maxW) {
          maxW = w;
        }
      }
      return {
        width: Math.max(20, Math.ceil(maxW) + TEXT_PAD_X * 2),
        height: Math.ceil(
          lines.length * fontSize * TEXT_LINE_HEIGHT + TEXT_PAD_Y * 2,
        ),
      };
    }
    const approx = Math.max(...lines.map((l) => l.length)) * fontSize * 0.6;
    return {
      width: Math.max(20, Math.ceil(approx) + TEXT_PAD_X * 2),
      height: Math.ceil(
        lines.length * fontSize * TEXT_LINE_HEIGHT + TEXT_PAD_Y * 2,
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

  /** Baseline Y for the line at `lineIndex` (0-based) within the box. */
  lineBaselineY(a: TextAnnotation, lineIndex: number): number {
    return (
      a.rect.y + TEXT_PAD_Y + a.fontSize + lineIndex * a.fontSize * TEXT_LINE_HEIGHT
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
  }

  private commitShape(d: DraftMark): void {
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
      fillColor: d.type === 'arrow' ? 'transparent' : 'rgba(37,99,235,0.12)',
      strokeWidth: 2,
    };
    this.state.addAnnotation(this.pageId(), ann);
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
  }
}
