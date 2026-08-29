import {
  validatePdfFile,
  verifyPdfMagic,
  formatBytes,
  safeFileName,
  FileValidationError,
} from './file.util';

function makeFile(
  content: string,
  name: string,
  type = 'application/pdf',
  size?: number,
): File {
  const file = new File([content], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
}

describe('file.util', () => {
  describe('validatePdfFile', () => {
    it('accepts a pdf by extension', () => {
      const result = validatePdfFile(makeFile('%PDF-', 'report.pdf'));
      expect(result.name).toBe('report.pdf');
    });

    it('accepts a pdf by mime type', () => {
      const result = validatePdfFile(makeFile('data', 'report', 'application/pdf'));
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it('rejects empty files', () => {
      expect(() => validatePdfFile(makeFile('', 'empty.pdf'))).toThrowError(
        FileValidationError,
      );
    });

    it('rejects non-pdf types', () => {
      expect(() => validatePdfFile(makeFile('x', 'note.txt', 'text/plain'))).toThrowError(
        FileValidationError,
      );
    });

    it('rejects files over the size limit', () => {
      const big = makeFile('x', 'big.pdf', 'application/pdf', 600 * 1024 * 1024);
      expect(() => validatePdfFile(big)).toThrowError(FileValidationError);
    });
  });

  describe('verifyPdfMagic', () => {
    it('resolves for a valid pdf header', async () => {
      const valid = await verifyPdfMagic(makeFile('%PDF-1.7 content', 'a.pdf'));
      expect(valid.name).toBe('a.pdf');
    });

    it('rejects a file without the pdf magic bytes', async () => {
      await expectAsync(
        verifyPdfMagic(makeFile('Hello world', 'fake.pdf')),
      ).toBeRejectedWithError(FileValidationError);
    });
  });

  describe('formatBytes', () => {
    it('formats zero', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });

  describe('safeFileName', () => {
    it('keeps a clean name and adds the extension', () => {
      expect(safeFileName('My Report.PDF')).toBe('my-report.pdf');
    });

    it('strips unsafe characters', () => {
      expect(safeFileName('invoice#2024$ final.pdf')).toBe(
        'invoice-2024-final.pdf',
      );
    });

    it('falls back to a default for empty names', () => {
      expect(safeFileName('   .pdf')).toBe('document.pdf');
    });

    it('honours a custom fallback extension', () => {
      expect(safeFileName('image', 'png')).toBe('image.png');
    });
  });
});
