/**
 * font-glyph-resolver.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompt 2 Spike — Glyph Availability Checker + Content Stream Re-Serialization
 *
 * Provides:
 *   1. GlyphResolver — validates text against a font subset and blocks missing
 *      characters (PRD §13 Q1 Decision: Option A — Block).
 *   2. ContentStreamEditor — locates Tj/TJ text operators in a PDF page content
 *      stream and replaces their string operands with new encoded text.
 *
 * PRD §5.3 — "The exported content stream must reuse the same font resource name,
 *             same font size operand (Tf), and same color-setting operator."
 * PRD §5.2 — "Typing replaces the run's text content only."
 *
 * ── CONTENT STREAM EDITING STRATEGY ─────────────────────────────────────────
 *
 * We operate at the byte level on the raw decompressed content stream.
 * The approach:
 *   1. Decompress the page's content stream(s) via pdf-lib's decodePDFRawStream.
 *   2. Tokenize the stream text, locating Tj / TJ operators and their operands.
 *   3. Identify the target operator (matched by run index from mupdf extraction).
 *   4. Replace the string operand bytes using the ToUnicode reverse map.
 *   5. Re-assemble the stream and write it back as a new PDFRawStream.
 *   6. pdf-lib handles re-compressing (or we write uncompressed for the spike).
 *
 * ── SPIKE SCOPE ──────────────────────────────────────────────────────────────
 * This spike edits ONE run in ONE page content stream. Multi-run / multi-page
 * editing is the Engine v0.1 scope (Prompts 3–4).
 *
 * IMPORTANT: Zero Angular imports. Framework-agnostic module.
 */

import {
  type FontSubsetInfo,
  type ToUnicodeMap,
  encodeTextForContentStream,
  validateTextAgainstSubset,
} from './font-subset-analyzer';
import type { GlyphValidationResult } from './text-run.model';

// ─── GlyphResolver ────────────────────────────────────────────────────────────

/**
 * Validates whether a proposed new text string can be safely encoded in a given
 * font's subset and provides the byte encoding if valid.
 *
 * PRD §13 Q1 Decision: BLOCK characters not in the subset (Option A).
 */
export class GlyphResolver {
  constructor(private readonly subsetInfo: FontSubsetInfo) {}

  /**
   * Checks whether `newText` is fully encodable in this font's subset.
   * @returns GlyphValidationResult with missingChars if any are blocked.
   */
  validate(newText: string): GlyphValidationResult {
    return validateTextAgainstSubset(newText, this.subsetInfo);
  }

  /**
   * Encodes `newText` to the byte sequence for the PDF content stream.
   * Returns null if any character is missing (you should call validate() first).
   */
  encode(newText: string): Uint8Array | null {
    return encodeTextForContentStream(newText, this.subsetInfo);
  }

  /**
   * Returns a human-readable warning message for missing glyphs.
   * Used by the Angular UI to display a toast notification.
   */
  static missingGlyphWarning(missingChars: readonly string[]): string {
    const chars = missingChars.map((c) => `"${c}"`).join(', ');
    return (
      `Character${missingChars.length > 1 ? 's' : ''} ${chars} ` +
      `cannot be typed here — not available in this embedded font subset. ` +
      `Only characters from the original document can be used.`
    );
  }
}

// ─── Content Stream Token Types ───────────────────────────────────────────────

type TokenType = 'literal-string' | 'hex-string' | 'name' | 'number' | 'operator' | 'array-open' | 'array-close' | 'whitespace' | 'comment';

interface Token {
  type: TokenType;
  raw: string;       // Raw bytes as they appear in the stream.
  value?: string;    // Decoded value for strings/names.
  startPos: number;  // Byte offset in the stream.
}

// ─── Content Stream Tokenizer ─────────────────────────────────────────────────

/**
 * Minimal PDF content stream tokenizer.
 * Recognizes: literal strings (), hex strings <>, arrays [], names /, numbers,
 * operators (bare alphabetic tokens), comments (%), whitespace.
 *
 * This is NOT a full PDF parser — it handles the subset of operators that appear
 * in text-rendering content streams (BT/ET blocks).
 */
