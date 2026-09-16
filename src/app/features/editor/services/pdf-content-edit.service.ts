/**
 * pdf-content-edit.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompt 6 — Export Pipeline Orchestrator
 *
 * Injectable service that sits between the Angular editor and the pure-TS
 * engine. Responsibilities:
 *   1. Read accumulated PendingStreamEdit[] from EditorTextEditService.
 *   2. Call rewriteEditedPages() to apply text edits to the source PDF bytes.
 *   3. Validate the result with qpdf (via PdfWorkerService).
 *   4. Return final ArrayBuffer; caller triggers the download.
 *
 * ── Privacy Guarantee ─────────────────────────────────────────────────────────
 * The entire export pipeline runs 100% in the browser:
 *   • No fetch() calls with document bytes.
 *   • No analytics pings containing document content.
 *   • No CDN font loading.
 *   • No cloud PDF API calls.
 *   • rewriteEditedPages() is pure pdf-lib (no network).
 *   • validatePdf() runs qpdf-wasm inside the existing Web Worker (no network).
 *   • The Blob + object URL are created locally and revoked after download.
 *
 * This is enforced by design: all PDF data stays in the user's browser tab.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { PdfWorkerService } from '../../../core/services/worker/pdf-worker.service';
import { EditorTextEditService } from './editor-text-edit.service';
import { PdfExportError } from '../../../core/services/pdf/content-edit/content-stream-serializer';

// ─── Progress State ────────────────────────────────────────────────────────────

export interface ContentEditExportProgress {
  readonly stage: string;
  readonly percentage: number;
}

// ─── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PdfContentEditService {
  private readonly toast = inject(ToastService);
  private readonly worker = inject(PdfWorkerService);
  private readonly textEdit = inject(EditorTextEditService);

  /** True while exportDocument() is running. */
  readonly isExporting = signal(false);
  /** Current export step for the progress indicator. */
  readonly progress = signal<ContentEditExportProgress | null>(null);

  /**
   * Applies all accumulated text edits to the original PDF bytes and returns
   * the final ArrayBuffer ready for download.
   *
   * Steps:
   *  1. Check if there are any pending edits; skip serialization if none.
   *  2. Call rewriteEditedPages() (pdf-lib content stream mutation).
   *  3. Validate the result via qpdf --check (in the existing Web Worker).
   *  4. Clear the pending edits on success (export is idempotent thereafter).
   *
   * @param originalPdfBytes - Source PDF bytes (unchanged; we derive a new copy).
   * @returns Modified PDF as ArrayBuffer, or the original bytes if no edits.
   * @throws PdfExportError if qpdf detects structural damage.
   */
  async exportDocument(originalPdfBytes: ArrayBuffer): Promise<ArrayBuffer> {
    if (this.isExporting()) {
      throw new Error('Export already in progress.');
    }

    const pendingEdits = this.textEdit.getPendingEdits();
    if (pendingEdits.size === 0 || !this.textEdit.hasPendingEdits()) {
      // No text edits — return original bytes unchanged (zero copy beyond slice).
      return originalPdfBytes;
    }

    this.isExporting.set(true);
    this.progress.set({ stage: 'Applying text edits…', percentage: 10 });

    try {
      // ── Step 1: Apply text edits via pdf-lib ─────────────────────────────
      const { rewriteEditedPages } = await import(
        '../../../core/services/pdf/content-edit/content-stream-serializer'
      );

      const sourceBytes = new Uint8Array(originalPdfBytes);
      let result: Awaited<ReturnType<typeof rewriteEditedPages>>;

      try {
        result = await rewriteEditedPages(sourceBytes, pendingEdits);
      } catch (e) {
        if (e instanceof PdfExportError) {
          throw e; // Re-throw; caller maps to toast.
        }
        throw new PdfExportError(
          'Failed to apply text edits to the PDF. Please undo recent changes and try again.',
          e,
        );
      }

      this.progress.set({ stage: 'Validating output…', percentage: 60 });

      // Log per-page serialization results (non-fatal warnings only).
      for (const r of result.results) {
        if (r.warnings.length > 0) {
          console.warn(`[ContentEditExport] Page ${r.pageIndex} warnings:`, r.warnings);
        }
      }

      const editedBytes = new Uint8Array(result.pdfBytes);

      // ── Step 2: Validate with qpdf ─────────────────────────────────────────
      try {
        const validation = await this.worker.validatePdf(editedBytes);
        if (!validation.valid) {
          throw new PdfExportError(
            validation.errorMessage ??
              'Export produced a damaged PDF. Please undo recent text edits and try again.',
          );
        }
      } catch (e) {
        if (e instanceof PdfExportError) throw e;
        // qpdf Worker unavailable — log and continue (best-effort).
        console.warn('[ContentEditExport] qpdf validation skipped (worker unavailable):', e);
      }

      this.progress.set({ stage: 'Finalising…', percentage: 90 });

      // ── Step 3: Clear pending edits on success ─────────────────────────────
      this.textEdit.clearPendingEdits();

      return result.pdfBytes;
    } finally {
      this.isExporting.set(false);
      this.progress.set(null);
    }
  }
}
