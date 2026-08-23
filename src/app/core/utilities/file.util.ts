export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB
const PDF_MAGIC = '%PDF-';

export interface ValidatedFile {
  readonly file: File;
  readonly name: string;
  readonly sizeBytes: number;
}

export function validatePdfFile(file: File): ValidatedFile {
  if (!file) {
    throw new FileValidationError('No file was provided.');
  }
  if (file.size === 0) {
    throw new FileValidationError('The selected file is empty.');
  }
  if (file.size > MAX_BYTES) {
    throw new FileValidationError(
      'This file is too large (max 500 MB).',
    );
  }
  const name = file.name.toLowerCase();
  const looksLikePdf =
    name.endsWith('.pdf') ||
    file.type === 'application/pdf' ||
    file.type === 'application/x-pdf';
  if (!looksLikePdf) {
    throw new FileValidationError(
      'Unsupported file type. Please choose a PDF document.',
    );
  }
  return { file, name: file.name, sizeBytes: file.size };
}

export async function verifyPdfMagic(
  file: File,
): Promise<ValidatedFile> {
  const validated = validatePdfFile(file);
  const head = await file.slice(0, 5).text().catch(() => '');
  if (!head.startsWith(PDF_MAGIC)) {
    throw new FileValidationError(
      'This does not appear to be a valid PDF file.',
    );
  }
  return validated;
}

export function safeFileName(name: string, fallbackExt = 'pdf'): string {
  const base = name.replace(/\.[^.]+$/, '');
  const cleaned = base
    .replace(/[^\w\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  const final = cleaned || 'document';
  return `${final}.${fallbackExt}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
