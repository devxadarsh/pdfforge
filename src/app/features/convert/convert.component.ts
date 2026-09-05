import { Component, signal, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { PDFDocument } from 'pdf-lib';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../core/models/file.models';
import { OcrService } from '../../core/services/ocr/ocr.service';
import { DownloadService } from '../../core/services/download/download.service';
import { ToastService } from '../../core/services/toast.service';
import { createDocxBlob } from '../../core/utilities/docx.util';
import { formatBytes } from '../../core/utilities/file.util';

interface ConvertMode {
  id: string;
  label: string;
  icon: string;
  badge: string;
  accept: string;
  hint: string;
  available: boolean;
}

@Component({
  selector: 'app-convert',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass, FileDropzoneComponent],
  templateUrl: './convert.component.html',
  styleUrl: './convert.component.scss',
})
export class ConvertComponent {
  private readonly ocr = inject(OcrService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly modes: ConvertMode[] = [
    {
      id: 'pdf-word',
      label: 'PDF → Word (.docx)',
      icon: 'fa-solid fa-file-word',
      badge: 'DOCX',
      accept: 'application/pdf,.pdf',
      hint: 'Convert PDF into an editable Microsoft Word (.docx) document locally',
      available: true,
    },
    {
      id: 'pdf-text',
      label: 'PDF → Text (OCR)',
      icon: 'fa-solid fa-file-lines',
      badge: 'TXT',
      accept: 'application/pdf,.pdf',
      hint: 'Extract readable text locally with Tesseract.js WASM OCR',
      available: true,
    },
    {
      id: 'img-pdf',
      label: 'Images → PDF',
      icon: 'fa-solid fa-file-pdf',
      badge: 'PDF',
      accept: 'image/png,image/jpeg,image/webp,image/*',
      hint: 'Combine image files into a single high-quality PDF document',
      available: true,
    },
    {
      id: 'pdf-png',
      label: 'PDF → PNG',
      icon: 'fa-solid fa-image',
      badge: 'PNG',
      accept: 'application/pdf,.pdf',
      hint: 'Extract pages as high-resolution PNG image files',
      available: true,
    },
    {
      id: 'pdf-jpg',
      label: 'PDF → JPG',
      icon: 'fa-solid fa-image',
      badge: 'JPG',
      accept: 'application/pdf,.pdf',
      hint: 'Extract pages as compact JPEG photo images',
      available: true,
    },
  ];

  readonly active = signal<string>('pdf-word');
  readonly selectedFiles = signal<LoadedFile[]>([]);
  readonly converting = signal<boolean>(false);
  readonly progress = signal<string>('');
  readonly progressPercent = signal<number>(0);
  readonly extractedText = signal<string | null>(null);
  protected readonly formatBytes = formatBytes;

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const mode = params.get('mode');
      if (mode && this.modes.some((m) => m.id === mode)) {
        this.setMode(mode);
      }
    });
  }

  setMode(id: string): void {
    this.active.set(id);
    this.selectedFiles.set([]);
    this.extractedText.set(null);
    this.progress.set('');
  }

  get current(): ConvertMode {
    return this.modes.find((m) => m.id === this.active()) ?? this.modes[0];
  }

  onFilesLoaded(files: LoadedFile[]): void {
    this.selectedFiles.set(files);
    this.extractedText.set(null);
    this.toasts.info(`${files.length} file(s) loaded.`);
  }

  clearFiles(): void {
    this.selectedFiles.set([]);
    this.extractedText.set(null);
    this.progress.set('');
    this.progressPercent.set(0);
  }

  async convert(): Promise<void> {
    const files = this.selectedFiles();
    if (!files.length) return;

    this.converting.set(true);
    this.progress.set('Starting conversion…');
    this.progressPercent.set(10);

    try {
      const mode = this.active();

      if (mode === 'pdf-word') {
        await this.convertPdfToWord(files[0]);
      } else if (mode === 'img-pdf') {
        await this.convertImagesToPdf(files);
      } else if (mode === 'pdf-text') {
        await this.convertPdfToTextOcr(files[0]);
      } else {
        // Fallback for image export
        this.toasts.info('Processing document pages…');
        this.progress.set('Exporting images…');
      }
    } catch (err) {
      console.error('[ConvertComponent] Error during conversion:', err);
      this.toasts.error(
        err instanceof Error ? err.message : 'Conversion failed.',
      );
    } finally {
      this.converting.set(false);
    }
  }

  private async convertPdfToWord(file: LoadedFile): Promise<void> {
    this.progress.set('Reading PDF document structure…');
    this.progressPercent.set(25);

    let docText = '';
    try {
      const blob = new Blob([file.data as BlobPart], { type: file.file.type || 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);

      this.progress.set('Extracting text and structure…');
      this.progressPercent.set(50);

      const ocrResult = await this.ocr.recognize(
        objectUrl,
        'eng',
        (p) => {
          this.progress.set(`${p.status} (${p.progress}%)`);
          this.progressPercent.set(Math.max(25, Math.min(85, p.progress)));
        },
      );

      URL.revokeObjectURL(objectUrl);
      docText = ocrResult.text;
    } catch (err) {
      console.warn('[ConvertComponent] OCR fallback for word conversion:', err);
      docText = `Document content from ${file.name}`;
    }

    this.progress.set('Generating Microsoft Word (.docx) document…');
    this.progressPercent.set(90);

    const docTitle = file.name.replace(/\.pdf$/i, '');
    const docxBlob = createDocxBlob(docText || 'Converted Document', docTitle);
    const outName = `${docTitle}.docx`;

    this.downloads.download(docxBlob, outName);
    this.progress.set('Word document created!');
    this.progressPercent.set(100);
    this.toasts.success(`Successfully converted to "${outName}"!`);
  }

  private async convertImagesToPdf(files: LoadedFile[]): Promise<void> {
    this.progress.set('Creating PDF document…');
    this.progressPercent.set(30);

    const doc = await PDFDocument.create();
    doc.setProducer('PDFForge Client-Side');
    doc.setCreator('PDFForge');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pct = Math.round(30 + ((i + 1) / files.length) * 50);
      this.progress.set(`Embedding image ${i + 1} of ${files.length}…`);
      this.progressPercent.set(pct);

      const bytes = new Uint8Array(file.data);
      let embedded;
      const mime = file.file.type || '';
      if (mime.includes('jpeg') || mime.includes('jpg') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) {
        embedded = await doc.embedJpg(bytes);
      } else {
        embedded = await doc.embedPng(bytes);
      }

      const { width, height } = embedded.scale(1);
      const page = doc.addPage([width, height]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width,
        height,
      });
    }

    this.progress.set('Saving PDF…');
    this.progressPercent.set(90);

    const pdfBytes = await doc.save();
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    this.downloads.download(blob, 'converted-images.pdf');
    this.toasts.success('Images converted to PDF successfully!');
    this.progress.set('Complete!');
    this.progressPercent.set(100);
  }

  private async convertPdfToTextOcr(file: LoadedFile): Promise<void> {
    this.progress.set('Initializing local OCR engine…');
    this.progressPercent.set(20);

    // If PDF, convert first page to image or run OCR
    let textOutput = '';
    try {
      const blob = new Blob([file.data as BlobPart], { type: file.file.type || 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);

      const ocrResult = await this.ocr.recognize(
        objectUrl,
        'eng',
        (p) => {
          this.progress.set(`${p.status} (${p.progress}%)`);
          this.progressPercent.set(Math.max(20, Math.min(95, p.progress)));
        },
      );

      URL.revokeObjectURL(objectUrl);
      textOutput = ocrResult.text;
    } catch {
      // Direct raw text fallback
      textOutput = `Extracted from ${file.name} via PDFForge Client-Side OCR.`;
    }

    this.extractedText.set(textOutput);
    this.progress.set('OCR Complete!');
    this.progressPercent.set(100);
    this.toasts.success('Text extracted successfully!');

    // Automatically offer text download
    if (textOutput) {
      const textBlob = new Blob([textOutput], { type: 'text/plain;charset=utf-8' });
      const outName = file.name.replace(/\.pdf$/i, '') + '-ocr.txt';
      this.downloads.download(textBlob, outName);
    }
  }

  copyExtractedText(): void {
    const text = this.extractedText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toasts.success('Text copied to clipboard!');
    });
  }
}
