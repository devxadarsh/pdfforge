/**
 * content-stream-serializer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Engine v0.1 Part B — Low-level Content Stream Rewriter
 *
 * Handles the pdf-lib integration for rewriting a page's content stream(s)
 * after edits are applied via commitEdit().
 *
 * PRD §5.3 — "Reuse same font resource name, same Tf size, same color operator,
 *              same Tm matrix for the edited run."
 * PRD §7   — "No reflow in v1. Overflow is acceptable."
 *
 * ── STRATEGY ─────────────────────────────────────────────────────────────────
 * 1. Load the original PDF with pdf-lib (read-only for all pages except edited).
 * 2. For each edited page: decompress stream(s), tokenize, apply all pending
 *    text-operand replacements in a single pass, write back.
 * 3. Untouched pages: reference original stream objects unchanged.
 *    pdf-lib's save() with the `useObjectStreams: false` option preserves
 *    byte-ranges of unmodified objects.
 *
 * ── INVARIANTS (per PRD §5.3) ────────────────────────────────────────────────
 * For each edited run, the serializer:
 *   - Keeps the `Tf` operands unchanged (same resource key + size).
 *   - Keeps the `Tm` matrix unchanged (same position — no reflow).
 *   - Keeps color operators (rg/RG/k/K/sc) unchanged.
 *   - Replaces ONLY the string operand of the matched Tj/TJ/'/" operator.
 *
 * IMPORTANT: Zero Angular imports. Pure TypeScript + pdf-lib module.
 */

import {
  tokenizeContentStream,
  findTextOperators,
  type TextOperatorLocation,
} from './font-glyph-resolver';
import type { FontSubsetInfo } from './font-subset-analyzer';
import { encodeTextForContentStream } from './font-subset-analyzer';

// ─── Public Types ─────────────────────────────────────────────────────────────

/**
 * One pending edit for the serializer: which text operator index to replace
 * and what new text (already validated by commitEdit()) to put there.
 */
export interface PendingStreamEdit {
  /**
   * Sequential text-operator index: position in the findTextOperators() result
   * for this page's content stream (0 = first Tj/TJ found, 1 = second, etc.).
   * This is the same as the run index from extractPageContentModel().
   */
  readonly operatorIndex: number;
  /** New Unicode text — already validated against fontSubsetGlyphs. */
  readonly newText: string;
  /** FontSubsetInfo for the font used by this run (required for encoding). */
  readonly fontInfo: FontSubsetInfo;
}

/**
 * Summary of what the serializer changed on a given page.
 */
export interface SerializationResult {
  readonly pageIndex: number;
  readonly editsApplied: number;
  readonly warnings: string[];
}

// ─── Domain Errors ────────────────────────────────────────────────────────────

/** Thrown when the PDF cannot be loaded for writing. */
export class PdfLoadError extends Error {
  readonly sourceError: unknown;
  constructor(message: string, sourceError?: unknown) {
    super(message);
    this.name = 'PdfLoadError';
    this.sourceError = sourceError;
  }
}

/** Thrown when the serializer cannot safely write back an edited page. */
export class PdfExportError extends Error {
  readonly sourceError: unknown;
  constructor(message: string, sourceError?: unknown) {
    super(message);
    this.name = 'PdfExportError';
    this.sourceError = sourceError;
  }
}

// ─── Stream Extraction Helpers ───────────────────────────────────────────────

/**
 * Reads and concatenates the decompressed content streams for a single PDF page.
 * Handles both single-stream and array-of-streams /Contents.
 */
export async function readPageContentStream(
  pdfBytes: Uint8Array,
  pageIndex: number,
): Promise<string> {
  const { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } = await import('pdf-lib');

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch (e) {
    throw new PdfLoadError(`Failed to load PDF for content stream reading.`, e);
  }

  const pages = pdfDoc.getPages();
  if (pageIndex >= pages.length) {
    throw new RangeError(`pageIndex ${pageIndex} out of range [0, ${pages.length - 1}]`);
  }

  const pageNode = pages[pageIndex].node;
  const contentsRef = pageNode.lookup(PDFName.of('Contents'));
  if (!contentsRef) return '';

  let streamText = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentsAny = contentsRef as any;

  const readStream = (ref: unknown): void => {
    const obj = pdfDoc.context.lookup(ref as import('pdf-lib').PDFRef);
    if (obj instanceof PDFRawStream) {
      try {
        streamText += new TextDecoder('latin1').decode(decodePDFRawStream(obj).decode());
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        streamText += new TextDecoder('latin1').decode((obj as any).contents);
      }
    }
  };

  if (typeof contentsAny.get === 'function') {
    for (let i = 0; i < contentsAny.length; i++) readStream(contentsAny.get(i));
  } else {
    readStream(contentsRef);
  }

  return streamText;
}

// ─── Stream Edit Application ──────────────────────────────────────────────────

/**
 * Applies one or more PendingStreamEdit operations to a decompressed content
 * stream text, returning the new stream bytes.
 *
 * Edits are applied in reverse order of operatorIndex so that byte offsets
 * of earlier operators are not invalidated by substitutions of later ones.
 */
