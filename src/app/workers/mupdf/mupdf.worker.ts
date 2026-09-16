/**
 * mupdf.worker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Web Worker host for mupdf-wasm operations.
 *
 * WHY A WORKER?
 * mupdf's JS wrapper (mupdf.js) uses top-level `await` which is incompatible
 * with Zone.js-based Angular builds (esbuild error: "Top-level await is not
 * available…"). Running mupdf inside a Web Worker sidesteps this because
 * workers are not Zone.js-patched and esbuild treats worker bundles separately.
 *
 * This also satisfies PRD §19 / AGENTS.md §6: Web Workers for heavy PDF processing.
 *
 * HOW MUPDF IS LOADED IN THE WORKER:
 * mupdf.js uses top-level await internally which esbuild cannot bundle for
 * browser targets that include Zone.js. To work around this, we dynamically
 * import mupdf using a script evaluated at runtime inside the worker, which
 * runs as its own ES module scope and is not subject to the bundler's target
 * constraints.
 *
 * ARCHITECTURE:
 *   Angular UI → MupdfWorkerClient (postMessage) → this worker → mupdf-wasm
 */

// ─── Message Protocol ─────────────────────────────────────────────────────────
// These types are inlined here and mirrored in mupdf-text-extractor.ts.

export type SerializedColor =
  | { type: 'rgb'; r: number; g: number; b: number }
  | { type: 'gray'; g: number }
  | { type: 'cmyk'; c: number; m: number; y: number; k: number };

