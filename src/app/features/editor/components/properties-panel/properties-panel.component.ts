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
} from '../../../../core/models/pdf.models';
import { EditorStateService } from '../../state/editor-state.service';
import { EditorPagesService } from '../../state/editor-pages.service';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="props">
      <div class="props__head">
        <span class="pf-label-caps">Properties</span>
      </div>

      @if (selected(); as ann) {
        <div class="props__section">
          <div class="props__title">{{ titleOf(ann) }}</div>

          @if (ann.type === 'text') {
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
          }

          @if (ann.type === 'shape') {
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
          }

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

          <button
            type="button"
            class="pf-btn pf-btn--danger pf-btn--sm props__delete"
            (click)="delete(ann)"
          >
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      } @else {
        <div class="props__section">
          <p class="pf-text-muted">Select an object to edit its properties.</p>
          @if (docName()) {
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
                <dd>{{ toolLabel() }}</dd>
              </div>
            </dl>
            <p class="pf-text-muted props__hint">
              Use a drawing tool from the toolbar, then drag on the page to add
              an annotation.
            </p>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .props {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .props__head {
        margin-bottom: 4px;
      }
      .props__section {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .props__title {
        font-size: 13px;
        font-weight: 700;
        color: var(--pf-on-surface);
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
      .pf-color {
        height: 32px;
        padding: 2px;
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius);
        background: var(--pf-surface-container-lowest);
      }
      .props__delete {
        align-self: flex-start;
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
      .props__hint {
        font-size: 12px;
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

  titleOf(ann: PdfAnnotation): string {
    if (ann.type === 'text') {
      return 'Text';
    }
    if (ann.type === 'shape') {
      return ann.kind.charAt(0).toUpperCase() + ann.kind.slice(1);
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

  delete(ann: PdfAnnotation): void {
    this.state.removeAnnotation(ann.id);
  }
}
