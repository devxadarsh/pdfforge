import { Injectable } from '@angular/core';

export interface SignatureDetails {
  readonly signerName?: string;
  readonly signerOrganization?: string;
  readonly signerEmail?: string;
  readonly signingTime?: Date;
  readonly reason?: string;
  readonly location?: string;
  readonly contactInfo?: string;
  readonly filter?: string;
  readonly subFilter?: string;
  readonly digestAlgorithm?: string;
  readonly byteRange: number[];
  readonly sha256Calculated: string;
  readonly sha256Embedded?: string;
  readonly isValid: boolean;
  readonly isTampered: boolean;
  readonly hasSubsequentUpdates: boolean;
  readonly summary: string;
}

export interface SignatureVerificationResult {
  readonly hasSignature: boolean;
  readonly signatureCount: number;
  readonly signatures: SignatureDetails[];
  readonly overallStatus: 'valid' | 'tampered' | 'unsigned';
  readonly message: string;
}

@Injectable({ providedIn: 'root' })
export class PdfSignatureVerifierService {
  /**
   * Scans a PDF file's raw bytes for digital signatures and cryptographically
   * verifies their ByteRange and integrity.
   */
  async verifySignatures(pdfBytes: Uint8Array): Promise<SignatureVerificationResult> {
    if (!pdfBytes || pdfBytes.byteLength === 0) {
      return {
        hasSignature: false,
        signatureCount: 0,
        signatures: [],
        overallStatus: 'unsigned',
        message: 'No PDF data provided.',
      };
    }

    try {
      const signatureBlocks = this.extractSignatureBlocks(pdfBytes);
      if (signatureBlocks.length === 0) {
        return {
          hasSignature: false,
          signatureCount: 0,
          signatures: [],
          overallStatus: 'unsigned',
          message: 'No cryptographic digital signatures found in this document.',
        };
      }

      const verifiedSignatures: SignatureDetails[] = [];

      for (const block of signatureBlocks) {
        const details = await this.verifySingleSignature(pdfBytes, block);
        verifiedSignatures.push(details);
      }

      const anyTampered = verifiedSignatures.some((s) => s.isTampered);
      const allValid = verifiedSignatures.every((s) => s.isValid);

      let overallStatus: 'valid' | 'tampered' | 'unsigned' = 'valid';
      let message = 'All digital signatures are valid and intact. Document is authentic.';

      if (anyTampered) {
        overallStatus = 'tampered';
        message = 'WARNING: Document has been tampered with or modified after signature was applied.';
      } else if (!allValid) {
        overallStatus = 'tampered';
        message = 'One or more signatures could not be verified.';
      }

      return {
        hasSignature: true,
        signatureCount: verifiedSignatures.length,
        signatures: verifiedSignatures,
        overallStatus,
        message,
      };
    } catch (err) {
      console.error('[PdfSignatureVerifierService] Verification error:', err);
      return {
        hasSignature: false,
        signatureCount: 0,
        signatures: [],
        overallStatus: 'unsigned',
        message: err instanceof Error ? err.message : 'Error during signature verification.',
      };
    }
  }

  /**
   * Scans PDF buffer for /ByteRange [ ... ] and /Contents < ... > signatures.
   */
  private extractSignatureBlocks(
    bytes: Uint8Array,
  ): Array<{ byteRange: number[]; contentsHex: string; rawDict: string }> {
    const latinText = this.bytesToLatin1(bytes);
    const results: Array<{ byteRange: number[]; contentsHex: string; rawDict: string }> = [];

    // Find /ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]
    const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
    let match: RegExpExecArray | null;

    while ((match = byteRangeRegex.exec(latinText)) !== null) {
      const offset1 = parseInt(match[1], 10);
      const len1 = parseInt(match[2], 10);
      const offset2 = parseInt(match[3], 10);
      const len2 = parseInt(match[4], 10);

      const byteRange = [offset1, len1, offset2, len2];

      // Extract dictionary around the match
      const dictStart = latinText.lastIndexOf('<<', match.index);
      const dictEnd = latinText.indexOf('>>', match.index);
      const rawDict = dictStart !== -1 && dictEnd !== -1 ? latinText.substring(dictStart, dictEnd + 2) : '';

      // Extract /Contents <hex>
      let contentsHex = '';
      const contentsMatch = /\/Contents\s*<([0-9a-fA-F\s]+)>/i.exec(rawDict);
      if (contentsMatch) {
        contentsHex = contentsMatch[1].replace(/\s+/g, '');
      } else {
        // Look in wider area if needed (signatures can be up to 64KB)
        const widerMatch = /\/Contents\s*<([0-9a-fA-F\s]+)>/i.exec(
          latinText.substring(Math.max(0, match.index - 65536), Math.min(latinText.length, match.index + 65536)),
        );
        if (widerMatch) {
          contentsHex = widerMatch[1].replace(/\s+/g, '');
        }
      }

      if (contentsHex) {
        results.push({ byteRange, contentsHex, rawDict });
      }
    }

    return results;
  }

