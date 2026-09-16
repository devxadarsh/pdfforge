/**
 * mupdf-text-extractor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompt 1 Spike — mupdf-wasm Structured Text Extraction
 *
 * Client-side bridge that communicates with `mupdf.worker.ts` via postMessage.
 * mupdf runs inside a Web Worker to avoid Zone.js / top-level-await conflicts.
 *
 * PRD §5.1 — text run detection
 * PRD §8   — mupdf-wasm for structured text extraction
 * PRD §19  — Web Workers for heavy PDF processing
 *
 * ── LICENSING NOTE ──────────────────────────────────────────────────────────
 * mupdf is AGPL-licensed (PRD §10, §13 Q3). Confirm licensing before shipping.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── FONT RESOURCE NAME FINDING (Prompt 1 architectural question) ─────────────
 * mupdf's StructuredText / onChar provides Font.getName() → PostScript name.
 * It does NOT expose the raw PDF resource key (e.g. "/F1").
 *
 * fontResource is prefixed "~" in spike output to mark it unresolved.
 * Resolution via pdf-lib traversal is planned for Prompt 3.
 * See spike-readme.md for full documentation.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * IMPORTANT: Zero Angular imports. This module is framework-agnostic.
 */

import type {
  BoundingBox,
  ExtractionResult,
  GrayColor,
  PageContentModel,
  PdfColor,
  RGBColor,
  TextRun,
} from './text-run.model';

// ─── Worker Message Types (inlined to avoid cross-module import issues) ───────
// These must stay in sync with mupdf.worker.ts. They are inlined here
// because TypeScript's angular compiler resolves worker files differently
// than regular modules.

export type SerializedColor =
  | { type: 'rgb'; r: number; g: number; b: number }
  | { type: 'gray'; g: number }
  | { type: 'cmyk'; c: number; m: number; y: number; k: number };

export interface SerializedTextRun {
  id: string;
  pageIndex: number;
  text: string;
  fontName?: string;
  fontResource: string;
  fontSize: number;
  color: SerializedColor;
  transformMatrix: [number, number, number, number, number, number];
  boundingBox: { x: number; y: number; width: number; height: number };
  charSpacing?: number;
  wordSpacing?: number;
}

export interface SerializedExtractionResult {
  pageIndex: number;
  extractionMs: number;
  runCount: number;
  warnings: string[];
  runs: SerializedTextRun[];
}

type WorkerResponse =
  | { type: 'pong'; requestId: string }
  | { type: 'extractTextResult'; requestId: string; result: SerializedExtractionResult }
  | { type: 'error'; requestId: string; message: string };

// ─── Worker Singleton ─────────────────────────────────────────────────────────

let _worker: Worker | null = null;
let _workerReady = false;

/** Lazily creates and returns the shared mupdf Web Worker. */
function getWorker(): Worker {
  if (_worker) return _worker;
  _worker = new Worker(
    new URL('../../../../workers/mupdf/mupdf.worker', import.meta.url),
    { type: 'module' },
  );
  _workerReady = true;
  return _worker;
}

/** Terminates the shared worker — call this on document unload if needed. */
export function destroyWorker(): void {
  _worker?.terminate();
  _worker = null;
  _workerReady = false;
}

// ─── Request/Response Correlation ────────────────────────────────────────────

let _nextId = 0;
const _pending = new Map<string, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();

function initWorkerListener(worker: Worker): void {
  if ((worker as Worker & { _listenerAttached?: boolean })._listenerAttached) return;
  (worker as Worker & { _listenerAttached?: boolean })._listenerAttached = true;

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const res = event.data;
    const pending = _pending.get(res.requestId);
    if (!pending) return;
    _pending.delete(res.requestId);
    if (res.type === 'error') {
      pending.reject(new Error(res.message));
    } else {
      pending.resolve(res);
    }
  });

  worker.addEventListener('error', (event: ErrorEvent) => {
    console.error('[MupdfTextExtractor] Worker error:', event.message);
    // Reject all pending requests.
    for (const [id, p] of _pending) {
      p.reject(new Error(`Worker error: ${event.message}`));
      _pending.delete(id);
    }
  });
}

function sendRequest(worker: Worker, request: object): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const requestId = `req-${_nextId++}`;
    _pending.set(requestId, { resolve, reject });
    worker.postMessage({ ...request, requestId });
  });
}

// ─── Color Deserialization ────────────────────────────────────────────────────

function deserializeColor(c: SerializedColor): PdfColor {
  switch (c.type) {
    case 'rgb':
      return { type: 'rgb', r: c.r, g: c.g, b: c.b } satisfies RGBColor;
    case 'gray':
      return { type: 'gray', g: c.g } satisfies GrayColor;
    case 'cmyk':
      return { type: 'cmyk', c: c.c, m: c.m, y: c.y, k: c.k };
    default:
      // Exhaustive guard — should never reach here with valid worker data.
      return { type: 'gray', g: 0 };
  }
}

function deserializeRun(r: SerializedTextRun): TextRun {
  return {
    id: r.id,
    pageIndex: r.pageIndex,
    text: r.text,
    fontName: r.fontName,
    fontResource: r.fontResource,
    fontSize: r.fontSize,
    color: deserializeColor(r.color),
    transformMatrix: r.transformMatrix,
    boundingBox: r.boundingBox as BoundingBox,
    charSpacing: r.charSpacing,
    wordSpacing: r.wordSpacing,
  };
}

function deserializeResult(raw: SerializedExtractionResult): ExtractionResult {
  const runs: TextRun[] = raw.runs.map(deserializeRun);
  const model: PageContentModel = { pageIndex: raw.pageIndex, runs };
  return { model, extractionMs: raw.extractionMs, warnings: raw.warnings };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts structured text runs from a single PDF page using mupdf-wasm
 * running in a Web Worker.
 *
 * @param pdfBytes - Raw bytes of the PDF (from FileReader / ArrayBuffer).
 * @param pageIndex - 0-based page index to extract.
 * @returns ExtractionResult with TextRun[] and timing data.
 */
export async function extractTextRuns(
  pdfBytes: ArrayBuffer | Uint8Array,
  pageIndex: number,
): Promise<ExtractionResult> {
  const worker = getWorker();
  initWorkerListener(worker);

  // Transfer the buffer to the worker (zero-copy).
  const buffer = pdfBytes instanceof Uint8Array ? pdfBytes.buffer : pdfBytes;

  const response = await sendRequest(worker, {
    type: 'extractText',
    pdfBytes: buffer,
    pageIndex,
  });

  if (response.type !== 'extractTextResult') {
    throw new Error(`[MupdfTextExtractor] Unexpected response type: ${response.type}`);
  }

  return deserializeResult(response.result);
}

// ─── JSON Schema Helper ────────────────────────────────────────────────────────

/**
 * Returns a JSON-serializable snapshot of an ExtractionResult.
 * Useful for console logging during the spike.
 */
export function serializeExtractionResult(result: ExtractionResult): object {
  return {
    pageIndex: result.model.pageIndex,
    extractionMs: result.extractionMs,
    runCount: result.model.runs.length,
    warnings: result.warnings,
    runs: result.model.runs.map((r) => ({
      id: r.id,
      text: r.text,
      fontResource: r.fontResource,
      fontSize: r.fontSize,
      color: r.color,
      transformMatrix: r.transformMatrix,
      boundingBox: r.boundingBox,
      charSpacing: r.charSpacing,
      wordSpacing: r.wordSpacing,
    })),
  };
}
