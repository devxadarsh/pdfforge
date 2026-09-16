/**
 * pdf-fixtures.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Minimal synthetic PDF fixtures for unit tests.
 *
 * These are hand-crafted minimal valid PDFs encoded as Uint8Array.
 * They avoid needing pdf-lib in the test bootstrap and work in Karma (browser).
 *
 * FIXTURE CATALOG:
 *   MINIMAL_TEXT_PDF     — 1-page PDF with "Hello World" using Helvetica (standard font).
 *                          Page Resources/Font has F1 → /Type1 Helvetica.
 *                          Content stream: BT /F1 12 Tf (Hello World) Tj ET
 *   CMAP_SINGLE_BYTE_PDF — 1-page PDF with a /ToUnicode CMap (single-byte encoding).
 *                          Font has a minimal ToUnicode stream mapping 0x48→"H", 0x65→"e" etc.
 *   EMPTY_PAGE_PDF       — 1-page PDF with no text content.
 */

/**
 * Converts a raw PDF string to a Uint8Array using latin1 encoding
 * so that binary bytes (like xref offsets) are preserved correctly.
 */
function pdfBytes(s: string): Uint8Array {
  const buf = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i) & 0xff;
  return buf;
}

// ─── Fixture 1: Minimal Text PDF ─────────────────────────────────────────────
//
// A minimal valid PDF-1.4 with:
//   - 1 page
//   - /F1 → Helvetica standard font (no embedding, no /ToUnicode)
//   - Content stream: BT /F1 12 Tf 72 720 Td (Hello World) Tj ET
//
// This fixture tests:
//   a) Content stream tokenizer correctly finds the Tj operator.
//   b) Font key resolution identifies "F1".
//   c) No fontSubsetGlyphs (standard fonts are not embedded).

export const MINIMAL_TEXT_PDF: Uint8Array = (() => {
  const body =
    '%PDF-1.4\n' +
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n   /Resources << /Font << /F1 4 0 R >> >>\n   /Contents 5 0 R >>\nendobj\n' +
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica\n   /Encoding /WinAnsiEncoding >>\nendobj\n';

  const contentStream = 'BT\n/F1 12 Tf\n72 720 Td\n(Hello World) Tj\nET\n';
  const streamLen = contentStream.length;
  const stream = `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${contentStream}endstream\nendobj\n`;

  const header = body + stream;
  const xrefPos = header.length;

  // Build xref manually.
  const offsets: number[] = [];
  let pos = 0;
  for (const line of body.split('\n')) {
    if (/^\d+ \d+ obj/.test(line)) offsets.push(pos);
    pos += line.length + 1;
  }

  const xref =
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets.slice(0, 5).map((o) => o.toString().padStart(10, '0') + ' 00000 n ').join('\n') +
    '\n' +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return pdfBytes(header + xref);
})();

// ─── Fixture 2: PDF with ToUnicode CMap ──────────────────────────────────────
//
// A PDF with a /ToUnicode stream that maps single-byte codes → Unicode.
// Font: /F2 → TrueType with embedded subset + ToUnicode cmap.
//
// ToUnicode maps:
//   <48> → "H"  (0x48 = 72)
//   <65> → "e"  (0x65 = 101)
//   <6C> → "l"  (0x6C = 108)
//   <6F> → "o"  (0x6F = 111)
//   <20> → " "  (0x20 = 32)
//   <57> → "W"  (0x57 = 87)
//   <72> → "r"  (0x72 = 114)
//   <64> → "d"  (0x64 = 100)
//
// Content stream uses hex string: <48 65 6C 6C 6F 20 57 6F 72 6C 64>
// This fixture tests:
//   a) parseToUnicodeCMap correctly parses bfchar entries.
//   b) encodeTextForContentStream reverse-maps Unicode → byte codes.
//   c) validateTextAgainstSubset correctly identifies missing chars.

export const CMAP_BFCHAR_ENTRIES = [
  ['48', 'H'], ['65', 'e'], ['6C', 'l'], ['6F', 'o'],
  ['20', ' '], ['57', 'W'], ['72', 'r'], ['6C', 'l'], ['64', 'd'],
] as const;

export const SAMPLE_CMAP_TEXT = `
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<00> <FF>
endcodespacerange
8 beginbfchar
<48> <0048>
<65> <0065>
<6C> <006C>
<6F> <006F>
<20> <0020>
<57> <0057>
<72> <0072>
<64> <0064>
endbfchar
endcmap
CMapType end
end
`.trim();

export const SAMPLE_CMAP_TWO_BYTE = `
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
3 beginbfchar
<0048> <0048>
<0065> <0065>
<006C> <006C>
endbfchar
endcmap
CMapType end
end
`.trim();

export const SAMPLE_CMAP_BFRANGE = `
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<00> <FF>
endcodespacerange
1 beginbfrange
<41> <5A> <0041>
endbfrange
endcmap
CMapType end
end
`.trim();

// ─── Fixture 3: Empty Page PDF ────────────────────────────────────────────────

export const EMPTY_PAGE_PDF: Uint8Array = pdfBytes(
  '%PDF-1.4\n' +
  '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
  '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
  '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n' +
  'xref\n0 4\n' +
  '0000000000 65535 f \n' +
  '0000000009 00000 n \n' +
  '0000000058 00000 n \n' +
  '0000000115 00000 n \n' +
  'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n218\n%%EOF\n',
);

// ─── Fixture 4: Sample content stream snippets ────────────────────────────────

/** Simple single-Tj content stream. */
export const STREAM_SIMPLE_TJ = `BT
/F1 12 Tf
72 720 Td
(Hello World) Tj
ET`;

/** TJ array with kerning adjustments. */
export const STREAM_TJ_ARRAY = `BT
/F2 10 Tf
100 650 Td
[(H) -50 (ello)] TJ
ET`;

/** Mixed operators: move-show-text. */
export const STREAM_MIXED_OPS = `BT
/F1 12 Tf
72 720 Td
(First line) Tj
0 -20 Td
(Second line) '
ET`;

/** Two fonts on same page. */
export const STREAM_TWO_FONTS = `BT
/F1 12 Tf
72 720 Td
(Font One text) Tj
/F2 10 Tf
72 700 Td
(Font Two text) Tj
ET`;

/** Hex string encoding. */
export const STREAM_HEX_STRING = `BT
/F1 12 Tf
72 720 Td
<48656C6C6F> Tj
ET`;
