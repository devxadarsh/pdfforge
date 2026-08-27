import {
  Component,
  inject,
  input,
  computed,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  PdfAnnotation,
  ShapeAnnotation,
  TextAnnotation,
  HighlightAnnotation,
  CommentAnnotation,
} from '../../../../core/models/pdf.models';
import { PanelSectionComponent } from '../../../../shared/components/panel/panel-section.component';
import { EditorStateService } from '../../state/editor-state.service';
import { EditorPagesService } from '../../state/editor-pages.service';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelSectionComponent],
  template: `
    <div class="props">
      <header class="props__head">
        <span class="props__icon"><i class="fa-solid fa-sliders"></i></span>
        <span class="props__title">Properties</span>
        <span class="props__tool-badge" [title]="toolLabel() + ' tool active'">
          <i [class]="toolIcon()"></i>{{ toolLabel() }}
        </span>
      </header>

      @if (selected(); as ann) {
        <app-panel-section [title]="titleOf(ann)" [icon]="iconOf(ann)">
          <button
            type="button"
            class="props__delete"
            (click)="delete(ann)"
            title="Delete annotation"
            aria-label="Delete annotation"
            psec-actions
          >
            <i class="fa-solid fa-trash"></i>
          </button>

          @if (ann.type === 'text') {
            <app-panel-section title="Content" icon="fa-solid fa-font" [bare]="true">
              <label class="props__field">
                <span>Text</span>
                <input
                  class="pf-input"
                  type="text"
                  [value]="ann.text"
                  (input)="setText(ann, $any($event.target).value)"
                />
              </label>
              <label class="props__field">
                <span>Font</span>
                <select
                  class="pf-input"
                  [value]="ann.fontFamily"
                  (change)="setFontFamily(ann, $any($event.target).value)"
                  aria-label="Font family"
                >
                  @for (opt of fontOptions; track opt.value) {
                    <option [value]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              </label>
              <label class="props__field">
                <span>Font size</span>
                <input
                  class="pf-input"
                  type="number"
                  min="8"
                  max="120"
                  [value]="ann.fontSize"
                  (input)="setFontSize(ann, $any($event.target).value)"
                />
              </label>
              <label class="props__field">
                <span>Color</span>
                <input
                  class="pf-color"
                  type="color"
                  [value]="ann.color"
                  (input)="setColor(ann, $any($event.target).value)"
                />
              </label>
            </app-panel-section>

            <app-panel-section title="Style" icon="fa-solid fa-text-height" [bare]="true">
              <div class="props__row">
                <button
                  type="button"
                  class="props__toggle"
                  [class.props__toggle--on]="ann.fontWeight >= 700"
                  (click)="toggleBold(ann)"
                  title="Bold"
                  aria-label="Bold"
                >
                  <i class="fa-solid fa-bold"></i>
                </button>
                <button
                  type="button"
                  class="props__toggle"
                  [class.props__toggle--on]="ann.italic"
                  (click)="toggleItalic(ann)"
                  title="Italic"
                  aria-label="Italic"
                >
                  <i class="fa-solid fa-italic"></i>
                </button>
                <button
                  type="button"
                  class="props__toggle"
                  [class.props__toggle--on]="ann.underline"
                  (click)="toggleUnderline(ann)"
                  title="Underline"
                  aria-label="Underline"
                >
                  <i class="fa-solid fa-underline"></i>
                </button>
              </div>
              <div class="props__row">
                <button
                  type="button"
                  class="props__toggle"
                  [class.props__toggle--on]="ann.align === 'left'"
                  (click)="setAlign(ann, 'left')"
                  title="Align left"
                  aria-label="Align left"
                >
                  <i class="fa-solid fa-align-left"></i>
                </button>
                <button
                  type="button"
                  class="props__toggle"
                  [class.props__toggle--on]="ann.align === 'center'"
                  (click)="setAlign(ann, 'center')"
                  title="Align center"
                  aria-label="Align center"
                >
                  <i class="fa-solid fa-align-center"></i>
                </button>
                <button
                  type="button"
                  class="props__toggle"
                  [class.props__toggle--on]="ann.align === 'right'"
                  (click)="setAlign(ann, 'right')"
                  title="Align right"
                  aria-label="Align right"
                >
                  <i class="fa-solid fa-align-right"></i>
                </button>
              </div>
            </app-panel-section>
          }

          @if (ann.type === 'shape') {
            <app-panel-section title="Stroke & fill" icon="fa-solid fa-palette" [bare]="true">
              <label class="props__field">
                <span>Stroke</span>
                <input
                  class="pf-color"
                  type="color"
                  [value]="ann.strokeColor"
                  (input)="setStroke(ann, $any($event.target).value)"
                />
              </label>
              @if (ann.kind !== 'arrow') {
                <label class="props__field">
                  <span>Fill</span>
                  <input
                    class="pf-color"
                    type="color"
                    [value]="toColor(ann.fillColor)"
                    (input)="setFill(ann, $any($event.target).value)"
                  />
                </label>
              }
              <label class="props__field">
                <span>Stroke width</span>
                <input
                  class="pf-input"
                  type="range"
                  min="1"
                  max="24"
                  [value]="ann.strokeWidth"
                  (input)="setStrokeWidth(ann, $any($event.target).value)"
                />
              </label>
            </app-panel-section>
          }

          @if (
            ann.type === 'highlight' ||
            ann.type === 'underline' ||
            ann.type === 'strikethrough'
          ) {
            <app-panel-section title="Appearance" icon="fa-solid fa-eye-dropper" [bare]="true">
              <label class="props__field">
                <span>Color</span>
                <input
                  class="pf-color"
                  type="color"
                  [value]="ann.color"
                  (input)="setHighlightColor(ann, $any($event.target).value)"
                />
              </label>
            </app-panel-section>
          }

          @if (ann.type === 'comment') {
            <app-panel-section title="Comment" icon="fa-solid fa-comment" [bare]="true">
              <label class="props__field">
                <span>Comment</span>
                <textarea
                  class="pf-input"
                  rows="3"
                  [value]="ann.text"
                  (input)="setComment(ann, $any($event.target).value)"
                ></textarea>
              </label>
              <label class="props__field">
                <span>Author</span>
                <input
                  class="pf-input"
                  type="text"
                  [value]="ann.author"
                  (input)="setAuthor(ann, $any($event.target).value)"
                />
              </label>
            </app-panel-section>
          }

          <app-panel-section title="Layer" icon="fa-solid fa-layer-group" [bare]="true">
            <label class="props__field">
              <span>Opacity</span>
              <input
                class="pf-input"
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                [value]="ann.opacity"
                (input)="setOpacity(ann, $any($event.target).value)"
              />
            </label>
          </app-panel-section>
        </app-panel-section>
      } @else {
        <app-panel-section
          title="Getting started"
          icon="fa-solid fa-hand-pointer"
        >
          <p class="pf-text-muted props__empty-text">
            Select an object on the page to edit its properties, or pick a tool
            from the toolbar to add a new annotation.
          </p>
        </app-panel-section>
        @if (docName()) {
          <app-panel-section title="Document" icon="fa-solid fa-file-pdf">
            <dl class="props__meta">
              <div>
                <dt>Document</dt>
                <dd>{{ docName() }}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{{ pageCount() }}</dd>
              </div>
              <div>
                <dt>Active tool</dt>
                <dd><span class="props__tool-badge props__tool-badge--sm">{{ toolLabel() }}</span></dd>
              </div>
            </dl>
          </app-panel-section>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        flex: 1 1 auto;
        min-height: 0;
      }
      .props {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        overflow-y: auto;
        padding-right: 2px;
      }
      .props__head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 2px 0;
      }
      .props__icon {
        width: 26px;
        height: 26px;
        display: grid;
        place-items: center;
        border-radius: var(--pf-radius);
        background: var(--pf-primary-container);
        color: var(--pf-on-primary-container);
        font-size: 12px;
      }
      .props__title {
        font-size: 14px;
        font-weight: 700;
        color: var(--pf-on-surface);
      }
      .props__tool-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
        padding: 3px 10px;
        border-radius: 999px;
        background: var(--pf-primary);
        color: var(--pf-on-primary);
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
      }
      .props__tool-badge i {
        font-size: 11px;
      }
      .props__tool-badge--sm {
        margin-left: 0;
      }
      .props__field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: var(--pf-on-surface-variant);
      }
      .props__field .pf-input,
      .props__field .pf-color {
        width: 100%;
      }
      .pf-input {
        height: 30px;
        padding: 0 10px;
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius);
        background: var(--pf-surface-container-lowest);
        color: var(--pf-on-surface);
        font-size: 13px;
        font-family: inherit;
      }
      .props__field textarea.pf-input {
        height: auto;
        padding: 6px 10px;
        resize: vertical;
      }
      select.pf-input {
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        padding-right: 28px;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M3 4.5 6 8l3-3.5' fill='none' stroke='%236b7280' stroke-width='1.5'/></svg>");
        background-repeat: no-repeat;
        background-position: right 10px center;
      }
      .props__row {
        display: flex;
        gap: 4px;
      }
      .props__toggle {
        width: 30px;
        height: 28px;
        border: 1px solid var(--pf-outline-variant);
        background: var(--pf-surface-container);
        color: var(--pf-on-surface-variant);
        border-radius: var(--pf-radius);
        cursor: pointer;
        font-size: 12px;
        transition: background-color 0.15s ease, color 0.15s ease,
          border-color 0.15s ease;
      }
      .props__toggle--on {
        background: var(--pf-primary);
        color: var(--pf-on-primary);
        border-color: var(--pf-primary);
      }
      .pf-color {
        height: 30px;
        padding: 2px;
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius);
        background: var(--pf-surface-container-lowest);
      }
      .props__delete {
        display: inline-grid;
        place-items: center;
        width: 26px;
        height: 26px;
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius);
        background: var(--pf-surface-container-lowest);
        color: var(--pf-error);
        cursor: pointer;
        font-size: 12px;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .props__delete:hover {
        background: var(--pf-error-container);
        color: var(--pf-on-error-container);
        border-color: var(--pf-error-container);
      }
      .props__empty-text {
        margin: 0;
        font-size: 13px;
        line-height: 1.5;
      }
      .props__meta {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .props__meta div {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
      }
      .props__meta dt {
        color: var(--pf-on-surface-variant);
      }
      .props__meta dd {
        margin: 0;
        font-weight: 600;
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 60%;
      }
      .props__meta dd:has(.props__tool-badge) {
        max-width: none;
        overflow: visible;
        white-space: normal;
      }
    `,
  ],
})
export class PropertiesPanelComponent {
  private readonly state = inject(EditorStateService);
  readonly pages = inject(EditorPagesService);

  readonly docName = input<string | null>(null);

  readonly selected = computed(() =>
    this.state.getSelected(this.pages.currentId()),
  );
  readonly pageCount = this.pages.pagesCount;
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
    return 'fa-solid fa-pen';
  }

  titleOf(ann: PdfAnnotation): string {
    if (ann.type === 'text') {
      return 'Text';
    }
    if (ann.type === 'shape') {
      return ann.kind.charAt(0).toUpperCase() + ann.kind.slice(1);
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

  toColor(value: string): string {
    if (value.startsWith('#')) {
      return value;
    }
    return '#000000';
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

  delete(ann: PdfAnnotation): void {
    this.state.removeAnnotation(ann.id);
  }
}