function tokenizeContentStream(text: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < text.length) {
    const char = text[pos];

    // Whitespace.
    if (/\s/.test(char)) {
      let end = pos;
      while (end < text.length && /\s/.test(text[end])) end++;
      tokens.push({ type: 'whitespace', raw: text.slice(pos, end), startPos: pos });
      pos = end;
      continue;
    }

    // Comment.
    if (char === '%') {
      let end = pos;
      while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end++;
      tokens.push({ type: 'comment', raw: text.slice(pos, end), startPos: pos });
      pos = end;
      continue;
    }

    // Literal string: (...)
    if (char === '(') {
      const { raw, value, end } = readLiteralString(text, pos);
      tokens.push({ type: 'literal-string', raw, value, startPos: pos });
      pos = end;
      continue;
    }

    // Hex string: <...> (but not <<, which is a dict).
    if (char === '<' && text[pos + 1] !== '<') {
      const end = text.indexOf('>', pos + 1) + 1;
      const raw = text.slice(pos, end);
      const hexContent = raw.slice(1, -1).replace(/\s/g, '');
      let value = '';
      for (let i = 0; i < hexContent.length; i += 2) {
        const byte = hexContent.length > i + 1
          ? hexContent.slice(i, i + 2)
          : hexContent[i] + '0';
        value += String.fromCharCode(parseInt(byte, 16));
      }
      tokens.push({ type: 'hex-string', raw, value, startPos: pos });
      pos = end;
      continue;
    }

    // Dict open <<.
    if (char === '<' && text[pos + 1] === '<') {
      tokens.push({ type: 'operator', raw: '<<', startPos: pos });
      pos += 2;
      continue;
    }

    // Dict close >>.
    if (char === '>' && text[pos + 1] === '>') {
      tokens.push({ type: 'operator', raw: '>>', startPos: pos });
      pos += 2;
      continue;
    }

    // Array open/close.
    if (char === '[') { tokens.push({ type: 'array-open', raw: '[', startPos: pos }); pos++; continue; }
    if (char === ']') { tokens.push({ type: 'array-close', raw: ']', startPos: pos }); pos++; continue; }

    // Name.
    if (char === '/') {
      let end = pos + 1;
      while (end < text.length && !/[\s\[\]()<>{}/%]/.test(text[end])) end++;
      const raw = text.slice(pos, end);
      tokens.push({ type: 'name', raw, value: raw.slice(1), startPos: pos });
      pos = end;
      continue;
    }

    // Number (including leading sign and decimal point).
    if (/[-+.0-9]/.test(char)) {
      let end = pos + 1;
      while (end < text.length && /[.0-9]/.test(text[end])) end++;
      tokens.push({ type: 'number', raw: text.slice(pos, end), startPos: pos });
      pos = end;
      continue;
    }

    // Operator (bare alphabetic + "'" and '"').
    if (/[A-Za-z'"]/.test(char)) {
      let end = pos + 1;
      while (end < text.length && /[A-Za-z*'"]/.test(text[end])) end++;
      tokens.push({ type: 'operator', raw: text.slice(pos, end), startPos: pos });
      pos = end;
      continue;
    }

    // Skip unrecognized characters.
    pos++;
  }

  return tokens;
}

/** Reads a PDF literal string (balanced parens, escape sequences). */
function readLiteralString(text: string, start: number): { raw: string; value: string; end: number } {
  let pos = start + 1; // Skip opening '('.
  let depth = 1;
  let value = '';
  let raw = '(';

  while (pos < text.length && depth > 0) {
    const c = text[pos];
    raw += c;

    if (c === '\\') {
      // Escape sequence.
      const next = text[pos + 1] ?? '';
      raw += next;
      pos += 2;
      switch (next) {
        case 'n': value += '\n'; break;
        case 'r': value += '\r'; break;
        case 't': value += '\t'; break;
        case 'b': value += '\b'; break;
        case 'f': value += '\f'; break;
        case '(': value += '('; break;
        case ')': value += ')'; break;
        case '\\': value += '\\'; break;
        default:
          // Octal escape: \ddd
          if (/[0-7]/.test(next)) {
            let octal = next;
            if (/[0-7]/.test(text[pos])) { octal += text[pos]; raw += text[pos]; pos++; }
            if (/[0-7]/.test(text[pos])) { octal += text[pos]; raw += text[pos]; pos++; }
            value += String.fromCharCode(parseInt(octal, 8));
          } else {
            value += next;
          }
      }
      continue;
    }

    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) { pos++; break; }
    } else {
      value += c;
    }
    pos++;
  }

  return { raw, value, end: pos };
}