export interface SerializedTextRun {
  id: string;
  pageIndex: number;
  text: string;
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

export type WorkerRequest =
  | { type: 'ping'; requestId: string }
  | { type: 'extractText'; requestId: string; pdfBytes: ArrayBuffer; pageIndex: number };

export type WorkerResponse =
  | { type: 'pong'; requestId: string }
  | { type: 'extractTextResult'; requestId: string; result: SerializedExtractionResult }
  | { type: 'error'; requestId: string; message: string };

// ─── mupdf Loading (dynamic import inside worker scope) ──────────────────────
//
// We use a dynamic import() inside the worker to load mupdf. Inside a Web
// Worker, the bundler does not apply Zone.js transforms, and top-level await
// in the mupdf module runs cleanly.
//
// The key trick: by using `import()` inside an async function (not top-level),
// we avoid the esbuild top-level-await error in the worker bundle itself.

type MuPdfModule = typeof import('mupdf');

let _mupdf: MuPdfModule | null = null;

async function getMupdf(): Promise<MuPdfModule> {
  if (_mupdf) return _mupdf;
  // In a Web Worker module, this dynamic import is not subject to
  // Angular's Zone.js top-level-await restriction.
  const mod = await import(/* webpackIgnore: true */ 'mupdf');
  _mupdf = ('default' in mod ? mod.default : mod) as unknown as MuPdfModule;
  return _mupdf;
}

// ─── Color Conversion ─────────────────────────────────────────────────────────

function convertColor(color: number[]): SerializedColor {
  switch (color.length) {
    case 1:
      return { type: 'gray', g: color[0] };
    case 3:
      return { type: 'rgb', r: color[0], g: color[1], b: color[2] };
    case 4:
      return { type: 'cmyk', c: color[0], m: color[1], y: color[2], k: color[3] };
    default:
      return { type: 'gray', g: 0 };
  }
}

// ─── Span Accumulator ─────────────────────────────────────────────────────────

interface Accumulator {
  text: string;
  fontName: string;
  fontSize: number;
  color: SerializedColor;
  transformMatrix: [number, number, number, number, number, number];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function colorKey(c: SerializedColor): string {
  return JSON.stringify(c);
}

// ─── Core Extraction Logic ────────────────────────────────────────────────────

async function doExtract(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
): Promise<SerializedExtractionResult> {
  const t0 = performance.now();
  const warnings: string[] = [];
  const mupdf = await getMupdf();

  const doc = mupdf.PDFDocument.openDocument(
    new Uint8Array(pdfBytes),
    'application/pdf',
  ) as InstanceType<typeof mupdf.PDFDocument>;

  const pageCount = doc.countPages();
  if (pageIndex < 0 || pageIndex >= pageCount) {
    doc.destroy();
    throw new RangeError(`pageIndex ${pageIndex} out of range [0, ${pageCount - 1}]`);
  }

  const page = doc.loadPage(pageIndex);
  const stext = page.toStructuredText('preserve-spans');

  const runs: SerializedTextRun[] = [];
  let runIndex = 0;
  let current: Accumulator | null = null;
  let currentKey = '';

  const flush = () => {
    if (!current) return;
    const rawWidth = Math.max(0, current.maxX - current.minX);
    const rawHeight = Math.max(0, current.maxY - current.minY);
    const rawY = current.minY;
    const rawX = current.minX;

    // If size is abnormally small (e.g. 1pt or <= 2pt) due to font matrix scaling while boundingBox height is normal (>= 4pt), use rawHeight
    const effectiveSize =
      current.fontSize <= 2 && rawHeight >= 4
        ? Math.round(rawHeight * 100) / 100
        : current.fontSize;

    // In PDF typography, MuPDF's char quad spans the full font em-box including
    // line-gap and ascender/descender margins, which can be 1.3x–1.5x the font size.
    // On large fonts this causes oversized top/bottom boxes that overlap adjacent lines.
    // We constrain the box height to a tight natural line height (max ~1.08 * fontSize)
    // and adjust Y so the background color fits snugly without overlapping other text.
    let y = rawY;
    let height = rawHeight;
    const maxTightHeight = Math.round(effectiveSize * 1.08 * 100) / 100;
    if (effectiveSize >= 4 && rawHeight > maxTightHeight) {
      const diff = rawHeight - maxTightHeight;
      y = Math.round((rawY + diff * 0.55) * 100) / 100;
      height = maxTightHeight;
    }

    const bb = {
      x: rawX,
      y,
      width: rawWidth,
      height,
    };
    runs.push({
      id: `p${pageIndex}-r${runIndex}`,
      pageIndex,
      text: current.text,
      fontName: current.fontName,
      // ⚠️ Unresolved: mupdf gives PostScript name, not PDF resource key.
      // Prefixed "~" to signal unresolved state. Fixed in Prompt 3.
      fontResource: `~${current.fontName}`,
      fontSize: effectiveSize,
      color: current.color,
      transformMatrix: current.transformMatrix,
      boundingBox: bb,
    });
    runIndex++;
    current = null;
    currentKey = '';
  };

  stext.walk({
    beginTextBlock() { flush(); },
    beginLine() { flush(); },
    onChar(c: string, _origin: unknown, font: { getName(): string }, size: number, quad: number[], color: number[], _bidi: number) {
      const charColor = convertColor(color);
      const fontName = font.getName();
      // Round size to 2 decimal places to preserve decimal font sizes (e.g. 10.5, 9.75) while preventing float jitter
      const normSize = Math.round(size * 100) / 100;
      const key = `${fontName}|${normSize}|${colorKey(charColor)}`;
      const qX = [quad[0], quad[2], quad[4], quad[6]];
      const qY = [quad[1], quad[3], quad[5], quad[7]];
      if (key !== currentKey) {
        flush();
        const llX = quad[4], llY = quad[5], lrX = quad[6], lrY = quad[7];
        const dx = lrX - llX, dy = lrY - llY;
        const len = Math.hypot(dx, dy) || 1;
        const cosA = dx / len, sinA = dy / len;
        current = {
          text: c,
          fontName,
          fontSize: normSize,
          color: charColor,
          transformMatrix: [cosA, sinA, -sinA, cosA, llX, llY],
          minX: Math.min(...qX),
          minY: Math.min(...qY),
          maxX: Math.max(...qX),
          maxY: Math.max(...qY),
        };
        currentKey = key;
      } else {
        current!.text += c;
        current!.minX = Math.min(current!.minX, ...qX);
        current!.minY = Math.min(current!.minY, ...qY);
        current!.maxX = Math.max(current!.maxX, ...qX);
        current!.maxY = Math.max(current!.maxY, ...qY);
      }
    },
    endLine() { flush(); },
    endTextBlock() { flush(); },
  });
  flush();

  stext.destroy();
  page.destroy();
  doc.destroy();

  const extractionMs = performance.now() - t0;
  if (extractionMs > 500) {
    warnings.push(`Extraction took ${extractionMs.toFixed(1)}ms — exceeds 500ms target (PRD §6).`);
  }

  return { pageIndex, extractionMs, runCount: runs.length, warnings, runs };
}

// ─── Message Handler ──────────────────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;

  if (req.type === 'ping') {
    self.postMessage({ type: 'pong', requestId: req.requestId } satisfies WorkerResponse);
    return;
  }

  if (req.type === 'extractText') {
    doExtract(req.pdfBytes, req.pageIndex)
      .then((result) => {
        self.postMessage({
          type: 'extractTextResult',
          requestId: req.requestId,
          result,
        } satisfies WorkerResponse);
      })
      .catch((err: unknown) => {
        self.postMessage({
          type: 'error',
          requestId: req.requestId,
          message: String(err),
        } satisfies WorkerResponse);
      });
  }
});
