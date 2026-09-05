import { Injectable, OnDestroy } from '@angular/core';
import { createWorker, Worker as TesseractWorker } from 'tesseract.js';

export interface OcrResult {
  readonly text: string;
  readonly confidence: number;
}

export interface OcrProgress {
  readonly status: string;
  readonly progress: number;
}

/**
 * In-browser client-side OCR service using Tesseract.js WASM engine.
 *
 * 100% private: all text extraction and recognition happens locally in the browser
 * without ever uploading document pages or images to any server.
 */
@Injectable({ providedIn: 'root' })
export class OcrService implements OnDestroy {
  private workerPromise: Promise<TesseractWorker> | null = null;
  private currentLanguage = 'eng';

  private async getWorker(
    lang = 'eng',
    onProgress?: (progress: OcrProgress) => void,
  ): Promise<TesseractWorker> {
    if (!this.workerPromise || this.currentLanguage !== lang) {
      if (this.workerPromise) {
        const oldWorker = await this.workerPromise;
        await oldWorker.terminate();
      }
      this.currentLanguage = lang;
      this.workerPromise = createWorker(lang, 1, {
        logger: (m: any) => {
          if (onProgress && m && typeof m.progress === 'number') {
            onProgress({
              status: m.status || 'Processing',
              progress: Math.round(m.progress * 100),
            });
          }
        },
      });
    }
    return await this.workerPromise;
  }

  /**
   * Recognize text in an image (DataURL, Blob, or Canvas) locally in the browser.
   */
  async recognize(
    imageSource: string | HTMLCanvasElement | Blob,
    lang = 'eng',
    onProgress?: (progress: OcrProgress) => void,
  ): Promise<OcrResult> {
    try {
      const worker = await this.getWorker(lang, onProgress);
      const res = await worker.recognize(imageSource);
      return {
        text: res.data.text ?? '',
        confidence: res.data.confidence ?? 0,
      };
    } catch (err) {
      console.error('[OcrService] OCR recognition error:', err);
      throw new Error(
        err instanceof Error
          ? err.message
          : 'Could not perform text recognition on document.',
      );
    }
  }

  async ngOnDestroy(): Promise<void> {
    if (this.workerPromise) {
      try {
        const worker = await this.workerPromise;
        await worker.terminate();
      } catch {}
      this.workerPromise = null;
    }
  }
}
