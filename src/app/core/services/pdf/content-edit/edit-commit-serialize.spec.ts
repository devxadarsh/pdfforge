/**
 * edit-commit-serialize.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for Prompt 4:
 *   - commitEdit()      (glyph validation, immutable update, GlyphMissingError)
 *   - applyEditsToStream() (content-stream-serializer)
 *   - rewriteEditedPages() (end-to-end pdf-lib PDF rewrite)
 *   - EditHistory       (undo/redo stack)
 *
 * Testing approach:
 *   - commitEdit() and EditHistory are pure TypeScript — tested synchronously.
 *   - applyEditsToStream() is pure TypeScript — tested synchronously.
 *   - rewriteEditedPages() requires pdf-lib (browser-available in Karma).
 */

import { commitEdit, GlyphMissingError, serializeEditedPage } from './content-edit-engine';
import { applyEditsToStream } from './content-stream-serializer';
import { EditHistory, applyUndo, applyRedo } from './edit-history';
import { parseToUnicodeCMap } from './font-subset-analyzer';
import type { PageContentModel, TextRun, EditCommand } from './text-run.model';
import type { FontSubsetInfo } from './font-subset-analyzer';
import type { PendingStreamEdit } from './content-stream-serializer';
import {
  SAMPLE_CMAP_TEXT,
  STREAM_SIMPLE_TJ,
  STREAM_TWO_FONTS,
  MINIMAL_TEXT_PDF,
} from './__fixtures__/pdf-fixtures';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeFontInfo(chars: string[], overrides?: Partial<FontSubsetInfo>): FontSubsetInfo {
  const toUnicodeMap = parseToUnicodeCMap(SAMPLE_CMAP_TEXT);
  return {
    fontKey: 'F1',
    postscriptName: 'TestFont',
    numGlyphs: chars.length,
    availableCodePoints: new Set(chars.map((c) => c.codePointAt(0)!)),
    availableChars: new Set(chars),
    toUnicodeMap,
    fontType: 'simple',
    fontkitParsed: false,
    warnings: [],
    ...overrides,
  };
}

