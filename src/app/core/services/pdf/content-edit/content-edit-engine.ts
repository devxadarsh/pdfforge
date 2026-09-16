/**
 * content-edit-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Engine v0.1 — Text Extraction + Edit Application + Export Orchestration
 *
 * Part A (Prompt 3): extractPageContentModel()
 *   Chains mupdf-wasm → pdf-lib font resolution → fontkit glyph analysis.
 *
 * Part B (Prompt 4): commitEdit() + serializeEditedPage()
 *   commitEdit()         — applies a validated text swap to the in-memory model.
 *   serializeEditedPage() — uses content-stream-serializer to write back edits.
 *
 * PRD §5.2 — "Typing replaces the run's text content only."
 * PRD §5.3 — "Reuse the same font resource, size, color, and Tm matrix."
 * PRD §7   — "No reflow in v1. Overflow is acceptable."
 * PRD §13 Q1 — Block missing glyphs (Option A).
 *
 * IMPORTANT: Zero Angular imports. Pure TypeScript module.
 */

import type {
  EditCommand,
  PageContentModel,
  TextRun,
} from './text-run.model';
import { GlyphMissingError } from './font-glyph-resolver';
import { extractTextRuns } from './mupdf-text-extractor';
import { analyzeFontsOnPage, type FontSubsetInfo } from './font-subset-analyzer';
import {
  rewriteEditedPages,
  type PendingStreamEdit,
  type SerializationResult,
  PdfLoadError as _PdfLoadError,
  PdfExportError as _PdfExportError,
} from './content-stream-serializer';
import { measureNaturalTextWidth } from '../../../utilities/font-matcher.util';

// Re-export domain errors so callers only need to import from this file.
export { PdfLoadError, PdfExportError } from './content-stream-serializer';
export { GlyphMissingError } from './font-glyph-resolver';


// ─── Public Result Type ──────────────────────────────────────────────────────

export interface PageExtractionResult {
  /** The structured content model ready for the editor. */
  readonly model: PageContentModel;
  /** Wall-clock time for the entire 3-step pipeline (ms). */
  readonly totalMs: number;
  /** Non-fatal warnings from any step. */
  readonly warnings: readonly string[];
  /** Font information map (key = PDF resource key, e.g. "F1"). */
  readonly fontInfoMap: ReadonlyMap<string, FontSubsetInfo>;
}

// ─── Font Resource Key Resolution (Step 2) ───────────────────────────────────

/**
 * Resolves the true PDF font resource key for each TextRun by cross-referencing
 * the page's Resources/Font dictionary via pdf-lib.
 *
 * mupdf gives us `Font.getName()` → PostScript/family name (e.g. "Helvetica-Bold").
 * pdf-lib lets us enumerate the page's /Font resources, reading /BaseFont from each.
 * We match on the PostScript name (after stripping subset prefixes like "AABBCC+").
 *
 * @returns Map of mupdf PostScript name → PDF resource key (e.g. "Helvetica-Bold" → "F1")
 */
