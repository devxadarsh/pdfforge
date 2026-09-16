/**
 * content-edit-engine.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the Content Edit Engine v0.1 extraction pipeline.
 *
 * Testing strategy:
 *   - Pure TS modules (parseToUnicodeCMap, tokenizer, GlyphResolver, etc.)
 *     are tested directly — no browser/WASM dependencies needed.
 *   - buildFontResourceMap() is tested with a minimal PDF loaded via pdf-lib
 *     in the browser test environment (Karma).
 *   - extractPageContentModel() (which requires mupdf WASM + Web Worker) is
 *     integration-tested in the browser verification harness, not here.
 *     Reason: Workers cannot be spawned in Karma's default jsdom-like context,
 *     and WASM initialization adds significant overhead to the test suite.
 */

import { parseToUnicodeCMap, validateTextAgainstSubset, encodeTextForContentStream, type FontSubsetInfo } from './font-subset-analyzer';
import { tokenizeContentStream, findTextOperators, GlyphResolver } from './font-glyph-resolver';
import { buildFontResourceMap } from './content-edit-engine';
import {
  SAMPLE_CMAP_TEXT,
  SAMPLE_CMAP_TWO_BYTE,
  SAMPLE_CMAP_BFRANGE,
  STREAM_SIMPLE_TJ,
  STREAM_TJ_ARRAY,
  STREAM_MIXED_OPS,
  STREAM_TWO_FONTS,
  STREAM_HEX_STRING,
  MINIMAL_TEXT_PDF,
} from './__fixtures__/pdf-fixtures';

// ─── ToUnicode CMap Parser Tests ──────────────────────────────────────────────

describe('parseToUnicodeCMap', () => {
  describe('bfchar (single-byte)', () => {
    let map: ReturnType<typeof parseToUnicodeCMap>;

    beforeEach(() => {
      map = parseToUnicodeCMap(SAMPLE_CMAP_TEXT);
    });

    it('should detect single-byte encoding', () => {
      expect(map.isTwoByteEncoding).toBeFalse();
    });

    it('should parse bfchar entries into byteToUnicode', () => {
      expect(map.byteToUnicode.get(0x48)).toBe('H');
      expect(map.byteToUnicode.get(0x65)).toBe('e');
      expect(map.byteToUnicode.get(0x6C)).toBe('l');
      expect(map.byteToUnicode.get(0x6F)).toBe('o');
      expect(map.byteToUnicode.get(0x20)).toBe(' ');
      expect(map.byteToUnicode.get(0x57)).toBe('W');
      expect(map.byteToUnicode.get(0x72)).toBe('r');
      expect(map.byteToUnicode.get(0x64)).toBe('d');
    });

    it('should build reverse unicodeToByte map', () => {
      expect(map.unicodeToByte.get('H')).toBe(0x48);
      expect(map.unicodeToByte.get('e')).toBe(0x65);
      expect(map.unicodeToByte.get('l')).toBe(0x6C);
      expect(map.unicodeToByte.get('o')).toBe(0x6F);
      expect(map.unicodeToByte.get(' ')).toBe(0x20);
      expect(map.unicodeToByte.get('W')).toBe(0x57);
      expect(map.unicodeToByte.get('r')).toBe(0x72);
      expect(map.unicodeToByte.get('d')).toBe(0x64);
    });

    it('should not map characters not in the cmap', () => {
      expect(map.unicodeToByte.get('Z')).toBeUndefined();
      expect(map.unicodeToByte.get('!')).toBeUndefined();
    });
  });

  describe('bfchar (two-byte / CIDFont)', () => {
    it('should detect two-byte encoding', () => {
      const map = parseToUnicodeCMap(SAMPLE_CMAP_TWO_BYTE);
      expect(map.isTwoByteEncoding).toBeTrue();
    });

    it('should parse two-byte bfchar entries', () => {
      const map = parseToUnicodeCMap(SAMPLE_CMAP_TWO_BYTE);
      expect(map.byteToUnicode.get(0x0048)).toBe('H');
      expect(map.byteToUnicode.get(0x0065)).toBe('e');
      expect(map.byteToUnicode.get(0x006C)).toBe('l');
    });
  });

  describe('bfrange', () => {
    it('should parse bfrange A-Z linear range', () => {
      const map = parseToUnicodeCMap(SAMPLE_CMAP_BFRANGE);
      // Range 0x41–0x5A mapped to Unicode A–Z.
      expect(map.byteToUnicode.get(0x41)).toBe('A');
      expect(map.byteToUnicode.get(0x42)).toBe('B');
      expect(map.byteToUnicode.get(0x5A)).toBe('Z');
      // Letters in between.
      expect(map.byteToUnicode.get(0x4D)).toBe('M');
    });

    it('should build reverse map from bfrange', () => {
      const map = parseToUnicodeCMap(SAMPLE_CMAP_BFRANGE);
      expect(map.unicodeToByte.get('A')).toBe(0x41);
      expect(map.unicodeToByte.get('Z')).toBe(0x5A);
    });

    it('should not include characters outside the range', () => {
      const map = parseToUnicodeCMap(SAMPLE_CMAP_BFRANGE);
      expect(map.unicodeToByte.get('a')).toBeUndefined();
      expect(map.unicodeToByte.get('0')).toBeUndefined();
    });
  });
});

