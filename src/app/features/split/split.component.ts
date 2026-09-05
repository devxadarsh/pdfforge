import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { PDFDocument } from 'pdf-lib';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../core/models/file.models';
import { PdfWorkerService } from '../../core/services/worker/pdf-worker.service';
import { DownloadService } from '../../core/services/download/download.service';
import { ToastService } from '../../core/services/toast.service';
import { parsePageRange } from '../../core/models/export.models';
import { formatBytes } from '../../core/utilities/file.util';

@Component({
  selector: 'app-split',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, FileDropzoneComponent],
  templateUrl: './split.component.html',
  styleUrl: './split.component.scss',
})
export class SplitComponent {
  private readonly worker = inject(PdfWorkerService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);

  readonly mode = signal<'every' | 'range'>('every');
  readonly range = signal('1-3, 5');
  readonly loadedFile = signal<LoadedFile | null>(null);
  readonly pageCount = signal<number>(0);
  readonly splitting = signal<boolean>(false);
  protected readonly formatBytes = formatBytes;

  setMode(m: 'every' | 'range'): void {
    this.mode.set(m);
  }

  applyPreset(type: 'all' | 'odd' | 'even' | 'first-half'): void {
    const total = this.pageCount();
    if (total <= 0) return;
    if (type === 'all') {
      this.range.set(`1-${total}`);
    } else if (type === 'odd') {
      const odds = Array.from({ length: total }, (_, i) => i + 1).filter((n) => n % 2 !== 0);
      this.range.set(odds.join(', '));
    } else if (type === 'even') {
      const evens = Array.from({ length: total }, (_, i) => i + 1).filter((n) => n % 2 === 0);
      this.range.set(evens.join(', '));
    } else if (type === 'first-half') {
      const mid = Math.max(1, Math.ceil(total / 2));
      this.range.set(`1-${mid}`);
    }
  }

  async onFileLoaded(files: LoadedFile[]): Promise<void> {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const doc = await PDFDocument.load(file.data, { ignoreEncryption: true });
      this.loadedFile.set(file);
      this.pageCount.set(doc.getPageCount());
      this.toasts.info(`Loaded "${file.name}" (${doc.getPageCount()} pages)`);
    } catch (err) {
      console.error('[SplitComponent] Failed to load PDF:', err);
      this.toasts.error('Failed to parse PDF document.');
    }
  }

  clearFile(): void {
    this.loadedFile.set(null);
    this.pageCount.set(0);
  }

  async split(): Promise<void> {
    const file = this.loadedFile();
    const total = this.pageCount();
    if (!file || total <= 0) {
      this.toasts.warning('Please select a valid PDF to split.');
      return;
    }

    let ranges: number[][] = [];
    if (this.mode() === 'every') {
      ranges = Array.from({ length: total }, (_, i) => [i]);
    } else {
      const parts = this.range()
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      for (const part of parts) {
        const indices = parsePageRange(part, total);
        if (indices.length > 0) {
          ranges.push(indices);
        }
      }

      if (ranges.length === 0) {
        this.toasts.warning(`Please specify valid page ranges between 1 and ${total}.`);
        return;
      }
    }

    this.splitting.set(true);
    try {
      const sourceBytes = new Uint8Array(file.data);
      const results = await this.worker.splitPdf(sourceBytes, ranges);

      if (results.length === 0) {
        this.toasts.warning('No pages were extracted.');
        return;
      }

      const baseName = file.name.replace(/\.pdf$/i, '');
      for (let i = 0; i < results.length; i++) {
        const splitBytes = results[i];
        const blob = new Blob([splitBytes as BlobPart], { type: 'application/pdf' });
        const partLabel = this.mode() === 'every' ? `page-${i + 1}` : `part-${i + 1}`;
        this.downloads.download(blob, `${baseName}-${partLabel}.pdf`);
        // Small delay if multiple downloads to allow browser download queue
        if (results.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
      }

      this.toasts.success(`Successfully split into ${results.length} document(s)!`);
    } catch (err) {
      console.error('[SplitComponent] Split failed:', err);
      this.toasts.error(err instanceof Error ? err.message : 'Failed to split PDF.');
    } finally {
      this.splitting.set(false);
    }
  }
}
