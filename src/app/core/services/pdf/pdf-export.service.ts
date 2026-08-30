import { Injectable } from '@angular/core';
import { PDFDocument, degrees } from 'pdf-lib';

export interface ExportPageSpec {
  readonly sourceIndex: number;
  readonly rotation: number;
}

export interface ExportOptions {
  readonly filename?: string;
  readonly author?: string;
  readonly title?: string;
}

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  async exportDocument(
    sourceBytes: Uint8Array,
    pages?: readonly ExportPageSpec[],
    options?: ExportOptions,
  ): Promise<Uint8Array> {
    if (!sourceBytes || sourceBytes.byteLength === 0) {
      throw new Error('Invalid PDF: document bytes are empty.');
    }

    const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();

    if (options?.title) {
      out.setTitle(options.title);
    }
    if (options?.author) {
      out.setAuthor(options.author);
    }

    const totalPages = src.getPageCount();
    if (totalPages === 0) {
      throw new Error('The PDF document contains no pages.');
    }

    // Filter valid page specs with bounds checking
    const validPages = (pages ?? []).filter(
      (p) =>
        p &&
        typeof p.sourceIndex === 'number' &&
        p.sourceIndex >= 0 &&
        p.sourceIndex < totalPages,
    );

    if (validPages.length > 0) {
      for (const spec of validPages) {
        try {
          const [copiedPage] = await out.copyPages(src, [spec.sourceIndex]);
          if (copiedPage) {
            const rot = typeof spec.rotation === 'number' ? spec.rotation : 0;
            const normalized = ((rot % 360) + 360) % 360;
            copiedPage.setRotation(degrees(normalized));
            out.addPage(copiedPage);
          }
        } catch (copyErr) {
          console.warn(
            '[PdfExportService] Failed to copy page at index:',
            spec.sourceIndex,
            copyErr,
          );
        }
      }
    }

    // Fallback: If no pages were copied, copy all original pages
    if (out.getPageCount() === 0) {
      const allIndices = Array.from({ length: totalPages }, (_, i) => i);
      const copiedAll = await out.copyPages(src, allIndices);
      for (const page of copiedAll) {
        if (page) {
          out.addPage(page);
        }
      }
    }

    const data = await out.save();
    return new Uint8Array(data);
  }
}
