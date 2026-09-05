import { TestBed } from '@angular/core/testing';
import { PdfSignatureVerifierService } from './pdf-signature-verifier.service';

describe('PdfSignatureVerifierService', () => {
  let service: PdfSignatureVerifierService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfSignatureVerifierService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should report unsigned for empty pdf buffer', async () => {
    const result = await service.verifySignatures(new Uint8Array(0));
    expect(result.hasSignature).toBeFalse();
    expect(result.overallStatus).toBe('unsigned');
  });

  it('should report unsigned for regular unsigned pdf', async () => {
    const encoder = new TextEncoder();
    const mockPdf = encoder.encode('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const result = await service.verifySignatures(mockPdf);
    expect(result.hasSignature).toBeFalse();
    expect(result.overallStatus).toBe('unsigned');
  });
});
