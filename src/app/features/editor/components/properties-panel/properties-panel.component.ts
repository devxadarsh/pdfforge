import {
  Component,
  inject,
  input,
  computed,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';
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
} from '../../../../core/models/pdf.models';
import { EditorStateService } from '../../state/editor-state.service';
import { EditorPagesService } from '../../state/editor-pages.service';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="props">
      <header class="props__header">
        <span class="props__header-icon">
          <i class="fa-solid fa-sliders"></i>
        </span>
        <div class="props__header-text">
          <span class="props__eyebrow">Editor</span>
          <h2 class="props__heading">Properties</h2>
        </div>
      </header>

      @if (selected(); as ann) {
        <section class="props__card">
          <div class="props__card-head">
            <span class="props__badge"><i [ngClass]="iconOf(ann)"></i></span>
            <div class="props__card-titles">
              <span class="props__type">{{ titleOf(ann) }}</span>
              <span class="props__subtitle">Annotation</span>
            </div>
          </div>

          <div class="props__divider"></div>

          <div class="props__body">
            @if (ann.type === 'text') {
              <div class="field">
                <label class="field__label" [for]="'pf-text-' + ann.id">Text</label>
                <input
                  id="pf-text-{{ ann.id }}"
                  class="pf-input"
                  type="text"
                  [value]="ann.text"
                  (input)="setText(ann, $any($event.target).value)"
                />
              </div>
              <div class="field field--row">
                <div class="field__col">
                  <label class="field__label" [for]="'pf-size-' + ann.id">Font size</label>
                  <input
                    id="pf-size-{{ ann.id }}"
                    class="pf-input"
                    type="number"
                    min="8"
                    max="120"
                    [value]="ann.fontSize"
                    (input)="setFontSize(ann, $any($event.target).value)"
                  />
                </div>
                <div class="field__col field__col--color">
                  <span class="field__label">Color</span>
                  <div class="color-control">
                    <span class="swatch" [style.background]="ann.color"></span>
                    <input
                      class="pf-color"
                      type="color"
                      [value]="ann.color"
                      (input)="setColor(ann, $any($event.target).value)"
                      aria-label="Text color"
                    />
                  </div>
                </div>
              </div>
            }

            @if (ann.type === 'shape') {
              <div class="field field--row">
                <div class="field__col field__col--color">
                  <span class="field__label">Stroke</span>
                  <div class="color-control">
                    <span class="swatch" [style.background]="ann.strokeColor"></span>
                    <input
                      class="pf-color"
                      type="color"
                      [value]="ann.strokeColor"
                      (input)="setStroke(ann, $any($event.target).value)"
                      aria-label="Stroke color"
                    />
                  </div>
                </div>
                @if (ann.kind !== 'arrow' && ann.kind !== 'line') {
                  <div class="field__col field__col--color">
                    <span class="field__label">Fill</span>
                    <div class="color-control">
                      <span class="swatch" [style.background]="toColor(ann.fillColor)"></span>
                      <input
                        class="pf-color"
                        type="color"
                        [value]="toColor(ann.fillColor)"
                        (input)="setFill(ann, $any($event.target).value)"
                        aria-label="Fill color"
                      />
                    </div>
                  </div>
                }
              </div>
              <div class="field">
                <label class="field__label" [for]="'pf-sw-' + ann.id">
                  Stroke width <span class="field__value">{{ ann.strokeWidth }} px</span>
                </label>
                <input
                  id="pf-sw-{{ ann.id }}"
                  class="pf-range"
                  type="range"
                  min="1"
                  max="24"
                  [value]="ann.strokeWidth"
                  (input)="setStrokeWidth(ann, $any($event.target).value)"
                />
              </div>
            }

            @if (ann.type === 'drawing') {
              <div class="field field--row">
                <div class="field__col field__col--color">
                  <span class="field__label">Ink color</span>
                  <div class="color-control">
                    <span class="swatch" [style.background]="ann.color"></span>
                    <input
                      class="pf-color"
                      type="color"
                      [value]="ann.color"
                      (input)="setDrawColor(ann, $any($event.target).value)"
                      aria-label="Ink color"
                    />
                  </div>
                </div>
              </div>
            }

            @if (
              ann.type === 'highlight' ||
              ann.type === 'underline' ||
              ann.type === 'strikethrough'
            ) {
              <div class="field field--row">
                <div class="field__col field__col--color">
                  <span class="field__label">Color</span>
                  <div class="color-control">
                    <span class="swatch" [style.background]="ann.color"></span>
                    <input
                      class="pf-color"
                      type="color"
                      [value]="ann.color"
                      (input)="setHighlightColor(ann, $any($event.target).value)"
                      aria-label="Highlight color"
                    />
                  </div>
                </div>
              </div>
            }

            @if (ann.type === 'comment') {
              <div class="field">
                <label class="field__label" [for]="'pf-cmt-' + ann.id">Comment</label>
                <textarea
                  id="pf-cmt-{{ ann.id }}"
                  class="pf-input pf-textarea"
                  rows="3"
                  [value]="ann.text"
                  (input)="setCommentText(ann, $any($event.target).value)"
                ></textarea>
              </div>
            }

            @if (ann.type === 'stamp') {
              <div class="field">
                <label class="field__label" [for]="'pf-stamp-' + ann.id">Text</label>
                <input
                  id="pf-stamp-{{ ann.id }}"
                  class="pf-input"
                  type="text"
                  [value]="ann.text"
                  (input)="setStampText(ann, $any($event.target).value)"
                />
              </div>
              <div class="field field--row">
                <div class="field__col field__col--color">
                  <span class="field__label">Color</span>
                  <div class="color-control">
                    <span class="swatch" [style.background]="ann.color"></span>
                    <input
                      class="pf-color"
                      type="color"
                      [value]="ann.color"
                      (input)="setStampColor(ann, $any($event.target).value)"
                      aria-label="Stamp color"
                    />
                  </div>
                </div>
              </div>
            }

            @if (
              ann.type === 'image' ||
              ann.type === 'signature' ||
              ann.type === 'stamp'
            ) {
              <div class="field">
                <label class="field__label" [for]="'pf-rot-' + ann.id">
                  Rotation <span class="field__value">{{ ann.rotation }}°</span>
                </label>
                <input
                  id="pf-rot-{{ ann.id }}"
                  class="pf-range"
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  [value]="ann.rotation"
                  (input)="setRotation(ann, $any($event.target).value)"
                />
              </div>
            }

            <div class="field">
              <label class="field__label" [for]="'pf-op-' + ann.id">
                Opacity <span class="field__value">{{ round(ann.opacity * 100) }}%</span>
              </label>
              <input
                id="pf-op-{{ ann.id }}"
                class="pf-range"
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                [value]="ann.opacity"
                (input)="setOpacity(ann, $any($event.target).value)"
              />
            </div>
          </div>

          <button
            type="button"
            class="pf-btn pf-btn--danger pf-btn--block props__delete"
            (click)="delete(ann)"
          >
            <i class="fa-solid fa-trash"></i> Delete annotation
          </button>
        </section>
      } @else {
        <section class="props__card props__card--empty">
          <div class="props__empty-icon">
            <i class="fa-regular fa-object-group"></i>
          </div>
          <p class="props__empty-title">Nothing selected</p>
          <p class="props__empty-text">
            Pick an object on the page to edit its style and position.
          </p>
          @if (docName()) {
            <dl class="props__meta">
              <div class="props__meta-row">
                <dt>Document</dt>
                <dd>{{ docName() }}</dd>
              </div>
              <div class="props__meta-row">
                <dt>Pages</dt>
                <dd>{{ pageCount() }}</dd>
              </div>
              <div class="props__meta-row">
                <dt>Active tool</dt>
                <dd>{{ toolLabel() }}</dd>
              </div>
            </dl>
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .props {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 4px;
      }

      /* Header */
      .props__header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 8px 0;
      }
      .props__header-icon {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        flex: 0 0 auto;
        border-radius: var(--pf-radius-md);
        background: var(--pf-primary-container);
        color: var(--pf-on-primary-container);
        font-size: 15px;
      }
      .props__header-text {
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }
      .props__eyebrow {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--pf-on-surface-variant);
      }
      .props__heading {
        font-size: 17px;
        font-weight: 700;
        color: var(--pf-on-surface);
      }

      /* Card */
      .props__card {
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: var(--pf-surface-container-lowest);
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius-lg);
        box-shadow: var(--pf-shadow-1);
        padding: 16px;
      }
      .props__card-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .props__badge {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        flex: 0 0 auto;
        border-radius: var(--pf-radius-md);
        background: var(--pf-surface-container-low);
        color: var(--pf-primary);
        font-size: 17px;
        border: 1px solid var(--pf-outline-variant);
      }
      .props__card-titles {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .props__type {
        font-size: 15px;
        font-weight: 700;
        color: var(--pf-on-surface);
      }
      .props__subtitle {
        font-size: 12px;
        color: var(--pf-on-surface-variant);
      }
      .props__divider {
        height: 1px;
        background: var(--pf-outline-variant);
        border: 0;
        margin: 0;
      }
      .props__body {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      /* Fields */
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field--row {
        flex-direction: row;
        gap: 12px;
      }
      .field__label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--pf-on-surface-variant);
      }
      .field__value {
        font-family: var(--pf-font-mono);
        font-size: 11px;
        font-weight: 600;
        color: var(--pf-primary);
        background: var(--pf-surface-container-low);
        padding: 1px 7px;
        border-radius: var(--pf-radius-full);
      }

      .field__col {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1 1 0;
        min-width: 0;
      }
      .field__col--color {
        flex: 0 0 auto;
      }
      .color-control {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .color-control .pf-color {
        flex: 1 1 auto;
      }
      .swatch {
        width: 22px;
        height: 22px;
        flex: 0 0 auto;
        border-radius: var(--pf-radius-sm);
        border: 1px solid var(--pf-outline-variant);
        box-shadow: inset 0 0 0 2px var(--pf-surface-container-lowest);
      }

      /* Inputs */
      .pf-input {
        width: 100%;
        height: 36px;
        padding: 0 12px;
        font-size: 13px;
        font-family: var(--pf-font-base);
        color: var(--pf-on-surface);
        background: var(--pf-surface-container-lowest);
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .pf-input:focus {
        outline: none;
        border-color: var(--pf-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-primary) 18%, transparent);
      }
      .pf-textarea {
        height: auto;
        padding: 8px 12px;
        resize: vertical;
        line-height: 1.4;
      }

      .pf-color {
        width: 100%;
        height: 36px;
        padding: 3px;
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius);
        background: var(--pf-surface-container-lowest);
        cursor: pointer;
      }
      .pf-color::-webkit-color-swatch-wrapper {
        padding: 0;
      }
      .pf-color::-webkit-color-swatch {
        border: none;
        border-radius: calc(var(--pf-radius) - 2px);
      }
      .pf-color::-moz-color-swatch {
        border: none;
        border-radius: calc(var(--pf-radius) - 2px);
      }

      .pf-range {
        width: 100%;
        height: 22px;
        accent-color: var(--pf-primary);
        cursor: pointer;
      }

      .pf-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-radius: var(--pf-radius);
        font-size: 13px;
        font-weight: 600;
        border: 1px solid transparent;
        cursor: pointer;
        text-decoration: none;
        white-space: nowrap;
        transition: background-color 0.15s ease, filter 0.15s ease;
      }
      .pf-btn--danger {
        background-color: var(--pf-error);
        color: var(--pf-on-error);
      }
      .pf-btn--danger:hover:not(:disabled) {
        filter: brightness(0.94);
      }
      .pf-btn--block {
        width: 100%;
        justify-content: center;
      }

      /* Delete */
      .props__delete {
        margin-top: 2px;
      }

      /* Empty state */
      .props__card--empty {
        align-items: center;
        text-align: center;
        gap: 8px;
        padding: 28px 18px;
      }
      .props__empty-icon {
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--pf-surface-container-low);
        color: var(--pf-on-surface-variant);
        font-size: 22px;
        margin-bottom: 4px;
      }
      .props__empty-title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: var(--pf-on-surface);
      }
      .props__empty-text {
        margin: 0;
        font-size: 12px;
        color: var(--pf-on-surface-variant);
        max-width: 26ch;
      }
      .props__meta {
        width: 100%;
        margin: 8px 0 0;
        display: flex;
        flex-direction: column;
        border-top: 1px solid var(--pf-outline-variant);
        padding-top: 10px;
      }
      .props__meta-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 6px 0;
        font-size: 12px;
      }
      .props__meta-row dt {
        color: var(--pf-on-surface-variant);
      }
      .props__meta-row dd {
        margin: 0;
        font-weight: 600;
        color: var(--pf-on-surface);
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 60%;
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

  round(value: number): number {
    return Math.round(value);
  }

  iconOf(ann: PdfAnnotation): string {
    switch (ann.type) {
      case 'text':
        return 'fa-solid fa-font';
      case 'shape':
        return ann.kind === 'circle'
          ? 'fa-solid fa-circle'
          : ann.kind === 'arrow'
            ? 'fa-solid fa-arrow-up-right'
            : ann.kind === 'line'
              ? 'fa-solid fa-minus'
              : 'fa-solid fa-square';
      case 'highlight':
        return 'fa-solid fa-highlighter';
      case 'underline':
        return 'fa-solid fa-underline';
      case 'strikethrough':
        return 'fa-solid fa-strikethrough';
      case 'drawing':
        return ann.kind === 'pen' ? 'fa-solid fa-pen' : 'fa-solid fa-pen-fancy';
      case 'image':
        return 'fa-solid fa-image';
      case 'signature':
        return 'fa-solid fa-signature';
      case 'stamp':
        return 'fa-solid fa-stamp';
      case 'comment':
        return 'fa-solid fa-comment';
      default:
        return 'fa-solid fa-circle';
    }
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
    if (ann.type === 'drawing') {
      return ann.kind === 'pen' ? 'Pen' : 'Freehand';
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

  setStroke(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      strokeColor: value,
    } as Partial<ShapeAnnotation>);
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

  setHighlightColor(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      color: value,
    } as Partial<HighlightAnnotation>);
  }

  setCommentText(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      text: value,
    } as Partial<CommentAnnotation>);
  }

  setDrawColor(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      color: value,
    } as Partial<DrawingAnnotation>);
  }

  setStampText(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      text: value,
    } as Partial<StampAnnotation>);
  }

  setStampColor(ann: PdfAnnotation, value: string): void {
    this.state.updateAnnotation(ann.id, {
      color: value,
    } as Partial<StampAnnotation>);
  }

  setRotation(ann: PdfAnnotation, value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      this.state.updateAnnotation(ann.id, { rotation: n });
    }
  }

  delete(ann: PdfAnnotation): void {
    this.state.removeAnnotation(ann.id);
  }
}
