import { TestBed } from '@angular/core/testing';
import { PDFDocument } from 'pdf-lib';
import { PdfMetadataService } from './pdf-metadata.service';

describe('PdfMetadataService', () => {
  let service: PdfMetadataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfMetadataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should read metadata from created PDF', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('Test Document');
    doc.setAuthor('Test Author');
    doc.setSubject('Unit Testing');
    doc.setKeywords(['angular', 'jasmine']);
    doc.addPage([100, 100]);
    const bytes = await doc.save();

    const meta = await service.readMetadata(new Uint8Array(bytes));
    expect(meta.title).toBe('Test Document');
    expect(meta.author).toBe('Test Author');
    expect(meta.subject).toBe('Unit Testing');
    expect(meta.pageCount).toBe(1);
  });

  it('should update metadata properly', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('Original Title');
    doc.addPage([100, 100]);
    const bytes = await doc.save();

    const updatedBytes = await service.updateMetadata(new Uint8Array(bytes), {
      title: 'Updated Title',
      author: 'New Author',
    });

    const meta = await service.readMetadata(updatedBytes);
    expect(meta.title).toBe('Updated Title');
    expect(meta.author).toBe('New Author');
  });

  it('should strip metadata cleanly', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('Secret Title');
    doc.setAuthor('Secret Author');
    doc.addPage([100, 100]);
    const bytes = await doc.save();

    const strippedBytes = await service.stripMetadata(new Uint8Array(bytes));
    const meta = await service.readMetadata(strippedBytes);
    expect(meta.title).toBe('');
    expect(meta.author).toBe('');
    expect(meta.creator).toBe('');
    expect(meta.producer).toBe('');
    expect(meta.creationDate).toBeNull();
    expect(meta.modificationDate).toBeNull();
  });

  it('should fallback modificationDate to creationDate if file was never modified', async () => {
    const doc = await PDFDocument.create();
    const creation = new Date(2024, 5, 15, 10, 30);
    doc.setCreationDate(creation);
    doc.addPage([100, 100]);
    const bytes = await doc.save();

    // Note: doc.save by default without updateMetadata: false may add mod date,
    // so we pass updateMetadata: false to test a PDF with only CreationDate
    const loadedDoc = await PDFDocument.load(bytes, { updateMetadata: false });
    const { PDFName } = await import('pdf-lib');
    const info = loadedDoc.context.lookup(loadedDoc.context.trailerInfo.Info);
    if (info && typeof (info as any).delete === 'function') {
      (info as any).delete(PDFName.of('ModDate'));
    }
    const cleanBytes = await loadedDoc.save({ useObjectStreams: false });

    const meta = await service.readMetadata(new Uint8Array(cleanBytes));
    expect(meta.creationDate).toBeTruthy();
    expect(meta.modificationDate).toBeTruthy();
    expect(meta.modificationDate?.getTime()).toBe(meta.creationDate?.getTime() ?? 0);
    expect(meta.hasSeparateModDate).toBeFalse();
  });

  it('should preserve original creationDate when updating other metadata', async () => {
    const doc = await PDFDocument.create();
    const originalCreation = new Date(2023, 2, 10, 8, 0);
    doc.setCreationDate(originalCreation);
    doc.setTitle('Before');
    doc.addPage([100, 100]);
    const bytes = await doc.save();

    const updatedBytes = await service.updateMetadata(new Uint8Array(bytes), {
      title: 'After',
      creationDate: originalCreation,
      modificationDate: new Date(2025, 0, 1),
    });

    const meta = await service.readMetadata(updatedBytes);
    expect(meta.title).toBe('After');
    expect(meta.creationDate?.getFullYear()).toBe(2023);
    expect(meta.modificationDate?.getFullYear()).toBe(2025);
  });
});