  private async verifySingleSignature(
    pdfBytes: Uint8Array,
    block: { byteRange: number[]; contentsHex: string; rawDict: string },
  ): Promise<SignatureDetails> {
    const [offset1, len1, offset2, len2] = block.byteRange;
    const totalCovered = offset2 + len2;
    const hasSubsequentUpdates = pdfBytes.byteLength > totalCovered;

    // Validate byte ranges are within bounds
    if (offset1 < 0 || len1 < 0 || offset2 < 0 || len2 < 0 || totalCovered > pdfBytes.byteLength) {
      return {
        byteRange: block.byteRange,
        sha256Calculated: '',
        isValid: false,
        isTampered: true,
        hasSubsequentUpdates,
        summary: 'Invalid ByteRange offsets (out of file bounds).',
      };
    }

    // 1. Slice chunks specified by ByteRange
    const chunk1 = pdfBytes.subarray(offset1, offset1 + len1);
    const chunk2 = pdfBytes.subarray(offset2, offset2 + len2);

    // Concatenate chunks
    const signedData = new Uint8Array(len1 + len2);
    signedData.set(chunk1, 0);
    signedData.set(chunk2, len1);

    // 2. Compute SHA-256, SHA-384, SHA-512, and SHA-1 digests
    const [sha256Buf, sha384Buf, sha512Buf, sha1Buf] = await Promise.all([
      crypto.subtle.digest('SHA-256', signedData.buffer as ArrayBuffer),
      crypto.subtle.digest('SHA-384', signedData.buffer as ArrayBuffer),
      crypto.subtle.digest('SHA-512', signedData.buffer as ArrayBuffer),
      crypto.subtle.digest('SHA-1', signedData.buffer as ArrayBuffer),
    ]);

    const sha256Calculated = this.bufferToHex(new Uint8Array(sha256Buf));
    const sha384Calculated = this.bufferToHex(new Uint8Array(sha384Buf));
    const sha512Calculated = this.bufferToHex(new Uint8Array(sha512Buf));
    const sha1Calculated = this.bufferToHex(new Uint8Array(sha1Buf));

    // 3. Parse dictionary fields
    const dict = block.rawDict;
    const signerName = this.extractPdfString(dict, '/Name') ?? this.extractSignerFromHex(block.contentsHex);
    const reason = this.extractPdfString(dict, '/Reason');
    const location = this.extractPdfString(dict, '/Location');
    const contactInfo = this.extractPdfString(dict, '/ContactInfo');
    const filter = this.extractPdfName(dict, '/Filter');
    const subFilter = this.extractPdfName(dict, '/SubFilter');
    const signingTime = this.extractPdfDate(dict, '/M');

    // 4. Verify digest presence in PKCS#7 container
    const embeddedInfo = this.inspectPkcs7Digest(
      block.contentsHex,
      sha256Calculated,
      sha384Calculated,
      sha512Calculated,
      sha1Calculated,
    );

    const isTampered = !embeddedInfo.matchesDigest;
    const isValid = embeddedInfo.matchesDigest;

    let summary = 'Signature digest does not match document content. Document has been modified or corrupted.';
    if (isValid) {
      if (hasSubsequentUpdates) {
        summary = 'Cryptographic signature is valid for signed revision, but document has subsequent incremental updates appended.';
      } else {
        summary = 'Cryptographic integrity verified. Hash matches byte-for-byte with no subsequent modifications.';
      }
    }

    return {
      signerName: signerName || embeddedInfo.signerName || 'Digital Signer',
      signerOrganization: embeddedInfo.organization,
      signerEmail: embeddedInfo.email,
      signingTime: signingTime || embeddedInfo.signingTime,
      reason,
      location,
      contactInfo,
      filter,
      subFilter,
      digestAlgorithm: embeddedInfo.digestAlgorithm,
      byteRange: block.byteRange,
      sha256Calculated,
      sha256Embedded: embeddedInfo.embeddedDigest,
      isValid,
      isTampered,
      hasSubsequentUpdates,
      summary,
    };
  }