export async function buildFontResourceMap(
  pdfBytes: Uint8Array,
  pageIndex: number,
): Promise<Map<string, string>> {
  const { PDFDocument, PDFName, PDFDict } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const fontResourceMap = new Map<string, string>(); // psName → resourceKey

  const pages = pdfDoc.getPages();
  if (pageIndex >= pages.length) return fontResourceMap;

  const pageNode = pages[pageIndex].node;
  const resourcesObj = pageNode.lookup(PDFName.of('Resources'));
  if (!resourcesObj || !(resourcesObj instanceof PDFDict)) return fontResourceMap;

  const fontDictObj = resourcesObj.lookup(PDFName.of('Font'));
  if (!fontDictObj || !(fontDictObj instanceof PDFDict)) return fontResourceMap;

  for (const [fontKeyName, fontRef] of fontDictObj.entries()) {
    const resourceKey = fontKeyName.asString().replace(/^\//, ''); // e.g. "/F1" → "F1"
    try {
      const fontDict = pdfDoc.context.lookup(fontRef);
      if (!(fontDict instanceof PDFDict)) continue;

      // Resolve /BaseFont (for Type1/TrueType/Type0) or /Name (for Type3).
      // /BaseFont is the PostScript name of the font, possibly with a subset
      // prefix like "AABBCC+TimesNewRoman".
      const baseFont = fontDict.lookup(PDFName.of('BaseFont'));
      if (baseFont) {
        const rawName = baseFont.toString().replace('/', '');
        // Strip subset prefix (6 uppercase letters + "+").
        const psName = rawName.replace(/^[A-Z]{6}\+/, '');
        fontResourceMap.set(psName, resourceKey);
        // Also store the raw name as a fallback.
        if (rawName !== psName) fontResourceMap.set(rawName, resourceKey);
      }

      // For Type0 (composite) fonts, also check DescendantFonts.
      const subtype = fontDict.lookup(PDFName.of('Subtype'));
      if (subtype?.toString() === '/Type0') {
        const descendantsRef = fontDict.lookup(PDFName.of('DescendantFonts'));
        if (descendantsRef) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const arr = pdfDoc.context.lookup(descendantsRef) as any;
          if (arr && typeof arr.get === 'function') {
            const cidFontRef = arr.get(0);
            const cidFont = pdfDoc.context.lookup(cidFontRef);
            if (cidFont instanceof PDFDict) {
              const cidBaseFont = cidFont.lookup(PDFName.of('BaseFont'));
              if (cidBaseFont) {
                const rawName = cidBaseFont.toString().replace('/', '');
                const psName = rawName.replace(/^[A-Z]{6}\+/, '');
                fontResourceMap.set(psName, resourceKey);
                if (rawName !== psName) fontResourceMap.set(rawName, resourceKey);
              }
            }
          }
        }
      }
    } catch {
      // Non-fatal — skip this font entry.
    }
  }

  return fontResourceMap;
}

// ─── Glyph Set Builder (Step 3) ──────────────────────────────────────────────

/**
 * Builds the fontSubsetGlyphs set for a single TextRun using the FontSubsetInfo
 * from font-subset-analyzer.
 *
 * @param fontInfo - FontSubsetInfo for the run's font resource.
 * @returns ReadonlySet<string> of available Unicode characters.
 */
export function buildFontSubsetGlyphSet(fontInfo: FontSubsetInfo): ReadonlySet<string> {
  return fontInfo.availableChars;
}

// ─── Main Extraction Pipeline ─────────────────────────────────────────────────

/**
 * Extracts a fully resolved `PageContentModel` for a single PDF page.
 *
 * Pipeline:
 *   1. mupdf-wasm → raw TextRun[] (fontResource = "~PostScriptName")
 *   2. pdf-lib    → font resource key map (resolves "~Helvetica" → "F1")
 *   3. fontkit    → glyph subset analysis (populates fontSubsetGlyphs)
 *
 * @param pdfBytes  - Raw PDF bytes.
 * @param pageIndex - 0-based page index to extract.
 * @returns PageExtractionResult with fully populated TextRun[].
 */