// ─── Glyph Validation Tests ───────────────────────────────────────────────────

describe('validateTextAgainstSubset', () => {
  function makeSubsetInfo(chars: string[]): FontSubsetInfo {
    const toUnicodeMap = parseToUnicodeCMap(SAMPLE_CMAP_TEXT);
    const availableChars = new Set(chars);
    const availableCodePoints = new Set(chars.map((c) => c.codePointAt(0)!));
    return {
      fontKey: 'F1',
      postscriptName: 'TestFont',
      numGlyphs: chars.length,
      availableCodePoints,
      availableChars,
      toUnicodeMap,
      fontType: 'simple',
      fontkitParsed: false,
      warnings: [],
    };
  }

  it('should return valid=true when all chars are in the subset', () => {
    const info = makeSubsetInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
    const result = validateTextAgainstSubset('Hello World', info);
    expect(result.valid).toBeTrue();
    expect(result.missingChars).toEqual([]);
  });

  it('should return valid=false with missing chars listed', () => {
    const info = makeSubsetInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
    const result = validateTextAgainstSubset('Hello!', info);
    expect(result.valid).toBeFalse();
    expect(result.missingChars).toContain('!');
  });

  it('should detect multiple missing characters', () => {
    // makeSubsetInfo uses the SAMPLE_CMAP_TEXT which maps H,e,l,o, ,W,r,d.
    // availableChars=['A','B','C'] is overridden but the toUnicodeMap is still SAMPLE_CMAP_TEXT.
    // validateTextAgainstSubset checks toUnicodeMap.unicodeToByte first.
    // So 'A','B','C' are NOT in the toUnicodeMap and will appear as missing.
    const info = makeSubsetInfo(['A', 'B', 'C']);
    const result = validateTextAgainstSubset('ABC123', info);
    expect(result.valid).toBeFalse();
    // All of A,B,C,1,2,3 are missing from the SAMPLE_CMAP_TEXT toUnicodeMap.
    expect(result.missingChars).toContain('1');
    expect(result.missingChars).toContain('2');
    expect(result.missingChars).toContain('3');
    expect(result.missingChars).toContain('A');
    expect(result.missingChars).toContain('B');
    expect(result.missingChars).toContain('C');
  });

  it('should handle empty text as valid', () => {
    const info = makeSubsetInfo(['A', 'B']);
    const result = validateTextAgainstSubset('', info);
    expect(result.valid).toBeTrue();
  });
});

// ─── encodeTextForContentStream Tests ────────────────────────────────────────

