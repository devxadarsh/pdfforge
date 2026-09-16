/**
 * editor-text-edit.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompt 5 — Angular orchestration layer for PDF content text editing.
 *
 * Bridges the pure-TS engine (Prompts 3–4) and the Angular editor shell.
 * Responsibilities:
 *   1. Load PageContentModel for the current page via extractPageContentModel().
 *   2. Expose TextRun[] as an Angular Signal for template consumption.
 *   3. Track active (editing) run: activeRunId, isEditing signals.
 *   4. Accept commitEdit requests, delegate to engine + EditHistory.
 *   5. Expose undo/redo that route through EditHistory (separate from the
 *      annotation-layer undo/redo in EditorStateService).
 *
 * PRD §5.2 — "Typing replaces the run's text content only."
 * PRD §5.3 — "Reuse the same font resource, size, color, and Tm matrix."
 * PRD §13 Q1 — Block missing glyphs (Option A).
 *
 * Coordinate system note:
 *   TextRun.boundingBox is in PDF user-space (72 DPI, origin bottom-left).
 *   The overlay component converts these to CSS pixels using `pdfPointToCssPixels()`.
 *
 * NOTE: extractPageContentModel() calls mupdf via a Web Worker + fontkit.
 * The result is cached per (pageIndex, pdfBytes reference) so re-renders
 * at different zoom levels don't retrigger extraction.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import type {
  PageContentModel,
  TextRun,
  EditCommand,
  TextRunStyleOverrides,
} from '../../../core/services/pdf/content-edit/text-run.model';
import type { FontSubsetInfo } from '../../../core/services/pdf/content-edit/font-subset-analyzer';
import type { PendingStreamEdit } from '../../../core/services/pdf/content-edit/content-stream-serializer';
import {
  commitEdit,
  GlyphMissingError,
} from '../../../core/services/pdf/content-edit/content-edit-engine';
import { EditHistory } from '../../../core/services/pdf/content-edit/edit-history';

// ─── Public Types ─────────────────────────────────────────────────────────────

/** State exposed to the overlay component. */
export interface TextEditSession {
  /** All extracted runs for the current page. */
  readonly runs: readonly TextRun[];
  /** The run currently being edited, or null. */
  readonly activeRunId: string | null;
  /** Whether a run is actively being edited. */
  readonly isEditing: boolean;
  /** Whether an undo action is available. */
  readonly canUndo: boolean;
  /** Whether a redo action is available. */
  readonly canRedo: boolean;
  /** true while extractPageContentModel() is running. */
  readonly isLoading: boolean;
  /** Non-fatal warnings from the extraction pipeline. */
  readonly warnings: readonly string[];
}

/** Coordinate conversion result: CSS pixel rect with page-relative origin. */
export interface OverlayRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class EditorTextEditService {
  private readonly toast = inject(ToastService);

  // ── Internal state ─────────────────────────────────────────────────────────

  /** Current PageContentModel (updated after each commitEdit). */
  private readonly _model = signal<PageContentModel | null>(null);
  /** Font info map returned by extractPageContentModel() — needed for encoding. */
  private _fontInfoMap: ReadonlyMap<string, FontSubsetInfo> = new Map();
  /** The raw PDF bytes of the currently-loaded document. */
  private _pdfBytes: ArrayBuffer | null = null;
  /** Accumulated pending edits per page, keyed by pageIndex. Consumed at export time. */
  private readonly _pendingEdits = new Map<number, PendingStreamEdit[]>();

  private readonly _activeRunId = signal<string | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _warnings = signal<readonly string[]>([]);

  /** Per-page undo/redo history for text content edits. */
  private readonly history = new EditHistory(50);
  private readonly _canUndo = signal(false);
  private readonly _canRedo = signal(false);

  /** Map of runId -> edited TextRun across the document. */
  private readonly _editedRuns = signal<Map<string, TextRun>>(new Map());
  readonly editedRuns = this._editedRuns.asReadonly();
  /** Original unedited runs to check if an edit was undone. */
  private readonly _originalRuns = new Map<string, TextRun>();

  // ── Public read-only signals ───────────────────────────────────────────────

  readonly runs = computed<readonly TextRun[]>(() => this._model()?.runs ?? []);
  readonly activeRunId = this._activeRunId.asReadonly();
  readonly isEditing = computed(() => this._activeRunId() !== null);
  readonly activeRun = computed<TextRun | null>(() => {
    const id = this._activeRunId();
    if (!id) return null;
    return this._editedRuns().get(id) ?? this._model()?.runs.find((r) => r.id === id) ?? null;
  });
  readonly isLoading = this._isLoading.asReadonly();
  readonly warnings = this._warnings.asReadonly();
  readonly canUndo = this._canUndo.asReadonly();
  readonly canRedo = this._canRedo.asReadonly();

