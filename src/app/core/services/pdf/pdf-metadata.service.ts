import { Injectable } from '@angular/core';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: Date | null;
  modificationDate: Date | null;
  hasSeparateModDate?: boolean;
  pageCount: number;
  fileSizeBytes: number;
  pdfVersion: string;
}

@Injectable({ providedIn: 'root' })
export class PdfMetadataService {
  /**
   * Reads standard and document info metadata from a PDF file.
   */
  async readMetadata(sourceBytes: Uint8Array): Promise<PdfMetadata> {
    const doc = await PDFDocument.load(sourceBytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });
    const pageCount = doc.getPageCount();

    // Detect version
    const latinText = this.bytesToLatin1(sourceBytes.subarray(0, 100));
    const versionMatch = /%PDF-(\d+\.\d+)/.exec(latinText);
    const pdfVersion = versionMatch ? `PDF ${versionMatch[1]}` : 'PDF 1.7';

    const keywordsArray = doc.getKeywords();
    const keywords = Array.isArray(keywordsArray) ? keywordsArray.join(', ') : (keywordsArray ?? '');

    let creationDate: Date | null = null;
    try {
      const cd = doc.getCreationDate();
      if (cd && !isNaN(cd.getTime())) {
        creationDate = cd;
      }
    } catch {
      creationDate = null;
    }

    let rawModificationDate: Date | null = null;
    try {
      const md = doc.getModificationDate();
      if (md && !isNaN(md.getTime())) {
        rawModificationDate = md;
      }
    } catch {
      rawModificationDate = null;
    }

    const hasSeparateModDate = !!rawModificationDate;
    let modificationDate: Date | null = rawModificationDate;

    // If this file was not modified anytime, show the same date as the creation date
    if (!modificationDate && creationDate) {
      modificationDate = new Date(creationDate.getTime());
    }

    return {
      title: doc.getTitle() ?? '',
      author: doc.getAuthor() ?? '',
      subject: doc.getSubject() ?? '',
      keywords,
      creator: doc.getCreator() ?? '',
      producer: doc.getProducer() ?? '',
      creationDate,
      modificationDate,
      hasSeparateModDate,
      pageCount,
      fileSizeBytes: sourceBytes.byteLength,
      pdfVersion,
    };
  }

  /**
   * Updates the document metadata and returns a newly saved PDF Uint8Array.
   * If a field is passed as empty string or null, it is completely removed from the PDF Info dictionary.
   */
  async updateMetadata(
    sourceBytes: Uint8Array,
    updates: Partial<Omit<PdfMetadata, 'pageCount' | 'fileSizeBytes' | 'pdfVersion'>>,
  ): Promise<Uint8Array> {
    const doc = await PDFDocument.load(sourceBytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });

    const info = doc.context.lookup(doc.context.trailerInfo.Info);
    const hasInfoDict = info instanceof PDFDict;

    const setOrDelete = (key: string, val?: string) => {
      if (val !== undefined) {
        if (val.trim()) {
          switch (key) {
            case 'Title':
              doc.setTitle(val);
              break;
            case 'Author':
              doc.setAuthor(val);
              break;
            case 'Subject':
              doc.setSubject(val);
              break;
            case 'Creator':
              doc.setCreator(val);
              break;
            case 'Producer':
              doc.setProducer(val);
              break;
          }
        } else if (hasInfoDict) {
          info.delete(PDFName.of(key));
        }
      }
    };

    setOrDelete('Title', updates.title);
    setOrDelete('Author', updates.author);
    setOrDelete('Subject', updates.subject);
    setOrDelete('Creator', updates.creator);
    setOrDelete('Producer', updates.producer);

    if (updates.keywords !== undefined) {
      if (updates.keywords.trim()) {
        const kwList = updates.keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean);
        doc.setKeywords(kwList);
      } else if (hasInfoDict) {
        info.delete(PDFName.of('Keywords'));
      }
    }

    // Creation Date: if explicitly provided, update or delete; if undefined, keep original intact
    if (updates.creationDate !== undefined) {
      if (updates.creationDate !== null && !isNaN(updates.creationDate.getTime())) {
        doc.setCreationDate(updates.creationDate);
      } else if (hasInfoDict) {
        info.delete(PDFName.of('CreationDate'));
      }
    }

    // Modification Date: if explicitly provided, update or delete; if undefined, set to now
    if (updates.modificationDate !== undefined) {
      if (updates.modificationDate !== null && !isNaN(updates.modificationDate.getTime())) {
        doc.setModificationDate(updates.modificationDate);
      } else if (hasInfoDict) {
        info.delete(PDFName.of('ModDate'));
      }
    } else {
      doc.setModificationDate(new Date());
    }

    const saved = await doc.save({ useObjectStreams: true });
    return new Uint8Array(saved);
  }

  /**
   * Strips all identifiable metadata (Title, Author, Subject, Keywords, Creator, Producer, Dates)
   * for complete privacy sanitization before sharing documents publicly.
   */
  async stripMetadata(sourceBytes: Uint8Array): Promise<Uint8Array> {
    const doc = await PDFDocument.load(sourceBytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });

    // Wipe all standard info dictionary entries
    const info = doc.context.lookup(doc.context.trailerInfo.Info);
    if (info instanceof PDFDict) {
      info.delete(PDFName.of('Title'));
      info.delete(PDFName.of('Author'));
      info.delete(PDFName.of('Subject'));
      info.delete(PDFName.of('Keywords'));
      info.delete(PDFName.of('Creator'));
      info.delete(PDFName.of('Producer'));
      info.delete(PDFName.of('CreationDate'));
      info.delete(PDFName.of('ModDate'));
    }

    // Wipe XMP metadata stream from catalog if present
    const catalog = doc.catalog;
    if (catalog && typeof (catalog as any).delete === 'function') {
      (catalog as any).delete(PDFName.of('Metadata'));
    }

    const saved = await doc.save({ useObjectStreams: true });
    return new Uint8Array(saved);
  }

  private bytesToLatin1(bytes: Uint8Array): string {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i]);
    }
    return result;
  }
}