describe('encodeTextForContentStream', () => {
  function makeSubsetWithCmap(): FontSubsetInfo {
    const toUnicodeMap = parseToUnicodeCMap(SAMPLE_CMAP_TEXT);
    return {
      fontKey: 'F1',
      postscriptName: 'TestFont',
      numGlyphs: 8,
      availableCodePoints: new Set([0x48, 0x65, 0x6C, 0x6F, 0x20, 0x57, 0x72, 0x64]),
      availableChars: new Set(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']),
      toUnicodeMap,
      fontType: 'simple',
      fontkitParsed: false,
      warnings: [],
    };
  }

  it('should encode "Hello" to correct byte codes', () => {
    const info = makeSubsetWithCmap();
    const result = encodeTextForContentStream('Hello', info);
    expect(result).not.toBeNull();
    expect(Array.from(result!)).toEqual([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
  });

  it('should return null when a character is missing from the map', () => {
    const info = makeSubsetWithCmap();
    const result = encodeTextForContentStream('Hello!', info);
    expect(result).toBeNull();
  });

  it('should encode space correctly', () => {
    const info = makeSubsetWithCmap();
    const result = encodeTextForContentStream(' ', info);
    expect(Array.from(result!)).toEqual([0x20]);
  });

  it('should return null when no ToUnicode map is present', () => {
    const info: FontSubsetInfo = {
      fontKey: 'F1',
      postscriptName: 'TestFont',
      numGlyphs: 0,
      availableCodePoints: new Set(),
      availableChars: new Set(),
      toUnicodeMap: null,
      fontType: 'simple',
      fontkitParsed: false,
      warnings: [],
    };
    const result = encodeTextForContentStream('Hi', info);
    expect(result).toBeNull();
  });

  describe('two-byte encoding', () => {
    it('should encode text using 2-byte codes for CIDFonts', () => {
      const toUnicodeMap = parseToUnicodeCMap(SAMPLE_CMAP_TWO_BYTE);
      const info: FontSubsetInfo = {
        fontKey: 'F1',
        postscriptName: 'TestCIDFont',
        numGlyphs: 3,
        availableCodePoints: new Set([0x48, 0x65, 0x6C]),
        availableChars: new Set(['H', 'e', 'l']),
        toUnicodeMap,
        fontType: 'composite',
        fontkitParsed: false,
        warnings: [],
      };
      const result = encodeTextForContentStream('He', info);
      // Two-byte: H = 0x0048, e = 0x0065
      expect(result).not.toBeNull();
      expect(Array.from(result!)).toEqual([0x00, 0x48, 0x00, 0x65]);
    });
  });
});

// ─── Content Stream Tokenizer Tests ──────────────────────────────────────────

describe('tokenizeContentStream', () => {
  it('should tokenize a simple Tj stream', () => {
    const tokens = tokenizeContentStream(STREAM_SIMPLE_TJ);
    const operators = tokens.filter((t) => t.type === 'operator');
    const opNames = operators.map((o) => o.raw);
    expect(opNames).toContain('Tf');
    expect(opNames).toContain('Td');
    expect(opNames).toContain('Tj');
    expect(opNames).toContain('BT');
    expect(opNames).toContain('ET');
  });

  it('should tokenize literal strings', () => {
    const tokens = tokenizeContentStream('(Hello World) Tj');
    const strTok = tokens.find((t) => t.type === 'literal-string');
    expect(strTok).toBeTruthy();
    expect(strTok!.value).toBe('Hello World');
  });

  it('should tokenize hex strings', () => {
    const tokens = tokenizeContentStream('<48656C6C6F> Tj');
    const hexTok = tokens.find((t) => t.type === 'hex-string');
    expect(hexTok).toBeTruthy();
    expect(hexTok!.value).toBe('Hello');
  });

  it('should handle escaped parens in literal strings', () => {
    const tokens = tokenizeContentStream('(Hello \\(World\\)) Tj');
    const strTok = tokens.find((t) => t.type === 'literal-string');
    expect(strTok!.value).toBe('Hello (World)');
  });
});

// ─── findTextOperators Tests ──────────────────────────────────────────────────

describe('findTextOperators', () => {
  it('should find a single Tj operator', () => {
    const tokens = tokenizeContentStream(STREAM_SIMPLE_TJ);
    const ops = findTextOperators(tokens);
    expect(ops.length).toBe(1);
    expect(ops[0].operator).toBe('Tj');
    expect(ops[0].currentText).toBe('Hello World');
    expect(ops[0].activeFontKey).toBe('F1');
  });

  it('should extract text from TJ array (concatenated)', () => {
    const tokens = tokenizeContentStream(STREAM_TJ_ARRAY);
    const ops = findTextOperators(tokens);
    const tjOp = ops.find((o) => o.operator === 'TJ');
    expect(tjOp).toBeTruthy();
    // TJ array [(H) -50 (ello)] → concatenated "Hello".
    expect(tjOp!.currentText).toContain('H');
    expect(tjOp!.currentText).toContain('ello');
  });

  it('should track active font across Tf operators', () => {
    const tokens = tokenizeContentStream(STREAM_TWO_FONTS);
    const ops = findTextOperators(tokens);
    expect(ops.length).toBe(2);
    expect(ops[0].activeFontKey).toBe('F1');
    expect(ops[1].activeFontKey).toBe('F2');
  });

  it("should find the ' (move-show) operator", () => {
    const tokens = tokenizeContentStream(STREAM_MIXED_OPS);
    const ops = findTextOperators(tokens);
    // "First line" via Tj, "Second line" via '
    expect(ops.length).toBe(2);
    expect(ops[0].operator).toBe('Tj');
    expect(ops[0].currentText).toBe('First line');
    expect(ops[1].operator).toBe("'");
    expect(ops[1].currentText).toBe('Second line');
  });

  it('should decode hex strings in Tj', () => {
    const tokens = tokenizeContentStream(STREAM_HEX_STRING);
    const ops = findTextOperators(tokens);
    expect(ops.length).toBe(1);
    // <48 65 6C 6C 6F> = "Hello"
    expect(ops[0].currentText).toBe('Hello');
  });

  it('should return empty array for a stream with no text operators', () => {
    const stream = 'q 1 0 0 1 0 0 cm /Img1 Do Q';
    const tokens = tokenizeContentStream(stream);
    const ops = findTextOperators(tokens);
    expect(ops.length).toBe(0);
  });
});

// ─── GlyphResolver Tests ──────────────────────────────────────────────────────

describe('GlyphResolver', () => {
  let resolver: GlyphResolver;

  beforeEach(() => {
    const toUnicodeMap = parseToUnicodeCMap(SAMPLE_CMAP_TEXT);
    const info: FontSubsetInfo = {
      fontKey: 'F1',
      postscriptName: 'TestFont',
      numGlyphs: 8,
      availableCodePoints: new Set([0x48, 0x65, 0x6C, 0x6F, 0x20, 0x57, 0x72, 0x64]),
      availableChars: new Set(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']),
      toUnicodeMap,
      fontType: 'simple',
      fontkitParsed: false,
      warnings: [],
    };
    resolver = new GlyphResolver(info);
  });

  it('should return valid=true for "Hello World"', () => {
    const result = resolver.validate('Hello World');
    expect(result.valid).toBeTrue();
    expect(result.missingChars).toEqual([]);
  });

  it('should block characters not in the subset', () => {
    const result = resolver.validate('Hello!');
    expect(result.valid).toBeFalse();
    expect(result.missingChars).toContain('!');
  });

  it('should encode "Hello" correctly', () => {
    const encoded = resolver.encode('Hello');
    expect(encoded).not.toBeNull();
    expect(Array.from(encoded!)).toEqual([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
  });

  it('should return null encoding for text with missing chars', () => {
    const encoded = resolver.encode('Hi!');
    expect(encoded).toBeNull();
  });

  it('should produce a human-readable warning for missing glyphs', () => {
    const msg = GlyphResolver.missingGlyphWarning(['!', '?']);
    expect(msg).toContain('"!"');
    expect(msg).toContain('"?"');
    expect(msg).toContain('embedded font subset');
  });
});

// ─── buildFontResourceMap Tests ───────────────────────────────────────────────

describe('buildFontResourceMap', () => {
  it('should resolve /F1 → Helvetica from MINIMAL_TEXT_PDF', async () => {
    const map = await buildFontResourceMap(MINIMAL_TEXT_PDF, 0);
    // MINIMAL_TEXT_PDF has F1 → /Helvetica (no subset prefix).
    expect(map.has('Helvetica')).toBeTrue();
    expect(map.get('Helvetica')).toBe('F1');
  });

  it('should return empty map for out-of-range pageIndex', async () => {
    const map = await buildFontResourceMap(MINIMAL_TEXT_PDF, 99);
    expect(map.size).toBe(0);
  });
});