// ─── Text Operator Locator ────────────────────────────────────────────────────

export interface TextOperatorLocation {
  /** The Tj/TJ/'/\" operator token index in the token array. */
  operatorIndex: number;
  /** The string/array token index immediately preceding the operator. */
  operandIndex: number;
  /** The operator name. */
  operator: 'Tj' | 'TJ' | "'" | '"';
  /** Current decoded text (as rendered on the page). */
  currentText: string;
  /** The font active at this operator (from most recent Tf token). */
  activeFontKey: string;
}

/**
 * Locates all Tj / TJ / ' / " operators in a tokenized content stream,
 * tracking the active font at each point.
 */
export function findTextOperators(tokens: Token[]): TextOperatorLocation[] {
  const locations: TextOperatorLocation[] = [];
  let activeFontKey = '';

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type !== 'operator') continue;

    // Track active font: /FontName fontSize Tf
    if (tok.raw === 'Tf') {
      // Look back for the name token: /FontName <size> Tf
      let j = i - 1;
      while (j >= 0 && tokens[j].type === 'whitespace') j--;
      j--; // skip size number
      while (j >= 0 && tokens[j].type === 'whitespace') j--;
      if (j >= 0 && tokens[j].type === 'name') {
        activeFontKey = tokens[j].value ?? '';
      }
      continue;
    }

    // Tj: <string> Tj
    if (tok.raw === 'Tj') {
      let j = i - 1;
      while (j >= 0 && tokens[j].type === 'whitespace') j--;
      if (j >= 0 && (tokens[j].type === 'literal-string' || tokens[j].type === 'hex-string')) {
        locations.push({
          operatorIndex: i,
          operandIndex: j,
          operator: 'Tj',
          currentText: tokens[j].value ?? '',
          activeFontKey,
        });
      }
      continue;
    }

    // TJ: [<string> offset <string> ...] TJ
    if (tok.raw === 'TJ') {
      let j = i - 1;
      while (j >= 0 && tokens[j].type === 'whitespace') j--;
      if (j >= 0 && tokens[j].type === 'array-close') {
        // Concatenate all string tokens inside the array.
        let text = '';
        let arrayOpen = j - 1;
        while (arrayOpen >= 0 && tokens[arrayOpen].type !== 'array-open') {
          if (tokens[arrayOpen].type === 'literal-string' || tokens[arrayOpen].type === 'hex-string') {
            text = (tokens[arrayOpen].value ?? '') + text;
          }
          arrayOpen--;
        }
        locations.push({
          operatorIndex: i,
          operandIndex: arrayOpen, // Index of the '['.
          operator: 'TJ',
          currentText: text,
          activeFontKey,
        });
      }
      continue;
    }

    // ' and " operators (move-and-show-text).
    if (tok.raw === "'" || tok.raw === '"') {
      let j = i - 1;
      while (j >= 0 && tokens[j].type === 'whitespace') j--;
      if (tok.raw === '"') j--; // Skip word spacing number.
      while (j >= 0 && tokens[j].type === 'whitespace') j--;
      if (tok.raw === '"') j--; // Skip char spacing number.
      while (j >= 0 && tokens[j].type === 'whitespace') j--;
      if (j >= 0 && (tokens[j].type === 'literal-string' || tokens[j].type === 'hex-string')) {
        locations.push({
          operatorIndex: i,
          operandIndex: j,
          operator: tok.raw as "'" | '"',
          currentText: tokens[j].value ?? '',
          activeFontKey,
        });
      }
    }
  }

  return locations;
}

