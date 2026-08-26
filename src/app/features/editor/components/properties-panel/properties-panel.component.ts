import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  PdfToolId,
  AnnotationStyleKind,
  AnnotationStyle,
  NgxAnnotationView,
  NgxAnnotationPatch,
  DEFAULT_ANNOTATION_STYLES,
} from '../../../../core/models/pdf.models';

const TOOL_TO_STYLE: Partial<Record<PdfToolId, AnnotationStyleKind>> = {
  text: 'text',
  highlight: 'highlight',
  underline: 'underline',
  strikethrough: 'strikethrough',
  pen: 'pen',
  freehand: 'freehand',
  rectangle: 'pen',
  circle: 'pen',
  line: 'pen',
  arrow: 'pen',
  comment: 'comment',
};

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
              <span class="props__subtitle">Page {{ ann.pageIndex + 1 }}</span>
            </div>
          </div>
          <div class="props__divider"></div>
          <div class="props__body">
            @if (ann.kind === 'text') {
              <div class="field">
                <label class="field__label" [for]="'ngx-text-' + ann.id">Text</label>
                <input id="ngx-text-{{ ann.id }}" class="pf-input" type="text"
                  [value]="ann.text" (input)="upd(ann, { text: $any($event.target).value })" />
              </div>
              <div class="field field--row">
                <div class="field__col">
                  <label class="field__label" [for]="'ngx-size-' + ann.id">Font size</label>
                  <input id="ngx-size-{{ ann.id }}" class="pf-input" type="number" min="8" max="120"
                    [value]="ann.fontSize" (input)="upd(ann, { fontSize: num($any($event.target).value) })" />
                </div>
                <div class="field__col field__col--color">
                  <span class="field__label">Color</span>
                  <div class="color-control">
                    <span class="swatch" [style.background]="ann.color"></span>
                    <input class="pf-color" type="color" [value]="ann.color"
                      (input)="upd(ann, { color: $any($event.target).value })" aria-label="Text color" />
                  </div>
                </div>
              </div>
            }

            @if (ann.kind === 'highlight' || ann.kind === 'ink' || ann.kind === 'underline' || ann.kind === 'strikethrough') {
              <div class="field field--row">
                <div class="field__col field__col--color">
                  <span class="field__label">Color</span>
                  <div class="color-control">
                    <span class="swatch" [style.background]="ann.color"></span>
                    <input class="pf-color" type="color" [value]="ann.color"
                      (input)="upd(ann, { color: $any($event.target).value })" aria-label="Color" />
                  </div>
                </div>
                <div class="field__col">
                  <label class="field__label" [for]="'ngx-sw-' + ann.id">
                    Thickness <span class="field__value">{{ ann.thickness }} px</span>
                  </label>
                  <input id="ngx-sw-{{ ann.id }}" class="pf-range" type="range" min="1" max="40"
                    [value]="ann.thickness" (input)="upd(ann, { thickness: num($any($event.target).value) })" />
                </div>
              </div>
            }

            @if (ann.kind === 'comment') {
              <div class="field">
                <label class="field__label" [for]="'ngx-cmt-' + ann.id">Comment</label>
                <textarea id="ngx-cmt-{{ ann.id }}" class="pf-input pf-textarea" rows="3"
                  [value]="ann.text" (input)="upd(ann, { text: $any($event.target).value })"></textarea>
              </div>
            }

            @if (ann.kind === 'stamp' || ann.kind === 'image') {
              <p class="props__note">
                <i class="fa-solid fa-circle-info"></i>
                Image and stamp annotations can be moved and resized on the page.
              </p>
            }

            @if (ann.kind !== 'stamp' && ann.kind !== 'image') {
              <div class="field">
                <label class="field__label" [for]="'ngx-op-' + ann.id">
                  Opacity <span class="field__value">{{ round(ann.opacity * 100) }}%</span>
                </label>
                <input id="ngx-op-{{ ann.id }}" class="pf-range" type="range" min="0.1" max="1" step="0.1"
                  [value]="ann.opacity" (input)="upd(ann, { opacity: num($any($event.target).value) })" />
              </div>
            }
          </div>

          <button type="button" class="pf-btn pf-btn--danger pf-btn--block props__delete"
            (click)="del(ann)">
            <i class="fa-solid fa-trash"></i> Delete annotation
          </button>
        </section>
      } @else if (showStyleEditor()) {
        <section class="props__card">
          <div class="props__card-head">
            <span class="props__badge"><i [ngClass]="iconOfKind(activeStyleKind()!)"></i></span>
            <div class="props__card-titles">
              <span class="props__type">{{ titleOfKind(activeStyleKind()!) }}</span>
              <span class="props__subtitle">Default style for new marks</span>
            </div>
          </div>
          <div class="props__divider"></div>
          <div class="props__body">
            @if (activeStyleKind() === 'text') {
              <div class="field">
                <label class="field__label" [for]="'st-font'">Font family</label>
                <select id="st-font" class="pf-input" [value]="style().fontFamily"
                  (change)="setStyle('fontFamily', $any($event.target).value)">
                  @for (f of fontOptions; track f.value) {
                    <option [value]="f.value">{{ f.label }}</option>
                  }
                </select>
              </div>
              <div class="field field--row">
                <div class="field__col">
                  <label class="field__label" [for]="'st-size'">Font size</label>
                  <input id="st-size" class="pf-input" type="number" min="8" max="120"
                    [value]="style().fontSize" (input)="setStyle('fontSize', num($any($event.target).value))" />
                </div>
                <div class="field__col field__col--color">
                  <span class="field__label">Color</span>
                  <div class="color-control">
                    <span class="swatch" [style.background]="style().color"></span>
                    <input class="pf-color" type="color" [value]="style().color"
                      (input)="setStyle('color', $any($event.target).value)" aria-label="Text color" />
                  </div>
                </div>
              </div>
              <div class="field">
                <label class="field__label">Alignment</label>
                <div class="seg">
                  @for (a of aligns; track a.value) {
                    <button type="button" class="seg__btn"
                      [class.seg__btn--active]="style().align === a.value"
                      (click)="setStyle('align', a.value)">
                      <i [ngClass]="a.icon"></i>
                    </button>
                  }
                </div>
              </div>
            }

            @if (activeStyleKind() === 'highlight' || activeStyleKind() === 'pen' || activeStyleKind() === 'freehand' || activeStyleKind() === 'underline' || activeStyleKind() === 'strikethrough') {
              <div class="field field--row">
                <div class="field__col field__col--color">
                  <span class="field__label">Color</span>
                  <div class="color-control">
                    <span class="swatch" [style.background]="style().color"></span>
                    <input class="pf-color" type="color" [value]="style().color"
                      (input)="setStyle('color', $any($event.target).value)" aria-label="Color" />
                  </div>
                </div>
                <div class="field__col">
                  <label class="field__label" [for]="'st-sw'">
                    {{ activeStyleKind() === 'highlight' ? 'Thickness' : 'Stroke' }}
                    <span class="field__value">{{ style().thickness }} px</span>
                  </label>
                  <input id="st-sw" class="pf-range" type="range" min="1" max="40"
                    [value]="style().thickness" (input)="setStyle('thickness', num($any($event.target).value))" />
                </div>
              </div>
            }

            @if (activeStyleKind() !== 'comment') {
              <div class="field">
                <label class="field__label" [for]="'st-op'">
                  Opacity <span class="field__value">{{ round(style().opacity * 100) }}%</span>
                </label>
                <input id="st-op" class="pf-range" type="range" min="0.1" max="1" step="0.1"
                  [value]="style().opacity" (input)="setStyle('opacity', num($any($event.target).value))" />
              </div>
            } @else {
              <p class="props__note">
                <i class="fa-solid fa-circle-info"></i>
                Comment pop-ups are created where you click on the page.
              </p>
            }
          </div>
        </section>
      } @else {
        <section class="props__card props__card--empty">
          <div class="props__empty-icon">
            <i class="fa-regular fa-object-group"></i>
          </div>
          <p class="props__empty-title">Nothing selected</p>
          <p class="props__empty-text">
            Pick an annotation tool, then click the page. Select a mark to edit its style.
          </p>
          @if (docName()) {
            <dl class="props__meta">
              <div class="props__meta-row">
                <dt>Document</dt>
                <dd>{{ docName() }}</dd>
              </div>
              <div class="props__meta-row">
                <dt>Active tool</dt>
                <dd>{{ toolLabel() }}</dd>
              </div>
            </dl>
          }
        </section>
      }

      @if (annotations().length) {
        <section class="props__list">
          <header class="props__list-head">
            <span>Annotations</span>
            <span class="props__list-count">{{ annotations().length }}</span>
          </header>
          <ul class="props__list-items">
            @for (ann of annotations(); track ann.id) {
              <li>
                <button type="button" class="props__list-row"
                  [class.props__list-row--active]="ann.id === selectedId()"
                  (click)="selectList(ann.id)">
                  <i [ngClass]="iconOf(ann)"></i>
                  <span class="props__list-label">{{ titleOf(ann) }}</span>
                  <span class="props__list-page">p{{ ann.pageIndex + 1 }}</span>
                </button>
              </li>
            }
          </ul>
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
      .seg {
        display: flex;
        gap: 6px;
      }
      .seg__btn {
        flex: 1 1 0;
        height: 34px;
        display: grid;
        place-items: center;
        border: 1px solid var(--pf-outline-variant);
        background: var(--pf-surface-container-lowest);
        color: var(--pf-on-surface-variant);
        border-radius: var(--pf-radius);
        cursor: pointer;
      }
      .seg__btn--active {
        border-color: var(--pf-primary);
        color: var(--pf-on-primary);
        background: var(--pf-primary);
      }
      .props__note {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin: 0;
        font-size: 12px;
        color: var(--pf-on-surface-variant);
        background: var(--pf-surface-container-low);
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius);
        padding: 8px 10px;
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
      .props__delete {
        margin-top: 2px;
      }
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
      .props__list {
        background: var(--pf-surface-container-lowest);
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius-lg);
        box-shadow: var(--pf-shadow-1);
        padding: 12px;
      }
      .props__list-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--pf-on-surface-variant);
        margin-bottom: 8px;
      }
      .props__list-count {
        font-family: var(--pf-font-mono);
        font-size: 11px;
        background: var(--pf-surface-container-low);
        padding: 1px 7px;
        border-radius: var(--pf-radius-full);
      }
      .props__list-items {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 240px;
        overflow-y: auto;
      }
      .props__list-row {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border: 1px solid transparent;
        background: transparent;
        border-radius: var(--pf-radius);
        cursor: pointer;
        color: var(--pf-on-surface);
        font-size: 13px;
      }
      .props__list-row:hover {
        background: var(--pf-surface-container-low);
      }
      .props__list-row--active {
        border-color: var(--pf-primary);
        background: var(--pf-primary-container);
        color: var(--pf-on-primary-container);
      }
      .props__list-row i {
        width: 16px;
        text-align: center;
        color: var(--pf-primary);
      }
      .props__list-label {
        flex: 1 1 auto;
        text-align: left;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .props__list-page {
        font-family: var(--pf-font-mono);
        font-size: 11px;
        color: var(--pf-on-surface-variant);
      }
    `,
  ],
})
export class PropertiesPanelComponent {
  readonly docName = input<string | null>(null);
  readonly activeTool = input<PdfToolId>('select');
  readonly styles = input<Record<AnnotationStyleKind, AnnotationStyle>>(
    structuredClone(DEFAULT_ANNOTATION_STYLES),
  );
  readonly annotations = input<NgxAnnotationView[]>([]);
  readonly selectedId = input<string | null>(null);

  readonly styleChange =
    output<{ kind: AnnotationStyleKind; patch: Partial<AnnotationStyle> }>();
  readonly selectAnnotation = output<string>();
  readonly updateAnnotation = output<{ id: string; patch: NgxAnnotationPatch }>();
  readonly deleteAnnotation = output<string>();

  readonly fontOptions = [
    { label: 'Sans-serif', value: 'sans-serif' },
    { label: 'Serif', value: 'serif' },
    { label: 'Monospace', value: 'monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Courier', value: 'Courier New, monospace' },
  ];
  readonly aligns = [
    { label: 'Left', value: 'left' as const, icon: 'fa-solid fa-align-left' },
    { label: 'Center', value: 'center' as const, icon: 'fa-solid fa-align-center' },
    { label: 'Right', value: 'right' as const, icon: 'fa-solid fa-align-right' },
  ];

  readonly selected = computed(
    () => this.annotations().find((a) => a.id === this.selectedId()) ?? null,
  );
  readonly activeStyleKind = computed<AnnotationStyleKind | null>(
    () => TOOL_TO_STYLE[this.activeTool()] ?? null,
  );
  readonly showStyleEditor = computed(
    () => !this.selected() && this.activeStyleKind() !== null,
  );
  readonly style = computed<AnnotationStyle>(() => {
    const kind = this.activeStyleKind();
    return kind ? this.styles()[kind] : (this.styles().text ?? DEFAULT_ANNOTATION_STYLES.text);
  });

  toolLabel = computed(() => {
    const t = this.activeTool();
    return t.charAt(0).toUpperCase() + t.slice(1);
  });

  round(value: number): number {
    return Math.round(value);
  }

  num(value: string): number {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }

  iconOf(ann: NgxAnnotationView): string {
    return this.iconOfKind(ann.kind);
  }

  iconOfKind(kind: string): string {
    switch (kind) {
      case 'text':
        return 'fa-solid fa-font';
      case 'highlight':
        return 'fa-solid fa-highlighter';
      case 'underline':
        return 'fa-solid fa-underline';
      case 'strikethrough':
        return 'fa-solid fa-strikethrough';
      case 'ink':
        return 'fa-solid fa-pen';
      case 'comment':
        return 'fa-solid fa-comment';
      case 'stamp':
      case 'image':
        return 'fa-solid fa-image';
      default:
        return 'fa-solid fa-circle';
    }
  }

  titleOf(ann: NgxAnnotationView): string {
    return this.titleOfKind(ann.kind);
  }

  titleOfKind(kind: string): string {
    switch (kind) {
      case 'text':
        return 'Text';
      case 'highlight':
        return 'Highlight';
      case 'underline':
        return 'Underline';
      case 'strikethrough':
        return 'Strikethrough';
      case 'ink':
        return 'Ink drawing';
      case 'comment':
        return 'Comment';
      case 'stamp':
        return 'Stamp';
      case 'image':
        return 'Image';
      default:
        return 'Annotation';
    }
  }

  setStyle(field: keyof AnnotationStyle, value: unknown): void {
    const kind = this.activeStyleKind();
    if (!kind) {
      return;
    }
    const patch = { [field]: value } as Partial<AnnotationStyle>;
    this.styleChange.emit({ kind, patch });
  }

  upd(ann: NgxAnnotationView, patch: NgxAnnotationPatch): void {
    this.updateAnnotation.emit({ id: ann.id, patch });
  }

  selectList(id: string): void {
    this.selectAnnotation.emit(id);
  }

  del(ann: NgxAnnotationView): void {
    this.deleteAnnotation.emit(ann.id);
  }
}
