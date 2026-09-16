import {
  resolveFontStyles,
  computeCalibratedFont,
  computeConsistentLetterSpacing,
  sampleCanvasBackgroundColor,
} from './font-matcher.util';

describe('font-matcher.util', () => {
  describe('resolveFontStyles', () => {
    it('resolves standard Times New Roman bold italic', () => {
      const result = resolveFontStyles('TimesNewRomanPS-BoldItalicMT');
      expect(result.fontFamily).toContain('Times New Roman');
      expect(result.cleanName).toBe('Times New Roman');
      expect(result.fontWeight).toBe('bold');
      expect(result.fontStyle).toBe('italic');
    });

    it('resolves Arial with subset prefix', () => {
      const result = resolveFontStyles('XYZABC+Arial-BoldMT');
      expect(result.fontFamily).toContain('Arial');
      expect(result.cleanName).toBe('Arial');
      expect(result.fontWeight).toBe('bold');
      expect(result.fontStyle).toBe('normal');
    });

    it('resolves Calibri Bold font', () => {
      const result = resolveFontStyles('ABCDEF+Calibri-Bold');
      expect(result.fontFamily).toContain('Calibri');
      expect(result.cleanName).toBe('Calibri');
      expect(result.fontWeight).toBe('bold');
      expect(result.fontStyle).toBe('normal');
    });

    it('resolves Georgia font', () => {
      const result = resolveFontStyles('~Georgia');
      expect(result.fontFamily).toContain('Georgia');
      expect(result.cleanName).toBe('Georgia');
      expect(result.fontWeight).toBe('normal');
      expect(result.fontStyle).toBe('normal');
    });

    it('resolves Helvetica Oblique', () => {
      const result = resolveFontStyles('Helvetica-Oblique');
      expect(result.fontFamily).toContain('Helvetica');
      expect(result.cleanName).toBe('Helvetica');
      expect(result.fontWeight).toBe('normal');
      expect(result.fontStyle).toBe('italic');
    });

    it('resolves Courier monospace font', () => {
      const result = resolveFontStyles('CourierNewPSMT');
      expect(result.fontFamily).toContain('Courier New');
      expect(result.cleanName).toBe('Courier New');
      expect(result.fontWeight).toBe('normal');
      expect(result.fontStyle).toBe('normal');
    });

    it('maps MuPDF fallback DejaVuSerif to Times New Roman', () => {
      const result = resolveFontStyles('DejaVuSerif');
      expect(result.fontFamily).toContain('Times New Roman');
      expect(result.cleanName).toBe('Times New Roman');
      expect(result.fontWeight).toBe('normal');
      expect(result.fontStyle).toBe('normal');
    });

    it('maps MuPDF fallback DejaVuSans to Arial', () => {
      const result = resolveFontStyles('DejaVuSans');
      expect(result.fontFamily).toContain('Arial');
      expect(result.cleanName).toBe('Arial');
      expect(result.fontWeight).toBe('normal');
      expect(result.fontStyle).toBe('normal');
    });

    it('maps MuPDF fallback DejaVuSansMono to Courier New', () => {
      const result = resolveFontStyles('DejaVuSansMono');
      expect(result.fontFamily).toContain('Courier New');
      expect(result.cleanName).toBe('Courier New');
      expect(result.fontWeight).toBe('normal');
      expect(result.fontStyle).toBe('normal');
    });

    it('provides fallback for undefined font name', () => {
      const result = resolveFontStyles(undefined);
      expect(result.fontFamily).toContain('sans-serif');
      expect(result.cleanName).toBe('Detected Font');
      expect(result.fontWeight).toBe('normal');
      expect(result.fontStyle).toBe('normal');
    });
  });

  describe('computeCalibratedFont', () => {
    it('returns calibrated letter-spacing to match target width', () => {
      const result = computeCalibratedFont('Hello World', 100, 16, 'ArialMT');
      expect(result.fontFamily).toContain('Arial');
      expect(result.fontSize).toBeGreaterThan(0);
      expect(result.letterSpacing).toBeDefined();
    });

    it('handles empty string gracefully', () => {
      const result = computeCalibratedFont('', 50, 14, 'Helvetica');
      expect(result.fontSize).toBe(14);
      expect(result.letterSpacing).toBe(0);
    });
  });

  describe('computeConsistentLetterSpacing', () => {
    it('returns 0 for empty or single-character string', () => {
      expect(computeConsistentLetterSpacing('', 50, 14, 'Arial')).toBe(0);
      expect(computeConsistentLetterSpacing('A', 50, 14, 'Arial')).toBe(0);
    });

    it('returns consistent letter spacing based on target width difference', () => {
      const spacing = computeConsistentLetterSpacing('Hello', 80, 14, 'Arial');
      expect(typeof spacing).toBe('number');
      expect(spacing).toBeGreaterThanOrEqual(-2.0);
      expect(spacing).toBeLessThanOrEqual(4.0);
    });

    it('respects explicit PDF charSpacing if present', () => {
      const spacing = computeConsistentLetterSpacing('Test', 100, 12, 'Arial', 1.5, 2);
      expect(spacing).toBe(3); // 1.5 * 2
    });
  });

  describe('sampleCanvasBackgroundColor', () => {
    it('samples white background from empty white canvas', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      canvas.style.width = '200px';
      canvas.style.height = '200px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(0, 0, 200, 200);
      }

      const color = sampleCanvasBackgroundColor(
        canvas,
        { x: 50, y: 50, width: 60, height: 16 },
        1.0,
      );
      expect(color).toBe('rgb(255, 255, 255)');
    });

    it('samples tinted cream background accurately', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      canvas.style.width = '200px';
      canvas.style.height = '200px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgb(245, 240, 230)';
        ctx.fillRect(0, 0, 200, 200);
      }

      const color = sampleCanvasBackgroundColor(
        canvas,
        { x: 50, y: 50, width: 60, height: 16 },
        1.0,
      );
      expect(color).toBe('rgb(245, 240, 230)');
    });
  });
});
