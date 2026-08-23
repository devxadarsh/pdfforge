import {
  Component,
  signal,
  computed,
  inject,
  input,
  effect,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RawTextItem } from '../../../../core/models/pdf.models';
import { PdfViewerService } from '../../../../core/services/pdf/pdf-viewer.service';
import { EditorStateService } from '../../state/editor-state.service';

interface DisplayTextItem {
  readonly id: string;
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  readonly editing: boolean;
  readonly edited: boolean;
  readonly removed: boolean;
}

function project(
  x: number,
  y: number,
  m: readonly number[],
): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

@Component({
  selector: 'app-editor-text-layer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="text-layer"
      [class.text-layer--active]="enabled()"
      [style.pointerEvents]="enabled() ? 'auto' : 'none'"
    >
      @if (enabled() && loading()) {
        <div class="text-layer__loading">
          <i class="fa-solid fa-spinner fa-spin"></i>
        </div>
      }
      @for (item of displayItems(); track item.id) {
        <div
          class="text-item"
          [class.text-item--editing]="item.editing"
          [class.text-item--edited]="item.edited"
          [class.text-item--removed]="item.removed"
          [attr.data-id]="item.id"
          [style.left.px]="item.left"
          [style.top.px]="item.top"
          [style.fontSize.px]="item.fontSize"
          [style.minWidth.px]="Math.max(4, item.width)"
          [style.minHeight.px]="item.fontSize"
          [attr.contenteditable]="enabled() && item.editing ? 'true' : 'false'"
          spellcheck="false"
          (click)="startEdit(item.id)"
          (input)="onEdit(item.id, $any($event.target).textContent ?? '')"
          (blur)="stopEdit(item.id)"
        >
          {{ item.text }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .text-layer {
        position: absolute;
        inset: 0;
        z-index: 5;
      }
      .text-layer__loading {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: #2563eb;
        font-size: 20px;
        pointer-events: none;
      }
      .text-item {
        position: absolute;
        box-sizing: border-box;
        color: transparent;
        cursor: text;
        white-space: pre;
        line-height: 1;
        outline: none;
        border: 1px solid transparent;
        background: transparent;
      }
      .text-layer--active .text-item {
        cursor: text;
      }
      .text-layer--active .text-item:hover {
        background: rgba(37, 99, 235, 0.12);
      }
      .text-item--editing {
        color: #111111;
        background: #ffffff;
        border-color: #2563eb;
      }
      .text-item--edited {
        color: #0b5ed7;
        background: #ffffff;
        border-color: rgba(11, 94, 215, 0.45);
      }
      .text-item--removed {
        background: #ffffff;
        border-color: rgba(239, 68, 68, 0.6);
        color: transparent;
        text-decoration: line-through;
      }
    `,
  ],
})
export class EditorTextLayerComponent {
  private readonly viewer = inject(PdfViewerService);
  private readonly state = inject(EditorStateService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly pageIndex = input.required<number>();
  readonly scale = input.required<number>();
  readonly rotation = input(0);
  readonly enabled = input(false);

  readonly loading = signal(false);
  private readonly rawItems = signal<RawTextItem[]>([]);
  private readonly transform = signal<number[] | null>(null);
  private readonly editingId = signal<string | null>(null);

  protected readonly Math = Math;

  readonly displayItems = computed<DisplayTextItem[]>(() => {
    const t = this.transform();
    const raw = this.rawItems();
    if (!t) {
      return [];
    }
    const deviceScale = Math.hypot(t[0], t[1]);
    const overrides = this.state.textOverrides().get(this.pageIndex()) ?? new Map();
    const editing = this.editingId();
    return raw.map((it) => {
      const override = overrides.get(it.id);
      const text = override ?? it.str;
      const edited = override !== undefined;
      const removed = edited && override === '';
      // Position the overlay at the text baseline origin (where the canvas
      // draws the glyphs) projected to device pixels, then shift up by the
      // device font size so the em box top aligns with the glyph box top.
      const origin = project(it.baseline.x, it.baseline.y, t);
      const fontSizeDev = Math.max(1, it.fontSize * deviceScale);
      const widthDev = Math.max(1, it.width * deviceScale);
      return {
        id: it.id,
        text,
        left: origin.x,
        top: origin.y - fontSizeDev,
        width: widthDev,
        height: fontSizeDev,
        fontSize: fontSizeDev,
        editing: editing === it.id,
        edited,
        removed,
      };
    });
  });

  constructor() {
    effect(
      () => {
        const enabled = this.enabled();
        const pageIndex = this.pageIndex();
        const scale = this.scale();
        const rotation = this.rotation();
        this.rawItems.set([]);
        this.transform.set(null);
        this.editingId.set(null);
        if (!enabled) {
          return;
        }
        void this.load(pageIndex, scale, rotation);
      },
      { allowSignalWrites: true },
    );
  }

  private async load(
    pageIndex: number,
    scale: number,
    rotation: number,
  ): Promise<void> {
    this.loading.set(true);
    try {
      const [raw, transform] = await Promise.all([
        this.viewer.getPageRawTextItems(pageIndex),
        this.viewer.getViewportTransform(pageIndex, scale, rotation),
      ]);
      this.rawItems.set(raw);
      this.transform.set(transform);
    } catch {
      this.rawItems.set([]);
      this.transform.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  startEdit(id: string): void {
    this.editingId.set(id);
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector(
        `[data-id="${CSS.escape(id)}"]`,
      ) as HTMLElement | null;
      if (!el) {
        return;
      }
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }, 0);
  }

  stopEdit(id: string): void {
    if (this.editingId() === id) {
      this.editingId.set(null);
    }
  }

  onEdit(id: string, text: string): void {
    const raw = this.rawItems().find((r) => r.id === id);
    if (raw && text === raw.str) {
      this.state.clearTextOverride(this.pageIndex(), id);
    } else {
      this.state.setTextOverride(this.pageIndex(), id, text);
    }
  }
}
