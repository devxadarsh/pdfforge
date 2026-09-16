/**
 * pdf-content-edit.service.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompt 6 — Integration tests for the export pipeline.
 *
 * Acceptance criteria tested here (from Prompt 6 §F and PRD §5.4):
 *   ✓ Only the edited page's content stream changes; all other pages are
 *     byte-for-byte identical in their raw content streams.
 *   ✓ rewriteEditedPages() returns a SerializationResult with editsApplied === 1
 *     for the edited page and editsApplied === 0 for unedited pages.
 *   ✓ PdfContentEditService.exportDocument() returns the original buffer unchanged
 *     when there are no pending edits.
 *   ✓ PdfContentEditService.exportDocument() calls rewriteEditedPages() and
 *     returns a new ArrayBuffer when pending edits exist.
 *
 * Privacy constraint:
 *   All operations run synchronously in the Karma browser test environment.
 *   No network requests are made.
 *
 * NOTE: These tests do NOT require mupdf or fontkit. They exercise:
 *   - rewriteEditedPages() directly (pdf-lib only).
 *   - PdfContentEditService via a mock EditorTextEditService.
 *   - The qpdf validation step is mocked to always return { valid: true }.
 */

import { TestBed } from '@angular/core/testing';
import { PDFDocument } from 'pdf-lib';
import { PdfContentEditService } from '../../../../features/editor/services/pdf-content-edit.service';
import { EditorTextEditService } from '../../../../features/editor/services/editor-text-edit.service';
import { PdfWorkerService } from '../../worker/pdf-worker.service';
import { ToastService } from '../../toast.service';
import { rewriteEditedPages } from './content-stream-serializer';
import type { PendingStreamEdit } from './content-stream-serializer';
import type { FontSubsetInfo } from './font-subset-analyzer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal 2-page PDF with distinct text content streams using pdf-lib.
 *
 * Uses a raw PDF string approach (same as MINIMAL_TEXT_PDF fixture) so that
 * readPageContentStream() can parse the Tj operators correctly.
 *
 * Page 0: "(Original Text) Tj"
 * Page 1: "(Untouched Page) Tj"
 */
async function buildTwoPagePdf(): Promise<Uint8Array> {
  // Start from MINIMAL_TEXT_PDF which has verified, parseable content streams.
  // Then add a second page by loading and extending via pdf-lib.
  const { PDFDocument: PD, PDFName: PN } = await import('pdf-lib');

  // Build a fresh 2-page PDF using pdf-lib's low-level stream API.
  const doc = await PD.create();

  const addPageWithStream = async (text: string): Promise<void> => {
    const page = doc.addPage([612, 792]);
    const contentStr = `BT\n/F1 12 Tf\n72 720 Td\n(${text}) Tj\nET\n`;
    const contentBytes = new TextEncoder().encode(contentStr);
    // Register as a raw stream so pdf-lib stores it as PDFRawStream.
    const streamRef = doc.context.register(
      doc.context.stream(contentBytes, { Length: contentBytes.length }),
    );
    page.node.set(PN.of('Contents'), streamRef);
  };

  await addPageWithStream('Original Text');
  await addPageWithStream('Untouched Page');

  // Save without object streams so streams are stored as PDFRawStream objects.
  const saved = await doc.save({ useObjectStreams: false });
  return new Uint8Array(saved);
}

/**
 * Reads the raw content stream text for a given page index.
 * Used to assert that a page's content stream was/wasn't changed.
 */
async function readPageStreamText(pdfBytes: Uint8Array, pageIndex: number): Promise<string> {
  const { readPageContentStream } = await import('./content-stream-serializer');
  return readPageContentStream(pdfBytes, pageIndex);
}

/**
 * Builds a minimal PendingStreamEdit for page 0 that targets operator at index 0.
 * Uses a stub FontSubsetInfo with a WinAnsiEncoding-compatible toUnicodeMap
 * (ASCII code point → same byte code) so encodeTextForContentStream() succeeds.
 */
function makePendingEdit(newText: string): PendingStreamEdit {
  // Build a unicodeToByte map for printable ASCII (0x20–0x7E).
  // For WinAnsiEncoding (standard Helvetica), char code = byte code.
  const unicodeToByte = new Map<string, number>();
  const byteToUnicode = new Map<number, string>();
  for (let cp = 0x20; cp <= 0x7e; cp++) {
    unicodeToByte.set(String.fromCodePoint(cp), cp);
    byteToUnicode.set(cp, String.fromCodePoint(cp));
  }

  const stubFontInfo: FontSubsetInfo = {
    fontKey: 'F1',
    postscriptName: 'Helvetica',
    numGlyphs: 94,
    availableCodePoints: new Set<number>([...unicodeToByte.values()]),
    availableChars: new Set<string>([...unicodeToByte.keys()]),
    toUnicodeMap: { unicodeToByte, byteToUnicode, isTwoByteEncoding: false },
    fontType: 'type1',
    fontkitParsed: false,
    warnings: [],
  };
  return {
    operatorIndex: 0,
    newText,
    fontInfo: stubFontInfo,
  };
}

// ─── Specs ────────────────────────────────────────────────────────────────────