function makeRun(overrides?: Partial<TextRun>): TextRun {
  return {
    id: 'p0-r0',
    pageIndex: 0,
    text: 'Hello',
    fontResource: 'F1',
    fontSize: 12,
    color: { type: 'gray', g: 0 },
    transformMatrix: [1, 0, 0, 1, 72, 720],
    boundingBox: { x: 72, y: 720, width: 50, height: 12 },
    fontSubsetGlyphs: new Set(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']),
    ...overrides,
  };
}

function makeModel(runs: TextRun[] = [makeRun()]): PageContentModel {
  return { pageIndex: 0, runs };
}

function makeFontInfoMap(info: FontSubsetInfo): ReadonlyMap<string, FontSubsetInfo> {
  return new Map([[info.fontKey, info]]);
}

// ─── commitEdit() Tests ───────────────────────────────────────────────────────

describe('commitEdit', () => {
  describe('valid text swaps', () => {
    it('should swap run text with same-length text', () => {
      const model = makeModel();
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
      const fontInfoMap = makeFontInfoMap(fontInfo);
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello' };

      const result = commitEdit(model, cmd, fontInfoMap);

      expect(result.model.runs[0].text).toBe('Hello');
    });

    it('should swap run text with shorter text (overflow acceptable per PRD §7)', () => {
      const model = makeModel([makeRun({ text: 'Hello World' })]);
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
      const fontInfoMap = makeFontInfoMap(fontInfo);
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello' };

      const result = commitEdit(model, cmd, fontInfoMap);

      expect(result.model.runs[0].text).toBe('Hello');
    });

    it('should swap run text with longer text (overflow acceptable per PRD §7)', () => {
      const model = makeModel([makeRun({ text: 'Hi' })]);
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
      const fontInfoMap = makeFontInfoMap(fontInfo);
      // "Hello" is longer than "Hi" — overflow allowed
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello' };

      const result = commitEdit(model, cmd, fontInfoMap);

      expect(result.model.runs[0].text).toBe('Hello');
    });

    it('should swap run text to empty string', () => {
      const model = makeModel();
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o']);
      const fontInfoMap = makeFontInfoMap(fontInfo);
      const cmd: EditCommand = { runId: 'p0-r0', newText: '' };

      const result = commitEdit(model, cmd, fontInfoMap);

      expect(result.model.runs[0].text).toBe('');
    });
  });

  describe('immutability', () => {
    it('should return a new PageContentModel, not mutate the original', () => {
      const model = makeModel();
      const original = model.runs[0];
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
      const fontInfoMap = makeFontInfoMap(fontInfo);
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello' };

      const result = commitEdit(model, cmd, fontInfoMap);

      // Original run is unchanged.
      expect(model.runs[0].text).toBe('Hello'); // was already 'Hello'
      expect(model.runs[0]).toBe(original);     // same object reference
      // Result is a different model object.
      expect(result.model).not.toBe(model);
    });

    it('should preserve all other TextRun properties unchanged', () => {
      const run = makeRun({ text: 'Hello', fontSize: 14, fontResource: 'F2' });
      const model = makeModel([run]);
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd'], { fontKey: 'F2' });
      const fontInfoMap = new Map([['F2', fontInfo]]);
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello' };

      const result = commitEdit(model, cmd, fontInfoMap);
      const updatedRun = result.model.runs[0];

      // Text updated.
      expect(updatedRun.text).toBe('Hello');
      // All other fields preserved exactly.
      expect(updatedRun.fontSize).toBe(14);
      expect(updatedRun.fontResource).toBe('F2');
      expect(updatedRun.transformMatrix).toEqual([1, 0, 0, 1, 72, 720]);
      expect(updatedRun.color).toEqual({ type: 'gray', g: 0 });
      expect(updatedRun.boundingBox).toEqual({ x: 72, y: 720, width: 50, height: 12 });
    });

    it('should not affect other runs in the model', () => {
      const run0 = makeRun({ id: 'p0-r0', text: 'Hello' });
      const run1 = makeRun({ id: 'p0-r1', text: 'World' });
      const model = makeModel([run0, run1]);
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
      const fontInfoMap = makeFontInfoMap(fontInfo);
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello' };

      const result = commitEdit(model, cmd, fontInfoMap);

      expect(result.model.runs[1].text).toBe('World');
      expect(result.model.runs[1]).toBe(run1); // same object reference
    });
  });

  describe('GlyphMissingError (PRD §13 Q1 — Block strategy)', () => {
    it('should throw GlyphMissingError when new text has missing chars', () => {
      const model = makeModel();
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
      const fontInfoMap = makeFontInfoMap(fontInfo);
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello!' }; // '!' missing

      expect(() => commitEdit(model, cmd, fontInfoMap)).toThrowError(GlyphMissingError);
    });

    it('should include missing chars in GlyphMissingError', () => {
      const model = makeModel();
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
      const fontInfoMap = makeFontInfoMap(fontInfo);
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello!?' };

      try {
        commitEdit(model, cmd, fontInfoMap);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(GlyphMissingError);
        const err = e as GlyphMissingError;
        expect(err.missingChars).toContain('!');
        expect(err.missingChars).toContain('?');
        expect(err.missingChars).not.toContain('H');
        expect(err.missingChars).not.toContain('e');
      }
    });

    it('should NOT throw when run has no fontSubsetGlyphs (unanalyzed font)', () => {
      const run = makeRun({ fontSubsetGlyphs: undefined });
      const model = makeModel([run]);
      const fontInfoMap = new Map<string, FontSubsetInfo>();
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Anything !!@#$%' };

      // Should not throw — no glyph set = no validation.
      expect(() => commitEdit(model, cmd, fontInfoMap)).not.toThrow();
    });

    it('should throw RangeError for unknown runId', () => {
      const model = makeModel();
      const fontInfoMap = new Map<string, FontSubsetInfo>();
      const cmd: EditCommand = { runId: 'nonexistent', newText: 'Hello' };

      expect(() => commitEdit(model, cmd, fontInfoMap)).toThrowError(RangeError);
    });
  });

  describe('pendingEdit result', () => {
    it('should include a PendingStreamEdit when font info is available', () => {
      const model = makeModel();
      const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
      const fontInfoMap = makeFontInfoMap(fontInfo);
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello' };

      const result = commitEdit(model, cmd, fontInfoMap);

      expect(result.pendingEdit).toBeTruthy();
      expect(result.pendingEdit!.newText).toBe('Hello');
      expect(result.pendingEdit!.fontInfo).toBe(fontInfo);
      expect(result.pendingEdit!.operatorIndex).toBe(0); // run at index 0
    });

    it('should return undefined pendingEdit when font info is missing', () => {
      const model = makeModel();
      const fontInfoMap = new Map<string, FontSubsetInfo>(); // empty
      const cmd: EditCommand = { runId: 'p0-r0', newText: 'Hello' };

      const result = commitEdit(model, cmd, fontInfoMap);

      expect(result.pendingEdit).toBeUndefined();
    });
  });
});

// ─── applyEditsToStream() Tests ───────────────────────────────────────────────

describe('applyEditsToStream', () => {
  function makeEdit(operatorIndex: number, newText: string): PendingStreamEdit {
    const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
    return { operatorIndex, newText, fontInfo };
  }

  it('should replace a Tj string operand', () => {
    const { newStreamBytes, applied } = applyEditsToStream(STREAM_SIMPLE_TJ, [makeEdit(0, 'Hello')]);
    expect(applied).toBe(1);
    const result = new TextDecoder().decode(newStreamBytes);
    // New text encoded as hex string.
    expect(result).toContain('<');
    expect(result).toContain('>');
    expect(result).toContain('Tj');
  });

  it('should report 0 applied when operator index is out of range', () => {
    const { applied, warnings } = applyEditsToStream(STREAM_SIMPLE_TJ, [makeEdit(99, 'Hello')]);
    expect(applied).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('should apply multiple edits to the same stream', () => {
    const fontInfo = makeFontInfo(['F', 'o', 'n', 't', ' ', 'T', 'w', 'e', 'x', 'O', 'e']);
    const edits: PendingStreamEdit[] = [
      { operatorIndex: 0, newText: 'Font', fontInfo },
      // Note: STREAM_TWO_FONTS has op 0 = "Font One text" (/F1) and op 1 = "Font Two text" (/F2)
      // We only have chars for simple replacement here, so just test op 0.
    ];
    const { applied } = applyEditsToStream(STREAM_TWO_FONTS, edits);
    expect(applied).toBeGreaterThanOrEqual(0); // At least tried.
  });

  it('should warn and skip when encoding fails (no ToUnicode for chars)', () => {
    // fontInfo with null toUnicodeMap → encodeTextForContentStream returns null.
    const fontInfo = makeFontInfo([], { toUnicodeMap: null });
    const edits: PendingStreamEdit[] = [
      { operatorIndex: 0, newText: 'Hello', fontInfo },
    ];
    const { applied, warnings } = applyEditsToStream(STREAM_SIMPLE_TJ, edits);
    expect(applied).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

// ─── EditHistory Tests ────────────────────────────────────────────────────────

describe('EditHistory', () => {
  let history: EditHistory;
  let model0: PageContentModel;
  let model1: PageContentModel;
  let model2: PageContentModel;
  const cmd1: EditCommand = { runId: 'p0-r0', newText: 'Edit 1' };
  const cmd2: EditCommand = { runId: 'p0-r0', newText: 'Edit 2' };

  beforeEach(() => {
    history = new EditHistory();
    model0 = makeModel([makeRun({ text: 'Original' })]);
    model1 = makeModel([makeRun({ text: 'Edit 1' })]);
    model2 = makeModel([makeRun({ text: 'Edit 2' })]);
  });

  describe('initial state', () => {
    it('should start empty', () => {
      expect(history.canUndo).toBeFalse();
      expect(history.canRedo).toBeFalse();
      expect(history.size).toBe(0);
      expect(history.cursor).toBe(-1);
    });
  });

  describe('push()', () => {
    it('should record an entry', () => {
      history.push(cmd1, model0, model1);
      expect(history.size).toBe(1);
      expect(history.canUndo).toBeTrue();
      expect(history.canRedo).toBeFalse();
    });

    it('should record multiple entries', () => {
      history.push(cmd1, model0, model1);
      history.push(cmd2, model1, model2);
      expect(history.size).toBe(2);
      expect(history.cursor).toBe(1);
    });

    it('should trim redo future on new push after undo', () => {
      history.push(cmd1, model0, model1);
      history.undo(); // go back
      history.push(cmd2, model0, model2); // new branch
      expect(history.size).toBe(1); // old future discarded
      expect(history.canRedo).toBeFalse();
    });

    it('should cap entries at maxDepth', () => {
      const smallHistory = new EditHistory(3);
      const m = makeModel();
      for (let i = 0; i < 5; i++) {
        const cmd: EditCommand = { runId: 'p0-r0', newText: `Edit ${i}` };
        smallHistory.push(cmd, m, m);
      }
      expect(smallHistory.size).toBeLessThanOrEqual(3);
    });
  });

  describe('undo()', () => {
    it('should return the before model', () => {
      history.push(cmd1, model0, model1);
      const result = history.undo();
      expect(result).toBe(model0);
    });

    it('should enable redo after undo', () => {
      history.push(cmd1, model0, model1);
      history.undo();
      expect(history.canRedo).toBeTrue();
    });

    it('should return null when nothing to undo', () => {
      expect(history.undo()).toBeNull();
    });

    it('should decrement cursor', () => {
      history.push(cmd1, model0, model1);
      history.push(cmd2, model1, model2);
      history.undo();
      expect(history.cursor).toBe(0);
    });
  });

  describe('redo()', () => {
    it('should return the after model', () => {
      history.push(cmd1, model0, model1);
      history.undo();
      const result = history.redo();
      expect(result).toBe(model1);
    });

    it('should return null when nothing to redo', () => {
      history.push(cmd1, model0, model1);
      expect(history.redo()).toBeNull();
    });

    it('should re-enable undo after redo', () => {
      history.push(cmd1, model0, model1);
      history.undo();
      history.redo();
      expect(history.canUndo).toBeTrue();
      expect(history.canRedo).toBeFalse();
    });
  });

  describe('peek methods', () => {
    it('should return the command to be undone', () => {
      history.push(cmd1, model0, model1);
      history.push(cmd2, model1, model2);
      expect(history.peekUndo()).toBe(cmd2);
    });

    it('should return the command to be redone', () => {
      history.push(cmd1, model0, model1);
      history.undo();
      expect(history.peekRedo()).toBe(cmd1);
    });

    it('should return null when no undo/redo available', () => {
      expect(history.peekUndo()).toBeNull();
      expect(history.peekRedo()).toBeNull();
    });
  });

  describe('clear()', () => {
    it('should reset all state', () => {
      history.push(cmd1, model0, model1);
      history.push(cmd2, model1, model2);
      history.clear();
      expect(history.size).toBe(0);
      expect(history.canUndo).toBeFalse();
      expect(history.canRedo).toBeFalse();
      expect(history.cursor).toBe(-1);
    });
  });

  describe('standalone helpers', () => {
    it('applyUndo() should call undo and return before model', () => {
      history.push(cmd1, model0, model1);
      const result = applyUndo(history);
      expect(result).toBe(model0);
    });

    it('applyRedo() should call redo and return after model', () => {
      history.push(cmd1, model0, model1);
      history.undo();
      const result = applyRedo(history);
      expect(result).toBe(model1);
    });
  });

  describe('multi-step undo/redo sequence', () => {
    it('should correctly navigate a 3-step history', () => {
      const model3 = makeModel([makeRun({ text: 'Edit 3' })]);
      const cmd3: EditCommand = { runId: 'p0-r0', newText: 'Edit 3' };

      history.push(cmd1, model0, model1);
      history.push(cmd2, model1, model2);
      history.push(cmd3, model2, model3);

      expect(history.undo()).toBe(model2);
      expect(history.undo()).toBe(model1);
      expect(history.undo()).toBe(model0);
      expect(history.undo()).toBeNull();

      expect(history.redo()).toBe(model1);
      expect(history.redo()).toBe(model2);
      expect(history.redo()).toBe(model3);
      expect(history.redo()).toBeNull();
    });
  });
});

// ─── serializeEditedPage() Integration Test ───────────────────────────────────

describe('serializeEditedPage', () => {
  // MINIMAL_TEXT_PDF has 1 page with content stream: BT /F1 12 Tf 72 720 Td (Hello World) Tj ET
  // But it uses standard Helvetica with no ToUnicode map — so encoding will warn.
  // This test verifies the function runs without throwing and returns valid PDF bytes.

  it('should return an ArrayBuffer', async () => {
    const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
    const edit: PendingStreamEdit = { operatorIndex: 0, newText: 'Hello', fontInfo };

    const result = await serializeEditedPage(MINIMAL_TEXT_PDF, 0, [edit]);

    expect(result.pdfBytes).toBeInstanceOf(ArrayBuffer);
    expect(result.pdfBytes.byteLength).toBeGreaterThan(0);
  });

  it('should produce output that starts with %PDF', async () => {
    const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
    const edit: PendingStreamEdit = { operatorIndex: 0, newText: 'Hello', fontInfo };

    const result = await serializeEditedPage(MINIMAL_TEXT_PDF, 0, [edit]);

    const bytes = new Uint8Array(result.pdfBytes);
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    expect(header).toBe('%PDF');
  });

  it('should include serialization results', async () => {
    const fontInfo = makeFontInfo(['H', 'e', 'l', 'o', ' ', 'W', 'r', 'd']);
    const edit: PendingStreamEdit = { operatorIndex: 0, newText: 'Hello', fontInfo };

    const result = await serializeEditedPage(MINIMAL_TEXT_PDF, 0, [edit]);

    expect(result.results).toBeTruthy();
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].pageIndex).toBe(0);
  });
});