  /** Returns all committed edited runs for a given page index. */
  getEditedRunsForPage(pageIndex: number): TextRun[] {
    const list: TextRun[] = [];
    for (const run of this._editedRuns().values()) {
      if (run.pageIndex === pageIndex) {
        list.push(run);
      }
    }
    return list;
  }

  /** Returns the original unedited run before any modifications, if known. */
  getOriginalRun(runId: string): TextRun | undefined {
    return this._originalRuns.get(runId);
  }

  /** Convenience computed: the full session state for the template. */
  readonly session = computed<TextEditSession>(() => ({
    runs: this.runs(),
    activeRunId: this._activeRunId(),
    isEditing: this.isEditing(),
    canUndo: this._canUndo(),
    canRedo: this._canRedo(),
    isLoading: this._isLoading(),
    warnings: this._warnings(),
  }));

  // ── Page Load ──────────────────────────────────────────────────────────────

  /**
   * Loads text runs for a given PDF page. Called when the editor activates the
   * 'content-edit' tool or when the current page changes.
   *
   * Uses a lazy import to keep mupdf/fontkit out of the initial bundle.
   * The result is cached: if called again with the same pdfBytes + pageIndex,
   * it returns immediately (no re-extraction).
   */
  async loadPage(pdfBytes: ArrayBuffer, pageIndex: number): Promise<void> {
    if (this._pdfBytes === pdfBytes && this._model()?.pageIndex === pageIndex) {
      return; // Already loaded.
    }

    this._isLoading.set(true);
    this._activeRunId.set(null);
    this.history.clear();
    this._canUndo.set(false);
    this._canRedo.set(false);

    try {
      const { extractPageContentModel } = await import(
        '../../../core/services/pdf/content-edit/content-edit-engine'
      );
      const result = await extractPageContentModel(pdfBytes, pageIndex);
      for (const r of result.model.runs) {
        if (!this._originalRuns.has(r.id)) {
          this._originalRuns.set(r.id, r);
        }
      }

      // Merge any previously committed edits for this page into the active model
      const mergedRuns = result.model.runs.map((r) => {
        const edited = this._editedRuns().get(r.id);
        return edited ?? r;
      });

      this._model.set({ ...result.model, runs: mergedRuns });
      this._fontInfoMap = result.fontInfoMap;
      this._pdfBytes = pdfBytes;
      this._warnings.set(result.warnings);

      if (result.warnings.length > 0) {
        console.warn('[TextEditService] Extraction warnings:', result.warnings);
      }
    } catch (e) {
      console.error('[TextEditService] Extraction failed:', e);
      this._warnings.set([`Failed to extract page text: ${String(e)}`]);
      this.toast.error('Could not analyse page text. Some runs may not be editable.');
    } finally {
      this._isLoading.set(false);
    }
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  /** Activates the overlay for the given run. Only one run at a time. */
  activateRun(runId: string, detectedBg?: string): void {
    this._activeRunId.set(runId);
    const current = this.activeRun();
    if (current && !current.styleOverrides?.backgroundColor) {
      this.updateActiveRunStyle({
        backgroundColor: detectedBg || '#ffffff',
        backgroundEnabled: true,
      });
    }
  }

  /** Deactivates any active run without committing. */
  deactivate(): void {
    this._activeRunId.set(null);
  }

  /**
   * Updates styling overrides on the currently active text run.
   * Modifies both the current model and the document-level _editedRuns cache
   * so adjustments take effect immediately in both overlay and canvas patch.
   */
  updateActiveRunStyle(overrides: Partial<TextRunStyleOverrides>): void {
    const activeId = this._activeRunId();
    if (!activeId) return;

    const currentModel = this._model();
    if (!currentModel) return;

    const runIndex = currentModel.runs.findIndex((r) => r.id === activeId);
    if (runIndex === -1) return;

    const existingRun = this._editedRuns().get(activeId) ?? currentModel.runs[runIndex];
    const updatedOverrides: TextRunStyleOverrides = {
      ...(existingRun.styleOverrides ?? {}),
      ...overrides,
    };

    const updatedRun: TextRun = {
      ...existingRun,
      styleOverrides: updatedOverrides,
    };

    // Update in current page model
    const newRuns = [...currentModel.runs];
    newRuns[runIndex] = updatedRun;
    this._model.set({ ...currentModel, runs: newRuns });

    // Store in _editedRuns so it stays persistent on blur and across pages
    this._editedRuns.update((map) => {
      const next = new Map(map);
      next.set(updatedRun.id, updatedRun);
      return next;
    });
  }

  /**
   * Resets any style overrides on the currently active run back to original PDF extracted values.
   */
  resetActiveRunStyle(): void {
    const activeId = this._activeRunId();
    if (!activeId) return;

    const currentModel = this._model();
    if (!currentModel) return;

    const runIndex = currentModel.runs.findIndex((r) => r.id === activeId);
    if (runIndex === -1) return;

    const existingRun = this._editedRuns().get(activeId) ?? currentModel.runs[runIndex];
    const origRun = this._originalRuns.get(activeId);

    const updatedRun: TextRun = {
      ...existingRun,
      styleOverrides: undefined,
    };

    const newRuns = [...currentModel.runs];
    newRuns[runIndex] = updatedRun;
    this._model.set({ ...currentModel, runs: newRuns });

    this._editedRuns.update((map) => {
      const next = new Map(map);
      if (origRun && origRun.text !== updatedRun.text) {
        next.set(updatedRun.id, updatedRun);
      } else {
        next.delete(updatedRun.id);
      }
      return next;
    });
  }

  // ── Edit Application ───────────────────────────────────────────────────────

  /**
   * Applies a text edit to the in-memory model and pushes history.
   * Returns the PendingStreamEdit for the caller to pass to serializeEditedPage()
   * when the user saves/exports. Returns null on any validation failure.
   *
   * Validation rules (Option A — Block):
   *   1. newText must not be empty (deleting runs is not supported in v1).
   *   2. newText must only contain characters present in the font's glyph set.
   */
  applyEdit(command: EditCommand, keepActive = false): PendingStreamEdit | null {
    const model = this._model();
    if (!model) return null;

    // Find the before-state run.
    const run = model.runs.find((r) => r.id === command.runId);
    if (!run) return null;

    // ── Validation 1: block empty edits ────────────────────────────────────
    const trimmed = command.newText.trim();
    if (trimmed === '') {
      this.toast.warning(
        'Text cannot be empty. To remove content, use the Eraser or Delete tool instead.',
      );
      if (!keepActive) this._activeRunId.set(null);
      return null;
    }

    // Skip no-op edits.
    if (run.text === command.newText) {
      if (!keepActive) this._activeRunId.set(null);
      return null;
    }

    let result: ReturnType<typeof commitEdit>;
    try {
      result = commitEdit(model, command, this._fontInfoMap);
    } catch (e) {
      if (e instanceof GlyphMissingError) {
        // ── Option A: Block — user-friendly, non-technical message ──────────
        const chars = e.missingChars;
        const charList = chars.slice(0, 3).map((c) => `"${c}"`).join(', ');
        const more = chars.length > 3 ? ` and ${chars.length - 3} more` : '';
        this.toast.warning(
          `The character${chars.length > 1 ? 's' : ''} ${charList}${more} ` +
          `cannot be used here — the PDF font does not include ` +
          `${chars.length > 1 ? 'them' : 'it'}. Try a different character.`,
        );
        if (!keepActive) this._activeRunId.set(null);
        return null;
      }
      console.error('[TextEditService] commitEdit failed:', e);
      this.toast.error('Could not apply the text change. Please try again.');
      if (!keepActive) this._activeRunId.set(null);
      return null;
    }

    // Record history (before → after).
    this.history.push(command, model, result.model);
    this._model.set(result.model);
    this._canUndo.set(this.history.canUndo);
    this._canRedo.set(this.history.canRedo);
    if (!keepActive) {
      this._activeRunId.set(null);
    }

    // Record in editedRuns signal for persistent rendering on the page
    const updatedRun = result.model.runs.find((r) => r.id === command.runId);
    if (updatedRun) {
      this._editedRuns.update((map) => {
        const next = new Map(map);
        next.set(updatedRun.id, updatedRun);
        return next;
      });
    }

    // Accumulate for export: each committed edit adds to the per-page queue.
    const pendingEdit = result.pendingEdit ?? null;
    if (pendingEdit) {
      const pageIndex = model.pageIndex;
      const existing = this._pendingEdits.get(pageIndex) ?? [];
      // Replace any prior edit for the same operator index (re-edit of same run).
      const withoutOld = existing.filter((e) => e.operatorIndex !== pendingEdit.operatorIndex);
      this._pendingEdits.set(pageIndex, [...withoutOld, pendingEdit]);
    }

    return pendingEdit;
  }

  // ── Pending Edits (for export) ─────────────────────────────────────────────

  /**
   * Returns a snapshot of all accumulated PendingStreamEdit[] by page index.
   * Called by PdfContentEditService at export time.
   */
  getPendingEdits(): ReadonlyMap<number, readonly PendingStreamEdit[]> {
    return this._pendingEdits;
  }

  /** Returns true if there are any pending text edits to serialize on export. */
  hasPendingEdits(): boolean {
    for (const edits of this._pendingEdits.values()) {
      if (edits.length > 0) return true;
    }
    return false;
  }

  /** Clears the accumulated pending edits (call after a successful export). */
  clearPendingEdits(): void {
    this._pendingEdits.clear();
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────────

  /** Undo the last text content edit. Returns the restored model or null. */
  undo(): void {
    const model = this.history.undo();
    if (model) {
      this._model.set(model);
      this._activeRunId.set(null);
      this._canUndo.set(this.history.canUndo);
      this._canRedo.set(this.history.canRedo);

      this._editedRuns.update((map) => {
        const next = new Map(map);
        for (const run of model.runs) {
          const orig = this._originalRuns.get(run.id);
          if (orig && orig.text === run.text) {
            next.delete(run.id);
          } else {
            next.set(run.id, run);
          }
        }
        return next;
      });
    }
  }

  /** Redo the last undone text content edit. */
  redo(): void {
    const model = this.history.redo();
    if (model) {
      this._model.set(model);
      this._activeRunId.set(null);
      this._canUndo.set(this.history.canUndo);
      this._canRedo.set(this.history.canRedo);

      this._editedRuns.update((map) => {
        const next = new Map(map);
        for (const run of model.runs) {
          const orig = this._originalRuns.get(run.id);
          if (orig && orig.text === run.text) {
            next.delete(run.id);
          } else {
            next.set(run.id, run);
          }
        }
        return next;
      });
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  /**
   * Clears all state. Call when the editor is closed or a new PDF is opened.
   */
  reset(): void {
    this._model.set(null);
    this._fontInfoMap = new Map();
    this._pdfBytes = null;
    this._activeRunId.set(null);
    this._isLoading.set(false);
    this._warnings.set([]);
    this.history.clear();
    this._canUndo.set(false);
    this._canRedo.set(false);
    this._pendingEdits.clear();
    this._editedRuns.set(new Map());
    this._originalRuns.clear();
  }

  // ── Coordinate Conversion ──────────────────────────────────────────────────

  /**
   * Converts a TextRun's PDF bounding box to a CSS pixel rect relative to the
   * rendered page's top-left corner.
   *
   * PDF coordinate system: origin bottom-left, y-axis up, 1 unit = 1/72 inch.
   * CSS coordinate system: origin top-left, y-axis down, units = px.
   *
   * Formula (for unrotated pages):
   *   cssLeft   = bbox.x * scale
   *   cssTop    = (pageHeightPt - bbox.y - bbox.height) * scale
   *   cssWidth  = bbox.width * scale
   *   cssHeight = bbox.height * scale
   *
   * @param run             - TextRun with boundingBox in PDF pt (top-left origin).
   * @param scale           - Current render scale (CSS px per PDF pt).
   * @param _pageHeightPt   - Optional page height in PDF points.
   */
  static pdfRunToOverlayRect(
    run: TextRun,
    scale: number,
    _pageHeightPt?: number,
  ): OverlayRect {
    const { x, y, width, height } = run.boundingBox;
    const fontSize = run.styleOverrides?.fontSize ?? run.fontSize;
    const maxTightHeight = fontSize > 0 ? fontSize * 1.08 : height;
    const tightH = height > maxTightHeight && fontSize >= 4 ? maxTightHeight : height;
    const diffY = height - tightH;
    const tightY = diffY > 0 ? y + diffY * 0.55 : y;

    return {
      left: Math.round(x * scale),
      top: Math.round(tightY * scale),
      width: Math.max(4, Math.round(width * scale)),
      height: Math.max(4, Math.round(tightH * scale)),
    };
  }

  /**
   * Resolves the CSS color string from a PdfColor.
   */
  static pdfColorToCss(color: TextRun['color']): string {
    switch (color.type) {
      case 'rgb':
        return `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
      case 'gray':
        return `rgb(${Math.round(color.g * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.g * 255)})`;
      case 'cmyk': {
        const r = 255 * (1 - color.c) * (1 - color.k);
        const g = 255 * (1 - color.m) * (1 - color.k);
        const b = 255 * (1 - color.y) * (1 - color.k);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
      }
    }
  }
}