export async function extractPageContentModel(
  pdfBytes: ArrayBuffer | Uint8Array,
  pageIndex: number,
): Promise<PageExtractionResult> {
  const t0 = performance.now();
  const warnings: string[] = [];

  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);

  // ── Step 1: mupdf extraction ──────────────────────────────────────────────
  const extractionResult = await extractTextRuns(bytes, pageIndex);
  warnings.push(...extractionResult.warnings);

  // ── Step 2: Font resource key resolution ──────────────────────────────────
  const fontResourceMap = await buildFontResourceMap(bytes, pageIndex);

  // ── Step 3: Font subset analysis ─────────────────────────────────────────
  let fontInfoMap: Map<string, FontSubsetInfo>;
  try {
    fontInfoMap = await analyzeFontsOnPage(bytes, pageIndex);
  } catch (e) {
    warnings.push(`Font subset analysis failed: ${String(e)}`);
    fontInfoMap = new Map();
  }

  // ── Enrich runs ───────────────────────────────────────────────────────────
  const enrichedRuns: TextRun[] = extractionResult.model.runs.map((run) => {
    // Resolve fontResource: strip "~" prefix, look up in fontResourceMap.
    const mupdfPsName = run.fontResource.startsWith('~')
      ? run.fontResource.slice(1)
      : run.fontResource;

    const directKey = fontResourceMap.get(mupdfPsName);
    const match = directKey
      ? { resourceKey: directKey, psName: mupdfPsName }
      : fuzzyMatchFont(mupdfPsName, fontResourceMap);

    const fuzzyKey = match?.resourceKey ?? null;
    const fontResource = fuzzyKey ?? run.fontResource; // Keep "~" prefix if still unresolved.

    if (!fuzzyKey) {
      warnings.push(`Could not resolve font resource key for "${mupdfPsName}" — using mupdf name as fallback.`);
    }

    // Populate glyph subset.
    const fontInfo = fuzzyKey ? fontInfoMap.get(fuzzyKey) : undefined;
    const fontSubsetGlyphs = fontInfo ? buildFontSubsetGlyphSet(fontInfo) : undefined;

    // Prioritize the actual PDF BaseFont name (e.g. Times-Roman, Helvetica, Calibri)
    // instead of MuPDF's internal fallback substitution font name (e.g. DejaVuSerif)
    const resolvedFontName = match?.psName || fontInfo?.postscriptName || mupdfPsName;

    return {
      ...run,
      fontName: resolvedFontName,
      fontResource,
      fontSubsetGlyphs,
    };
  });

  const model: PageContentModel = {
    pageIndex: extractionResult.model.pageIndex,
    runs: enrichedRuns,
  };

  return {
    model,
    totalMs: performance.now() - t0,
    warnings,
    fontInfoMap,
  };
}

// ─── Fuzzy Font Name Matching ─────────────────────────────────────────────────

/**
 * Tries to match a mupdf PostScript name against the fontResourceMap using
 * case-insensitive substring matching and fallback font translation.
 * Handles common name normalization differences (e.g. "TimesNewRoman" vs "Times-Roman")
 * as well as MuPDF's bundled fallback font substitutions (e.g. "DejaVuSerif" → "Times-Roman").
 *
 * Returns the PDF resource key and matched PDF BaseFont name if a match is found, otherwise null.
 */
