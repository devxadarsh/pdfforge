/**
 * text-edit-overlay.component.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompt 5 — Inline Text Edit Overlay
 *
 * Renders an absolutely-positioned `<div contenteditable>` on top of the
 * PDF canvas, exactly covering a single TextRun's bounding box.
 *
 * Inputs (signal-based):
 *   run         — The TextRun to edit.
 *   scale       — Current render scale (CSS px per PDF pt).
 *   pageHeightPt — Page height in PDF points (for coordinate flip).
 *
 * Outputs (EventEmitter):
 *   committed — Emits EditCommand when user blurs or presses Enter.
 *   cancelled — Emits void when user presses Escape (no change).
 *
 * Behaviour:
 *   - On init: auto-focuses the editable div, selects all text.
 *   - Escape: restores original text, emits cancelled.
 *   - Blur: emits committed with current text content.
 *   - Enter: emits committed (single-line text only in v1).
 *   - Stops click propagation so the PDF canvas doesn't receive it.
 *
 * PRD §5.3 — Font family, font size, and color match the underlying run.
 * Prompt 5 constraint — Must not modify ngx-extended-pdf-viewer internals.
 */

import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  ElementRef,
  viewChild,
  ChangeDetectionStrategy,
  OnDestroy,
} from '@angular/core';
import { NgStyle } from '@angular/common';
import type { TextRun, EditCommand } from '../../../../core/services/pdf/content-edit/text-run.model';
import { EditorTextEditService, type OverlayRect } from '../../services/editor-text-edit.service';
import { resolveFontStyles, computeConsistentLetterSpacing } from '../../../../core/utilities/font-matcher.util';

