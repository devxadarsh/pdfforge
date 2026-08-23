import { Injectable } from '@angular/core';
import { PDFDocument, PDFName, PDFHexString } from 'pdf-lib';
import * as forge from 'node-forge';
import { DigitalSignatureRequest } from '../../models/pdf.models';

const PLACEHOLDER_HEX_CHARS = 16384;

@Injectable({ providedIn: 'root' })
export class PdfSignService {
  async sign(
    bytes: Uint8Array,
    req: DigitalSignatureRequest,
  ): Promise<Uint8Array> {
    const p12Der = forge.util.binary.raw.encode(req.certBytes);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, req.password);

    const keyBag =
      p12.getBags({ bagType: forge.pki.oids['pkcs8ShroudedKeyBag'] })[
        forge.pki.oids['pkcs8ShroudedKeyBag']
      ]?.[0];
    if (!keyBag) {
      throw new Error('No private key was found in the certificate file.');
    }
    const privateKey = keyBag.key;

    const certBags =
      p12.getBags({ bagType: forge.pki.oids['certBag'] })[
        forge.pki.oids['certBag']
      ];
    if (!certBags?.length) {
      throw new Error('No certificate was found in the file.');
    }
    const cert = certBags[0].cert;
    if (!cert) {
      throw new Error('No certificate was found in the file.');
    }
    const signerName =
      req.signerName?.trim() ||
      cert.subject.getField('CN')?.value ||
      'Signed by PDFForge';

    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    if (!pages.length) {
      throw new Error('The document has no pages to sign.');
    }
    const lastPage = pages[pages.length - 1];

    const signature = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: 'adbe.pkcs7.detached',
        ByteRange: [0, 9999999999, 9999999999, 9999999999],
        Contents: PDFHexString.of('0'.repeat(PLACEHOLDER_HEX_CHARS * 2)),
        Reason: req.reason ?? 'Signed with PDFForge',
        M: new Date().toISOString(),
        Location: req.location ?? '',
        ContactInfo: req.contactInfo ?? '',
        Name: signerName,
      }),
    );

    const widget = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        Rect: [0, 0, 0, 0],
        V: signature,
        T: 'PDFForgeSignature',
        F: 0,
        P: lastPage.ref,
      }),
    );

    lastPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([widget]));
    pdfDoc.catalog.set(
      PDFName.of('AcroForm'),
      pdfDoc.context.obj({ Fields: [widget], SigFlags: 3 }),
    );

    const saved = await pdfDoc.save({ useObjectStreams: false });
    const certChain = certBags
      .map((b) => b.cert)
      .filter((c): c is forge.pki.Certificate => !!c);
    return this.embedCms(saved, certChain, privateKey as forge.pki.rsa.PrivateKey, cert);
  }

  private embedCms(
    saved: Uint8Array,
    certs: forge.pki.Certificate[],
    privateKey: forge.pki.rsa.PrivateKey,
    leafCert: forge.pki.Certificate,
  ): Uint8Array {
    let pdfString = '';
    const chunk = 8192;
    for (let i = 0; i < saved.length; i += chunk) {
      pdfString += String.fromCharCode(...saved.subarray(i, i + chunk));
    }

    const contentsIdx = pdfString.indexOf('/Contents');
    if (contentsIdx < 0) {
      throw new Error('Could not locate the signature placeholder.');
    }
    const hexStart = pdfString.indexOf('<', contentsIdx);
    const hexEnd = pdfString.indexOf('>', hexStart);
    const sigStart = contentsIdx;
    const sigEnd = hexEnd + 1;
    const placeholderHex = pdfString.substring(hexStart + 1, hexEnd);
    const L = placeholderHex.length;

    const before = pdfString.substring(0, sigStart);
    const after = pdfString.substring(sigEnd);
    const message = before + after;

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(message);
    for (const c of certs) {
      p7.addCertificate(c);
    }
    const md = forge.md.sha256.create();
    md.update(message, 'raw');
    p7.addSigner({
      key: privateKey,
      certificate: leafCert,
      digestAlgorithm: forge.pki.oids['sha256'],
      authenticatedAttributes: [
        { type: forge.pki.oids['contentType'], value: forge.pki.oids['data'] },
        {
          type: forge.pki.oids['messageDigest'],
          value: md.digest().getBytes(),
        },
      ],
    });
    p7.sign({ detached: true });

    const cmsDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const cmsHex = forge.util.bytesToHex(cmsDer);
    if (cmsHex.length > L) {
      throw new Error(
        'The certificate chain is too large to embed. Use a certificate with a smaller chain.',
      );
    }
    const padded = cmsHex.padEnd(L, '0');

    let newPdfString = before + '/Contents <' + padded + '>' + after;

    const brRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/;
    const brMatch = newPdfString.match(brRegex);
    if (!brMatch) {
      throw new Error('Could not locate the signature ByteRange.');
    }
    const widths = [
      brMatch[1].length,
      brMatch[2].length,
      brMatch[3].length,
      brMatch[4].length,
    ];
    const total = newPdfString.length;
    const real = [0, sigStart, sigEnd, total - sigEnd].map((n, idx) =>
      String(n).padStart(widths[idx], '0'),
    );
    const newBr = `/ByteRange [ ${real[0]} ${real[1]} ${real[2]} ${real[3]} ]`;
    newPdfString = newPdfString.replace(brRegex, newBr);

    const out = new Uint8Array(newPdfString.length);
    for (let i = 0; i < newPdfString.length; i++) {
      out[i] = newPdfString.charCodeAt(i) & 0xff;
    }
    return out;
  }
}
