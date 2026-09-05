import { TestBed } from '@angular/core/testing';
import { PdfForensicsService } from './pdf-forensics.service';

describe('PdfForensicsService', () => {
  let service: PdfForensicsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfForensicsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should analyze single revision PDF', () => {
    const encoder = new TextEncoder();
    const mockPdf = encoder.encode(
      '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n55\n%%EOF',
    );
    const report = service.analyzeDocument(mockPdf);
    expect(report.revisionCount).toBe(1);
    expect(report.pdfVersion).toBe('PDF 1.7');
    expect(report.revisions.length).toBe(1);
    expect(report.revisions[0].isInitialCreation).toBeTrue();
  });

  it('should detect incremental updates in multi-EOF PDF', () => {
    const encoder = new TextEncoder();
    const mockPdf = encoder.encode(
      '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Size 2 >>\nstartxref\n50\n%%EOF\n' +
        '2 0 obj\n<< /Type /Pages >>\nendobj\ntrailer\n<< /Size 3 /Prev 50 >>\nstartxref\n120\n%%EOF',
    );
    const report = service.analyzeDocument(mockPdf);
    expect(report.revisionCount).toBe(2);
    expect(report.revisions.length).toBe(2);
    expect(report.anomalies.some((a) => a.title.includes('Incremental Updates'))).toBeTrue();
  });
});