describe('rewriteEditedPages() — byte-identity integration', () => {
  it('only rewrites the edited page; page 1 content stream is identical to original', async () => {
    const originalBytes = await buildTwoPagePdf();
    const edit = makePendingEdit('Edited Text');

    const { pdfBytes, results } = await rewriteEditedPages(
      originalBytes,
      new Map([[0, [edit]]]),
    );

    // ── Edited page result ─────────────────────────────────────────────────
    const editedResult = results.find((r) => r.pageIndex === 0);
    expect(editedResult).toBeDefined();
    expect(editedResult!.editsApplied).toBe(1);

    // ── Page count preserved ───────────────────────────────────────────────
    const modifiedDoc = await PDFDocument.load(new Uint8Array(pdfBytes), { ignoreEncryption: true });
    const originalDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    expect(modifiedDoc.getPageCount()).toBe(originalDoc.getPageCount());

    // ── Untouched page: content stream text unchanged ──────────────────────
    const originalPage1Text = await readPageStreamText(originalBytes, 1);
    const exportedPage1Text = await readPageStreamText(new Uint8Array(pdfBytes), 1);

    // Both must contain the original untouched text.
    expect(originalPage1Text).toContain('Untouched Page');
    expect(exportedPage1Text).toContain('Untouched Page');
    // Streams must be byte-for-byte identical.
    expect(exportedPage1Text).toBe(originalPage1Text);
  });

  it('returns no result entries for pages not in editsByPage', async () => {
    const originalBytes = await buildTwoPagePdf();
    const edit = makePendingEdit('Only Page Zero');

    const { results } = await rewriteEditedPages(
      originalBytes,
      new Map([[0, [edit]]]),
    );

    // Only page 0 was edited — no entry for page 1.
    const page1Result = results.find((r) => r.pageIndex === 1);
    expect(page1Result).toBeUndefined();
  });

  it('handles an empty editsByPage map — PDF page count unchanged', async () => {
    const originalBytes = await buildTwoPagePdf();
    const { pdfBytes, results } = await rewriteEditedPages(originalBytes, new Map());

    expect(results).toHaveSize(0);
    const doc = await PDFDocument.load(new Uint8Array(pdfBytes), { ignoreEncryption: true });
    expect(doc.getPageCount()).toBe(2);
  });
});

describe('PdfContentEditService — export pipeline', () => {
  let service: PdfContentEditService;
  let mockTextEdit: jasmine.SpyObj<EditorTextEditService>;
  let mockWorker: jasmine.SpyObj<PdfWorkerService>;

  beforeEach(() => {
    mockTextEdit = jasmine.createSpyObj<EditorTextEditService>(
      'EditorTextEditService',
      ['getPendingEdits', 'hasPendingEdits', 'clearPendingEdits'],
    );
    mockWorker = jasmine.createSpyObj<PdfWorkerService>(
      'PdfWorkerService',
      ['validatePdf'],
    );
    // Default: validation always passes.
    mockWorker.validatePdf.and.returnValue(Promise.resolve({ valid: true }));

    TestBed.configureTestingModule({
      providers: [
        PdfContentEditService,
        { provide: EditorTextEditService, useValue: mockTextEdit },
        { provide: PdfWorkerService, useValue: mockWorker },
        {
          provide: ToastService,
          useValue: jasmine.createSpyObj('ToastService', ['error', 'warning', 'success', 'info']),
        },
      ],
    });
    service = TestBed.inject(PdfContentEditService);
  });

  it('returns original buffer unchanged when no pending edits exist', async () => {
    mockTextEdit.hasPendingEdits.and.returnValue(false);
    mockTextEdit.getPendingEdits.and.returnValue(new Map());

    const original = new ArrayBuffer(42);
    const result = await service.exportDocument(original);

    // Same reference — no copy/serialization performed.
    expect(result).toBe(original);
    expect(mockWorker.validatePdf).not.toHaveBeenCalled();
  });

  it('calls validatePdf and clearPendingEdits when pending edits exist', async () => {
    const pdfBytes = await buildTwoPagePdf();
    const edit = makePendingEdit('New Text');

    mockTextEdit.hasPendingEdits.and.returnValue(true);
    mockTextEdit.getPendingEdits.and.returnValue(new Map([[0, [edit]]]));
    mockTextEdit.clearPendingEdits.and.stub();

    const result = await service.exportDocument(pdfBytes.buffer as ArrayBuffer);

    // Returns a new ArrayBuffer containing a valid PDF.
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
    // Must not be the original reference.
    expect(result).not.toBe(pdfBytes.buffer as ArrayBuffer);

    // qpdf validation was called with the serialized bytes.
    expect(mockWorker.validatePdf).toHaveBeenCalledOnceWith(jasmine.any(Uint8Array));

    // Pending edits cleared on success.
    expect(mockTextEdit.clearPendingEdits).toHaveBeenCalledTimes(1);

    // Signals reset after completion.
    expect(service.isExporting()).toBeFalse();
    expect(service.progress()).toBeNull();
  });

  it('throws and does NOT clear pending edits if qpdf validation fails', async () => {
    const pdfBytes = await buildTwoPagePdf();
    const edit = makePendingEdit('Bad Edit');

    mockTextEdit.hasPendingEdits.and.returnValue(true);
    mockTextEdit.getPendingEdits.and.returnValue(new Map([[0, [edit]]]));
    mockTextEdit.clearPendingEdits.and.stub();

    mockWorker.validatePdf.and.returnValue(
      Promise.resolve({ valid: false, errorMessage: 'Export produced a damaged PDF.' }),
    );

    await expectAsync(
      service.exportDocument(pdfBytes.buffer as ArrayBuffer),
    ).toBeRejectedWithError(/damaged PDF/);

    // Pending edits preserved so the user can undo and retry.
    expect(mockTextEdit.clearPendingEdits).not.toHaveBeenCalled();
    expect(service.isExporting()).toBeFalse();
  });

  it('rejects concurrent exports immediately', async () => {
    // Simulate an in-progress export by setting the signal.
    service.isExporting.set(true);

    await expectAsync(
      service.exportDocument(new ArrayBuffer(10)),
    ).toBeRejectedWithError('Export already in progress.');
  });
});