function fuzzyMatchFont(
  mupdfName: string,
  fontResourceMap: Map<string, string>,
): { resourceKey: string; psName: string } | null {
  const normalized = mupdfName.toLowerCase().replace(/[-_\s]/g, '');

  // 1. Direct or substring match against declared PDF BaseFont names
  for (const [psName, resourceKey] of fontResourceMap) {
    const candNorm = psName.toLowerCase().replace(/[-_\s]/g, '');
    if (candNorm === normalized || candNorm.includes(normalized) || normalized.includes(candNorm)) {
      return { resourceKey, psName };
    }
  }

  // 2. MuPDF / Ghostscript fallback substitute font resolution
  // If MuPDF returned DejaVuSerif or NimbusRoman, it was substituting for a Serif font in the PDF
  if (
    normalized.includes('dejavuserif') ||
    normalized.includes('nimbusrom') ||
    (normalized.includes('dejavu') && normalized.includes('serif'))
  ) {
    for (const [psName, resourceKey] of fontResourceMap) {
      const p = psName.toLowerCase();
      if (
        p.includes('times') ||
        p.includes('roman') ||
        p.includes('georgia') ||
        p.includes('garamond') ||
        p.includes('cambria') ||
        p.includes('serif') ||
        p.includes('baskerville') ||
        p.includes('palatino')
      ) {
        return { resourceKey, psName };
      }
    }
  }

  // If MuPDF returned DejaVuSansMono or NimbusMono, it was substituting for a Monospace font in the PDF
  if (
    normalized.includes('dejavusansmono') ||
    normalized.includes('nimbusmon') ||
    (normalized.includes('dejavu') && normalized.includes('mono'))
  ) {
    for (const [psName, resourceKey] of fontResourceMap) {
      const p = psName.toLowerCase();
      if (
        p.includes('courier') ||
        p.includes('mono') ||
        p.includes('consolas') ||
        p.includes('typewriter')
      ) {
        return { resourceKey, psName };
      }
    }
  }

  // If MuPDF returned DejaVuSans or NimbusSans, it was substituting for a Sans font in the PDF
  if (
    normalized.includes('dejavusans') ||
    normalized.includes('nimbussan') ||
    normalized.includes('dejavu')
  ) {
    for (const [psName, resourceKey] of fontResourceMap) {
      const p = psName.toLowerCase();
      if (
        p.includes('helvetica') ||
        p.includes('arial') ||
        p.includes('calibri') ||
        p.includes('verdana') ||
        p.includes('tahoma') ||
        p.includes('sans')
      ) {
        return { resourceKey, psName };
      }
    }
  }

  // 3. If there is only one unique font resource on the page, any run on that page belongs to it
  const uniqueKeys = new Set(fontResourceMap.values());
  if (uniqueKeys.size === 1) {
    const firstEntry = fontResourceMap.entries().next().value;
    if (firstEntry) {
      return { resourceKey: firstEntry[1], psName: firstEntry[0] };
    }
  }

  return null;
}

// ─── Part B: commitEdit ───────────────────────────────────────────────────────

/**
 * Result of a commitEdit() call.
 */
export interface CommitEditResult {
  /** The new PageContentModel with the run's text updated. */
  readonly model: PageContentModel;
  /**
   * The PendingStreamEdit ready to pass to serializeEditedPage().
   * Undefined if the run's font info is unavailable (caller should warn).
   */
  readonly pendingEdit: PendingStreamEdit | undefined;
}

/**
 * Applies an EditCommand to the in-memory PageContentModel.
 *
 * Validates that every character in `command.newText` is present in
 * `run.fontSubsetGlyphs`. If not, throws `GlyphMissingError`.
 *
 * Returns a new (immutable) PageContentModel with the run updated, plus
 * a PendingStreamEdit record for the serializer.
 *
 * PRD §5.2 — "Typing replaces the run's text content only."
 * PRD §5.3 — "Reuse the same font resource, size, color, and Tm matrix."
 * PRD §13 Q1 — Block missing glyphs (Option A).
 *
 * @param model   - Current page content model.
 * @param command - The edit to apply.
 * @param fontInfoMap - Font info map from the extraction result (provides encoding).
 * @throws GlyphMissingError if any character is not in the embedded font subset.
 * @throws RangeError if the runId is not found in the model.
 */
