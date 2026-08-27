import {
  Component,
  inject,
  input,
  computed,
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
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss',
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
