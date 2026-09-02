/**
 * Domain-specific error classes for PDF operations in PDFForge.
 * Prevents raw internal stack traces from bubbling to user-facing UI.
 */

export class PdfError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PdfError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidPdfError extends PdfError {
  constructor(message = 'The provided file is not a valid or readable PDF document.', cause?: unknown) {
    super(message, 'INVALID_PDF', cause);
    this.name = 'InvalidPdfError';
  }
}

export class PdfExportError extends PdfError {
  constructor(message = 'An unexpected error occurred while generating or exporting the PDF.', cause?: unknown) {
    super(message, 'PDF_EXPORT_ERROR', cause);
    this.name = 'PdfExportError';
  }
}

export class UnsupportedPdfOperationError extends PdfError {
  constructor(message = 'This PDF operation is not supported by the client-side engine.', cause?: unknown) {
    super(message, 'UNSUPPORTED_PDF_OPERATION', cause);
    this.name = 'UnsupportedPdfOperationError';
  }
}

export class PdfLoadError extends PdfError {
  constructor(message = 'Failed to load or parse the PDF document.', cause?: unknown) {
    super(message, 'PDF_LOAD_ERROR', cause);
    this.name = 'PdfLoadError';
  }
}

export class PdfRenderError extends PdfError {
  constructor(message = 'Failed to render PDF pages or overlays.', cause?: unknown) {
    super(message, 'PDF_RENDER_ERROR', cause);
    this.name = 'PdfRenderError';
  }
}

export class FileValidationError extends PdfError {
  constructor(message = 'File validation failed.', cause?: unknown) {
    super(message, 'FILE_VALIDATION_ERROR', cause);
    this.name = 'FileValidationError';
  }
}