export function commitEdit(
  model: PageContentModel,
  command: EditCommand,
  fontInfoMap: ReadonlyMap<string, FontSubsetInfo>,
): CommitEditResult {
  // Find the target run.
  const runIndex = model.runs.findIndex((r) => r.id === command.runId);
  if (runIndex === -1) {
    throw new RangeError(`Run "${command.runId}" not found in page ${model.pageIndex}.`);
  }

  const run = model.runs[runIndex];
  const cleanedNewText = command.newText.replace(/[\r\n]+/g, '');

  // Validate glyph availability.
  if (run.fontSubsetGlyphs && run.fontSubsetGlyphs.size > 0) {
    const missing: string[] = [];
    for (const char of cleanedNewText) {
      if (char === ' ' || char === '\t' || char === '\u00A0') continue;
      if (!run.fontSubsetGlyphs.has(char)) missing.push(char);
    }
    if (missing.length > 0) {
      throw new GlyphMissingError(
        `Cannot apply edit: character(s) ${missing.map((c) => `"${c}"`).join(', ')} ` +
        `are not in the embedded font subset for "${run.fontResource}".`,
        missing,
      );
    }
  }

  // Adjust boundingBox width proportionally when text changes so the text area
  // increases or decreases to match the updated text.
  let newBoundingBox = run.boundingBox;
  if (cleanedNewText !== run.text) {
    const rawFontName = run.fontName || run.fontResource;
    const measuredOrig = measureNaturalTextWidth(run.text, run.fontSize, rawFontName);
    const measuredNew = measureNaturalTextWidth(cleanedNewText, run.fontSize, rawFontName);
    if (measuredOrig > 0 && measuredNew > 0) {
      const ratio = measuredNew / measuredOrig;
      newBoundingBox = {
        ...run.boundingBox,
        width: Math.max(4, Math.round(run.boundingBox.width * ratio * 100) / 100),
      };
    } else {
      newBoundingBox = {
        ...run.boundingBox,
        width: Math.max(4, measuredNew),
      };
    }
  }

  // Build updated run (immutable object spread).
  const updatedRun: TextRun = {
    ...run,
    text: cleanedNewText,
    boundingBox: newBoundingBox,
  };

  // Build new runs array.
  const newRuns = [
    ...model.runs.slice(0, runIndex),
    updatedRun,
    ...model.runs.slice(runIndex + 1),
  ];

  const newModel: PageContentModel = {
    pageIndex: model.pageIndex,
    runs: newRuns,
  };

  // Build PendingStreamEdit for the serializer.
  // operatorIndex = runIndex (mupdf run index maps to Tj/TJ operator index).
  const fontInfo = fontInfoMap.get(run.fontResource);
  const pendingEdit: PendingStreamEdit | undefined = fontInfo
    ? { operatorIndex: runIndex, newText: cleanedNewText, fontInfo }
    : undefined;

  return { model: newModel, pendingEdit };
}

// ─── Part B: serializeEditedPage ─────────────────────────────────────────────

/**
 * Result of serializeEditedPage().
 */
export interface SerializeResult {
  /** The modified PDF bytes as an ArrayBuffer. */
  readonly pdfBytes: ArrayBuffer;
  /** Per-page serialization summaries. */
  readonly results: readonly SerializationResult[];
}

/**
 * Writes the edits recorded via commitEdit() back into the PDF file.
 *
 * Only pages that have pending edits are re-serialized. All other pages
 * pass through unchanged via pdf-lib's object graph.
 *
 * Usage pattern (Prompt 5):
 * ```ts
 * const extracted = await extractPageContentModel(bytes, 0);
 * const { model, pendingEdit } = commitEdit(extracted.model, cmd, extracted.fontInfoMap);
 * if (pendingEdit) {
 *   const { pdfBytes } = await serializeEditedPage(
 *     bytes,
 *     model.pageIndex,
 *     [pendingEdit],
 *   );
 *   triggerDownload(pdfBytes);
 * }
 * ```
 *
 * @param originalPdfBytes - The source PDF (not mutated).
 * @param pageIndex        - 0-based index of the page to rewrite.
 * @param pendingEdits     - Edits to apply (from commitEdit()).
 * @returns Modified PDF as ArrayBuffer.
 * @throws PdfLoadError  if the PDF cannot be loaded.
 * @throws PdfExportError if saving the modified PDF fails.
 */
export async function serializeEditedPage(
  originalPdfBytes: ArrayBuffer | Uint8Array,
  pageIndex: number,
  pendingEdits: readonly PendingStreamEdit[],
): Promise<SerializeResult> {
  const bytes = originalPdfBytes instanceof Uint8Array
    ? originalPdfBytes
    : new Uint8Array(originalPdfBytes);

  const editsByPage = new Map<number, readonly PendingStreamEdit[]>([[pageIndex, pendingEdits]]);

  const { pdfBytes, results } = await rewriteEditedPages(bytes, editsByPage);

  return { pdfBytes, results };
}