// ─── Content Stream Editor ───────────────────────────────────────────────────

/**
 * Result of a content stream edit operation.
 */
export interface EditResult {
  /** The modified content stream bytes (decompressed). */
  newStreamBytes: Uint8Array;
  /** Whether any changes were made. */
  changed: boolean;
  /** Human-readable summary of what was changed. */
  summary: string;
}

/**
 * Replaces the text string at a specific operator index in a content stream
 * with `newText`, encoding it for the given font subset.
 *
 * @param streamText - Decompressed content stream as a string.
 * @param operatorIndex - Index (from findTextOperators) of the target operator.
 * @param newText - The replacement Unicode text.
 * @param subsetInfo - Font subset info for encoding validation.
 * @param allOperatorLocations - All text operator locations (from findTextOperators).
 */
export function editTextInStream(
  streamText: string,
  operatorIndex: number,
  newText: string,
  subsetInfo: FontSubsetInfo,
  allOperatorLocations: TextOperatorLocation[],
): EditResult {
  // Validate glyph availability.
  const validation = validateTextAgainstSubset(newText, subsetInfo);
  if (!validation.valid) {
    throw new GlyphMissingError(
      `Cannot encode "${newText}": characters ${validation.missingChars.map((c) => `"${c}"`).join(', ')} are not in the embedded font subset.`,
      validation.missingChars,
    );
  }

  // Encode the new text to PDF byte codes.
  const encodedBytes = encodeTextForContentStream(newText, subsetInfo);
  if (!encodedBytes) {
    throw new Error(`Cannot encode "${newText}" — font lacks a ToUnicode map. Editing blocked.`);
  }

  // Find the target location.
  const target = allOperatorLocations.find((loc) => loc.operatorIndex === operatorIndex);
  if (!target) {
    throw new Error(`No text operator found at index ${operatorIndex}.`);
  }

  const tokens = tokenizeContentStream(streamText);
  const operandTok = tokens[target.operandIndex];

  // Build the replacement hex string (more robust than literal strings for
  // arbitrary byte sequences — avoids needing to escape bytes).
  const hexStr = '<' + Array.from(encodedBytes).map((b) => b.toString(16).padStart(2, '0')).join('') + '>';

  // If it's a TJ array, replace the whole array with a single Tj.
  // For v1 this is acceptable — the array form is only needed for kerning,
  // which we don't preserve on edit (PRD §3: no reflow, no kerning changes).
  let replaceStart: number;
  let replaceEnd: number;

  if (target.operator === 'TJ') {
    // Replace from '[' to ']' (the whole array).
    replaceStart = operandTok.startPos;
    // Find the closing ']' by scanning forward.
    let depth = 0;
    let endPos = operandTok.startPos;
    for (let i = operandTok.startPos; i < streamText.length; i++) {
      if (streamText[i] === '[') depth++;
      else if (streamText[i] === ']') { depth--; if (depth === 0) { endPos = i + 1; break; } }
    }
    replaceEnd = endPos;
  } else {
    // For Tj / ' / ", replace just the string operand token.
    replaceStart = operandTok.startPos;
    replaceEnd = operandTok.startPos + operandTok.raw.length;
  }

  const newStreamText =
    streamText.slice(0, replaceStart) +
    hexStr +
    streamText.slice(replaceEnd);

  const newStreamBytes = new TextEncoder().encode(newStreamText);

  return {
    newStreamBytes,
    changed: true,
    summary: `Replaced text at operator ${operatorIndex} (${target.operator}): "${target.currentText}" → "${newText}"`,
  };
}

// ─── Full PDF Edit Pipeline (Spike) ──────────────────────────────────────────

/**
 * Spike-level end-to-end edit:
 *   1. Load PDF with pdf-lib.
 *   2. Decompress the target page's content stream.
 *   3. Find text operators.
 *   4. Replace the operator at `runIndex` with `newText`.
 *   5. Write back the modified stream.
 *   6. Save the PDF and return it as a Blob.
 *
 * This is a *spike-level* implementation — it handles one page, one stream.
 * The production engine (Prompt 3–4) will handle multi-stream pages and
 * proper Tm matrix tracking.
 */
