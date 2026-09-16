/**
 * text-run.model.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared data model for the pdfforge Content Edit Engine (v1: Text Editing).
 *
 * PRD §8 — Data Model
 * PRD §3 — Decision: one style per run (no per-character styling in v1)
 * PRD §13 Q1 — Decision: block missing glyphs (not silent fallback)
 *
 * IMPORTANT: Zero Angular imports. This file is framework-agnostic and must
 * remain importable from Web Workers and standalone spike harnesses.
 */

// ─── Color Types ────────────────────────────────────────────────────────────

/** RGB color, each component in [0, 1]. */
export interface RGBColor {
  readonly type: 'rgb';
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Grayscale color, value in [0, 1]. */
export interface GrayColor {
  readonly type: 'gray';
  readonly g: number;
}

/** CMYK color, each component in [0, 1]. */
export interface CMYKColor {
  readonly type: 'cmyk';
  readonly c: number;
  readonly m: number;
  readonly y: number;
  readonly k: number;
}

export type PdfColor = RGBColor | GrayColor | CMYKColor;

// ─── Bounding Box ───────────────────────────────────────────────────────────

/**
 * Axis-aligned bounding box in PDF user-space coordinates.
 * Origin is bottom-left (PDF convention). y increases upward.
 */
export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// ─── Text Run ───────────────────────────────────────────────────────────────

/**
 * A TextRun is a contiguous sequence of characters sharing a single font
 * resource, font size, color, and transformation. Grouping is derived
 * directly from mupdf StructuredText spans; we do not invent extra grouping.
 *
 * PRD §5.1 — "A run = a contiguous sequence of characters sharing one font
 * resource + size + color + transform."
 */
export interface TextRun {
  /** Stable ID for this run within a given page extraction. Format: `p{page}-r{index}` */
  readonly id: string;

  /** 0-based page index within the document. */
  readonly pageIndex: number;

  /** Raw Unicode text of this run. */
  readonly text: string;

  /**
   * PDF font resource name as it appears in the page's Resources dict,
   * e.g. "/F1" or "/TT2". Used to write the correct `Tf` operand on export.
   *
   * ⚠️ ARCHITECTURAL NOTE (Prompt 1 finding):
   * mupdf's StructuredText API (onChar callback) gives us the resolved Font
   * object (fz_font) with `getName()` → human-readable PostScript name, but
   * does NOT expose the raw PDF resource key (e.g. "/F1"). That key must be
   * recovered by cross-referencing the page's Resources/Font dictionary via
   * PDFDocument, matching on the font name or object number.
   *
   * In this spike, `fontResource` is populated from Font.getName() as a
   * best-effort placeholder. The Prompt 2 / Engine v0.1 phase will resolve
   * the true resource key via pdf-lib's PDFDocument traversal.
   *
   * Resolution strategy (Prompt 3):
   *   1. Iterate page Resources.Font entries via pdf-lib.
   *   2. For each entry, resolve the font object and read /BaseFont or /Name.
   *   3. Match against mupdf's Font.getName() string.
   *   4. Use the matched key (e.g. "F1") as fontResource.
   */
  readonly fontResource: string;

  /** Resolved PostScript font name (e.g. "Arial-BoldMT", "TimesNewRomanPSMT", "Calibri"). */
  readonly fontName?: string;

  /** Font size in PDF user-space points. */
  readonly fontSize: number;

  /**
   * Fill color of the text. Derived from mupdf's onChar color argument.
   * For stroked text, this may be approximate — v1 only supports filled text.
   */
  readonly color: PdfColor;

  /**
   * The 6-element text matrix [a, b, c, d, e, f] at the start of this run,
   * corresponding to the PDF `Tm` operator. Origin and scale as in PDF spec.
   * mupdf provides this via the Font transform matrix in onChar.
   */
  readonly transformMatrix: readonly [number, number, number, number, number, number];

  /** Bounding box in PDF user-space coordinates. */
  readonly boundingBox: BoundingBox;

  /** Character spacing (PDF `Tc` operand), if available. */
  readonly charSpacing?: number;

  /** Word spacing (PDF `Tw` operand), if available. */
  readonly wordSpacing?: number;

  /**
   * Set of Unicode characters known to be available in the embedded font
   * glyph subset. Populated in Prompt 2 (font-subset-analyzer).
   * undefined = not yet analyzed; empty Set = no information available.
   *
   * Used in Prompt 7 (hardening) to block characters missing from the subset.
   * PRD §7 — "Embedded subset fonts: block the specific character with warning."
   */
  readonly fontSubsetGlyphs?: ReadonlySet<string>;

  /**
   * User-customized style overrides configured via the Properties Panel
   * (e.g. font size, family, colors, spacing, padding, margin/offsets).
   */
  readonly styleOverrides?: TextRunStyleOverrides;
}

// ─── Text Run Style Overrides ───────────────────────────────────────────────

/**
 * Styling adjustments configured on a TextRun via the Properties Panel.
 * All units are in PDF user-space points / proportions.
 */
export interface TextRunStyleOverrides {
  readonly fontSize?: number;
  readonly fontFamily?: string;
  readonly fontWeight?: string | number;
  readonly fontStyle?: 'normal' | 'italic';
  readonly underline?: boolean;
  readonly color?: string;
  readonly backgroundColor?: string;
  readonly backgroundEnabled?: boolean;
  readonly letterSpacing?: number;
  readonly lineHeight?: number;
  readonly paddingX?: number;
  readonly paddingY?: number;
  readonly marginX?: number;
  readonly marginY?: number;
  readonly textAlign?: 'left' | 'center' | 'right';
  readonly textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  readonly opacity?: number;
}

// ─── Page Content Model ─────────────────────────────────────────────────────

/**
 * All text runs extracted from a single PDF page.
 * This is the view model handed to the Angular UI layer.
 */
export interface PageContentModel {
  readonly pageIndex: number;
  readonly runs: readonly TextRun[];
}

// ─── Edit Command ────────────────────────────────────────────────────────────

/**
 * A single user edit: swap the text of a run for new content,
 * preserving all other properties (font, size, color, position).
 * PRD §5.2 — "Typing replaces the run's text content only."
 */
export interface EditCommand {
  readonly runId: string;
  readonly newText: string;
}

// ─── Extraction Result ───────────────────────────────────────────────────────

/**
 * Result returned by the mupdf text extractor.
 * Includes timing data for the Prompt 1 spike performance requirement.
 */
export interface ExtractionResult {
  readonly model: PageContentModel;
  /** Wall-clock milliseconds for the extraction operation. Target: < 500ms. */
  readonly extractionMs: number;
  /** Any warnings encountered during extraction (non-fatal). */
  readonly warnings: readonly string[];
}

// ─── Glyph Validation Result ─────────────────────────────────────────────────

/** Result of checking whether a string is encodable in an embedded font. */
export interface GlyphValidationResult {
  /** true = all characters are available in the font subset */
  readonly valid: boolean;
  /** Characters that are NOT available in the subset (empty if valid). */
  readonly missingChars: readonly string[];
}
