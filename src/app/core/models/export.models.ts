/**
 * Models and utility functions for PDF Export in PDFForge.
 */

export type ExportPageRangeType = 'all' | 'current' | 'custom' | 'selected';

export interface ExportProgressUpdate {
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly percentage: number;
  readonly stage: string;
}

export interface DetailedExportOptions {
  readonly filename: string;
  readonly pageRange: ExportPageRangeType;
  readonly customPageRange?: string; // e.g. "1-3, 5, 7-9"
  readonly includeAnnotations: boolean;
  readonly includeImagesAndSignatures: boolean;
  readonly includeStamps: boolean;
  readonly title?: string;
  readonly author?: string;
  readonly subject?: string;
  readonly creator?: string;
}

/**
 * Safely parses a page range string such as "1-3, 5, 8-10" into a 0-based array of indices.
 * Guaranteed to be sorted, deduplicated, and clamped to [0, totalPages - 1].
 */
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || totalPages <= 0) return [];

  const matched = new Set<number>();
  const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let i = min; i <= max; i++) {
          matched.add(i - 1);
        }
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        matched.add(pageNum - 1);
      }
    }
  }

  return Array.from(matched).sort((a, b) => a - b);
}

/**
 * Sanitizes a filename to ensure safe download naming and .pdf extension.
 */
export function sanitizePdfFilename(name: string, fallback = 'document-edited.pdf'): string {
  if (!name || !name.trim()) return fallback;
  let cleaned = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  if (!cleaned.toLowerCase().endsWith('.pdf')) {
    cleaned += '.pdf';
  }
  return cleaned;
}
