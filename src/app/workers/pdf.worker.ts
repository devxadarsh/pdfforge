/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { PDFDocument } from 'pdf-lib';

export interface WorkerFileInfo {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface WorkerPermissions {
  readonly print: boolean;
  readonly copy: boolean;
  readonly modify: boolean;
}

export interface PdfWorkerApi {
  mergePdfs(files: WorkerFileInfo[]): Promise<Uint8Array>;
  splitPdf(sourceBytes: Uint8Array, ranges: number[][]): Promise<Uint8Array[]>;
  compressPdf(
    sourceBytes: Uint8Array,
    level: 'recommended' | 'strong' | 'extreme',
  ): Promise<Uint8Array>;
  protectPdf(
    sourceBytes: Uint8Array,
    userPassword: string,
    ownerPassword?: string,
    permissions?: WorkerPermissions,
  ): Promise<Uint8Array>;
  unlockPdf(sourceBytes: Uint8Array, password: string): Promise<Uint8Array>;
}

let cachedQpdf: any = null;

function resolveWasmUrl(file: string): string {
  const name = file || 'qpdf.wasm';
  try {
    return new URL(`assets/${name}`, self.location.href).href;
  } catch {
    return `assets/${name}`;
  }
}

async function getQpdf(): Promise<any> {
  if (cachedQpdf) return cachedQpdf;
  const qpdfModule = await import('@neslinesli93/qpdf-wasm');
  const factory = ((qpdfModule as any).default || qpdfModule) as any;
  cachedQpdf = await factory({
    locateFile: (file: string) => resolveWasmUrl(file),
  });
  return cachedQpdf;
}

const api: PdfWorkerApi = {
  async mergePdfs(files: WorkerFileInfo[]): Promise<Uint8Array> {
    if (!files || files.length === 0) {
      throw new Error('No PDF files provided for merge.');
    }
    const merged = await PDFDocument.create();
    merged.setProducer('PDFForge (Client-Side Worker)');
    merged.setCreator('PDFForge');

    for (const file of files) {
      const srcDoc = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
      const pageIndices = srcDoc.getPageIndices();
      const copiedPages = await merged.copyPages(srcDoc, pageIndices);
      for (const page of copiedPages) {
        merged.addPage(page);
      }
    }

    const output = await merged.save();
    return new Uint8Array(output);
  },

  async splitPdf(sourceBytes: Uint8Array, ranges: number[][]): Promise<Uint8Array[]> {
    if (!sourceBytes || sourceBytes.byteLength === 0) {
      throw new Error('Empty PDF source bytes.');
    }
    const srcDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    const results: Uint8Array[] = [];

    for (const range of ranges) {
      const validIndices = range.filter((idx) => idx >= 0 && idx < totalPages);
      if (validIndices.length === 0) continue;

      const subDoc = await PDFDocument.create();
      subDoc.setProducer('PDFForge (Client-Side Worker)');
      const copied = await subDoc.copyPages(srcDoc, validIndices);
      for (const page of copied) {
        subDoc.addPage(page);
      }
      const bytes = await subDoc.save();
      results.push(new Uint8Array(bytes));
    }

    return results;
  },

  async compressPdf(
    sourceBytes: Uint8Array,
    level: 'recommended' | 'strong' | 'extreme',
  ): Promise<Uint8Array> {
    if (!sourceBytes || sourceBytes.byteLength === 0) {
      throw new Error('Empty PDF source bytes.');
    }

    // Try QPDF-WASM linearization & stream compression if available in browser worker
    try {
      const qpdf = await getQpdf();
      if (qpdf && qpdf.FS) {
        const inName = `input_${Date.now()}.pdf`;
        const outName = `compressed_${Date.now()}.pdf`;
        qpdf.FS.writeFile(inName, sourceBytes);

        const args = ['--linearize'];
        if (level === 'extreme') {
          args.push('--recompress-flate', '--compression-level=9', '--object-streams=generate');
        } else if (level === 'strong') {
          args.push('--recompress-flate', '--compression-level=7', '--object-streams=generate');
        } else {
          args.push('--object-streams=generate');
        }
        args.push(inName, outName);

        const code = qpdf.callMain(args);
        if (code === 0 || code === 3) {
          const result = qpdf.FS.readFile(outName);
          try {
            qpdf.FS.unlink(inName);
            qpdf.FS.unlink(outName);
          } catch {}
          return new Uint8Array(result);
        }
      }
    } catch {
      // Fallback to pdf-lib stream rebuild
    }

    // Fallback: Rebuild document with pdf-lib objects and stream compression
    const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    doc.setProducer('PDFForge Compressed');
    const saved = await doc.save({ useObjectStreams: true });
    return new Uint8Array(saved);
  },

  async protectPdf(
    sourceBytes: Uint8Array,
    userPassword: string,
    ownerPassword?: string,
    permissions?: WorkerPermissions,
  ): Promise<Uint8Array> {
    if (!sourceBytes || sourceBytes.byteLength === 0) {
      throw new Error('Empty PDF source bytes.');
    }

    try {
      const qpdf = await getQpdf();
      if (qpdf && qpdf.FS) {
        const inName = `unprot_${Date.now()}.pdf`;
        const outName = `prot_${Date.now()}.pdf`;
        qpdf.FS.writeFile(inName, sourceBytes);

        const opw = ownerPassword || userPassword;
        const args = [
          '--encrypt',
          userPassword,
          opw,
          '256',
        ];

        if (permissions) {
          if (!permissions.print) args.push('--print=none');
          if (!permissions.copy) args.push('--extract=n');
          if (!permissions.modify) args.push('--modify=none');
        }

        args.push('--', inName, outName);

        const code = qpdf.callMain(args);
        if (code === 0 || code === 3) {
          const result = qpdf.FS.readFile(outName);
          try {
            qpdf.FS.unlink(inName);
            qpdf.FS.unlink(outName);
          } catch {}
          return new Uint8Array(result);
        }
      }
    } catch (err) {
      console.warn('[PdfWorker] QPDF protect failed, fallback:', err);
    }

    // Fallback to error if WASM not present for AES encryption
    throw new Error('PDF Encryption requires QPDF WebAssembly engine.');
  },

  async unlockPdf(sourceBytes: Uint8Array, password: string): Promise<Uint8Array> {
    if (!sourceBytes || sourceBytes.byteLength === 0) {
      throw new Error('Empty PDF source bytes.');
    }

    try {
      const qpdf = await getQpdf();
      if (qpdf && qpdf.FS) {
        const inName = `locked_${Date.now()}.pdf`;
        const outName = `unlocked_${Date.now()}.pdf`;
        qpdf.FS.writeFile(inName, sourceBytes);

        const args = [`--password=${password}`, '--decrypt', inName, outName];
        const code = qpdf.callMain(args);
        if (code === 0 || code === 3) {
          const result = qpdf.FS.readFile(outName);
          try {
            qpdf.FS.unlink(inName);
            qpdf.FS.unlink(outName);
          } catch {}
          return new Uint8Array(result);
        }
      }
    } catch (err) {
      console.warn('[PdfWorker] QPDF unlock failed:', err);
    }

    // Fallback: try loading with pdf-lib ignoreEncryption
    const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const saved = await doc.save();
    return new Uint8Array(saved);
  },
};

Comlink.expose(api);