@Component({
  selector: 'app-text-edit-overlay',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './text-edit-overlay.component.html',
  styleUrl: './text-edit-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextEditOverlayComponent implements OnDestroy {
  // ── Inputs / Outputs ───────────────────────────────────────────────────────

  readonly run = input.required<TextRun>();
  readonly scale = input.required<number>();
  readonly pageHeightPt = input.required<number>();

  readonly committed = output<EditCommand>();
  readonly cancelled = output<void>();

  private readonly editableRef = viewChild<ElementRef<HTMLDivElement>>('editable');
  private readonly _originalText = signal('');
  private _lastRunId: string | null = null;
  private _lastCommittedText: string | null = null;

  // ── Computed styles ───────────────────────────────────────────────────────

  /** CSS pixel rect relative to the page container. */
  readonly rect = computed<OverlayRect>(() =>
    EditorTextEditService.pdfRunToOverlayRect(
      this.run(),
      this.scale(),
      this.pageHeightPt(),
    ),
  );

  /** CSS color string derived from the TextRun's PdfColor. */
  readonly cssColor = computed<string>(() =>
    EditorTextEditService.pdfColorToCss(this.run().color),
  );

  /** Inline styles object for NgStyle. */
  readonly overlayStyles = computed<Record<string, string>>(() => {
    const r = this.rect();
    const run = this.run();
    const scale = this.scale();
    const overrides = run.styleOverrides;
    const styles = resolveFontStyles(run.fontName || run.fontResource);

    const fontSize = overrides?.fontSize ?? run.fontSize;
    const fontSizePx = Math.round(fontSize * scale * 100) / 100;

    const padX = Math.round((overrides?.paddingX ?? 0) * scale);
    const padY = Math.round((overrides?.paddingY ?? 0) * scale);
    const marginX = Math.round((overrides?.marginX ?? 0) * scale);
    const marginY = Math.round((overrides?.marginY ?? 0) * scale);

    let letterSpacingCss: string;
    if (overrides?.letterSpacing !== undefined) {
      letterSpacingCss = `${overrides.letterSpacing * scale}px`;
    } else {
      const spacing = computeConsistentLetterSpacing(
        run.text,
        run.boundingBox.width * scale,
        fontSizePx,
        run.fontName || run.fontResource,
        run.charSpacing,
        scale,
      );
      letterSpacingCss = spacing === 0 ? 'normal' : `${spacing}px`;
    }

    const wordSpacingCss =
      typeof run.wordSpacing === 'number' && Math.abs(run.wordSpacing) > 0.01
        ? `${Math.round(run.wordSpacing * scale * 10) / 10}px`
        : 'normal';

    const hasBg =
      overrides?.backgroundEnabled &&
      overrides?.backgroundColor &&
      overrides.backgroundColor !== 'transparent';

    return {
      left: `${r.left + marginX}px`,
      top: `${r.top + marginY}px`,
      minWidth: '20px',
      width: 'max-content',
      height: `${r.height}px`,
      color: overrides?.color ?? this.cssColor(),
      'background-color': overrides?.backgroundColor || '#ffffff',
      'font-family': overrides?.fontFamily ?? styles.fontFamily,
      'font-weight': overrides?.fontWeight ? `${overrides.fontWeight}` : styles.fontWeight,
      'font-style': overrides?.fontStyle ?? styles.fontStyle,
      'text-decoration': overrides?.underline ? 'underline' : 'none',
      'font-size': `${fontSizePx}px`,
      'letter-spacing': letterSpacingCss,
      'word-spacing': wordSpacingCss,
      'line-height':
        overrides?.lineHeight !== undefined ? `${overrides.lineHeight}` : `${r.height}px`,
      'text-align': overrides?.textAlign ?? 'left',
      'text-transform': overrides?.textTransform ?? 'none',
      padding: `${padY}px ${padX}px`,
      opacity: overrides?.opacity !== undefined ? `${overrides.opacity}` : '1',
    };
  });

  constructor() {
    // Synchronize DOM text when run changes, but only focus on fresh activation
    effect(() => {
      const run = this.run();
      const isNewRun = this._lastRunId !== run.id;
      this._lastRunId = run.id;

      if (isNewRun) {
        this._originalText.set(run.text);
        this._lastCommittedText = run.text;
        const el = this.editableRef()?.nativeElement;
        if (el) {
          el.innerText = run.text;
        }
        // Focus and select all ONLY on a fresh run activation
        queueMicrotask(() => this.focusAndSelectAll());
      } else {
        // Run styling or text updated. If focus is NOT in the editable, sync text visually
        const el = this.editableRef()?.nativeElement;
        if (el && document.activeElement !== el && el.innerText !== run.text) {
          el.innerText = run.text;
          this._lastCommittedText = run.text;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.commit();
  }

  // ── Lifecycle helpers ─────────────────────────────────────────────────────

  private focusAndSelectAll(): void {
    const el = this.editableRef()?.nativeElement;
    if (!el) return;
    el.focus({ preventScroll: true });
    // Select all text content.
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  /** Stops the click from propagating to the PDF canvas hit-test layer. */
  onContainerClick(event: MouseEvent): void {
    event.stopPropagation();
    const el = this.editableRef()?.nativeElement;
    if (el && document.activeElement !== el) {
      el.focus();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      // Commit on Enter (single-line edit; Shift+Enter would insert newline).
      event.preventDefault();
      this.commit();
      return;
    }
  }

  /** Intercepts paste to insert plain text only (no HTML formatting). */
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    // Collapse to single line (overlay is single-line in v1).
    const singleLine = text.replace(/[\r\n]+/g, ' ').trim();
    document.execCommand('insertText', false, singleLine);
  }

  onBlur(): void {
    this.commit();
  }

  // ── Commit / Cancel ───────────────────────────────────────────────────────

  private commit(): void {
    const el = this.editableRef()?.nativeElement;
    const raw = el ? (el.textContent ?? el.innerText ?? '') : '';
    // Strip carriage returns and newlines without trimming spaces
    const cleaned = raw.replace(/[\r\n]+/g, '');

    if (cleaned !== this._lastCommittedText) {
      this._lastCommittedText = cleaned;
      this.committed.emit({
        runId: this.run().id,
        newText: cleaned,
      });
    }
  }

  private cancel(): void {
    const orig = this._originalText();
    this._lastCommittedText = orig;
    const el = this.editableRef()?.nativeElement;
    if (el) el.innerText = orig;
    this.cancelled.emit();
  }
}