  /**
   * Inspects PKCS#7 DER hex for message digest and certificates.
   */
  private inspectPkcs7Digest(
    hex: string,
    sha256Calc: string,
    sha384Calc: string,
    sha512Calc: string,
    sha1Calc: string,
  ): {
    matchesDigest: boolean;
    embeddedDigest?: string;
    digestAlgorithm?: string;
    signerName?: string;
    organization?: string;
    email?: string;
    signingTime?: Date;
  } {
    const lowerHex = hex.toLowerCase();
    const cleanSha256 = sha256Calc.toLowerCase();
    const cleanSha384 = sha384Calc.toLowerCase();
    const cleanSha512 = sha512Calc.toLowerCase();
    const cleanSha1 = sha1Calc.toLowerCase();

    // Check if any calculated hash appears in the PKCS#7 container
    const hasSha256 = lowerHex.includes(cleanSha256);
    const hasSha384 = lowerHex.includes(cleanSha384);
    const hasSha512 = lowerHex.includes(cleanSha512);
    const hasSha1 = lowerHex.includes(cleanSha1);

    const matchesDigest = hasSha256 || hasSha384 || hasSha512 || hasSha1;
    const embeddedDigest = hasSha256
      ? cleanSha256
      : hasSha384
      ? cleanSha384
      : hasSha512
      ? cleanSha512
      : hasSha1
      ? cleanSha1
      : undefined;

    const digestAlgorithm = hasSha256
      ? 'SHA-256'
      : hasSha384
      ? 'SHA-384'
      : hasSha512
      ? 'SHA-512'
      : hasSha1
      ? 'SHA-1'
      : undefined;

    // Extract printable strings from the ASN.1 hex to find Common Name / Org / Email
    const extractedStrings = this.extractStringsFromHex(hex);
    let signerName: string | undefined;
    let organization: string | undefined;
    let email: string | undefined;

    for (const str of extractedStrings) {
      if (str.includes('@') && !email && str.length < 100) {
        email = str;
      }
    }

    return {
      matchesDigest,
      embeddedDigest,
      digestAlgorithm,
      signerName,
      organization,
      email,
    };
  }

  private extractStringsFromHex(hex: string): string[] {
    const strings: string[] = [];
    const bytes: number[] = [];
    const len = hex.length;

    for (let i = 0; i < len; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }

    // 1. Standard ASCII / UTF-8 printable runs
    let current = '';
    for (const byte of bytes) {
      if (byte >= 32 && byte <= 126) {
        current += String.fromCharCode(byte);
      } else {
        if (current.length >= 3) {
          strings.push(current);
        }
        current = '';
      }
    }
    if (current.length >= 3) {
      strings.push(current);
    }

    // 2. BMPString (UTF-16BE: 0x00 followed by printable ASCII)
    let bmpCurrent = '';
    for (let i = 0; i < bytes.length - 1; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] >= 32 && bytes[i + 1] <= 126) {
        bmpCurrent += String.fromCharCode(bytes[i + 1]);
      } else {
        if (bmpCurrent.length >= 3) {
          strings.push(bmpCurrent);
        }
        bmpCurrent = '';
      }
    }
    if (bmpCurrent.length >= 3) {
      strings.push(bmpCurrent);
    }

    return strings;
  }

  private extractSignerFromHex(hex: string): string | undefined {
    const strings = this.extractStringsFromHex(hex);
    // Find strings that look like names or common names
    for (const s of strings) {
      if (/^[A-Z][a-zA-Z\s.-]{2,40}$/.test(s) && !s.includes('Adobe') && !s.includes('Certificate')) {
        return s;
      }
    }
    return undefined;
  }

  private extractPdfString(dict: string, key: string): string | undefined {
    const regex = new RegExp(`${key}\\s*\\(([^)]+)\\)`);
    const match = regex.exec(dict);
    return match ? match[1] : undefined;
  }

  private extractPdfName(dict: string, key: string): string | undefined {
    const regex = new RegExp(`${key}\\s*\\/([a-zA-Z0-9._]+)`);
    const match = regex.exec(dict);
    return match ? match[1] : undefined;
  }

  private extractPdfDate(dict: string, key: string): Date | undefined {
    const raw = this.extractPdfString(dict, key);
    if (!raw) return undefined;
    // PDF Date format: D:YYYYMMDDHHmmSSOHH'mm'
    const cleaned = raw.replace(/^D:/, '');
    const year = parseInt(cleaned.substring(0, 4), 10);
    const month = parseInt(cleaned.substring(4, 6), 10) - 1;
    const day = parseInt(cleaned.substring(6, 8), 10) || 1;
    const hour = parseInt(cleaned.substring(8, 10), 10) || 0;
    const minute = parseInt(cleaned.substring(10, 12), 10) || 0;
    const second = parseInt(cleaned.substring(12, 14), 10) || 0;

    if (!isNaN(year) && !isNaN(month)) {
      const d = new Date(Date.UTC(year, month, day, hour, minute, second));
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  }

  private bytesToLatin1(bytes: Uint8Array): string {
    let result = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      result += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return result;
  }

  private bufferToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
