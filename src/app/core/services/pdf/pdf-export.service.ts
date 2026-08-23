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
    pages: readonly ExportPageSpec[],
    options?: ExportOptions,
  ): Promise<Uint8Array> {
    if (!pages.length) {
      throw new Error('The document has no pages to export.');
    }
    const src = await PDFDocument.load(sourceBytes);
    const out = await PDFDocument.create();
    if (options?.title) {
      out.setTitle(options.title);
    }
    if (options?.author) {
      out.setAuthor(options.author);
    }
    const indices = pages.map((p) => p.sourceIndex);
    const copied = await out.copyPages(src, indices);
    pages.forEach((spec, i) => {
      const page = copied[i];
      const normalized = ((spec.rotation % 360) + 360) % 360;
      page.setRotation(degrees(normalized));
      out.addPage(page);
    });
    const data = await out.save();
    return new Uint8Array(data);
  }
}