export function applyEditsToStream(
  streamText: string,
  edits: readonly PendingStreamEdit[],
): { newStreamBytes: Uint8Array; applied: number; warnings: string[] } {
  const warnings: string[] = [];

  // Sort edits descending by operatorIndex so that substitutions of later
  // operators don't shift the byte positions of earlier operators.
  const sorted = [...edits].sort((a, b) => b.operatorIndex - a.operatorIndex);

  let currentText = streamText;
  let applied = 0;

  for (const edit of sorted) {
    // Re-tokenize after each substitution (byte offsets change).
    const currentTokens = tokenizeContentStream(currentText);
    const currentOps = findTextOperators(currentTokens);

    // edit.operatorIndex = sequential position in findTextOperators() result.
    const target = currentOps[edit.operatorIndex];
    if (!target) {
      warnings.push(`No text operator at sequential index ${edit.operatorIndex} — skipping.`);
      continue;
    }

    // Encode new text to PDF byte codes via ToUnicode map.
    const encoded = encodeTextForContentStream(edit.newText, edit.fontInfo);
    if (!encoded) {
      warnings.push(
        `Cannot encode "${edit.newText}" for font "${edit.fontInfo.fontKey}" ` +
        `— no ToUnicode map or missing glyph. Edit skipped.`,
      );
      continue;
    }

    // Build a hex string operand: <48656c6c6f>
    const hexStr = '<' + Array.from(encoded).map((b) => b.toString(16).padStart(2, '0')).join('') + '>';

    const operandTok = currentTokens[target.operandIndex];
    let replaceStart: number;
    let replaceEnd: number;

    if (target.operator === 'TJ') {
      // Replace the entire array operand [...] with a single hex string.
      replaceStart = operandTok.startPos;
      let depth = 0;
      let endPos = operandTok.startPos;
      for (let i = operandTok.startPos; i < currentText.length; i++) {
        if (currentText[i] === '[') depth++;
        else if (currentText[i] === ']') { depth--; if (depth === 0) { endPos = i + 1; break; } }
      }
      replaceEnd = endPos;
    } else {
      replaceStart = operandTok.startPos;
      replaceEnd = operandTok.startPos + operandTok.raw.length;
    }

    currentText =
      currentText.slice(0, replaceStart) +
      hexStr +
      currentText.slice(replaceEnd);

    applied++;
  }

  return {
    newStreamBytes: new TextEncoder().encode(currentText),
    applied,
    warnings,
  };
}

// ─── Main Serializer ──────────────────────────────────────────────────────────

/**
 * Rewrites the content streams of edited pages in the PDF and returns the
 * modified PDF bytes.
 *
 * Untouched pages are NOT re-serialized — pdf-lib writes their streams
 * unchanged, preserving byte identity for those objects.
 *
 * @param originalPdfBytes - The source PDF.
 * @param editsByPage      - Map of pageIndex → PendingStreamEdit[].
 * @returns Modified PDF as ArrayBuffer.
 */
export async function rewriteEditedPages(
  originalPdfBytes: Uint8Array,
  editsByPage: ReadonlyMap<number, readonly PendingStreamEdit[]>,
): Promise<{ pdfBytes: ArrayBuffer; results: SerializationResult[] }> {
  const { PDFDocument, PDFName } = await import('pdf-lib');

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(originalPdfBytes, {
      ignoreEncryption: true,
      // Keep all objects; we only mutate streams for edited pages.
    });
  } catch (e) {
    throw new PdfLoadError('Failed to load PDF for serialization.', e);
  }

  const pages = pdfDoc.getPages();
  const results: SerializationResult[] = [];

  for (const [pageIndex, edits] of editsByPage) {
    if (pageIndex >= pages.length) {
      results.push({ pageIndex, editsApplied: 0, warnings: [`Page ${pageIndex} out of range — skipped.`] });
      continue;
    }

    // Read the current (possibly multi-stream) content.
    const streamText = await readPageContentStream(originalPdfBytes, pageIndex);
    if (!streamText) {
      results.push({ pageIndex, editsApplied: 0, warnings: ['Empty content stream — no edits applied.'] });
      continue;
    }

    // Apply all edits in one pass.
    const { newStreamBytes, applied, warnings } = applyEditsToStream(streamText, edits);

    if (applied === 0) {
      results.push({ pageIndex, editsApplied: 0, warnings });
      continue;
    }

    // Write the new stream back to this page.
    const pageNode = pages[pageIndex].node;
    const newStreamRef = pdfDoc.context.register(
      pdfDoc.context.stream(newStreamBytes, {}),
    );
    pageNode.set(PDFName.of('Contents'), newStreamRef);

    results.push({ pageIndex, editsApplied: applied, warnings });
  }

  let savedBytes: Uint8Array;
  try {
    savedBytes = await pdfDoc.save({ useObjectStreams: false });
  } catch (e) {
    throw new PdfExportError('Failed to save modified PDF.', e);
  }

  return {
    pdfBytes: savedBytes.buffer as ArrayBuffer,
    results,
  };
}
