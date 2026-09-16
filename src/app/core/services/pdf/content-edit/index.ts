/**
 * index.ts — Public API barrel for the Content Edit Engine (v1: Text Editing)
 * ─────────────────────────────────────────────────────────────────────────────
 * The Angular layer imports ONLY from this barrel.
 * New modules are added here as prompts 2–7 are implemented.
 *
 * IMPORTANT: Zero Angular imports anywhere in this directory.
 */

// ─── Data Model (Prompt 1) ────────────────────────────────────────────────────
export type {
  BoundingBox,
  CMYKColor,
  EditCommand,
  ExtractionResult,
  GlyphValidationResult,
  GrayColor,
  PageContentModel,
  PdfColor,
  RGBColor,
  TextRun,
} from './text-run.model';

// ─── mupdf Text Extractor (Prompt 1) ─────────────────────────────────────────
export { extractTextRuns, serializeExtractionResult } from './mupdf-text-extractor';

// ─── Font Subset Analyzer (Prompt 2) ─────────────────────────────────────────
export {
  analyzeFontsOnPage,
  encodeTextForContentStream,
  parseToUnicodeCMap,
  validateTextAgainstSubset,
  type FontSubsetInfo,
  type ToUnicodeMap,
} from './font-subset-analyzer';

// ─── Font Glyph Resolver + Content Stream Editor (Prompt 2) ──────────────────
export {
  GlyphMissingError,
  GlyphResolver,
  editTextInPdf,
  editTextInStream,
  findTextOperators,
  tokenizeContentStream,
  type EditResult,
  type TextOperatorLocation,
} from './font-glyph-resolver';

// ─── Content Edit Engine v0.1 — Extraction Pipeline (Prompt 3) ───────────────
export {
  extractPageContentModel,
  buildFontResourceMap,
  buildFontSubsetGlyphSet,
  type PageExtractionResult,
} from './content-edit-engine';

// ─── Content Edit Engine v0.1 — Edit + Serialization (Prompt 4) ──────────────
export {
  commitEdit,
  serializeEditedPage,
  PdfLoadError,
  PdfExportError,
  type CommitEditResult,
  type SerializeResult,
} from './content-edit-engine';

// ─── Content Stream Serializer (Prompt 4) ────────────────────────────────────
export {
  rewriteEditedPages,
  applyEditsToStream,
  readPageContentStream,
  type PendingStreamEdit,
  type SerializationResult,
} from './content-stream-serializer';

// ─── Edit History / Undo-Redo (Prompt 4) ────────────────────────────────────
export { EditHistory, applyUndo, applyRedo } from './edit-history';