export async function editTextInPdf(
  pdfBytes: Uint8Array | ArrayBuffer,
  pageIndex: number,
  runIndex: number,
  newText: string,
  subsetInfo: FontSubsetInfo,
): Promise<Blob> {
  const { PDFDocument, PDFName, PDFRawStream, PDFStream, decodePDFRawStream } = await import('pdf-lib');

  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const pages = pdfDoc.getPages();
  if (pageIndex >= pages.length) {
    throw new RangeError(`pageIndex ${pageIndex} out of range [0, ${pages.length - 1}]`);
  }

  const page = pages[pageIndex];
  const pageNode = page.node;

  // ── Get content stream(s) ─────────────────────────────────────────────────
  const contentsObj = pageNode.lookup(PDFName.of('Contents'));
  if (!contentsObj) throw new Error('Page has no Contents stream.');

  // Contents may be a single stream ref or an array of refs.
  // For the spike, concatenate all streams and write back as one.
  let combinedStreamText = '';
  const contentRefs: unknown[] = [];

  const resolveStream = (ref: unknown): void => {
    const obj = pdfDoc.context.lookup(ref as import('pdf-lib').PDFRef);
    if (obj instanceof PDFRawStream) {
      try {
        const decoded = decodePDFRawStream(obj).decode();
        combinedStreamText += new TextDecoder('latin1').decode(decoded);
        contentRefs.push(ref);
      } catch {
        // Fallback: read raw uncompressed bytes.
        const raw = obj as unknown as { contents: Uint8Array };
        combinedStreamText += new TextDecoder('latin1').decode(raw.contents);
        contentRefs.push(ref);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentsAsAny = contentsObj as any;
  if (contentsObj && typeof contentsAsAny.get === 'function') {
    // Array of content stream refs.
    for (let i = 0; i < contentsAsAny.length; i++) {
      resolveStream(contentsAsAny.get(i));
    }
  } else {
    resolveStream(contentsObj);
  }

  if (!combinedStreamText) {
    throw new Error('Could not decode page content stream.');
  }

  // ── Tokenize and find operators ────────────────────────────────────────────
  const tokens = tokenizeContentStream(combinedStreamText);
  const operators = findTextOperators(tokens);

  if (runIndex >= operators.length) {
    throw new RangeError(`runIndex ${runIndex} out of range [0, ${operators.length - 1}]. Page has ${operators.length} text operators.`);
  }

  const target = operators[runIndex];

  // ── Edit the stream ────────────────────────────────────────────────────────
  const editResult = editTextInStream(
    combinedStreamText,
    target.operatorIndex,
    newText,
    subsetInfo,
    operators,
  );

  // ── Write the modified stream back ────────────────────────────────────────
  // Write as an uncompressed stream (no /Filter). qpdf-wasm will re-compress
  // in the production export pipeline (Prompt 6).
  const newStreamRef = pdfDoc.context.register(
    pdfDoc.context.stream(editResult.newStreamBytes, {}),
  );

  // Update the page's /Contents to point to the new stream.
  pageNode.set(PDFName.of('Contents'), newStreamRef);

  // ── Save and return ───────────────────────────────────────────────────────
  const savedBytes = await pdfDoc.save();
  // Cast via ArrayBuffer to satisfy Blob constructor strict typing.
  return new Blob([savedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

// ─── Error Types ──────────────────────────────────────────────────────────────

/**
 * Thrown when the user tries to type a character not present in the embedded
 * font subset. PRD §13 Q1 — Block strategy.
 */
export class GlyphMissingError extends Error {
  constructor(
    message: string,
    readonly missingChars: readonly string[],
  ) {
    super(message);
    this.name = 'GlyphMissingError';
  }
}

// ─── Re-export convenience ────────────────────────────────────────────────────
export { type GlyphValidationResult, tokenizeContentStream, findTextOperators as default };
